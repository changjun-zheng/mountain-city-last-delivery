import type { InteractionObject } from './interaction.ts';
import type {
  GrayboxCheckpointConfig,
  SnapshotAnchor,
  SnapshotRegistryEntry,
  SnapshotScenario,
} from './snapshot.ts';

export const PROTOTYPE_LEVEL_SCHEMA_VERSION = 1;
export const PROTOTYPE_PLATFORM_STATE_VERSION = 1;

type RectangleDefinition = Readonly<{
  objectId: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}>;

export type PrototypeTerrainDefinition = RectangleDefinition & Readonly<{
  type: 'static-rectangle';
}>;

export type PrototypeRouteGateDefinition = RectangleDefinition & Readonly<{
  type: 'route-gate';
}>;

export type PrototypeFailureZoneDefinition = RectangleDefinition & Readonly<{
  type: 'failure-sensor';
  zoneId: string;
}>;

export type PrototypeVerticalLiftDefinition = Readonly<{
  type: 'vertical-lift';
  objectId: string;
  label: string;
  axis: 'vertical';
  x: number;
  fromY: number;
  toY: number;
  width: number;
  height: number;
  periodMs: number;
}>;

export type PrototypeLevelDefinition = Readonly<{
  schemaVersion: typeof PROTOTYPE_LEVEL_SCHEMA_VERSION;
  levelId: string;
  size: Readonly<{ width: number; height: number }>;
  spawn: SnapshotAnchor;
  terrain: readonly PrototypeTerrainDefinition[];
  routeGate: PrototypeRouteGateDefinition;
  lift: PrototypeVerticalLiftDefinition;
  failureZone: PrototypeFailureZoneDefinition;
  routeEffectId: string;
  bodyLabels: Readonly<{
    player: string;
    foot: string;
    anchorProbe: string;
    supportProbe: string;
  }>;
  snapshotScenario: SnapshotScenario;
  interactions: readonly InteractionObject[];
}>;

const ROOT_KEYS = [
  'schemaVersion',
  'levelId',
  'size',
  'spawn',
  'terrain',
  'routeGate',
  'lift',
  'failureZone',
  'routeEffectId',
  'bodyLabels',
  'snapshotScenario',
  'interactions',
] as const;
const RECTANGLE_KEYS = [
  'type',
  'objectId',
  'label',
  'x',
  'y',
  'width',
  'height',
] as const;
const FAILURE_ZONE_KEYS = [...RECTANGLE_KEYS, 'zoneId'] as const;
const LIFT_KEYS = [
  'type',
  'objectId',
  'label',
  'axis',
  'x',
  'fromY',
  'toY',
  'width',
  'height',
  'periodMs',
] as const;
const SNAPSHOT_SCENARIO_KEYS = [
  'schemaVersion',
  'defaultCheckpointId',
  'checkpointConfigs',
  'registry',
] as const;
const CHECKPOINT_KEYS = [
  'checkpointId',
  'levelId',
  'anchor',
  'fallbackAnchors',
] as const;
const REGISTRY_KEYS = ['objectId', 'stateVersion', 'axis'] as const;
const ANCHOR_KEYS = ['x', 'y', 'facing'] as const;
const BODY_LABEL_KEYS = [
  'player',
  'foot',
  'anchorProbe',
  'supportProbe',
] as const;
const INTERACTION_REQUIRED_KEYS = [
  'id',
  'kind',
  'label',
  'title',
  'content',
  'x',
  'y',
  'rangeX',
  'rangeY',
] as const;
const INTERACTION_OPTIONAL_KEYS = [
  'progress',
  'actionId',
  'actionLabel',
  'activateOnClose',
] as const;
const INTERACTION_PROGRESS_KEYS = ['category', 'id'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function exactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  label: string,
): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length ||
      actual.some((key, index) => key !== wanted[index])) {
    throw new Error(`${label} has an unsupported shape.`);
  }
}

function nonEmptyString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value;
}

