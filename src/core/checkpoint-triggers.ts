import type { BusinessRuntimeBus } from './business-runtime-bus.ts';
import type {
  CheckpointEntryCoordinationResult,
  EventDispatchResult,
  EventProducerHandle,
} from './events.ts';
import {
  getGrayboxCheckpointConfig,
  GRAYBOX_TEST_CAPTURE_CHECKPOINT_A_ID,
  GRAYBOX_TEST_CAPTURE_CHECKPOINT_B_ID,
  type GrayboxCheckpointConfig,
} from './snapshot.ts';
import type {
  SnapshotCaptureRequestResult,
  SnapshotCaptureRuntimeSnapshot,
} from './snapshot-capture-runtime.ts';

export const CHECKPOINT_ENTRY_EVENT_TYPE =
  'prototype.checkpoint.entry.observed' as const;

export type CheckpointTriggerDefinition = Readonly<{
  triggerId: string;
  label: string;
  checkpointId: string;
  competitionGroup: string;
  priority: number;
  x: number;
  y: number;
  width: number;
  height: number;
}>;

// Prototype-only graybox trigger geometry. These priorities and positions do
// not define final level placement or product rules.
export const GRAYBOX_CHECKPOINT_TRIGGERS: readonly CheckpointTriggerDefinition[] =
  Object.freeze([
    Object.freeze({
      triggerId: 'checkpoint-trigger-a',
      label: '检查点 A',
      checkpointId: GRAYBOX_TEST_CAPTURE_CHECKPOINT_A_ID,
      competitionGroup: 'graybox-checkpoint-overlap',
      priority: 10,
      x: 1200,
      y: 470,
      width: 80,
      height: 92,
    }),
    Object.freeze({
      triggerId: 'checkpoint-trigger-b',
      label: '检查点 B',
      checkpointId: GRAYBOX_TEST_CAPTURE_CHECKPOINT_B_ID,
      competitionGroup: 'graybox-checkpoint-overlap',
      priority: 20,
      x: 1245,
      y: 470,
      width: 80,
      height: 92,
    }),
  ]);

export type CheckpointTriggerOccupancySnapshot = Readonly<{
  triggerId: string;
  occupied: boolean;
  occupiedSteps: number;
  lastOccupiedSteps: number;
  enterCount: number;
  exitCount: number;
  lastTransitionTick: number | null;
}>;

export type CheckpointTriggerZoneSnapshot = CheckpointTriggerDefinition & Readonly<{
  occupied: boolean;
  occupiedSteps: number;
  lastOccupiedSteps: number;
  enterCount: number;
  exitCount: number;
  lastTransitionTick: number | null;
  opportunityId: string | null;
  entryEventId: number | null;
  lastDecision: CheckpointEntryCoordinationResult['decision'] | null;
  lastReason: string | null;
}>;

export type CheckpointArbitrationEntrant = Readonly<{
  triggerId: string;
  checkpointId: string;
  priority: number;
  opportunityId: string;
  entryEventId: number;
  detectedTick: number;
  decision: CheckpointEntryCoordinationResult['decision'];
  reason: string;
  finalized: boolean;
  retired: boolean;
}>;

export type CheckpointArbitrationRecord = Readonly<{
  batchTick: number;
  closedTick: number;
  arbitrationTick: number;
  winnerTriggerId: string | null;
  winnerCheckpointId: string | null;
  winnerOpportunityId: string | null;
  winnerEntryEventId: number | null;
  captureEventId: number | null;
  captureRequestStatus: string;
  entrants: readonly CheckpointArbitrationEntrant[];
}>;

export type CheckpointTriggerPhase =
  | 'idle'
  | 'collecting'
  | 'arbitrated'
  | 'saving'
  | 'saved'
  | 'blocked'
  | 'failed';

export type CheckpointTriggerRuntimeSnapshot = Readonly<{
  enabled: boolean;
  phase: CheckpointTriggerPhase;
  batchOpen: boolean;
  batchTick: number | null;
  closedTick: number | null;
  arbitrationTick: number | null;
  batchCount: number;
  entryEventCount: number;
  selectedCount: number;
  captureRequestCount: number;
  blockedCount: number;
  failureCount: number;
  currentCheckpointId: string | null;
  candidateCheckpointId: string | null;
  latestOpportunityId: string | null;
  latestEntryEventId: number | null;
  latestCaptureEventId: number | null;
  latestCaptureRequestId: string | null;
  feedbackKind: 'idle' | 'saving' | 'saved' | 'blocked' | 'failed';
  feedback: string;
  lastArbitration: CheckpointArbitrationRecord | null;
  recentArbitrations: readonly CheckpointArbitrationRecord[];
  zones: readonly CheckpointTriggerZoneSnapshot[];
}>;

