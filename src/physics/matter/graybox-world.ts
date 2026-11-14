import type {} from 'phaser';
import { PLAYER_PROTOTYPE, type PlayerState } from '../../core/player.ts';
import type {
  GrayboxPhysics,
  TemporaryObjectFreezeResult,
  TemporaryObjectReleaseResult,
} from '../../core/graybox.ts';
import { PROTOTYPE_PROGRESS_CONTENT } from '../../core/progress.ts';
import type {
  MovingPlatformLogicalState,
  SnapshotAnchor,
} from '../../core/snapshot.ts';
import {
  GRAYBOX_CHECKPOINT_TRIGGERS,
  type CheckpointTriggerOccupancySnapshot,
} from '../../core/checkpoint-triggers.ts';

// Uses Phaser's bundled Matter, injected so the identical world can run in deterministic tests.
export type MatterLibrary = {
  Bodies: typeof MatterJS.Bodies; Body: typeof MatterJS.Body; Composite: typeof MatterJS.Composite;
  Engine: typeof MatterJS.Engine;
  Query: { collides(body: MatterJS.BodyType, bodies: MatterJS.BodyType[]): { bodyA: MatterJS.BodyType; bodyB: MatterJS.BodyType }[] };
};
type Pair = { isActive: boolean; isSensor: boolean; bodyA: MatterJS.BodyType; bodyB: MatterJS.BodyType;
  collision: { normal: { x: number; y: number } } };
export const GRAYBOX_SIZE = { width: 2000, height: 680 };
export const ONE_WAY_PLATFORM: Readonly<{
  label: string; x: number; y: number; width: number; height: number;
}> = Object.freeze({ label: 'one-way-platform-a', x: 1075, y: 419, width: 70, height: 18 });
export const PROGRESS_TEST_ROUTE_GATE: Readonly<{
  label: string; x: number; y: number; width: number; height: number;
}> = Object.freeze({
  label: 'progress-test-route-gate',
  x: 620,
  y: 290,
  width: 18,
  height: 90,
});
export const DIAGNOSTIC_ZONE_PROTOTYPES = Object.freeze([
  Object.freeze({ label: 'diagnostic-zone-a', x: 400, y: 462, width: 120, height: 76 }),
  Object.freeze({ label: 'diagnostic-zone-b', x: 450, y: 462, width: 120, height: 76 }),
]);
export type MovingPlatformSnapshot = Readonly<{
  label: string; axis: 'horizontal' | 'vertical';
  x: number; y: number; width: number; height: number;
  vx: number; vy: number; direction: -1 | 1; phase: number; cycle: number;
}>;
export type DiagnosticZoneTransition = Readonly<{
  kind: 'enter' | 'exit'; tick: number; diagnosticOrdinal: number;
}>;
export type DiagnosticZoneSnapshot = Readonly<{
  label: string; x: number; y: number; width: number; height: number;
  occupied: boolean; occupiedSteps: number; lastOccupiedSteps: number;
  enterCount: number; exitCount: number; lastTransitionTick: number | null;
  recentTransitions: readonly DiagnosticZoneTransition[];
}>;
export type MatterGrayboxDiagnostics = Readonly<{
  oneWayCollisionEnabled: boolean;
  progressRouteOpen: boolean;
  platformClockMs: number;
  movingPlatforms: readonly MovingPlatformSnapshot[];
  supportRelativeX: number | null;
  supportRelativeY: number | null;
  diagnosticZones: readonly DiagnosticZoneSnapshot[];
  diagnosticBaselineTick: number;
  diagnosticBaselineCount: number;
  frozenObjectIds: readonly string[];
}>;

