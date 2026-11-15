import type {} from 'phaser';
import {
  FIRST_LEVEL_DEFINITION,
} from '../../core/first-level.ts';
import type {
  GrayboxPhysics,
  TemporaryObjectFreezeResult,
  TemporaryObjectReleaseResult,
} from '../../core/graybox.ts';
import { PLAYER_PROTOTYPE, type PlayerState } from '../../core/player.ts';
import {
  type PermanentEffectSnapshot,
} from '../../core/progress.ts';
import {
  type FailureZoneSnapshot,
  type RecoveryAnchorValidationResult,
  type RecoveryWorldValidationIssue,
  type RecoveryWorldValidationResult,
} from '../../core/recovery.ts';
import {
  GRAYBOX_CHECKPOINT_TRIGGERS,
  type CheckpointTriggerOccupancySnapshot,
} from '../../core/checkpoint-triggers.ts';
import type {
  MovingPlatformLogicalState,
  SnapshotAnchor,
  SnapshotScenario,
  TemporarySnapshotObject,
} from '../../core/snapshot.ts';
import type { MatterLibrary } from './graybox-world.ts';
import {
  validatePrototypeLevelDefinition,
  type PrototypeLevelDefinition,
} from '../../core/prototype-level.ts';

type Pair = {
  isActive: boolean;
  isSensor: boolean;
  bodyA: MatterJS.BodyType;
  bodyB: MatterJS.BodyType;
  collision: { normal: { x: number; y: number } };
};

export const FIRST_LEVEL_SIZE = FIRST_LEVEL_DEFINITION.size;
export const FIRST_LEVEL_SPAWN: SnapshotAnchor =
  FIRST_LEVEL_DEFINITION.spawn;
export const FIRST_LEVEL_FAILURE_ZONE = Object.freeze({
  zoneId: FIRST_LEVEL_DEFINITION.failureZone.zoneId,
  label: FIRST_LEVEL_DEFINITION.failureZone.label,
  x: FIRST_LEVEL_DEFINITION.failureZone.x,
  y: FIRST_LEVEL_DEFINITION.failureZone.y,
  width: FIRST_LEVEL_DEFINITION.failureZone.width,
  height: FIRST_LEVEL_DEFINITION.failureZone.height,
});
export const FIRST_LEVEL_LIFT = FIRST_LEVEL_DEFINITION.lift;
export const FIRST_LEVEL_ROUTE_GATE =
  FIRST_LEVEL_DEFINITION.routeGate;

const PLAYER_CATEGORY = 0x0002;
const ROUTE_GATE_CATEGORY = 0x0010;
const FAILURE_ZONE_CATEGORY = 0x0040;
const TOP_TOLERANCE_PX = 4;
const POSITION_EPSILON = 0.01;
const MOTION_EPSILON = 0.01;

type LiftRuntime = {
  body: MatterJS.BodyType;
  deltaX: number;
  deltaY: number;
  vx: number;
  vy: number;
  direction: -1 | 1;
  phase: number;
  cycle: number;
};

type FailureRuntime = {
  occupied: boolean;
  occupiedSteps: number;
  lastOccupiedSteps: number;
  enterCount: number;
  exitCount: number;
  lastTransitionTick: number | null;
  enteredThisStep: boolean;
};

export type FirstLevelMatterDiagnostics = Readonly<{
  lift: Readonly<{
    label: string;
    x: number;
    y: number;
    width: number;
    height: number;
    vx: number;
    vy: number;
    direction: -1 | 1;
    phase: number;
    cycle: number;
    active: boolean;
  }>;
  platformClockMs: number;
  routeOpen: boolean;
  gateMask: number;
  failureZone: FailureZoneSnapshot;
  supportRelativeX: number | null;
  supportRelativeY: number | null;
  frozenObjectIds: readonly string[];
}>;

