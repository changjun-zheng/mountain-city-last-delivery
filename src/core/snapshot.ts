// Prototype checkpoint snapshot contract for the current graybox. Versions and
// field names remain engineering choices until a later design decision.
export const GRAYBOX_SNAPSHOT_SCHEMA_VERSION = 1;
export const GRAYBOX_CHECKPOINT_ID = 'graybox-initial-spawn';
export const GRAYBOX_TEST_CAPTURE_CHECKPOINT_A_ID = 'graybox-test-capture-a';
export const GRAYBOX_TEST_CAPTURE_CHECKPOINT_B_ID = 'graybox-test-capture-b';
// Keep the singular export for existing D10-A1/A2 callers. New trigger code
// uses the explicit A/B names.
export const GRAYBOX_TEST_CAPTURE_CHECKPOINT_ID = GRAYBOX_TEST_CAPTURE_CHECKPOINT_A_ID;
export const GRAYBOX_LEVEL_ID = 'graybox-platform-lab';

export type SnapshotAnchor = Readonly<{
  x: number;
  y: number;
  facing: -1 | 1;
}>;

export type GrayboxCheckpointConfig = Readonly<{
  checkpointId: string;
  levelId: string;
  anchor: SnapshotAnchor;
  // Trusted, finite order. Recovery checks these only when the primary anchor
  // fails, never as a map-wide or randomized search.
  fallbackAnchors: readonly SnapshotAnchor[];
}>;

export type MovingPlatformLogicalState = Readonly<{
  axis: 'horizontal' | 'vertical';
  clockMs: number;
  position: Readonly<{ x: number; y: number }>;
  direction: -1 | 1;
  phase: number;
  cycle: number;
}>;

export type TemporarySnapshotObject = Readonly<{
  objectId: string;
  stateVersion: number;
  state: MovingPlatformLogicalState;
}>;

export type TemporarySnapshot = Readonly<{
  schemaVersion: number;
  runtimeInstanceId: string;
  checkpointId: string;
  levelId: string;
  anchor: SnapshotAnchor;
  objects: readonly TemporarySnapshotObject[];
}>;

export type TemporarySnapshotState = Readonly<{
  status: 'READY' | 'FAILED';
  error: string | null;
  captureAttempts: number;
  capturedAtTick: number | null;
  current: TemporarySnapshot | null;
}>;

export type TemporarySnapshotSource = Readonly<{
  captureTemporaryObject(objectId: string): unknown;
}>;

export type SnapshotFaultPhase = 'capture' | 'validate' | 'commit' | 'after-commit';
export type SnapshotFaultInjector = (
  phase: SnapshotFaultPhase,
  details: Readonly<{ objectId?: string }>,
) => void;

export type SnapshotValidationFailureKind =
  | 'version-incompatible'
  | 'invalid-source';

// Recovery uses this typed boundary to send incompatible snapshots directly to
// RecoveryError. Display text remains diagnostic data, never control flow.
export class SnapshotValidationError extends Error {
  readonly kind: SnapshotValidationFailureKind;

  constructor(kind: SnapshotValidationFailureKind, message: string) {
    super(message);
    this.name = 'SnapshotValidationError';
    this.kind = kind;
  }
}

export type SnapshotRegistryEntry = Readonly<{
  objectId: string;
  stateVersion: number;
  axis: MovingPlatformLogicalState['axis'];
}>;

export type SnapshotScenario = Readonly<{
  schemaVersion: number;
  defaultCheckpointId: string;
  checkpointConfigs: readonly GrayboxCheckpointConfig[];
  registry: readonly SnapshotRegistryEntry[];
}>;

// These are graybox test destinations, not final level coordinates or policy.
export const GRAYBOX_CHECKPOINT_CONFIGS: readonly GrayboxCheckpointConfig[] =
  Object.freeze([
    Object.freeze({
      checkpointId: GRAYBOX_CHECKPOINT_ID,
      levelId: GRAYBOX_LEVEL_ID,
      anchor: Object.freeze({ x: 80, y: 472, facing: 1 as const }),
      fallbackAnchors: Object.freeze([
        Object.freeze({ x: 160, y: 472, facing: 1 as const }),
        Object.freeze({ x: 700, y: 472, facing: -1 as const }),
      ]),
    }),
    Object.freeze({
      checkpointId: GRAYBOX_TEST_CAPTURE_CHECKPOINT_A_ID,
      levelId: GRAYBOX_LEVEL_ID,
      anchor: Object.freeze({ x: 1200, y: 472, facing: 1 as const }),
      fallbackAnchors: Object.freeze([
        Object.freeze({ x: 1160, y: 472, facing: 1 as const }),
        Object.freeze({ x: 1300, y: 472, facing: -1 as const }),
      ]),
    }),
    Object.freeze({
      checkpointId: GRAYBOX_TEST_CAPTURE_CHECKPOINT_B_ID,
      levelId: GRAYBOX_LEVEL_ID,
      anchor: Object.freeze({ x: 1270, y: 472, facing: 1 as const }),
      fallbackAnchors: Object.freeze([]),
    }),
  ]);