type TriggerRuntime = {
  readonly definition: CheckpointTriggerDefinition;
  occupied: boolean;
  occupiedSteps: number;
  lastOccupiedSteps: number;
  enterCount: number;
  exitCount: number;
  lastTransitionTick: number | null;
  opportunityId: string | null;
  entryEventId: number | null;
  lastDecision: CheckpointEntryCoordinationResult['decision'] | null;
  lastReason: string | null;
};

type BatchedEntry = Readonly<{
  definition: CheckpointTriggerDefinition;
  opportunityId: string;
  eventId: number;
  detectedTick: number;
  batchTick: number;
}>;

type PendingWinner = Readonly<{
  definition: CheckpointTriggerDefinition;
  opportunityId: string;
  eventId: number;
}>;

type RequestCapture = (
  checkpointId: string,
  simulationTick: number,
  authorization: Readonly<{
    runtimeInstanceId: string;
    levelId: string;
    checkpointId: string;
    requestId: string;
    sourceEntryEventId: number;
    granted: boolean;
  }>,
) => SnapshotCaptureRequestResult;

export function validateCheckpointTriggerDefinitions(
  definitions: readonly CheckpointTriggerDefinition[],
): readonly CheckpointTriggerDefinition[] {
  if (definitions.length < 1) {
    throw new Error('At least one checkpoint trigger definition is required.');
  }
  const triggerIds = new Set<string>();
  const checkpointIds = new Set<string>();
  const prioritiesByGroup = new Map<string, Set<number>>();
  for (const definition of definitions) {
    if (!definition.triggerId || !definition.label ||
        !definition.checkpointId || !definition.competitionGroup) {
      throw new Error('Checkpoint trigger identity and labels must be non-empty.');
    }
    if (triggerIds.has(definition.triggerId)) {
      throw new Error(`Duplicate checkpoint triggerId: ${definition.triggerId}.`);
    }
    if (checkpointIds.has(definition.checkpointId)) {
      throw new Error(`Duplicate checkpoint trigger checkpointId: ${definition.checkpointId}.`);
    }
    triggerIds.add(definition.triggerId);
    checkpointIds.add(definition.checkpointId);
    if (!Number.isSafeInteger(definition.priority)) {
      throw new Error(`Checkpoint priority must be a safe integer: ${definition.triggerId}.`);
    }
    for (const [label, value] of [
      ['x', definition.x],
      ['y', definition.y],
      ['width', definition.width],
      ['height', definition.height],
    ] as const) {
      if (!Number.isFinite(value) || (label === 'width' || label === 'height') && value <= 0) {
        throw new Error(`Checkpoint trigger ${definition.triggerId} has invalid ${label}.`);
      }
    }
    const config = getGrayboxCheckpointConfig(definition.checkpointId);
    if (config.anchor.x < definition.x - definition.width / 2 ||
        config.anchor.x > definition.x + definition.width / 2 ||
        config.anchor.y < definition.y - definition.height / 2 ||
        config.anchor.y > definition.y + definition.height / 2) {
      throw new Error(
        `Checkpoint anchor for ${definition.checkpointId} is outside its trigger area.`,
      );
    }
    const priorities = prioritiesByGroup.get(definition.competitionGroup) ??
      new Set<number>();
    if (priorities.has(definition.priority)) {
      throw new Error(
        `Duplicate checkpoint priority ${definition.priority} in ` +
          `competition group ${definition.competitionGroup}.`,
      );
    }
    priorities.add(definition.priority);
    prioritiesByGroup.set(definition.competitionGroup, priorities);
  }
  return definitions;
}

validateCheckpointTriggerDefinitions(GRAYBOX_CHECKPOINT_TRIGGERS);

export function arbitrateCheckpointTriggerEntries<
  T extends Readonly<{
    definition: Pick<CheckpointTriggerDefinition, 'priority'>;
    eventId: number;
  }>,
>(entries: readonly T[]): readonly T[] {
  return Object.freeze([...entries].sort((left, right) =>
    left.definition.priority - right.definition.priority ||
    left.eventId - right.eventId));
}