function finite(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number.`);
  }
  return value;
}

function positive(value: unknown, label: string): number {
  const number = finite(value, label);
  if (number <= 0) throw new Error(`${label} must be positive.`);
  return number;
}

function facing(value: unknown, label: string): -1 | 1 {
  if (value !== -1 && value !== 1) {
    throw new Error(`${label} must be -1 or 1.`);
  }
  return value;
}

function anchor(value: unknown, label: string): SnapshotAnchor {
  if (!isRecord(value)) throw new Error(`${label} must be an object.`);
  exactKeys(value, ANCHOR_KEYS, label);
  return Object.freeze({
    x: finite(value.x, `${label}.x`),
    y: finite(value.y, `${label}.y`),
    facing: facing(value.facing, `${label}.facing`),
  });
}

function rectangle(
  value: unknown,
  expectedType: 'static-rectangle' | 'route-gate',
  label: string,
): PrototypeTerrainDefinition | PrototypeRouteGateDefinition {
  if (!isRecord(value)) throw new Error(`${label} must be an object.`);
  exactKeys(value, RECTANGLE_KEYS, label);
  if (value.type !== expectedType) {
    throw new Error(`${label}.type is unsupported.`);
  }
  return Object.freeze({
    type: expectedType,
    objectId: nonEmptyString(value.objectId, `${label}.objectId`),
    label: nonEmptyString(value.label, `${label}.label`),
    x: finite(value.x, `${label}.x`),
    y: finite(value.y, `${label}.y`),
    width: positive(value.width, `${label}.width`),
    height: positive(value.height, `${label}.height`),
  });
}

function failureZone(value: unknown): PrototypeFailureZoneDefinition {
  if (!isRecord(value)) throw new Error('failureZone must be an object.');
  exactKeys(value, FAILURE_ZONE_KEYS, 'failureZone');
  if (value.type !== 'failure-sensor') {
    throw new Error('failureZone.type is unsupported.');
  }
  return Object.freeze({
    type: 'failure-sensor' as const,
    zoneId: nonEmptyString(value.zoneId, 'failureZone.zoneId'),
    objectId: nonEmptyString(value.objectId, 'failureZone.objectId'),
    label: nonEmptyString(value.label, 'failureZone.label'),
    x: finite(value.x, 'failureZone.x'),
    y: finite(value.y, 'failureZone.y'),
    width: positive(value.width, 'failureZone.width'),
    height: positive(value.height, 'failureZone.height'),
  });
}

function lift(value: unknown): PrototypeVerticalLiftDefinition {
  if (!isRecord(value)) throw new Error('lift must be an object.');
  exactKeys(value, LIFT_KEYS, 'lift');
  if (value.type !== 'vertical-lift') throw new Error('lift.type is unsupported.');
  if (value.axis !== 'vertical') throw new Error('lift.axis is unsupported.');
  const fromY = finite(value.fromY, 'lift.fromY');
  const toY = finite(value.toY, 'lift.toY');
  if (fromY === toY) throw new Error('lift endpoints must differ.');
  return Object.freeze({
    type: 'vertical-lift' as const,
    axis: 'vertical' as const,
    objectId: nonEmptyString(value.objectId, 'lift.objectId'),
    label: nonEmptyString(value.label, 'lift.label'),
    x: finite(value.x, 'lift.x'),
    fromY,
    toY,
    width: positive(value.width, 'lift.width'),
    height: positive(value.height, 'lift.height'),
    periodMs: positive(value.periodMs, 'lift.periodMs'),
  });
}

function checkpoint(value: unknown, levelId: string): GrayboxCheckpointConfig {
  if (!isRecord(value)) throw new Error('checkpoint config must be an object.');
  exactKeys(value, CHECKPOINT_KEYS, 'checkpoint config');
  const checkpointId = nonEmptyString(value.checkpointId, 'checkpointId');
  const configuredLevelId = nonEmptyString(
    value.levelId,
    `${checkpointId}.levelId`,
  );
  if (configuredLevelId !== levelId) {
    throw new Error(`Checkpoint ${checkpointId} belongs to another level.`);
  }
  if (!Array.isArray(value.fallbackAnchors)) {
    throw new Error(`${checkpointId}.fallbackAnchors must be an array.`);
  }
  return Object.freeze({
    checkpointId,
    levelId: configuredLevelId,
    anchor: anchor(value.anchor, `${checkpointId}.anchor`),
    // Preserve the trusted recovery order exactly.
    fallbackAnchors: Object.freeze(value.fallbackAnchors.map(
      (candidate, index) =>
        anchor(candidate, `${checkpointId}.fallbackAnchors[${index}]`),
    )),
  });
}

function registryEntry(value: unknown): SnapshotRegistryEntry {
  if (!isRecord(value)) throw new Error('snapshot registry entry must be an object.');
  exactKeys(value, REGISTRY_KEYS, 'snapshot registry entry');
  if (value.stateVersion !== PROTOTYPE_PLATFORM_STATE_VERSION) {
    throw new Error('snapshot registry stateVersion is unsupported.');
  }
  if (value.axis !== 'vertical') {
    throw new Error('snapshot registry axis is unsupported.');
  }
  return Object.freeze({
    objectId: nonEmptyString(value.objectId, 'snapshot registry objectId'),
    stateVersion: PROTOTYPE_PLATFORM_STATE_VERSION,
    axis: 'vertical' as const,
  });
}

function snapshotScenario(
  value: unknown,
  levelId: string,
  spawn: SnapshotAnchor,
  liftDefinition: PrototypeVerticalLiftDefinition,
): SnapshotScenario {
  if (!isRecord(value)) throw new Error('snapshotScenario must be an object.');
  exactKeys(value, SNAPSHOT_SCENARIO_KEYS, 'snapshotScenario');
  if (value.schemaVersion !== PROTOTYPE_LEVEL_SCHEMA_VERSION) {
    throw new Error('snapshotScenario.schemaVersion is unsupported.');
  }
  const defaultCheckpointId = nonEmptyString(
    value.defaultCheckpointId,
    'snapshotScenario.defaultCheckpointId',
  );
  if (!Array.isArray(value.checkpointConfigs) ||
      value.checkpointConfigs.length !== 1) {
    throw new Error('This adapter requires exactly one initial checkpoint.');
  }
  const checkpoints = value.checkpointConfigs.map(
    candidate => checkpoint(candidate, levelId),
  );
  if (checkpoints[0]?.checkpointId !== defaultCheckpointId) {
    throw new Error('snapshotScenario.defaultCheckpointId is not configured.');
  }
  if (!anchorsEqual(checkpoints[0].anchor, spawn)) {
    throw new Error('spawn must exactly match the default checkpoint anchor.');
  }
  if (!Array.isArray(value.registry) || value.registry.length !== 1) {
    throw new Error('This adapter requires exactly one snapshot registry object.');
  }
  const registry = value.registry.map(registryEntry);
  if (registry[0]?.objectId !== liftDefinition.objectId) {
    throw new Error('Snapshot registry objectId must match the vertical lift.');
  }
  return Object.freeze({
    schemaVersion: PROTOTYPE_LEVEL_SCHEMA_VERSION,
    defaultCheckpointId,
    checkpointConfigs: Object.freeze(checkpoints),
    registry: Object.freeze(registry),
  });
}

function bodyLabels(value: unknown): PrototypeLevelDefinition['bodyLabels'] {
  if (!isRecord(value)) throw new Error('bodyLabels must be an object.');
  exactKeys(value, BODY_LABEL_KEYS, 'bodyLabels');
  const parsed = Object.freeze({
    player: nonEmptyString(value.player, 'bodyLabels.player'),
    foot: nonEmptyString(value.foot, 'bodyLabels.foot'),
    anchorProbe: nonEmptyString(
      value.anchorProbe,
      'bodyLabels.anchorProbe',
    ),
    supportProbe: nonEmptyString(
      value.supportProbe,
      'bodyLabels.supportProbe',
    ),
  });
  if (new Set(Object.values(parsed)).size !== BODY_LABEL_KEYS.length) {
    throw new Error('bodyLabels must use unique labels.');
  }
  return parsed;
}

function interactions(
  value: unknown,
): readonly InteractionObject[] {
  if (!Array.isArray(value)) throw new Error('interactions must be an array.');
  const ids = new Set<string>();
  return Object.freeze(value.map((candidate, index) => {
    if (!isRecord(candidate)) {
      throw new Error(`interactions[${index}] must be an object.`);
    }
    const actualKeys = Object.keys(candidate);
    const allowedKeys = new Set<string>([
      ...INTERACTION_REQUIRED_KEYS,
      ...INTERACTION_OPTIONAL_KEYS,
    ]);
    if (actualKeys.some(key => !allowedKeys.has(key))) {
      throw new Error(`interactions[${index}] has an unsupported shape.`);
    }
    for (const key of INTERACTION_REQUIRED_KEYS) {
      if (!(key in candidate)) {
        throw new Error(`interactions[${index}].${key} is required.`);
      }
    }
    const id = nonEmptyString(candidate.id, `interactions[${index}].id`);
    if (ids.has(id)) throw new Error(`Duplicate interaction id: ${id}.`);
    ids.add(id);
    if (
      candidate.kind !== 'investigation' &&
      candidate.kind !== 'pickup' &&
      candidate.kind !== 'collection' &&
      candidate.kind !== 'goal'
    ) {
      throw new Error(`interactions[${index}].kind is unsupported.`);
    }
    const progress = candidate.progress === undefined
      ? undefined
      : parseInteractionProgress(candidate.progress, index);
    const actionId = candidate.actionId === undefined
      ? undefined
      : nonEmptyString(candidate.actionId, `interactions[${index}].actionId`);
    const actionLabel = candidate.actionLabel === undefined
      ? undefined
      : nonEmptyString(
        candidate.actionLabel,
        `interactions[${index}].actionLabel`,
      );
    if (
      candidate.activateOnClose !== undefined &&
      typeof candidate.activateOnClose !== 'boolean'
    ) {
      throw new Error(`interactions[${index}].activateOnClose must be boolean.`);
    }
    return Object.freeze({
      id,
      kind: candidate.kind,
      ...(progress ? { progress } : {}),
      ...(actionId ? { actionId } : {}),
      ...(actionLabel ? { actionLabel } : {}),
      ...(candidate.activateOnClose === undefined
        ? {}
        : { activateOnClose: candidate.activateOnClose }),
      label: nonEmptyString(candidate.label, `interactions[${index}].label`),
      title: nonEmptyString(candidate.title, `interactions[${index}].title`),
      content: nonEmptyString(candidate.content, `interactions[${index}].content`),
      x: finite(candidate.x, `interactions[${index}].x`),
      y: finite(candidate.y, `interactions[${index}].y`),
      rangeX: positive(candidate.rangeX, `interactions[${index}].rangeX`),
      rangeY: positive(candidate.rangeY, `interactions[${index}].rangeY`),
    });
  }));
}

function parseInteractionProgress(
  value: unknown,
  index: number,
): NonNullable<InteractionObject['progress']> {
  if (!isRecord(value)) {
    throw new Error(`interactions[${index}].progress must be an object.`);
  }
  exactKeys(
    value,
    INTERACTION_PROGRESS_KEYS,
    `interactions[${index}].progress`,
  );
  if (value.category !== 'collection' && value.category !== 'goal') {
    throw new Error(`interactions[${index}].progress.category is unsupported.`);
  }
  return Object.freeze({
    category: value.category,
    id: nonEmptyString(value.id, `interactions[${index}].progress.id`),
  });
}

function anchorsEqual(left: SnapshotAnchor, right: SnapshotAnchor): boolean {
  return left.x === right.x &&
    left.y === right.y &&
    left.facing === right.facing;
}

export function validatePrototypeLevelDefinition(
  value: unknown,
): PrototypeLevelDefinition {
  if (!isRecord(value)) {
    throw new Error('Prototype level definition must be an object.');
  }
  exactKeys(value, ROOT_KEYS, 'Prototype level definition');
  if (value.schemaVersion !== PROTOTYPE_LEVEL_SCHEMA_VERSION) {
    throw new Error('Prototype level schemaVersion is unsupported.');
  }
  const levelId = nonEmptyString(value.levelId, 'levelId');
  if (!isRecord(value.size)) throw new Error('size must be an object.');
  exactKeys(value.size, ['width', 'height'], 'size');
  const size = Object.freeze({
    width: positive(value.size.width, 'size.width'),
    height: positive(value.size.height, 'size.height'),
  });
  const spawn = anchor(value.spawn, 'spawn');
  if (!Array.isArray(value.terrain) || value.terrain.length === 0) {
    throw new Error('terrain must contain at least one static body.');
  }
  const terrain = Object.freeze(value.terrain.map((candidate, index) =>
    rectangle(
      candidate,
      'static-rectangle',
      `terrain[${index}]`,
    ) as PrototypeTerrainDefinition));
  const routeGate = rectangle(
    value.routeGate,
    'route-gate',
    'routeGate',
  ) as PrototypeRouteGateDefinition;
  const liftDefinition = lift(value.lift);
  const failure = failureZone(value.failureZone);
  const routeEffectId = nonEmptyString(value.routeEffectId, 'routeEffectId');
  const parsedBodyLabels = bodyLabels(value.bodyLabels);
  const scenario = snapshotScenario(
    value.snapshotScenario,
    levelId,
    spawn,
    liftDefinition,
  );
  const definitionInteractions = interactions(value.interactions);

  const physicalObjects = [
    ...terrain,
    routeGate,
    liftDefinition,
    failure,
  ];
  const objectIds = new Set<string>();
  const labelSet = new Set<string>(Object.values(parsedBodyLabels));
  for (const object of physicalObjects) {
    if (objectIds.has(object.objectId)) {
      throw new Error(`Duplicate prototype objectId: ${object.objectId}.`);
    }
    objectIds.add(object.objectId);
    if (labelSet.has(object.label)) {
      throw new Error(`Duplicate prototype body label: ${object.label}.`);
    }
    labelSet.add(object.label);
  }

  return Object.freeze({
    schemaVersion: PROTOTYPE_LEVEL_SCHEMA_VERSION,
    levelId,
    size,
    spawn,
    terrain,
    routeGate,
    lift: liftDefinition,
    failureZone: failure,
    routeEffectId,
    bodyLabels: parsedBodyLabels,
    snapshotScenario: scenario,
    interactions: definitionInteractions,
  });
}