// Dedicated D12-A1 Matter adapter. It shares the player contract, fixed-step
// loop and recovery interfaces with the laboratory, while owning its level ID,
// geometry, business effects and initial snapshot registry.
export class FirstLevelMatterWorld implements GrayboxPhysics {
  readonly terrain: MatterJS.BodyType[] = [];
  readonly player!: MatterJS.BodyType;
  readonly foot!: MatterJS.BodyType;
  readonly routeGate!: MatterJS.BodyType;
  readonly failureZoneBody!: MatterJS.BodyType;
  readonly snapshotScenario: SnapshotScenario;
  readonly spawnAnchor: SnapshotAnchor;
  readonly definition: PrototypeLevelDefinition;
  readonly #matter: MatterLibrary;
  readonly #engine: MatterJS.Engine;
  readonly #advance: (deltaMs: number) => void;
  readonly #gravity: { x: number; y: number; scale: number };
  readonly #originalGravity: Readonly<{ x: number; y: number; scale: number }>;
  readonly #ownedBodies = new Set<MatterJS.BodyType>();
  readonly #lift: LiftRuntime;
  readonly #recoveryPosition: { x: number; y: number };
  readonly #failure: FailureRuntime = {
    occupied: false,
    occupiedSteps: 0,
    lastOccupiedSteps: 0,
    enterCount: 0,
    exitCount: 0,
    lastTransitionTick: null,
    enteredThisStep: false,
  };
  #platformClockMs = 0;
  #liftActive = false;
  #driveVelocity = { x: 0, y: 0 };
  #carriedByLift = false;
  #lastSimulationTick = 0;
  #state: PlayerState;
  #steps = 0;
  #managedWorldRebuildCount = 0;
  #temporaryObjectFreezeOwner?: object;
  #frozenTemporaryObjectIds: readonly string[] = Object.freeze([]);
  #disposeError: Error | null = null;
  #disposed = false;
  #terminated = false;
  #gravityRestored = false;

  constructor(
    matter: MatterLibrary,
    engine: MatterJS.Engine,
    advance: (deltaMs: number) => void,
    definitionInput: unknown = FIRST_LEVEL_DEFINITION,
  ) {
    // Layout validation is deliberately before the first Body creation. The
    // adapter rejects an incomplete or unsupported map instead of filling it
    // with first-level defaults.
    this.definition = validatePrototypeLevelDefinition(definitionInput);
    this.#matter = matter;
    this.#engine = engine;
    this.#advance = advance;
    this.snapshotScenario = this.definition.snapshotScenario;
    this.spawnAnchor = this.definition.spawn;
    this.#state = createInitialState(
      this.definition.spawn.x,
      this.definition.spawn.y,
    );
    this.#recoveryPosition = {
      x: this.definition.lift.x,
      y: this.definition.lift.fromY,
    };
    const gravity = (
      engine as unknown as {
        gravity: { x: number; y: number; scale: number };
      }
    ).gravity;
    this.#gravity = gravity;
    this.#originalGravity = Object.freeze({
      x: gravity.x,
      y: gravity.y,
      scale: gravity.scale,
    });
    try {
      Object.assign(gravity, { x: 0, y: 1.4, scale: 0.001 });

      const createRectangle = (
        object: Readonly<{
          x: number;
          y: number;
          width: number;
          height: number;
          label: string;
        }>,
      ) => {
        const body = matter.Bodies.rectangle(
          object.x,
          object.y,
          object.width,
          object.height,
          {
            isStatic: true,
            friction: 1,
            label: object.label,
          },
        );
        this.#trackBody(body);
        return body;
      };

      // The route, support tolerances and movement algorithm are unchanged;
      // every coordinate and identity comes from this instance's definition.
      for (const terrain of this.definition.terrain) {
        this.terrain.push(createRectangle(terrain));
      }

      const routeGate = createRectangle(this.definition.routeGate);
      routeGate.collisionFilter = {
        category: ROUTE_GATE_CATEGORY,
        mask: PLAYER_CATEGORY,
        group: 0,
      };
      this.routeGate = routeGate;
      this.terrain.push(routeGate);

      const liftBody = createRectangle({
        x: this.definition.lift.x,
        y: this.definition.lift.fromY,
        width: this.definition.lift.width,
        height: this.definition.lift.height,
        label: this.definition.lift.label,
      });
      this.#lift = {
        body: liftBody,
        deltaX: 0,
        deltaY: 0,
        vx: 0,
        vy: 0,
        direction: 1,
        phase: 0,
        cycle: 0,
      };

      const failureZoneBody = matter.Bodies.rectangle(
        this.definition.failureZone.x,
        this.definition.failureZone.y,
        this.definition.failureZone.width,
        this.definition.failureZone.height,
        {
          isStatic: true,
          isSensor: true,
          label: this.definition.failureZone.objectId,
          collisionFilter: {
            category: FAILURE_ZONE_CATEGORY,
            mask: PLAYER_CATEGORY,
            group: 0,
          },
        },
      );
      this.#trackBody(failureZoneBody);
      this.failureZoneBody = failureZoneBody;

      const player = matter.Bodies.rectangle(
        this.definition.spawn.x,
        this.definition.spawn.y,
        PLAYER_PROTOTYPE.width,
        PLAYER_PROTOTYPE.height,
        {
          label: this.definition.bodyLabels.player,
          friction: 0,
          frictionStatic: 2,
          frictionAir: 0,
          restitution: 0,
          chamfer: { radius: 3 },
          collisionFilter: {
            category: PLAYER_CATEGORY,
            mask: -1,
            group: 0,
          },
        },
      );
      matter.Body.setInertia(player, Infinity);
      this.#trackBody(player);
      this.player = player;

      const foot = matter.Bodies.rectangle(
        this.definition.spawn.x,
        this.definition.spawn.y + PLAYER_PROTOTYPE.height / 2 + 1,
        22,
        8,
        {
          isSensor: true,
          isStatic: true,
          label: this.definition.bodyLabels.foot,
          collisionFilter: {
            category: PLAYER_CATEGORY,
            mask: -1,
            group: 0,
          },
        },
      );
      this.#trackBody(foot);
      this.foot = foot;

      for (const body of [
        ...this.terrain,
        liftBody,
        this.failureZoneBody,
        this.player,
      ]) {
        matter.Composite.add(
          engine.world as unknown as MatterJS.CompositeType,
          body,
        );
      }
      this.#synchronizeFailureBaseline();
    } catch (error) {
      this.#terminated = true;
      try {
        this.#removeOwnedBodies();
        this.#restoreGravity();
      } catch (cleanupError) {
        throw new AggregateError(
          [error, cleanupError],
          'FirstLevelMatterWorld construction failed and cleanup was incomplete.',
        );
      }
      throw error;
    }
  }

  drive(vx: number, vy: number): void {
    if (this.#terminated) return;
    this.#driveVelocity = { x: vx, y: vy };
    this.player.friction =
      this.#state.grounded && Math.abs(vx) < 0.01 ? 1 : 0;
  }

  setPermanentEffect(effectId: string, expectedActive: boolean): void {
    if (this.#terminated || effectId !== this.definition.routeEffectId) {
      return;
    }
    this.#liftActive = expectedActive;
    this.routeGate.collisionFilter.mask = expectedActive ? 0 : PLAYER_CATEGORY;
    this.#matter.Composite.setModified(
      this.#engine.world as unknown as MatterJS.CompositeType,
      true,
      false,
      true,
    );
  }

  freezeTemporaryObjects(
    objectIds: readonly string[],
    owner: object,
  ): TemporaryObjectFreezeResult {
    if (this.#terminated) {
      return Object.freeze({
        status: 'busy' as const,
        frozenObjectIds: this.#frozenTemporaryObjectIds,
      });
    }
    if (owner === null || typeof owner !== 'object') {
      throw new TypeError('Temporary-object freeze owner must be an object.');
    }
    if (
      objectIds.length !== 1 ||
      objectIds[0] !== this.definition.lift.objectId
    ) {
      throw new Error('Freeze must cover the exact level registry.');
    }
    if (this.#temporaryObjectFreezeOwner) {
      return Object.freeze({
        status:
          this.#temporaryObjectFreezeOwner === owner
            ? 'existing' as const
            : 'busy' as const,
        frozenObjectIds: this.#frozenTemporaryObjectIds,
      });
    }
    this.#temporaryObjectFreezeOwner = owner;
    this.#frozenTemporaryObjectIds = Object.freeze([
      this.definition.lift.objectId,
    ]);
    this.#lift.deltaX = this.#lift.deltaY = this.#lift.vx = this.#lift.vy = 0;
    this.#matter.Body.setVelocity(this.#lift.body, { x: 0, y: 0 });
    return Object.freeze({
      status: 'frozen' as const,
      frozenObjectIds: this.#frozenTemporaryObjectIds,
    });
  }

  releaseTemporaryObjects(owner: object): TemporaryObjectReleaseResult {
    if (this.#terminated) {
      return Object.freeze({
        status: 'owner-mismatch' as const,
        releasedObjectIds: Object.freeze([]),
      });
    }
    if (!this.#temporaryObjectFreezeOwner) {
      return Object.freeze({
        status: 'already-released' as const,
        releasedObjectIds: Object.freeze([]),
      });
    }
    if (this.#temporaryObjectFreezeOwner !== owner) {
      return Object.freeze({
        status: 'owner-mismatch' as const,
        releasedObjectIds: Object.freeze([]),
      });
    }
    const releasedObjectIds = this.#frozenTemporaryObjectIds;
    this.#temporaryObjectFreezeOwner = undefined;
    this.#frozenTemporaryObjectIds = Object.freeze([]);
    return Object.freeze({
      status: 'released' as const,
      releasedObjectIds,
    });
  }

  isTemporaryObjectChangeAllowed(objectId: string): boolean {
    if (this.#terminated) return false;
    return !this.#temporaryObjectFreezeOwner ||
      !this.#frozenTemporaryObjectIds.includes(objectId);
  }

  get frozenTemporaryObjectIds(): readonly string[] {
    return this.#frozenTemporaryObjectIds;
  }

  captureTemporaryObject(objectId: string): MovingPlatformLogicalState {
    if (this.#terminated) {
      throw new Error('Cannot capture a disposed level world.');
    }
    if (objectId !== this.definition.lift.objectId) {
      throw new Error(`Unknown level snapshot object: ${objectId}.`);
    }
    return Object.freeze({
      axis: 'vertical' as const,
      clockMs: this.#platformClockMs,
      position: Object.freeze({
        x: this.#lift.body.position.x,
        y: this.#lift.body.position.y,
      }),
      direction: this.#lift.direction,
      phase: this.#lift.phase,
      cycle: this.#lift.cycle,
    });
  }

  applyTemporarySnapshot(objects: readonly TemporarySnapshotObject[]): void {
    if (this.#terminated) return;
    if (
      objects.length !== 1 ||
      objects[0]?.objectId !== this.definition.lift.objectId ||
      objects[0]?.state.axis !== 'vertical'
    ) {
      throw new Error('Recovery snapshot does not match the level lift.');
    }
    const state = objects[0].state;
    this.#recoveryPosition.x = state.position.x;
    this.#recoveryPosition.y = state.position.y;
    this.#lift.direction = state.direction;
    this.#lift.phase = state.phase;
    this.#lift.cycle = state.cycle;
    this.#lift.deltaX = this.#lift.deltaY = this.#lift.vx = this.#lift.vy = 0;
    this.#platformClockMs = state.clockMs;
    this.#driveVelocity = { x: 0, y: 0 };
    this.#carriedByLift = false;
  }

  rebuildRecoveryWorld(): void {
    if (this.#terminated) return;
    const world = this.#engine.world as unknown as MatterJS.CompositeType;
    this.#matter.Composite.remove(world, this.#lift.body);
    this.#ownedBodies.delete(this.#lift.body);
    const body = this.#matter.Bodies.rectangle(
      this.#recoveryPosition.x,
      this.#recoveryPosition.y,
      this.definition.lift.width,
      this.definition.lift.height,
      {
        isStatic: true,
        friction: 1,
        label: this.definition.lift.label,
      },
    );
    this.#trackBody(body);
    this.#lift.body = body;
    this.#lift.deltaX = this.#lift.deltaY = this.#lift.vx = this.#lift.vy = 0;
    this.#matter.Body.setVelocity(body, { x: 0, y: 0 });
    this.#matter.Composite.add(world, body);
    this.#matter.Engine.clear(this.#engine);
    this.#matter.Composite.setModified(world, true, false, true);
    this.#managedWorldRebuildCount++;
  }

  validateRecoveryWorld(
    objects: readonly TemporarySnapshotObject[],
    expectedPermanentEffects: readonly PermanentEffectSnapshot[],
  ): RecoveryWorldValidationResult {
    const critical: RecoveryWorldValidationIssue[] = [];
    const fail = (code: string, message: string) => {
      critical.push(Object.freeze({ code, message }));
    };
    if (this.#terminated) {
      fail('world-disposed', '物理关卡实例已经终止，不能执行恢复校验。');
      return Object.freeze({
        status: 'invalid' as const,
        critical: Object.freeze(critical),
        warnings: Object.freeze([]),
      });
    }
    const bodies = this.#matter.Composite.allBodies(
      this.#engine.world as unknown as MatterJS.CompositeType,
    );
    const bodySet = new Set(bodies);
    if (
      objects.length !== 1 ||
      objects[0]?.objectId !== this.definition.lift.objectId
    ) {
      fail(
        'temporary-object-set-mismatch',
        `关卡恢复快照必须且只能登记 ${this.definition.lift.objectId}。`,
      );
    } else {
      const expected = objects[0];
      if (!bodySet.has(this.#lift.body)) {
        fail(
          'required-platform-body-missing',
          '升降平台的真实碰撞体不在 Matter World。',
        );
      }
      if (
        this.#platformClockMs !== expected.state.clockMs ||
        this.#lift.direction !== expected.state.direction ||
        this.#lift.phase !== expected.state.phase ||
        this.#lift.cycle !== expected.state.cycle
      ) {
        fail(
          'platform-logical-state-mismatch',
          '升降平台逻辑状态与恢复快照不一致。',
        );
      }
      if (
        Math.abs(this.#lift.body.position.x - expected.state.position.x) >
          POSITION_EPSILON ||
        Math.abs(this.#lift.body.position.y - expected.state.position.y) >
          POSITION_EPSILON
      ) {
        fail(
          'platform-body-position-mismatch',
          '升降平台碰撞位置与恢复状态不一致。',
        );
      }
    }
    for (const body of [
      ...this.terrain,
      this.routeGate,
      this.failureZoneBody,
    ]) {
      if (!bodySet.has(body)) {
        fail(
          'required-world-body-missing',
          `关卡必要 Body ${body.label} 不在 Matter World。`,
        );
      }
    }
    const routeExpected = expectedPermanentEffects.some(effect =>
      effect.id === this.definition.routeEffectId &&
      effect.expectedActive);
    const gateOpen = this.routeGate.collisionFilter.mask === 0;
    if (this.#liftActive !== routeExpected || gateOpen !== routeExpected) {
      fail(
        'permanent-route-effect-mismatch',
        `关卡路线永久期望 ${routeExpected ? 'OPEN' : 'CLOSED'}，` +
          `平台 ${this.#liftActive ? 'ACTIVE' : 'OFF'}，门 ` +
          `${gateOpen ? 'OPEN' : 'CLOSED'}。`,
      );
    }
    return Object.freeze({
      status: critical.length === 0 ? 'valid' as const : 'invalid' as const,
      critical: Object.freeze(critical),
      warnings: Object.freeze([]),
    });
  }

  validateRecoveryAnchor(
    anchor: SnapshotAnchor,
    _checkpointId: string,
  ): RecoveryAnchorValidationResult {
    if (this.#terminated) {
      return Object.freeze({
        status: 'invalid' as const,
        reason: 'level world has been disposed',
        blockerLabels: Object.freeze([]),
      });
    }
    const m = this.#matter;
    const bodies = m.Composite.allBodies(
      this.#engine.world as unknown as MatterJS.CompositeType,
    );
    const probe = m.Bodies.rectangle(
      anchor.x,
      anchor.y,
      PLAYER_PROTOTYPE.width,
      PLAYER_PROTOTYPE.height,
      {
        isSensor: true,
        label: this.definition.bodyLabels.anchorProbe,
        collisionFilter: {
          category: PLAYER_CATEGORY,
          mask: -1,
          group: 0,
        },
      },
    );
    if (m.Query.collides(probe, [this.failureZoneBody]).length > 0) {
      return Object.freeze({
        status: 'invalid' as const,
        reason: 'player body overlaps the level failure zone',
        blockerLabels: Object.freeze([this.failureZoneBody.label]),
      });
    }
    const blockers = m.Query.collides(probe, bodies)
      .map(collision =>
        collision.bodyA === probe ? collision.bodyB : collision.bodyA)
      .filter(body => !body.isSensor && collisionAllowed(probe, body))
      .map(body => body.label);
    if (blockers.length > 0) {
      return Object.freeze({
        status: 'invalid' as const,
        reason: 'player body overlaps a solid object',
        blockerLabels: Object.freeze(blockers),
      });
    }
    const supportProbe = m.Bodies.rectangle(
      anchor.x,
      anchor.y + PLAYER_PROTOTYPE.height / 2 + 5,
      22,
      12,
      {
        isSensor: true,
        label: this.definition.bodyLabels.supportProbe,
        collisionFilter: {
          category: PLAYER_CATEGORY,
          mask: -1,
          group: 0,
        },
      },
    );
    const support = m.Query.collides(supportProbe, bodies)
      .map(collision =>
        collision.bodyA === supportProbe ? collision.bodyB : collision.bodyA)
      .find(body =>
        !body.isSensor &&
        collisionAllowed(supportProbe, body) &&
        body.bounds.min.y >=
          anchor.y + PLAYER_PROTOTYPE.height / 2 - TOP_TOLERANCE_PX &&
        body.bounds.min.y <=
          anchor.y + PLAYER_PROTOTYPE.height / 2 + 12);
    return support
      ? Object.freeze({
        status: 'valid' as const,
        support: support.label,
        blockerLabels: Object.freeze([]),
      })
      : Object.freeze({
        status: 'invalid' as const,
        reason: 'no effective non-sensor support below the fixed anchor',
        blockerLabels: Object.freeze([]),
      });
  }

  placePlayerAtAnchor(anchor: SnapshotAnchor): void {
    if (this.#terminated) return;
    const m = this.#matter;
    m.Body.setPosition(this.player, { x: anchor.x, y: anchor.y });
    m.Body.setAngle(this.player, 0);
    m.Body.setVelocity(this.player, { x: 0, y: 0 });
    m.Body.setAngularVelocity(this.player, 0);
    this.player.force.x = this.player.force.y = 0;
    this.player.torque = 0;
    const impulse = (
      this.player as MatterJS.BodyType &
      { positionImpulse: { x: number; y: number } }
    ).positionImpulse;
    impulse.x = impulse.y = 0;
    m.Body.setPosition(this.foot, {
      x: anchor.x,
      y: anchor.y + PLAYER_PROTOTYPE.height / 2 + 1,
    });
    this.#driveVelocity = { x: 0, y: 0 };
    this.#carriedByLift = false;
    m.Engine.clear(this.#engine);
    m.Composite.setModified(
      this.#engine.world as unknown as MatterJS.CompositeType,
      true,
      false,
      true,
    );
    this.#state = createInitialState(anchor.x, anchor.y);
  }

  synchronizeRecoveryOccupancy(tick: number): void {
    if (this.#terminated) return;
    const occupied = this.#matter.Query.collides(
      this.player,
      [this.failureZoneBody],
    ).length > 0;
    if (occupied !== this.#failure.occupied) {
      this.#failure.lastTransitionTick = tick;
    }
    this.#failure.occupied = occupied;
    this.#failure.occupiedSteps = occupied
      ? this.#failure.occupiedSteps + 1
      : 0;
    if (!occupied) this.#failure.lastOccupiedSteps = 0;
    this.#failure.enteredThisStep = false;
  }

  step(deltaMs: number, tick: number): void {
    if (this.#terminated) return;
    this.#lastSimulationTick = tick;
    this.#failure.enteredThisStep = false;
    const previousSupport =
      this.#state.support === this.definition.lift.label;
    this.#advanceLift(deltaMs);
    this.#matter.Body.setVelocity(this.player, {
      x: this.#driveVelocity.x / 60,
      y: this.#driveVelocity.y / 60,
    });
    this.#carriedByLift = false;
    if (previousSupport && this.player.velocity.y >= -MOTION_EPSILON) {
      this.#matter.Body.setPosition(this.player, {
        x: this.player.position.x + this.#lift.deltaX,
        y: this.player.position.y + this.#lift.deltaY,
      });
      this.#carriedByLift = true;
    }
    this.#advance(deltaMs);
    this.#steps++;
    const body = this.player;
    this.#matter.Body.setPosition(this.foot, {
      x: body.position.x,
      y: body.position.y + PLAYER_PROTOTYPE.height / 2 + 1,
    });
    const candidates = new Set(
      this.#matter.Query.collides(
        this.foot,
        [...this.terrain, this.#lift.body],
      ).map(collision =>
        collision.bodyA === this.foot
          ? collision.bodyB
          : collision.bodyA),
    );
    const carriedVx = this.#carriedByLift
      ? this.#lift.deltaX * 1000 / deltaMs
      : 0;
    const carriedVy = this.#carriedByLift
      ? this.#lift.deltaY * 1000 / deltaMs
      : 0;
    let support = '';
    let normalX = 0;
    let normalY = -1;
    let wall = false;
    let ceiling = false;
    let supportVx = 0;
    let supportVy = 0;
    for (const pair of this.#engine.pairs.list as Pair[]) {
      if (
        !pair.isActive ||
        pair.isSensor ||
        (pair.bodyA !== body && pair.bodyB !== body)
      ) {
        continue;
      }
      const other = pair.bodyA === body ? pair.bodyB : pair.bodyA;
      const sign = pair.bodyA === body ? 1 : -1;
      const nx = sign * pair.collision.normal.x;
      const ny = sign * pair.collision.normal.y;
      if (Math.abs(nx) > 0.7) wall = true;
      if (ny > 0.65) ceiling = true;
      const otherVx =
        other.label === this.definition.lift.label ? this.#lift.vx : 0;
      const otherVy =
        other.label === this.definition.lift.label ? this.#lift.vy : 0;
      const playerVx = body.velocity.x * 60 + carriedVx;
      const playerVy = body.velocity.y * 60 + carriedVy;
      const separatingSpeed =
        (playerVx - otherVx) * nx + (playerVy - otherVy) * ny;
      if (candidates.has(other) && ny < -0.65 && separatingSpeed <= 40) {
        support = other.label;
        normalX = nx;
        normalY = ny;
        supportVx = otherVx;
        supportVy = otherVy;
      }
    }
    const vx = body.velocity.x * 60;
    const vy = body.velocity.y * 60;
    this.#state = {
      x: body.position.x,
      y: body.position.y,
      vx,
      vy,
      worldVx: vx + carriedVx,
      worldVy: vy + carriedVy,
      supportVx,
      supportVy,
      grounded: Boolean(support),
      normalX,
      normalY,
      support,
      wall,
      ceiling,
    };
    this.#updateFailure(tick);
  }

  reset(): void {
    if (this.#terminated) return;
    if (this.#temporaryObjectFreezeOwner) {
      throw new Error(
        'Debug reset is unavailable while checkpoint objects are frozen.',
      );
    }
    const m = this.#matter;
    m.Body.setPosition(this.player, {
      x: this.definition.spawn.x,
      y: this.definition.spawn.y,
    });
    m.Body.setVelocity(this.player, { x: 0, y: 0 });
    m.Body.setAngularVelocity(this.player, 0);
    this.player.force.x = this.player.force.y = 0;
    this.player.torque = 0;
    const impulse = (
      this.player as MatterJS.BodyType &
      { positionImpulse: { x: number; y: number } }
    ).positionImpulse;
    impulse.x = impulse.y = 0;
    m.Body.setPosition(this.#lift.body, {
      x: this.definition.lift.x,
      y: this.definition.lift.fromY,
    });
    m.Body.setVelocity(this.#lift.body, { x: 0, y: 0 });
    this.#lift.deltaX = this.#lift.deltaY = 0;
    this.#lift.vx = this.#lift.vy = 0;
    this.#lift.direction = 1;
    this.#lift.phase = 0;
    this.#lift.cycle = 0;
    this.#platformClockMs = 0;
    this.#liftActive = false;
    this.routeGate.collisionFilter.mask = PLAYER_CATEGORY;
    this.#driveVelocity = { x: 0, y: 0 };
    this.#carriedByLift = false;
    m.Engine.clear(this.#engine);
    m.Composite.setModified(
      this.#engine.world as unknown as MatterJS.CompositeType,
      true,
      false,
      true,
    );
    this.#state = createInitialState(
      this.definition.spawn.x,
      this.definition.spawn.y,
    );
    this.#synchronizeFailureBaseline();
  }

  /**
   * Releases only the Matter resources owned by this adapter. A borrowed
   * Engine is never cleared wholesale, so unrelated sentinel bodies survive.
   */
  dispose(): void {
    if (this.#disposed && !this.#disposeError) return;
    if (this.#temporaryObjectFreezeOwner) {
      throw new Error(
        'Level world disposal is blocked by a temporary-object freeze owner.',
      );
    }
    this.#terminated = true;
    const errors: Error[] = [];
    if (!this.#gravityRestored) {
      try {
        this.#restoreGravity();
      } catch (error) {
        errors.push(asError(error, 'Failed to restore borrowed Engine gravity.'));
      }
    }
    for (const body of [...this.#ownedBodies].reverse()) {
      try {
        this.#matter.Composite.remove(
          this.#engine.world as unknown as MatterJS.CompositeType,
          body,
        );
        this.#ownedBodies.delete(body);
      } catch (error) {
        errors.push(asError(error, `Failed to remove Body ${body.label}.`));
      }
    }
    try {
      this.#matter.Engine.clear(this.#engine);
      this.#matter.Composite.setModified(
        this.#engine.world as unknown as MatterJS.CompositeType,
        true,
        false,
        true,
      );
    } catch (error) {
      errors.push(asError(error, 'Failed to clear disposed Engine broadphase.'));
    }
    if (errors.length > 0) {
      this.#disposed = false;
      this.#disposeError = new AggregateError(
        errors,
        `Level world disposal left ${this.#ownedBodies.size} owned Body resource(s).`,
      );
      throw this.#disposeError;
    }
    this.#disposed = true;
    this.#disposeError = null;
  }

  get disposed(): boolean {
    return this.#disposed && this.#ownedBodies.size === 0;
  }

  get ownedBodyCount(): number {
    return this.#ownedBodies.size;
  }

  get disposeError(): Error | null {
    return this.#disposeError;
  }

  get state(): PlayerState {
    return this.#state;
  }

  get steps(): number {
    return this.#steps;
  }

  get timestamp(): number {
    return this.#engine.timing.timestamp;
  }

  get managedWorldRebuildCount(): number {
    return this.#managedWorldRebuildCount;
  }

  get liftBody(): MatterJS.BodyType {
    return this.#lift.body;
  }

  get platformClockMs(): number {
    return this.#platformClockMs;
  }

  get routeOpen(): boolean {
    return this.#liftActive;
  }

  get checkpointTriggers(): readonly CheckpointTriggerOccupancySnapshot[] {
    // D12-A1 uses only the committed initial snapshot. These disabled entries
    // preserve the shared checkpoint coordinator contract without exposing new
    // playable checkpoints in the first level.
    return GRAYBOX_CHECKPOINT_TRIGGERS.map(definition =>
      Object.freeze({
        triggerId: definition.triggerId,
        occupied: false,
        occupiedSteps: 0,
        lastOccupiedSteps: 0,
        enterCount: 0,
        exitCount: 0,
        lastTransitionTick: null,
      }));
  }

  get checkpointTriggersEnabled(): boolean {
    return false;
  }

  get failureZone(): FailureZoneSnapshot {
    return Object.freeze({
      zoneId: this.definition.failureZone.zoneId,
      label: this.definition.failureZone.label,
      x: this.definition.failureZone.x,
      y: this.definition.failureZone.y,
      width: this.definition.failureZone.width,
      height: this.definition.failureZone.height,
      occupied: this.#failure.occupied,
      occupiedSteps: this.#failure.occupiedSteps,
      lastOccupiedSteps: this.#failure.lastOccupiedSteps,
      enterCount: this.#failure.enterCount,
      exitCount: this.#failure.exitCount,
      lastTransitionTick: this.#failure.lastTransitionTick,
      enteredThisStep: this.#failure.enteredThisStep,
    });
  }

  get diagnostics(): FirstLevelMatterDiagnostics {
    return Object.freeze({
      lift: Object.freeze({
        label: this.definition.lift.label,
        x: this.#lift.body.position.x,
        y: this.#lift.body.position.y,
        width: this.definition.lift.width,
        height: this.definition.lift.height,
        vx: this.#lift.vx,
        vy: this.#lift.vy,
        direction: this.#lift.direction,
        phase: this.#lift.phase,
        cycle: this.#lift.cycle,
        active: this.#liftActive,
      }),
      platformClockMs: this.#platformClockMs,
      routeOpen: this.#liftActive,
      gateMask: this.routeGate.collisionFilter.mask,
      failureZone: this.failureZone,
      supportRelativeX:
        this.#state.support === this.definition.lift.label
          ? this.#state.x - this.#lift.body.position.x
          : null,
      supportRelativeY:
        this.#state.support === this.definition.lift.label
          ? this.#state.y - this.#lift.body.position.y
          : null,
      frozenObjectIds: this.frozenTemporaryObjectIds,
    });
  }

  #trackBody(body: MatterJS.BodyType): void {
    this.#ownedBodies.add(body);
  }

  #removeOwnedBodies(): void {
    const errors: Error[] = [];
    for (const body of [...this.#ownedBodies].reverse()) {
      try {
        this.#matter.Composite.remove(
          this.#engine.world as unknown as MatterJS.CompositeType,
          body,
        );
        this.#ownedBodies.delete(body);
      } catch (error) {
        errors.push(asError(error, `Failed to remove Body ${body.label}.`));
      }
    }
    if (errors.length > 0) {
      throw new AggregateError(errors, 'Owned Body cleanup was incomplete.');
    }
  }

  #restoreGravity(): void {
    if (this.#gravityRestored) return;
    Object.assign(this.#gravity, this.#originalGravity);
    this.#gravityRestored = true;
  }

  #advanceLift(deltaMs: number): void {
    if (this.#terminated) return;
    if (this.#frozenTemporaryObjectIds.includes(this.definition.lift.objectId)) {
      this.#lift.deltaX = 0;
      this.#lift.deltaY = 0;
      this.#lift.vx = 0;
      this.#lift.vy = 0;
      return;
    }
    const lift = this.definition.lift;
    const beforeX = this.#lift.body.position.x;
    const beforeY = this.#lift.body.position.y;
    if (this.#liftActive) {
      this.#platformClockMs += deltaMs;
      this.#lift.phase =
        (this.#platformClockMs % lift.periodMs) / lift.periodMs;
      const half = lift.periodMs / 2;
      const phaseMs = this.#platformClockMs % lift.periodMs;
      if (phaseMs < half) {
        this.#lift.direction = 1;
        this.#matter.Body.setPosition(this.#lift.body, {
          x: lift.x,
          y:
            lift.fromY +
            (lift.toY - lift.fromY) *
              phaseMs / half,
        });
      } else {
        this.#lift.direction = -1;
        this.#matter.Body.setPosition(this.#lift.body, {
          x: lift.x,
          y:
            lift.toY +
            (lift.fromY - lift.toY) *
              (phaseMs - half) / half,
        });
      }
      this.#lift.cycle = Math.floor(
        this.#platformClockMs / lift.periodMs,
      );
    }
    // Static Matter bodies keep cached broadphase bounds until explicitly
    // marked modified. Without this the lift visually moves but the player can
    // walk through it or fall from the route.
    this.#matter.Composite.setModified(
      this.#engine.world as unknown as MatterJS.CompositeType,
      true,
      false,
      true,
    );
    this.#lift.deltaX = this.#lift.body.position.x - beforeX;
    this.#lift.deltaY = this.#lift.body.position.y - beforeY;
    this.#lift.vx = this.#lift.deltaX * 1000 / deltaMs;
    this.#lift.vy = this.#lift.deltaY * 1000 / deltaMs;
  }

  #updateFailure(tick: number): void {
    const occupied = this.#matter.Query.collides(
      this.player,
      [this.failureZoneBody],
    ).length > 0;
    if (occupied === this.#failure.occupied) {
      this.#failure.enteredThisStep = false;
      if (occupied) this.#failure.occupiedSteps++;
      return;
    }
    this.#failure.occupied = occupied;
    this.#failure.lastTransitionTick = tick;
    this.#failure.enteredThisStep = occupied;
    if (occupied) {
      this.#failure.enterCount++;
      this.#failure.occupiedSteps = 1;
      this.#failure.lastOccupiedSteps = 0;
    } else {
      this.#failure.exitCount++;
      this.#failure.lastOccupiedSteps = this.#failure.occupiedSteps;
      this.#failure.occupiedSteps = 0;
    }
  }

  #synchronizeFailureBaseline(): void {
    const occupied = this.#matter.Query.collides(
      this.player,
      [this.failureZoneBody],
    ).length > 0;
    this.#failure.occupied = occupied;
    this.#failure.occupiedSteps = occupied ? 1 : 0;
    this.#failure.lastOccupiedSteps = 0;
    this.#failure.enterCount = 0;
    this.#failure.exitCount = 0;
    this.#failure.lastTransitionTick = this.#lastSimulationTick;
    this.#failure.enteredThisStep = false;
  }
}

function createInitialState(x: number, y: number): PlayerState {
  return Object.freeze({
    x,
    y,
    vx: 0,
    vy: 0,
    worldVx: 0,
    worldVy: 0,
    supportVx: 0,
    supportVy: 0,
    grounded: false,
    normalX: 0,
    normalY: -1,
    support: '',
    wall: false,
    ceiling: false,
  });
}

function collisionAllowed(
  bodyA: MatterJS.BodyType,
  bodyB: MatterJS.BodyType,
): boolean {
  const filterA = bodyA.collisionFilter;
  const filterB = bodyB.collisionFilter;
  return (
    (filterA.mask & filterB.category) !== 0 &&
    (filterB.mask & filterA.category) !== 0
  );
}

function asError(value: unknown, fallback: string): Error {
  if (value instanceof Error) return value;
  return new Error(`${fallback} ${String(value)}`);
}