// The host owns timing and calls these methods around its single Matter step.
// This class only records real occupancy edges, closes one batch per Tick and
// grants the existing capture runtime to the deterministic winner.
export class CheckpointTriggerRuntime {
  readonly #bus: BusinessRuntimeBus;
  readonly #requestCapture: RequestCapture;
  readonly #getCurrentCheckpointId: () => string | null;
  readonly #getCaptureSnapshot: () => SnapshotCaptureRuntimeSnapshot;
  readonly #producer: EventProducerHandle;
  readonly #zones: TriggerRuntime[];
  readonly #zoneById: Map<string, TriggerRuntime>;
  readonly #recentArbitrations: CheckpointArbitrationRecord[] = [];
  #entryOrdinal = 0;
  #batchOpen = false;
  #batchTick: number | null = null;
  #closedTick: number | null = null;
  #arbitrationTick: number | null = null;
  #batch: BatchedEntry[] = [];
  #pendingWinner: PendingWinner | undefined;
  #latestArbitration: CheckpointArbitrationRecord | null = null;
  #phase: CheckpointTriggerPhase = 'idle';
  #feedbackKind: CheckpointTriggerRuntimeSnapshot['feedbackKind'] = 'idle';
  #feedback = '走进检查点区域触发捕获；区域仅在测试路线开放后激活。';
  #entryEventCount = 0;
  #selectedCount = 0;
  #captureRequestCount = 0;
  #blockedCount = 0;
  #failureCount = 0;
  #batchCount = 0;
  #enabled = false;
  #latestOpportunityId: string | null = null;
  #latestEntryEventId: number | null = null;
  #latestCaptureEventId: number | null = null;
  #latestCaptureRequestId: string | null = null;