// This order is the checkpoint capture and validation order. The registry is a
// frozen constant: runtime code cannot add or remove required objects.
export const GRAYBOX_SNAPSHOT_REGISTRY: readonly SnapshotRegistryEntry[] = Object.freeze([
  Object.freeze({
    objectId: 'moving-horizontal-a',
    stateVersion: 1,
    axis: 'horizontal' as const,
  }),
  Object.freeze({
    objectId: 'moving-vertical-a',
    stateVersion: 1,
    axis: 'vertical' as const,
  }),
]);

export const GRAYBOX_SNAPSHOT_SCENARIO: SnapshotScenario = Object.freeze({
  schemaVersion: GRAYBOX_SNAPSHOT_SCHEMA_VERSION,
  defaultCheckpointId: GRAYBOX_CHECKPOINT_ID,
  checkpointConfigs: GRAYBOX_CHECKPOINT_CONFIGS,
  registry: GRAYBOX_SNAPSHOT_REGISTRY,
});

const SNAPSHOT_KEYS = [
  'schemaVersion',
  'runtimeInstanceId',
  'checkpointId',
  'levelId',
  'anchor',
  'objects',
] as const;
const OBJECT_KEYS = ['objectId', 'stateVersion', 'state'] as const;
const STATE_KEYS = ['axis', 'clockMs', 'position', 'direction', 'phase', 'cycle'] as const;
const POSITION_KEYS = ['x', 'y'] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function getGrayboxCheckpointConfig(
  checkpointId: string,
  scenario: SnapshotScenario = GRAYBOX_SNAPSHOT_SCENARIO,
): GrayboxCheckpointConfig {
  const config = scenario.checkpointConfigs.find(
    candidate => candidate.checkpointId === checkpointId,
  );
  if (!config) throw new Error(`Unknown trusted checkpointId: ${checkpointId}.`);
  return config;
}

function anchorsEqual(left: SnapshotAnchor, right: SnapshotAnchor): boolean {
  return left.x === right.x && left.y === right.y && left.facing === right.facing;
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[], label: string): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw new Error(`${label} has an unsupported shape.`);
  }
}

