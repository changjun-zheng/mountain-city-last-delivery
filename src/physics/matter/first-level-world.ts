import type {} from 'phaser';
import {
  FIRST_LEVEL_LIFT_OBJECT_ID,
  FIRST_LEVEL_SPATIAL_CONFIG,
  FIRST_LEVEL_SNAPSHOT_SCENARIO,
} from '../../core/first-level.ts';
import type {
  GrayboxPhysics,
  TemporaryObjectFreezeResult,
  TemporaryObjectReleaseResult,
} from '../../core/graybox.ts';
import { PLAYER_PROTOTYPE, type PlayerState } from '../../core/player.ts';
import {
  FIRST_LEVEL_PROGRESS_CONTENT,
  type PermanentEffectSnapshot,
} from '../../core/progress.ts';
import {
  PLAYER_FAILURE_ZONE_ID,
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
  TemporarySnapshotObject,
} from '../../core/snapshot.ts';
import type { MatterLibrary } from './graybox-world.ts';

type Pair = {
  isActive: boolean;
  isSensor: boolean;
  bodyA: MatterJS.BodyType;
  bodyB: MatterJS.BodyType;
  collision: { normal: { x: number; y: number } };
};

export const FIRST_LEVEL_SIZE = FIRST_LEVEL_SPATIAL_CONFIG.size;
export const FIRST_LEVEL_SPAWN: SnapshotAnchor =
  FIRST_LEVEL_SPATIAL_CONFIG.spawn;