const PLAYER_CATEGORY = 0x0002;
const ONE_WAY_CATEGORY = 0x0004;
const DIAGNOSTIC_ZONE_CATEGORY = 0x0008;
const TEST_ROUTE_GATE_CATEGORY = 0x0010;
const CHECKPOINT_TRIGGER_CATEGORY = 0x0020;
// Matter contact slop can leave the body about 2 px inside the top face on the first supported tick.
const TOP_TOLERANCE_PX = 4;
const MOTION_EPSILON = 0.01;
const MOVING_PLATFORM_PROTOTYPES = Object.freeze([
  Object.freeze({
    label: 'moving-horizontal-a', axis: 'horizontal' as const, width: 100, height: 18,
    fromX: 1710, toX: 1780, fromY: 300, toY: 300, periodMs: 4000, phaseOffsetMs: 0,
  }),
  Object.freeze({
    label: 'moving-vertical-a', axis: 'vertical' as const, width: 72, height: 18,
    fromX: 1910, toX: 1910, fromY: 310, toY: 220, periodMs: 3600, phaseOffsetMs: 0,
  }),
]);

type OneWayState = {
  body: MatterJS.BodyType;
  top: number;
  passThrough: boolean;
  collisionEnabled: boolean;
};
type MovingPlatformRuntime = {
  readonly definition: (typeof MOVING_PLATFORM_PROTOTYPES)[number];
  readonly body: MatterJS.BodyType;
  deltaX: number;
  deltaY: number;
  vx: number;
  vy: number;
  direction: -1 | 1;
  phase: number;
  cycle: number;
};
type DiagnosticZoneRuntime = {
  readonly definition: (typeof DIAGNOSTIC_ZONE_PROTOTYPES)[number];
  readonly body: MatterJS.BodyType;
  occupied: boolean;
  occupiedSteps: number;
  lastOccupiedSteps: number;
  enterCount: number;
  exitCount: number;
  lastTransitionTick: number | null;
  readonly recentTransitions: DiagnosticZoneTransition[];
};
type CheckpointTriggerRuntime = {
  readonly definition: (typeof GRAYBOX_CHECKPOINT_TRIGGERS)[number];
  readonly body: MatterJS.BodyType;
  occupied: boolean;
  occupiedSteps: number;
  lastOccupiedSteps: number;
  enterCount: number;
  exitCount: number;
  lastTransitionTick: number | null;
};