  constructor(options: Readonly<{
    bus: BusinessRuntimeBus;
    requestCapture: RequestCapture;
    getCurrentCheckpointId: () => string | null;
    getCaptureSnapshot: () => SnapshotCaptureRuntimeSnapshot;
  }>) {
    this.#bus = options.bus;
    this.#requestCapture = options.requestCapture;
    this.#getCurrentCheckpointId = options.getCurrentCheckpointId;
    this.#getCaptureSnapshot = options.getCaptureSnapshot;
    this.#producer = options.bus.createProducer();
    this.#zones = GRAYBOX_CHECKPOINT_TRIGGERS.map(definition => ({
      definition,
      occupied: false,
      occupiedSteps: 0,
      lastOccupiedSteps: 0,
      enterCount: 0,
      exitCount: 0,
      lastTransitionTick: null,
      opportunityId: null,
      entryEventId: null,
      lastDecision: null,
      lastReason: null,
    }));
    this.#zoneById = new Map(this.#zones.map(zone => [
      zone.definition.triggerId,
      zone,
    ]));
  }

  synchronizeBaseline(
    states: readonly CheckpointTriggerOccupancySnapshot[],
    enabled: boolean,
    tick: number,
  ): void {
    this.#assertStates(states);
    for (const zone of this.#zones) {
      const state = states.find(candidate =>
        candidate.triggerId === zone.definition.triggerId);
      zone.occupied = state?.occupied ?? false;
      zone.occupiedSteps = zone.occupied ? 1 : 0;
      zone.lastOccupiedSteps = zone.lastOccupiedSteps;
      zone.lastTransitionTick = tick;
      zone.opportunityId = null;
      zone.entryEventId = null;
      zone.lastDecision = null;
      zone.lastReason = null;
    }
    this.#enabled = enabled;
    this.#batchOpen = false;
    this.#batchTick = null;
    this.#closedTick = null;
    this.#arbitrationTick = null;
    this.#batch = [];
    this.#pendingWinner = undefined;
  }

  beginTick(tick: number): void {
    if (this.#batchOpen) {
      throw new Error(`Checkpoint trigger batch for Tick ${this.#batchTick} is still open.`);
    }
    this.#batchOpen = true;
    this.#batchTick = tick;
    this.#closedTick = null;
    this.#arbitrationTick = null;
    this.#batch = [];
    this.#phase = 'collecting';
  }

  observeAfterPhysics(
    tick: number,
    states: readonly CheckpointTriggerOccupancySnapshot[],
    enabled: boolean,
  ): void {
    if (!this.#batchOpen || this.#batchTick !== tick) {
      throw new Error(`Checkpoint trigger collection is not open for Tick ${tick}.`);
    }
    this.#assertStates(states);
    this.#enabled = enabled;
    for (const definition of GRAYBOX_CHECKPOINT_TRIGGERS) {
      const state = states.find(candidate =>
        candidate.triggerId === definition.triggerId) as
        CheckpointTriggerOccupancySnapshot;
      const zone = this.#zoneById.get(definition.triggerId) as TriggerRuntime;
      const rising = state.occupied && !zone.occupied;
      zone.occupied = state.occupied;
      zone.occupiedSteps = state.occupiedSteps;
      zone.lastOccupiedSteps = state.lastOccupiedSteps;
      zone.enterCount = state.enterCount;
      zone.exitCount = state.exitCount;
      zone.lastTransitionTick = state.lastTransitionTick;
      if (rising && enabled) this.#createEntry(zone, tick);
    }
  }

  closeAndArbitrate(tick: number): void {
    if (!this.#batchOpen || this.#batchTick !== tick) {
      throw new Error(`Checkpoint trigger batch is not open for Tick ${tick}.`);
    }
    this.#batchOpen = false;
    this.#closedTick = tick;
    this.#arbitrationTick = tick;
    this.#batchCount++;
    if (this.#batch.length === 0) return;

    const sorted = arbitrateCheckpointTriggerEntries(this.#batch);
    const winner = sorted[0];
    const entrants: CheckpointArbitrationEntrant[] = [];
    for (const entry of sorted) {
      const selected = entry === winner;
      const completion = this.#bus.completeCheckpointEntry(
        this.#producer,
        entry.eventId,
        {
          status: 'checkpoint-entry-arbitrated',
          triggerId: entry.definition.triggerId,
          checkpointId: entry.definition.checkpointId,
          opportunityId: entry.opportunityId,
          priority: entry.definition.priority,
          detectedTick: entry.detectedTick,
          batchTick: entry.batchTick,
          closedTick: tick,
          arbitrationTick: tick,
          decision: selected ? 'selected' : 'not-selected',
          reason: selected
            ? `priority ${entry.definition.priority} won the closed Tick ${tick} batch`
            : `priority ${entry.definition.priority} lost to ` +
              `${winner.definition.priority}; this opportunity was consumed`,
        },
      );
      let finalized = false;
      let retired = false;
      if (completion.status === 'completed') {
        const read = this.#bus.events.readFinalResult(
          this.#producer,
          entry.eventId,
        );
        if (read.status === 'available') {
          const acknowledged = this.#bus.events.acknowledge(
            this.#producer,
            read.result,
          );
          finalized = acknowledged.status === 'acknowledged' ||
            acknowledged.status === 'already-acknowledged';
          if (finalized) {
            const result = this.#bus.events.retire(
              this.#producer,
              read.result,
            );
            retired = result.status === 'retired' ||
              result.status === 'already-retired';
          }
        }
      } else {
        this.#failureCount++;
        this.#feedbackKind = 'failed';
        this.#feedback = completion.message;
      }
      const zone = this.#zoneById.get(entry.definition.triggerId) as TriggerRuntime;
      zone.lastDecision = selected ? 'selected' : 'not-selected';
      zone.lastReason = selected
        ? `selected at Tick ${tick} with priority ${entry.definition.priority}`
        : `closed-batch loser at Tick ${tick}; consumed without queueing`;
      entrants.push(Object.freeze({
        triggerId: entry.definition.triggerId,
        checkpointId: entry.definition.checkpointId,
        priority: entry.definition.priority,
        opportunityId: entry.opportunityId,
        entryEventId: entry.eventId,
        detectedTick: entry.detectedTick,
        decision: selected ? 'selected' as const : 'not-selected' as const,
        reason: zone.lastReason,
        finalized,
        retired,
      }));
    }
    const winnerEntrant = entrants.find(entry =>
      entry.entryEventId === winner.eventId);
    this.#pendingWinner = winnerEntrant?.finalized && winnerEntrant.retired
      ? Object.freeze({
        definition: winner.definition,
        opportunityId: winner.opportunityId,
        eventId: winner.eventId,
      })
      : undefined;
    this.#selectedCount += this.#pendingWinner ? 1 : 0;
    this.#phase = this.#pendingWinner ? 'arbitrated' : 'blocked';
    this.#feedbackKind = this.#pendingWinner ? 'saving' : 'blocked';
    this.#feedback = this.#pendingWinner
      ? `${winner.definition.label} 赢得 Tick ${tick} 批次；等待协调阶段启动捕获。`
      : `Tick ${tick} 的胜出进入事件未能完成确认／退役，捕获未启动。`;
    this.#latestArbitration = Object.freeze({
      batchTick: tick,
      closedTick: tick,
      arbitrationTick: tick,
      winnerTriggerId: winner.definition.triggerId,
      winnerCheckpointId: winner.definition.checkpointId,
      winnerOpportunityId: winner.opportunityId,
      winnerEntryEventId: winner.eventId,
      captureEventId: null,
      captureRequestStatus: this.#pendingWinner ? 'not-requested' : 'entry-not-retired',
      entrants: Object.freeze(entrants),
    });
    this.#recentArbitrations.push(this.#latestArbitration);
    if (this.#recentArbitrations.length > 8) this.#recentArbitrations.shift();
  }

  startWinnerAfterDispatch(tick: number): void {
    const winner = this.#pendingWinner;
    this.#pendingWinner = undefined;
    if (!winner) return;
    const config = getGrayboxCheckpointConfig(winner.definition.checkpointId);
    const result = this.#requestCapture(
      config.checkpointId,
      tick,
      {
        runtimeInstanceId: this.#bus.runtimeInstanceId,
        levelId: config.levelId,
        checkpointId: config.checkpointId,
        requestId: winner.opportunityId,
        sourceEntryEventId: winner.eventId,
        granted: true,
      },
    );
    this.#captureRequestCount++;
    this.#latestCaptureRequestId = winner.opportunityId;
    const capture = this.#getCaptureSnapshot();
    this.#latestCaptureEventId = capture.eventId;
    this.#latestArbitration = this.#replaceLatestArbitration({
      captureEventId: capture.eventId,
      captureRequestStatus: result.status === 'rejected'
        ? result.reason
        : result.status,
    });
    if (result.status === 'rejected') {
      this.#blockedCount++;
      this.#phase = 'blocked';
      this.#feedbackKind = 'blocked';
      this.#feedback =
        `${winner.definition.label} 本次被阻挡：${result.feedback}；未排队，` +
        `离开后重新进入才会再次尝试。`;
      return;
    }
    this.#phase = 'saving';
    this.#feedbackKind = 'saving';
    this.#feedback =
      `${winner.definition.label} 保存中；进入 Event #${winner.eventId}，` +
      `捕获 Event #${capture.eventId ?? '-'}。`;
  }

  afterDispatch(
    _tick: number,
    _dispatch: EventDispatchResult,
    capture: SnapshotCaptureRuntimeSnapshot,
  ): void {
    if (this.#phase === 'blocked' || this.#phase === 'failed') {
      this.#latestCaptureEventId ??= capture.eventId;
      return;
    }
    if (capture.eventId !== null &&
        capture.authorizationRequestId === this.#latestCaptureRequestId) {
      this.#latestCaptureEventId = capture.eventId;
      if (capture.phase === 'succeeded') {
        this.#phase = 'saved';
        this.#feedbackKind = 'saved';
        this.#feedback =
          `${capture.requestedCheckpointId ?? capture.currentCheckpointId ?? '-'}` +
          ` 已保存；Transaction ${capture.transactionId ?? '-'}，` +
          `Result Event ${capture.resultEventId ?? '-'}。`;
      } else if (capture.phase === 'failed') {
        this.#phase = 'failed';
        this.#failureCount++;
        this.#feedbackKind = 'failed';
        this.#feedback =
          `保存失败：${capture.message}；旧检查点保留，本次进入机会不补发。`;
      } else if (capture.phase === 'blocked') {
        this.#phase = 'blocked';
        this.#blockedCount++;
        this.#feedbackKind = 'blocked';
        this.#feedback =
          `保存被阻挡：${capture.message}；本次进入机会已消耗。`;
      } else if (capture.phase !== 'rejected') {
        this.#phase = 'saving';
        this.#feedbackKind = 'saving';
        this.#feedback =
          `保存中：${capture.requestedCheckpointId ?? '-'} · ` +
          `phase ${capture.phase} · Tick ${capture.capturedAtTick ?? '-'}`;
      }
    }
  }

  noteResetBlocked(message: string): void {
    this.#blockedCount++;
    this.#phase = 'blocked';
    this.#feedbackKind = 'blocked';
    this.#feedback = `R 被安全拒绝：${message}`;
  }

  noteResetCompleted(states: readonly CheckpointTriggerOccupancySnapshot[], tick: number): void {
    this.synchronizeBaseline(states, this.#enabled, tick);
    if (this.#getCaptureSnapshot().phase === 'succeeded') {
      this.#phase = 'saved';
      this.#feedbackKind = 'saved';
    }
  }

  get snapshot(): CheckpointTriggerRuntimeSnapshot {
    const capture = this.#getCaptureSnapshot();
    const candidate = capture.phase === 'idle'
      ? null
      : capture.candidateCheckpointId ?? capture.requestedCheckpointId;
    return Object.freeze({
      enabled: this.#enabled,
      phase: this.#phase,
      batchOpen: this.#batchOpen,
      batchTick: this.#batchTick,
      closedTick: this.#closedTick,
      arbitrationTick: this.#arbitrationTick,
      batchCount: this.#batchCount,
      entryEventCount: this.#entryEventCount,
      selectedCount: this.#selectedCount,
      captureRequestCount: this.#captureRequestCount,
      blockedCount: this.#blockedCount,
      failureCount: this.#failureCount,
      currentCheckpointId: this.#getCurrentCheckpointId(),
      candidateCheckpointId: candidate,
      latestOpportunityId: this.#latestOpportunityId,
      latestEntryEventId: this.#latestEntryEventId,
      latestCaptureEventId: this.#latestCaptureEventId ?? capture.eventId,
      latestCaptureRequestId: this.#latestCaptureRequestId,
      feedbackKind: this.#feedbackKind,
      feedback: this.#feedback,
      lastArbitration: this.#latestArbitration,
      recentArbitrations: Object.freeze(this.#recentArbitrations.map(record =>
        Object.freeze({
          ...record,
          entrants: Object.freeze(record.entrants.map(entrant => ({ ...entrant }))),
        }))),
      zones: Object.freeze(this.#zones.map(zone => Object.freeze({
        ...zone.definition,
        occupied: zone.occupied,
        occupiedSteps: zone.occupiedSteps,
        lastOccupiedSteps: zone.lastOccupiedSteps,
        enterCount: zone.enterCount,
        exitCount: zone.exitCount,
        lastTransitionTick: zone.lastTransitionTick,
        opportunityId: zone.opportunityId,
        entryEventId: zone.entryEventId,
        lastDecision: zone.lastDecision,
        lastReason: zone.lastReason,
      }))),
    });
  }

  #createEntry(zone: TriggerRuntime, tick: number): void {
    const definition = zone.definition;
    const opportunityId =
      `${this.#bus.runtimeInstanceId}:checkpoint-entry:${++this.#entryOrdinal}`;
    const created = this.#bus.events.create({
      type: CHECKPOINT_ENTRY_EVENT_TYPE,
      payload: {
        triggerId: definition.triggerId,
        checkpointId: definition.checkpointId,
        opportunityId,
        priority: definition.priority,
        detectedTick: tick,
        batchTick: tick,
      },
    }, this.#producer);
    if (created.status !== 'created') {
      this.#failureCount++;
      this.#phase = 'failed';
      this.#feedbackKind = 'failed';
      this.#feedback = `检查点进入事件创建失败：${created.message}`;
      return;
    }
    this.#entryEventCount++;
    this.#latestOpportunityId = opportunityId;
    this.#latestEntryEventId = created.event.eventId;
    zone.opportunityId = opportunityId;
    zone.entryEventId = created.event.eventId;
    this.#batch.push(Object.freeze({
      definition,
      opportunityId,
      eventId: created.event.eventId,
      detectedTick: tick,
      batchTick: tick,
    }));
  }

  #assertStates(states: readonly CheckpointTriggerOccupancySnapshot[]): void {
    if (states.length !== this.#zones.length) {
      throw new Error('Checkpoint trigger physics and shared-core registry differ.');
    }
    const known = new Set(states.map(state => state.triggerId));
    for (const zone of this.#zones) {
      if (!known.has(zone.definition.triggerId)) {
        throw new Error(
          `Missing checkpoint trigger occupancy: ${zone.definition.triggerId}.`,
        );
      }
    }
  }

  #replaceLatestArbitration(
    update: Readonly<{
      captureEventId: number | null;
      captureRequestStatus: string;
    }>,
  ): CheckpointArbitrationRecord | null {
    if (!this.#latestArbitration) return null;
    const replacement = Object.freeze({
      ...this.#latestArbitration,
      ...update,
    });
    this.#latestArbitration = replacement;
    this.#recentArbitrations[this.#recentArbitrations.length - 1] = replacement;
    return replacement;
  }
}