export const FIRST_LEVEL_FAILURE_ZONE = Object.freeze({
  zoneId: PLAYER_FAILURE_ZONE_ID,
  label: '首关可恢复坠落区',
  ...FIRST_LEVEL_SPATIAL_CONFIG.failureZone,
});
export const FIRST_LEVEL_LIFT = FIRST_LEVEL_SPATIAL_CONFIG.lift;
export const FIRST_LEVEL_ROUTE_GATE =
  FIRST_LEVEL_SPATIAL_CONFIG.routeGate;

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
  readonly player: MatterJS.BodyType;
  readonly foot: MatterJS.BodyType;
  readonly routeGate: MatterJS.BodyType;
  readonly failureZoneBody: MatterJS.BodyType;
  readonly snapshotScenario = FIRST_LEVEL_SNAPSHOT_SCENARIO;
  readonly spawnAnchor = FIRST_LEVEL_SPAWN;
  readonly #matter: MatterLibrary;
  readonly #engine: MatterJS.Engine;
  readonly #advance: (deltaMs: number) => void;
  readonly #gravity: { x: number; y: number; scale: number };
  readonly #lift: LiftRuntime;
  readonly #failure: FailureRuntime = {
    occupied: false,
    occupiedSteps: 0,
    lastOccupiedSteps: 0,
    enterCount: 0,
    exitCount: 0,
    lastTransitionTick: null,
    enteredThisStep: false,
  };
  readonly #recoveryPosition: { x: number; y: number } = {
    x: FIRST_LEVEL_LIFT.x,
    y: FIRST_LEVEL_LIFT.fromY,
  };
  #platformClockMs = 0;
  #liftActive = false;
  #driveVelocity = { x: 0, y: 0 };
  #carriedByLift = false;
  #lastSimulationTick = 0;
  #state: PlayerState = createInitialState(FIRST_LEVEL_SPAWN.x, FIRST_LEVEL_SPAWN.y);
  #steps = 0;
  #managedWorldRebuildCount = 0;
  #temporaryObjectFreezeOwner?: object;
  #frozenTemporaryObjectIds: readonly string[] = Object.freeze([]);

  constructor(
    matter: MatterLibrary,
    engine: MatterJS.Engine,
    advance: (deltaMs: number) => void,
  ) {
    this.#matter = matter;
    this.#engine = engine;
    this.#advance = advance;
    const gravity = (
      engine as unknown as {
        gravity: { x: number; y: number; scale: number };
      }
    ).gravity;
    this.#gravity = gravity;
    Object.assign(gravity, { x: 0, y: 1.4, scale: 0.001 });

    const rectangle = (
      x: number,
      y: number,
      width: number,
      height: number,
      label: string,
    ) => {
      const body = matter.Bodies.rectangle(x, y, width, height, {
        isStatic: true,
        friction: 1,
        label,
      });
      this.terrain.push(body);
      return body;
    };

    // Confirmed route A -> B -> descending C -> lower D. The gaps between
    // C tiers require normal jumps; the gated service lift is the only safe
    // route from C3 down to the riverbank.
    for (const terrain of FIRST_LEVEL_SPATIAL_CONFIG.terrain) {
      rectangle(
        terrain.x,
        terrain.y,
        terrain.width,
        terrain.height,
        terrain.label,
      );
    }

    this.routeGate = matter.Bodies.rectangle(
      FIRST_LEVEL_ROUTE_GATE.x,
      FIRST_LEVEL_ROUTE_GATE.y,
      FIRST_LEVEL_ROUTE_GATE.width,
      FIRST_LEVEL_ROUTE_GATE.height,
      {
        isStatic: true,
        friction: 1,
        label: FIRST_LEVEL_ROUTE_GATE.label,
        collisionFilter: {
          category: ROUTE_GATE_CATEGORY,
          mask: PLAYER_CATEGORY,
          group: 0,
        },
      },
    );
    this.terrain.push(this.routeGate);

    const liftBody = matter.Bodies.rectangle(
      FIRST_LEVEL_LIFT.x,
      FIRST_LEVEL_LIFT.fromY,
      FIRST_LEVEL_LIFT.width,
      FIRST_LEVEL_LIFT.height,
      {
        isStatic: true,
        friction: 1,
        label: FIRST_LEVEL_LIFT.label,
      },
    );
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

    this.failureZoneBody = matter.Bodies.rectangle(
      FIRST_LEVEL_FAILURE_ZONE.x,
      FIRST_LEVEL_FAILURE_ZONE.y,
      FIRST_LEVEL_FAILURE_ZONE.width,
      FIRST_LEVEL_FAILURE_ZONE.height,
      {
        isStatic: true,
        isSensor: true,
        label: FIRST_LEVEL_FAILURE_ZONE.zoneId,
        collisionFilter: {
          category: FAILURE_ZONE_CATEGORY,
          mask: PLAYER_CATEGORY,
          group: 0,
        },
      },
    );
    this.player = matter.Bodies.rectangle(
      FIRST_LEVEL_SPAWN.x,
      FIRST_LEVEL_SPAWN.y,
      PLAYER_PROTOTYPE.width,
      PLAYER_PROTOTYPE.height,
      {
        label: 'player',
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
    matter.Body.setInertia(this.player, Infinity);
    this.foot = matter.Bodies.rectangle(
      FIRST_LEVEL_SPAWN.x,
      FIRST_LEVEL_SPAWN.y + PLAYER_PROTOTYPE.height / 2 + 1,
      22,
      8,
      {
        isSensor: true,
        isStatic: true,
        label: 'foot-region',
        collisionFilter: {
          category: PLAYER_CATEGORY,
          mask: -1,
          group: 0,
        },
      },
    );
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
  }

  drive(vx: number, vy: number): void {
    this.#driveVelocity = { x: vx, y: vy };
    this.player.friction =
      this.#state.grounded && Math.abs(vx) < 0.01 ? 1 : 0;
  }

  setPermanentEffect(effectId: string, expectedActive: boolean): void {
    if (effectId !== FIRST_LEVEL_PROGRESS_CONTENT.liftRouteUnlocked.effectId) {
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
    if (owner === null || typeof owner !== 'object') {
      throw new TypeError('Temporary-object freeze owner must be an object.');
    }
    if (
      objectIds.length !== 1 ||
      objectIds[0] !== FIRST_LEVEL_LIFT_OBJECT_ID
    ) {
      throw new Error('Freeze must cover the exact first-level registry.');
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
      FIRST_LEVEL_LIFT_OBJECT_ID,
    ]);
    this.#lift.deltaX = this.#lift.deltaY = this.#lift.vx = this.#lift.vy = 0;
    this.#matter.Body.setVelocity(this.#lift.body, { x: 0, y: 0 });
    return Object.freeze({
      status: 'frozen' as const,
      frozenObjectIds: this.#frozenTemporaryObjectIds,
    });
  }

  releaseTemporaryObjects(owner: object): TemporaryObjectReleaseResult {
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
    return !this.#temporaryObjectFreezeOwner ||
      !this.#frozenTemporaryObjectIds.includes(objectId);
  }

  get frozenTemporaryObjectIds(): readonly string[] {
    return this.#frozenTemporaryObjectIds;
  }

  captureTemporaryObject(objectId: string): MovingPlatformLogicalState {
    if (objectId !== FIRST_LEVEL_LIFT_OBJECT_ID) {
      throw new Error(`Unknown first-level snapshot object: ${objectId}.`);
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
    if (
      objects.length !== 1 ||
      objects[0]?.objectId !== FIRST_LEVEL_LIFT_OBJECT_ID ||
      objects[0]?.state.axis !== 'vertical'
    ) {
      throw new Error('Recovery snapshot does not match the first-level lift.');
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
    const world = this.#engine.world as unknown as MatterJS.CompositeType;
    this.#matter.Composite.remove(world, this.#lift.body);
    const body = this.#matter.Bodies.rectangle(
      this.#recoveryPosition.x,
      this.#recoveryPosition.y,
      FIRST_LEVEL_LIFT.width,
      FIRST_LEVEL_LIFT.height,
      {
        isStatic: true,
        friction: 1,
        label: FIRST_LEVEL_LIFT.label,
      },
    );
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
    const bodies = this.#matter.Composite.allBodies(
      this.#engine.world as unknown as MatterJS.CompositeType,
    );
    const bodySet = new Set(bodies);
    if (
      objects.length !== 1 ||
      objects[0]?.objectId !== FIRST_LEVEL_LIFT_OBJECT_ID
    ) {
      fail(
        'temporary-object-set-mismatch',
        '首关恢复快照必须且只能登记 service lift。',
      );
    } else {
      const expected = objects[0];
      if (!bodySet.has(this.#lift.body)) {
        fail(
          'required-platform-body-missing',
          '首关升降平台的真实碰撞体不在 Matter World。',
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
          '首关升降平台逻辑状态与恢复快照不一致。',
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
          '首关升降平台碰撞位置与恢复状态不一致。',
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
          `首关必要 Body ${body.label} 不在 Matter World。`,
        );
      }
    }
    const routeExpected = expectedPermanentEffects.some(effect =>
      effect.id === FIRST_LEVEL_PROGRESS_CONTENT.liftRouteUnlocked.effectId &&
      effect.expectedActive);
    const gateOpen = this.routeGate.collisionFilter.mask === 0;
    if (this.#liftActive !== routeExpected || gateOpen !== routeExpected) {
      fail(
        'permanent-route-effect-mismatch',
        `首关路线永久期望 ${routeExpected ? 'OPEN' : 'CLOSED'}，` +
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
        label: 'first-level-anchor-probe',
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
        reason: 'player body overlaps the first-level failure zone',
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
        label: 'first-level-support-probe',
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
    this.#lastSimulationTick = tick;
    this.#failure.enteredThisStep = false;
    const previousSupport = this.#state.support === FIRST_LEVEL_LIFT.label;
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
        other.label === FIRST_LEVEL_LIFT.label ? this.#lift.vx : 0;
      const otherVy =
        other.label === FIRST_LEVEL_LIFT.label ? this.#lift.vy : 0;
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
    if (this.#temporaryObjectFreezeOwner) {
      throw new Error(
        'Debug reset is unavailable while checkpoint objects are frozen.',
      );
    }
    const m = this.#matter;
    m.Body.setPosition(this.player, {
      x: FIRST_LEVEL_SPAWN.x,
      y: FIRST_LEVEL_SPAWN.y,
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
      x: FIRST_LEVEL_LIFT.x,
      y: FIRST_LEVEL_LIFT.fromY,
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
      FIRST_LEVEL_SPAWN.x,
      FIRST_LEVEL_SPAWN.y,
    );
    this.#synchronizeFailureBaseline();
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
      ...FIRST_LEVEL_FAILURE_ZONE,
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
        label: FIRST_LEVEL_LIFT.label,
        x: this.#lift.body.position.x,
        y: this.#lift.body.position.y,
        width: FIRST_LEVEL_LIFT.width,
        height: FIRST_LEVEL_LIFT.height,
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
        this.#state.support === FIRST_LEVEL_LIFT.label
          ? this.#state.x - this.#lift.body.position.x
          : null,
      supportRelativeY:
        this.#state.support === FIRST_LEVEL_LIFT.label
          ? this.#state.y - this.#lift.body.position.y
          : null,
      frozenObjectIds: this.frozenTemporaryObjectIds,
    });
  }

  #advanceLift(deltaMs: number): void {
    const beforeX = this.#lift.body.position.x;
    const beforeY = this.#lift.body.position.y;
    if (this.#liftActive) {
      this.#platformClockMs += deltaMs;
      this.#lift.phase =
        (this.#platformClockMs % FIRST_LEVEL_LIFT.periodMs) /
        FIRST_LEVEL_LIFT.periodMs;
      const half = FIRST_LEVEL_LIFT.periodMs / 2;
      const phaseMs = this.#platformClockMs % FIRST_LEVEL_LIFT.periodMs;
      if (phaseMs < half) {
        this.#lift.direction = 1;
        this.#matter.Body.setPosition(this.#lift.body, {
          x: FIRST_LEVEL_LIFT.x,
          y:
            FIRST_LEVEL_LIFT.fromY +
            (FIRST_LEVEL_LIFT.toY - FIRST_LEVEL_LIFT.fromY) *
              phaseMs / half,
        });
      } else {
        this.#lift.direction = -1;
        this.#matter.Body.setPosition(this.#lift.body, {
          x: FIRST_LEVEL_LIFT.x,
          y:
            FIRST_LEVEL_LIFT.toY +
            (FIRST_LEVEL_LIFT.fromY - FIRST_LEVEL_LIFT.toY) *
              (phaseMs - half) / half,
        });
      }
      this.#lift.cycle = Math.floor(
        this.#platformClockMs / FIRST_LEVEL_LIFT.periodMs,
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