export class MatterGrayboxWorld implements GrayboxPhysics {
  readonly terrain: MatterJS.BodyType[] = [];
  readonly player: MatterJS.BodyType;
  readonly foot: MatterJS.BodyType;
  readonly oneWayPlatform: MatterJS.BodyType;
  readonly progressRouteGate: MatterJS.BodyType;
  readonly diagnosticZoneBodies: MatterJS.BodyType[] = [];
  readonly checkpointTriggerBodies: MatterJS.BodyType[] = [];
  readonly #matter: MatterLibrary;
  readonly #engine: MatterJS.Engine;
  readonly #advance: (deltaMs: number) => void;
  readonly #gravity: { x: number; y: number; scale: number };
  readonly #oneWay: OneWayState;
  readonly #movingPlatforms: MovingPlatformRuntime[];
  readonly #movingByLabel: Map<string, MovingPlatformRuntime>;
  readonly #diagnosticZones: DiagnosticZoneRuntime[];
  readonly #diagnosticZoneByLabel: Map<string, DiagnosticZoneRuntime>;
  readonly #checkpointTriggers: CheckpointTriggerRuntime[];
  readonly spawnAnchor: SnapshotAnchor = Object.freeze({ x: 80, y: 472, facing: 1 });
  #platformClockMs = 0;
  #progressRouteOpen = false;
  #diagnosticBaselineTick = 0;
  #diagnosticBaselineCount = 0;
  #diagnosticOrdinal = 0;
  #lastSimulationTick = 0;
  #driveVelocity = { x: 0, y: 0 };
  #carriedBy?: MovingPlatformRuntime;
  #temporaryObjectFreezeOwner?: object;
  #frozenTemporaryObjectIds: readonly string[] = Object.freeze([]);
  #state: PlayerState = { x: 80, y: 472, vx: 0, vy: 0, grounded: false,
    worldVx: 0, worldVy: 0, supportVx: 0, supportVy: 0,
    normalX: 0, normalY: -1, support: '', wall: false, ceiling: false };
  #steps = 0;

  constructor(matter: MatterLibrary, engine: MatterJS.Engine, advance: (deltaMs: number) => void) {
    this.#matter = matter;
    this.#engine = engine;
    this.#advance = advance;
    const gravity = (engine as unknown as { gravity: { x: number; y: number; scale: number } }).gravity;
    this.#gravity = gravity;
    Object.assign(gravity, { x: 0, y: 1.4, scale: 0.001 }); // Prototype: 1400 units/s².
    const rectangle = (x: number, y: number, w: number, h: number, label: string) => {
      const body = matter.Bodies.rectangle(x, y, w, h, { isStatic: true, friction: 1, label });
      this.terrain.push(body);
      return body;
    };
    rectangle(440, 535, 880, 70, 'ground-a');
    rectangle(1165, 535, 310, 70, 'ground-b');
    rectangle(1790, 415, 340, 70, 'upper-ground');
    rectangle(10, 250, 20, 500, 'left-boundary');
    rectangle(1970, 250, 20, 500, 'right-boundary');
    rectangle(535, 455, 30, 90, 'wall');
    rectangle(290, 415, 200, 30, 'low-ceiling');
    this.progressRouteGate = matter.Bodies.rectangle(
      PROGRESS_TEST_ROUTE_GATE.x,
      PROGRESS_TEST_ROUTE_GATE.y,
      PROGRESS_TEST_ROUTE_GATE.width,
      PROGRESS_TEST_ROUTE_GATE.height,
      {
        isStatic: true,
        friction: 1,
        label: PROGRESS_TEST_ROUTE_GATE.label,
        collisionFilter: { category: TEST_ROUTE_GATE_CATEGORY, mask: PLAYER_CATEGORY, group: 0 },
      },
    );
    this.terrain.push(this.progressRouteGate);
    rectangle(745, 409, 90, 18, 'solid-platform-a');
    rectangle(1155, 399, 90, 18, 'solid-platform-b');
    this.oneWayPlatform = matter.Bodies.rectangle(
      ONE_WAY_PLATFORM.x, ONE_WAY_PLATFORM.y, ONE_WAY_PLATFORM.width, ONE_WAY_PLATFORM.height,
      {
        isStatic: true, friction: 1, label: ONE_WAY_PLATFORM.label,
        collisionFilter: { category: ONE_WAY_CATEGORY, mask: 0, group: 0 },
      },
    );
    this.terrain.push(this.oneWayPlatform);
    this.#oneWay = {
      body: this.oneWayPlatform,
      top: this.oneWayPlatform.bounds.min.y,
      passThrough: false,
      collisionEnabled: false,
    };
    this.#movingPlatforms = MOVING_PLATFORM_PROTOTYPES.map(definition => {
      const body = matter.Bodies.rectangle(
        definition.fromX, definition.fromY, definition.width, definition.height,
        { isStatic: true, friction: 1, label: definition.label },
      );
      const phase = (definition.phaseOffsetMs % definition.periodMs) / definition.periodMs;
      const outwardDirection = definition.axis === 'horizontal'
        ? Math.sign(definition.toX - definition.fromX)
        : Math.sign(definition.toY - definition.fromY);
      return {
        definition, body, deltaX: 0, deltaY: 0, vx: 0, vy: 0,
        direction: (phase < 0.5 ? outwardDirection : -outwardDirection) as -1 | 1,
        phase,
        cycle: Math.floor(definition.phaseOffsetMs / definition.periodMs),
      };
    });
    this.#movingByLabel = new Map(this.#movingPlatforms.map(platform => [platform.definition.label, platform]));
    this.#diagnosticZones = DIAGNOSTIC_ZONE_PROTOTYPES.map(definition => {
      const body = matter.Bodies.rectangle(
        definition.x, definition.y, definition.width, definition.height,
        {
          isStatic: true, isSensor: true, label: definition.label,
          collisionFilter: { category: DIAGNOSTIC_ZONE_CATEGORY, mask: PLAYER_CATEGORY, group: 0 },
        },
      );
      this.diagnosticZoneBodies.push(body);
      return {
        definition, body, occupied: false, occupiedSteps: 0, lastOccupiedSteps: 0,
        enterCount: 0, exitCount: 0, lastTransitionTick: null, recentTransitions: [],
      };
    });
    this.#diagnosticZoneByLabel = new Map(
      this.#diagnosticZones.map(zone => [zone.definition.label, zone]),
    );
    this.#checkpointTriggers = GRAYBOX_CHECKPOINT_TRIGGERS.map(definition => {
      const body = matter.Bodies.rectangle(
        definition.x,
        definition.y,
        definition.width,
        definition.height,
        {
          isStatic: true,
          isSensor: true,
          label: definition.triggerId,
          collisionFilter: {
            category: CHECKPOINT_TRIGGER_CATEGORY,
            mask: PLAYER_CATEGORY,
            group: 0,
          },
        },
      );
      this.checkpointTriggerBodies.push(body);
      return {
        definition,
        body,
        occupied: false,
        occupiedSteps: 0,
        lastOccupiedSteps: 0,
        enterCount: 0,
        exitCount: 0,
        lastTransitionTick: null,
      };
    });
    const slope = matter.Bodies.fromVertices(0, 0, [[
      { x: 0, y: 120 }, { x: 300, y: 0 }, { x: 300, y: 180 }, { x: 0, y: 180 },
    ]], { isStatic: true, friction: 1, label: 'continuous-slope' });
    matter.Body.translate(slope, { x: 1320 - slope.bounds.min.x, y: 380 - slope.bounds.min.y });
    this.terrain.push(slope);
    this.player = matter.Bodies.rectangle(80, 472, PLAYER_PROTOTYPE.width, PLAYER_PROTOTYPE.height, {
      label: 'player', friction: 0, frictionStatic: 2, frictionAir: 0, restitution: 0,
      chamfer: { radius: 3 }, collisionFilter: { category: PLAYER_CATEGORY, mask: -1, group: 0 },
    });
    matter.Body.setInertia(this.player, Infinity);
    this.foot = matter.Bodies.rectangle(80, 496, 22, 8, {
      isSensor: true, isStatic: true, label: 'foot-region',
      collisionFilter: { category: PLAYER_CATEGORY, mask: -1, group: 0 },
    });
    // The sensor is a query-only independent region: it never blocks or changes player mass.
    for (const body of [
      ...this.terrain, ...this.#movingPlatforms.map(platform => platform.body),
      ...this.diagnosticZoneBodies, ...this.checkpointTriggerBodies, this.player,
    ]) {
      matter.Composite.add(engine.world as unknown as MatterJS.CompositeType, body);
    }
  }

  drive(vx: number, vy: number): void {
    this.#driveVelocity = { x: vx, y: vy };
    this.player.friction = this.#state.grounded && Math.abs(vx) < 0.01 ? 1 : 0;
    if (this.#state.support === 'continuous-slope' && Math.abs(vx) < 0.01 && Math.abs(vy) < 0.01) {
      // Prototype static-support anti-slide: counter gravity only after validated contact.
      // Engine collision detection still runs; air, moving input and jumping never use this.
      this.player.force.y -= this.player.mass * this.#gravity.y * this.#gravity.scale;
    }
  }

  setPermanentEffect(effectId: string, expectedActive: boolean): void {
    if (effectId !== PROTOTYPE_PROGRESS_CONTENT.goal.effectId) return;
    this.#setProgressRouteOpen(expectedActive);
  }

  freezeTemporaryObjects(
    objectIds: readonly string[],
    owner: object,
  ): TemporaryObjectFreezeResult {
    if (owner === null || typeof owner !== 'object') {
      throw new TypeError('Temporary-object freeze owner must be an object.');
    }
    if (new Set(objectIds).size !== objectIds.length ||
        objectIds.length !== this.#movingPlatforms.length ||
        objectIds.some(objectId => !this.#movingByLabel.has(objectId))) {
      throw new Error('Temporary-object freeze must cover the exact fixed registry.');
    }
    if (this.#temporaryObjectFreezeOwner) {
      if (this.#temporaryObjectFreezeOwner === owner) {
        return Object.freeze({
          status: 'existing' as const,
          frozenObjectIds: this.#frozenTemporaryObjectIds,
        });
      }
      return Object.freeze({
        status: 'busy' as const,
        frozenObjectIds: this.#frozenTemporaryObjectIds,
      });
    }
    this.#temporaryObjectFreezeOwner = owner;
    this.#frozenTemporaryObjectIds = Object.freeze([...objectIds]);
    for (const platform of this.#movingPlatforms) {
      platform.deltaX = platform.deltaY = platform.vx = platform.vy = 0;
      this.#matter.Body.setVelocity(platform.body, { x: 0, y: 0 });
    }
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
    const platform = this.#movingByLabel.get(objectId);
    if (!platform) throw new Error(`Unknown temporary snapshot object: ${objectId}.`);
    return Object.freeze({
      axis: platform.definition.axis,
      clockMs: this.#platformClockMs,
      position: Object.freeze({
        x: platform.body.position.x,
        y: platform.body.position.y,
      }),
      direction: platform.direction,
      phase: platform.phase,
      cycle: platform.cycle,
    });
  }

  step(deltaMs: number, tick: number): void {
    this.#lastSimulationTick = tick;
    const previousSupport = this.#movingByLabel.get(this.#state.support);
    this.#advanceMovingPlatforms(deltaMs);
    this.#matter.Body.setVelocity(this.player, {
      x: this.#driveVelocity.x / 60, y: this.#driveVelocity.y / 60,
    });
    this.#carriedBy = undefined;
    // Prototype choice: moving supports carry position, but jumping inherits no extra velocity.
    if (previousSupport && this.player.velocity.y >= -MOTION_EPSILON) {
      this.#matter.Body.setPosition(this.player, {
        x: this.player.position.x + previousSupport.deltaX,
        y: this.player.position.y + previousSupport.deltaY,
      });
      this.#carriedBy = previousSupport;
    }
    this.#updateOneWayCollision();
    this.#advance(deltaMs);
    this.#steps++;
    const body = this.player;
    this.#matter.Body.setPosition(this.foot, { x: body.position.x, y: body.position.y + PLAYER_PROTOTYPE.height / 2 + 1 });
    const candidates = new Set(this.#matter.Query.collides(
      this.foot, [...this.terrain, ...this.#movingPlatforms.map(platform => platform.body)],
    ).map(c => c.bodyA === this.foot ? c.bodyB : c.bodyA));
    const carriedVx = this.#carriedBy ? this.#carriedBy.deltaX * 1000 / deltaMs : 0;
    const carriedVy = this.#carriedBy ? this.#carriedBy.deltaY * 1000 / deltaMs : 0;
    let support = '', normalX = 0, normalY = -1, wall = false, ceiling = false;
    let supportVx = 0, supportVy = 0;
    for (const pair of this.#engine.pairs.list as Pair[]) {
      if (!pair.isActive || pair.isSensor || (pair.bodyA !== body && pair.bodyB !== body)) continue;
      const other = pair.bodyA === body ? pair.bodyB : pair.bodyA;
      const sign = pair.bodyA === body ? 1 : -1;
      const nx = sign * pair.collision.normal.x, ny = sign * pair.collision.normal.y;
      if (Math.abs(nx) > 0.7) wall = true;
      if (ny > 0.65) ceiling = true;
      // Tangential ascent has negative world-Y velocity but is still supported.
      const moving = this.#movingByLabel.get(other.label);
      const otherVx = moving?.vx ?? 0, otherVy = moving?.vy ?? 0;
      const playerVx = body.velocity.x * 60 + carriedVx;
      const playerVy = body.velocity.y * 60 + carriedVy;
      const separatingSpeed = (playerVx - otherVx) * nx + (playerVy - otherVy) * ny;
      if (candidates.has(other) && ny < -0.65 && separatingSpeed <= 40) {
        support = other.label;
        normalX = nx;
        normalY = ny;
        supportVx = otherVx;
        supportVy = otherVy;
      }
    }
    const vx = body.velocity.x * 60, vy = body.velocity.y * 60;
    this.#state = { x: body.position.x, y: body.position.y, vx, vy,
      worldVx: vx + carriedVx, worldVy: vy + carriedVy,
      supportVx, supportVy, grounded: Boolean(support), normalX, normalY, support, wall, ceiling };
    this.#updateDiagnosticZones(tick);
    this.#updateCheckpointTriggers(tick);
  }

  reset(): void {
    if (this.#temporaryObjectFreezeOwner) {
      throw new Error('Debug reset is unavailable while checkpoint objects are frozen.');
    }
    const m = this.#matter;
    m.Body.setPosition(this.player, { x: 80, y: 472 });
    m.Body.setVelocity(this.player, { x: 0, y: 0 });
    m.Body.setAngularVelocity(this.player, 0);
    this.player.force.x = this.player.force.y = 0;
    this.player.torque = 0;
    const impulse = (this.player as MatterJS.BodyType & { positionImpulse: { x: number; y: number } }).positionImpulse;
    impulse.x = impulse.y = 0;
    m.Engine.clear(this.#engine);
    // Engine.clear also empties the broadphase detector. Rebuild it on the next step.
    m.Composite.setModified(this.#engine.world as unknown as MatterJS.CompositeType, true, false, true);
    this.#oneWay.passThrough = false;
    this.#setOneWayCollision(false);
    this.#setProgressRouteOpen(false);
    this.#platformClockMs = 0;
    this.#driveVelocity = { x: 0, y: 0 };
    this.#carriedBy = undefined;
    for (const platform of this.#movingPlatforms) {
      m.Body.setPosition(platform.body, { x: platform.definition.fromX, y: platform.definition.fromY });
      m.Body.setVelocity(platform.body, { x: 0, y: 0 });
      platform.deltaX = platform.deltaY = platform.vx = platform.vy = 0;
      const definition = platform.definition;
      const phase = (definition.phaseOffsetMs % definition.periodMs) / definition.periodMs;
      const outward = phase < 0.5;
      const outwardDirection = definition.axis === 'horizontal'
        ? Math.sign(definition.toX - definition.fromX)
        : Math.sign(definition.toY - definition.fromY);
      platform.direction = (outward ? outwardDirection : -outwardDirection) as -1 | 1;
      platform.phase = phase;
      platform.cycle = 0;
    }
    this.#state = { x: 80, y: 472, vx: 0, vy: 0,
      worldVx: 0, worldVy: 0, supportVx: 0, supportVy: 0, grounded: false,
      normalX: 0, normalY: -1, support: '', wall: false, ceiling: false };
    this.#synchronizeDiagnosticBaseline();
    this.#synchronizeCheckpointTriggerBaseline();
  }
  get state(): PlayerState { return this.#state; }
  get steps(): number { return this.#steps; }
  get timestamp(): number { return this.#engine.timing.timestamp; }
  get oneWayCollisionEnabled(): boolean { return this.#oneWay.collisionEnabled; }
  get progressRouteOpen(): boolean { return this.#progressRouteOpen; }
  get platformClockMs(): number { return this.#platformClockMs; }
  get movingPlatforms(): readonly MovingPlatformSnapshot[] {
    return this.#movingPlatforms.map(platform => ({
      label: platform.definition.label,
      axis: platform.definition.axis,
      x: platform.body.position.x,
      y: platform.body.position.y,
      width: platform.definition.width,
      height: platform.definition.height,
      vx: platform.vx,
      vy: platform.vy,
      direction: platform.direction,
      phase: platform.phase,
      cycle: platform.cycle,
    }));
  }
  get diagnosticZones(): readonly DiagnosticZoneSnapshot[] {
    return this.#diagnosticZones.map(zone => ({
      label: zone.definition.label,
      x: zone.definition.x,
      y: zone.definition.y,
      width: zone.definition.width,
      height: zone.definition.height,
      occupied: zone.occupied,
      occupiedSteps: zone.occupiedSteps,
      lastOccupiedSteps: zone.lastOccupiedSteps,
      enterCount: zone.enterCount,
      exitCount: zone.exitCount,
      lastTransitionTick: zone.lastTransitionTick,
      recentTransitions: zone.recentTransitions.map(transition => ({ ...transition })),
    }));
  }
  get checkpointTriggers(): readonly CheckpointTriggerOccupancySnapshot[] {
    return this.#checkpointTriggers.map(trigger => Object.freeze({
      triggerId: trigger.definition.triggerId,
      occupied: trigger.occupied,
      occupiedSteps: trigger.occupiedSteps,
      lastOccupiedSteps: trigger.lastOccupiedSteps,
      enterCount: trigger.enterCount,
      exitCount: trigger.exitCount,
      lastTransitionTick: trigger.lastTransitionTick,
    }));
  }
  get checkpointTriggersEnabled(): boolean {
    return this.#progressRouteOpen;
  }
  get diagnostics(): MatterGrayboxDiagnostics {
    const support = this.#movingByLabel.get(this.#state.support);
    return {
      oneWayCollisionEnabled: this.#oneWay.collisionEnabled,
      progressRouteOpen: this.#progressRouteOpen,
      platformClockMs: this.#platformClockMs,
      movingPlatforms: this.movingPlatforms,
      supportRelativeX: support ? this.#state.x - support.body.position.x : null,
      supportRelativeY: support ? this.#state.y - support.body.position.y : null,
      diagnosticZones: this.diagnosticZones,
      diagnosticBaselineTick: this.#diagnosticBaselineTick,
      diagnosticBaselineCount: this.#diagnosticBaselineCount,
      frozenObjectIds: this.frozenTemporaryObjectIds,
    };
  }

  #updateDiagnosticZones(tick: number): void {
    const occupiedLabels = new Set(this.#matter.Query.collides(
      this.player, this.diagnosticZoneBodies,
    ).map(collision => collision.bodyA === this.player ? collision.bodyB.label : collision.bodyA.label));
    for (const zone of this.#diagnosticZones) {
      const occupied = occupiedLabels.has(zone.definition.label);
      if (occupied === zone.occupied) {
        if (occupied) zone.occupiedSteps++;
        continue;
      }
      zone.occupied = occupied;
      zone.lastTransitionTick = tick;
      if (occupied) {
        zone.enterCount++;
        zone.occupiedSteps = 1;
        zone.lastOccupiedSteps = 0;
      } else {
        zone.exitCount++;
        zone.lastOccupiedSteps = zone.occupiedSteps;
        zone.occupiedSteps = 0;
      }
      zone.recentTransitions.push({
        kind: occupied ? 'enter' : 'exit',
        tick,
        diagnosticOrdinal: ++this.#diagnosticOrdinal,
      });
      if (zone.recentTransitions.length > 8) zone.recentTransitions.shift();
    }
  }

  #updateCheckpointTriggers(tick: number): void {
    const occupiedLabels = new Set(this.#matter.Query.collides(
      this.player,
      this.checkpointTriggerBodies,
    ).map(collision =>
      collision.bodyA === this.player ? collision.bodyB.label : collision.bodyA.label));
    for (const trigger of this.#checkpointTriggers) {
      const occupied = occupiedLabels.has(trigger.definition.triggerId);
      if (occupied === trigger.occupied) {
        if (occupied) trigger.occupiedSteps++;
        continue;
      }
      trigger.occupied = occupied;
      trigger.lastTransitionTick = tick;
      if (occupied) {
        trigger.enterCount++;
        trigger.occupiedSteps = 1;
        trigger.lastOccupiedSteps = 0;
      } else {
        trigger.exitCount++;
        trigger.lastOccupiedSteps = trigger.occupiedSteps;
        trigger.occupiedSteps = 0;
      }
    }
  }

  #synchronizeDiagnosticBaseline(): void {
    const occupiedLabels = new Set(this.#matter.Query.collides(
      this.player, this.diagnosticZoneBodies,
    ).map(collision => collision.bodyA === this.player ? collision.bodyB.label : collision.bodyA.label));
    for (const zone of this.#diagnosticZones) {
      zone.occupied = occupiedLabels.has(zone.definition.label);
      zone.occupiedSteps = zone.occupied ? 1 : 0;
      zone.lastOccupiedSteps = 0;
      zone.enterCount = 0;
      zone.exitCount = 0;
      zone.lastTransitionTick = null;
      zone.recentTransitions.length = 0;
    }
    this.#diagnosticBaselineTick = this.#lastSimulationTick;
    this.#diagnosticBaselineCount++;
  }

  #synchronizeCheckpointTriggerBaseline(): void {
    const occupiedLabels = new Set(this.#matter.Query.collides(
      this.player,
      this.checkpointTriggerBodies,
    ).map(collision =>
      collision.bodyA === this.player ? collision.bodyB.label : collision.bodyA.label));
    for (const trigger of this.#checkpointTriggers) {
      trigger.occupied = occupiedLabels.has(trigger.definition.triggerId);
      trigger.occupiedSteps = trigger.occupied ? 1 : 0;
      trigger.lastOccupiedSteps = 0;
      trigger.enterCount = 0;
      trigger.exitCount = 0;
      trigger.lastTransitionTick = this.#lastSimulationTick;
    }
  }

  #updateOneWayCollision(): void {
    const bodyBottom = this.player.bounds.max.y;
    const rising = this.player.velocity.y < -MOTION_EPSILON;
    if (rising) this.#oneWay.passThrough = true;

    if (this.#oneWay.passThrough && bodyBottom > this.#oneWay.top - TOP_TOLERANCE_PX) {
      this.#setOneWayCollision(false);
      return;
    }

    if (bodyBottom <= this.#oneWay.top - TOP_TOLERANCE_PX) {
      // The whole player body has cleared the top face. Collision may resume only while descending.
      this.#oneWay.passThrough = false;
    }
    const descending = this.player.velocity.y >= -MOTION_EPSILON;
    const aboveTop = bodyBottom <= this.#oneWay.top + TOP_TOLERANCE_PX;
    this.#setOneWayCollision(!this.#oneWay.passThrough && descending && aboveTop);
  }

  #setOneWayCollision(enabled: boolean): void {
    if (this.#oneWay.collisionEnabled === enabled) return;
    this.#oneWay.collisionEnabled = enabled;
    this.#oneWay.body.collisionFilter.mask = enabled ? PLAYER_CATEGORY : 0;
    this.#matter.Composite.setModified(
      this.#engine.world as unknown as MatterJS.CompositeType, true, false, true,
    );
  }

  #setProgressRouteOpen(open: boolean): void {
    if (this.#progressRouteOpen === open) return;
    this.#progressRouteOpen = open;
    this.progressRouteGate.collisionFilter.mask = open ? 0 : PLAYER_CATEGORY;
    this.#matter.Composite.setModified(
      this.#engine.world as unknown as MatterJS.CompositeType, true, false, true,
    );
  }

  #advanceMovingPlatforms(deltaMs: number): void {
    if (this.#temporaryObjectFreezeOwner) {
      for (const platform of this.#movingPlatforms) {
        platform.deltaX = platform.deltaY = platform.vx = platform.vy = 0;
      }
      return;
    }
    this.#platformClockMs += deltaMs;
    for (const platform of this.#movingPlatforms) {
      const d = platform.definition;
      const elapsed = this.#platformClockMs + d.phaseOffsetMs;
      const phase = (elapsed % d.periodMs) / d.periodMs;
      const outward = phase < 0.5;
      const triangle = outward ? phase * 2 : (1 - phase) * 2;
      const x = d.fromX + (d.toX - d.fromX) * triangle;
      const y = d.fromY + (d.toY - d.fromY) * triangle;
      const deltaX = x - platform.body.position.x;
      const deltaY = y - platform.body.position.y;
      this.#matter.Body.setPosition(platform.body, { x, y });
      platform.deltaX = deltaX;
      platform.deltaY = deltaY;
      platform.vx = deltaX * 1000 / deltaMs;
      platform.vy = deltaY * 1000 / deltaMs;
      const outwardDirection = d.axis === 'horizontal'
        ? Math.sign(d.toX - d.fromX)
        : Math.sign(d.toY - d.fromY);
      platform.direction = (outward ? outwardDirection : -outwardDirection) as -1 | 1;
      platform.phase = phase;
      platform.cycle = Math.floor(elapsed / d.periodMs);
    }
    this.#matter.Composite.setModified(
      this.#engine.world as unknown as MatterJS.CompositeType, true, false, true,
    );
  }
}