function requireFinite(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number.`);
  }
  return value;
}

function validateState(
  value: unknown,
  expected: SnapshotRegistryEntry,
): MovingPlatformLogicalState {
  if (!isRecord(value)) throw new Error(`${expected.objectId}.state must be an object.`);
  hasExactKeys(value, STATE_KEYS, `${expected.objectId}.state`);
  if (value.axis !== expected.axis) {
    throw new Error(`${expected.objectId}.state.axis does not match the fixed registry.`);
  }
  const clockMs = requireFinite(value.clockMs, `${expected.objectId}.state.clockMs`);
  if (clockMs < 0) throw new Error(`${expected.objectId}.state.clockMs must be non-negative.`);
  if (value.direction !== -1 && value.direction !== 1) {
    throw new Error(`${expected.objectId}.state.direction must be -1 or 1.`);
  }
  const phase = requireFinite(value.phase, `${expected.objectId}.state.phase`);
  if (phase < 0 || phase >= 1) {
    throw new Error(`${expected.objectId}.state.phase must be in [0, 1).`);
  }
  const cycle = requireFinite(value.cycle, `${expected.objectId}.state.cycle`);
  if (!Number.isSafeInteger(cycle) || cycle < 0) {
    throw new Error(`${expected.objectId}.state.cycle must be a non-negative safe integer.`);
  }
  if (!isRecord(value.position)) {
    throw new Error(`${expected.objectId}.state.position must be an object.`);
  }
  hasExactKeys(value.position, POSITION_KEYS, `${expected.objectId}.state.position`);
  const position = Object.freeze({
    x: requireFinite(value.position.x, `${expected.objectId}.state.position.x`),
    y: requireFinite(value.position.y, `${expected.objectId}.state.position.y`),
  });
  return Object.freeze({
    axis: expected.axis,
    clockMs,
    position,
    direction: value.direction,
    phase,
    cycle,
  });
}

// Validation also produces the immutable stored copy. Unknown fields, missing
// required objects, duplicate IDs and incompatible versions are rejected.
export function validateTemporarySnapshot(
  value: unknown,
  configuredCheckpointId = GRAYBOX_CHECKPOINT_ID,
  scenario: SnapshotScenario = GRAYBOX_SNAPSHOT_SCENARIO,
): TemporarySnapshot {
  if (!isRecord(value)) throw new Error('Snapshot must be an object.');
  hasExactKeys(value, SNAPSHOT_KEYS, 'Snapshot');
  if (value.schemaVersion !== scenario.schemaVersion) {
    throw new SnapshotValidationError(
      'version-incompatible',
      `Unsupported snapshot schemaVersion: ${String(value.schemaVersion)}.`,
    );
  }
  if (typeof value.runtimeInstanceId !== 'string' || !value.runtimeInstanceId) {
    throw new Error('Snapshot runtimeInstanceId must be a non-empty string.');
  }
  if (typeof value.checkpointId !== 'string' || !value.checkpointId) {
    throw new Error('Snapshot checkpointId must be a non-empty string.');
  }
  if (value.checkpointId !== configuredCheckpointId) {
    throw new Error('Snapshot checkpointId does not match the requested trusted checkpoint.');
  }
  const checkpointConfig = getGrayboxCheckpointConfig(
    configuredCheckpointId,
    scenario,
  );
  if (value.levelId !== checkpointConfig.levelId) {
    throw new Error('Snapshot levelId does not match the active graybox level.');
  }
  if (!isRecord(value.anchor)) throw new Error('Snapshot anchor must be an object.');
  hasExactKeys(value.anchor, ['x', 'y', 'facing'], 'Snapshot anchor');
  const anchorX = requireFinite(value.anchor.x, 'Snapshot anchor.x');
  const anchorY = requireFinite(value.anchor.y, 'Snapshot anchor.y');
  if (value.anchor.facing !== -1 && value.anchor.facing !== 1) {
    throw new Error('Snapshot anchor.facing must be -1 or 1.');
  }
  const candidateAnchor = Object.freeze({
    x: anchorX,
    y: anchorY,
    facing: value.anchor.facing,
  });
  if (!anchorsEqual(candidateAnchor, checkpointConfig.anchor)) {
    throw new Error('Snapshot anchor does not match the trusted checkpoint configuration.');
  }
  if (!Array.isArray(value.objects)) throw new Error('Snapshot objects must be an array.');
  if (value.objects.length !== scenario.registry.length) {
    throw new Error('Snapshot required-object set is incomplete or contains extra objects.');
  }
  const byId = new Map<string, unknown>();
  for (const entry of value.objects) {
    if (!isRecord(entry)) throw new Error('Snapshot object entry must be an object.');
    hasExactKeys(entry, OBJECT_KEYS, 'Snapshot object entry');
    if (typeof entry.objectId !== 'string' || !entry.objectId) {
      throw new Error('Snapshot objectId must be a non-empty string.');
    }
    if (byId.has(entry.objectId)) {
      throw new Error(`Duplicate snapshot objectId: ${entry.objectId}.`);
    }
    byId.set(entry.objectId, entry);
  }
  for (const expected of scenario.registry) {
    if (!byId.has(expected.objectId)) {
      throw new Error(`Missing required snapshot object: ${expected.objectId}.`);
    }
  }
  for (const objectId of byId.keys()) {
    if (!scenario.registry.some(entry => entry.objectId === objectId)) {
      throw new Error(`Unknown snapshot object: ${objectId}.`);
    }
  }
  const objects = scenario.registry.map(expected => {
    const entry = byId.get(expected.objectId);
    if (!isRecord(entry)) throw new Error(`Missing required snapshot object: ${expected.objectId}.`);
    if (entry.stateVersion !== expected.stateVersion) {
      throw new SnapshotValidationError(
        'version-incompatible',
        `${expected.objectId} has unsupported stateVersion: ${String(entry.stateVersion)}.`,
      );
    }
    return Object.freeze({
      objectId: expected.objectId,
      stateVersion: expected.stateVersion,
      state: validateState(entry.state, expected),
    });
  });
  return Object.freeze({
    schemaVersion: scenario.schemaVersion,
    runtimeInstanceId: value.runtimeInstanceId,
    checkpointId: checkpointConfig.checkpointId,
    levelId: checkpointConfig.levelId,
    anchor: checkpointConfig.anchor,
    objects: Object.freeze(objects),
  });
}

export function captureTemporarySnapshot(
  source: TemporarySnapshotSource,
  identity: Readonly<{
    runtimeInstanceId: string;
    checkpointId?: string;
    anchor?: SnapshotAnchor;
  }>,
  faultInjector?: SnapshotFaultInjector,
  scenario: SnapshotScenario = GRAYBOX_SNAPSHOT_SCENARIO,
): TemporarySnapshot {
  if (!source || typeof source.captureTemporaryObject !== 'function') {
    throw new Error('Snapshot source does not provide captureTemporaryObject().');
  }
  const checkpointConfig = getGrayboxCheckpointConfig(
    identity.checkpointId ?? scenario.defaultCheckpointId,
    scenario,
  );
  if (identity.anchor && !anchorsEqual(identity.anchor, checkpointConfig.anchor)) {
    throw new Error('Capture anchor does not match the trusted checkpoint configuration.');
  }
  const objects = scenario.registry.map(expected => {
    faultInjector?.('capture', { objectId: expected.objectId });
    return {
      objectId: expected.objectId,
      stateVersion: expected.stateVersion,
      state: source.captureTemporaryObject(expected.objectId),
    };
  });
  const candidate = {
    schemaVersion: scenario.schemaVersion,
    runtimeInstanceId: identity.runtimeInstanceId,
    checkpointId: checkpointConfig.checkpointId,
    levelId: checkpointConfig.levelId,
    anchor: checkpointConfig.anchor,
    objects,
  };
  faultInjector?.('validate', {});
  return validateTemporarySnapshot(
    candidate,
    checkpointConfig.checkpointId,
    scenario,
  );
}

// The current record is replaced only after the complete candidate has passed
// validation and the optional commit fault seam has returned successfully.
export class FixedTemporarySnapshotStore {
  #current: TemporarySnapshot | null = null;
  readonly #scenario: SnapshotScenario;

  constructor(scenario: SnapshotScenario = GRAYBOX_SNAPSHOT_SCENARIO) {
    this.#scenario = scenario;
  }

  commit(candidate: unknown, faultInjector?: SnapshotFaultInjector): TemporarySnapshot {
    const checkpointId =
      isRecord(candidate) && typeof candidate.checkpointId === 'string'
        ? candidate.checkpointId
        : this.#scenario.defaultCheckpointId;
    const validated = validateTemporarySnapshot(
      candidate,
      checkpointId,
      this.#scenario,
    );
    faultInjector?.('commit', {});
    this.#current = validated;
    faultInjector?.('after-commit', {});
    return validated;
  }

  get current(): TemporarySnapshot | null {
    return this.#current;
  }
}

export type InitialSnapshotCaptureResult = Readonly<
  | {
    status: 'READY';
    error: null;
    captureAttempts: number;
    capturedAtTick: number;
    current: TemporarySnapshot;
  }
  | {
    status: 'FAILED';
    error: string;
    captureAttempts: number;
    capturedAtTick: null;
    current: null;
  }
>;

export function captureInitialTemporarySnapshot(
  source: TemporarySnapshotSource,
  identity: Readonly<{
    runtimeInstanceId: string;
    checkpointId?: string;
    anchor?: SnapshotAnchor;
  }>,
  store: FixedTemporarySnapshotStore,
  faultInjector?: SnapshotFaultInjector,
  scenario: SnapshotScenario = GRAYBOX_SNAPSHOT_SCENARIO,
): InitialSnapshotCaptureResult {
  try {
    const candidate = captureTemporarySnapshot(
      source,
      identity,
      faultInjector,
      scenario,
    );
    const current = store.commit(candidate, faultInjector);
    return Object.freeze({
      status: 'READY' as const,
      error: null,
      captureAttempts: 1,
      capturedAtTick: 0,
      current,
    });
  } catch (error) {
    return Object.freeze({
      status: 'FAILED' as const,
      error: error instanceof Error ? error.message : String(error),
      captureAttempts: 1,
      capturedAtTick: null,
      current: null,
    });
  }
}
