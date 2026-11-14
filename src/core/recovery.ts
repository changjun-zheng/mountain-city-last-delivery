import type { BusinessRuntimeBus } from './business-runtime-bus.ts';
import type {
  EventProducerHandle,
  PlayerFailureCoordinationResult,
} from './events.ts';
import type {
  PlayerControlCoordinator,
  PlayerState,
} from './player.ts';
import type { PermanentEffectSnapshot } from './progress.ts';
import type {
  GrayboxCheckpointConfig,
  SnapshotAnchor,
  SnapshotScenario,
  TemporarySnapshot,
  TemporarySnapshotObject,
} from './snapshot.ts';
import {
  getGrayboxCheckpointConfig,
  GRAYBOX_SNAPSHOT_SCENARIO,
  SnapshotValidationError,
  validateTemporarySnapshot,
} from './snapshot.ts';
import type { SnapshotCaptureRuntimeSnapshot } from './snapshot-capture-runtime.ts';
import type { CheckpointTriggerOccupancySnapshot } from './checkpoint-triggers.ts';
import type {
  PauseOwner,
  PauseRequestKey,
  PauseToken,
  RuntimeLifecycleController,
} from './lifecycle.ts';

export const PLAYER_FAILURE_EVENT_TYPE =
  'prototype.failure.player-fell' as const;
export const PLAYER_FAILURE_ZONE_ID = 'failure-gap-early-a' as const;

// Engineering-only values for the current graybox. These do not define final
// recovery timing, camera policy or gameplay penalties.
export const PLAYER_RECOVERY_PROTOTYPE = Object.freeze({
  fadeOutMs: 500,
  fadeInMs: 500,
  maxCaptureSettleTicks: 120,
});

export type FailureZoneSnapshot = Readonly<{
  zoneId: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  occupied: boolean;
  occupiedSteps: number;
  lastOccupiedSteps: number;
  enterCount: number;
  exitCount: number;
  lastTransitionTick: number | null;
  enteredThisStep: boolean;
}>;

export type RecoveryAnchorValidationResult =
  | Readonly<{
    status: 'valid';
    support: string;
    blockerLabels: readonly string[];
  }>
  | Readonly<{
    status: 'invalid';
    reason: string;
    blockerLabels: readonly string[];
  }>;

export type RecoveryWorldValidationIssue = Readonly<{
  code: string;
  message: string;
}>;

export type RecoveryWorldValidationResult = Readonly<{
  status: 'valid' | 'invalid';
  critical: readonly RecoveryWorldValidationIssue[];
  warnings: readonly RecoveryWorldValidationIssue[];
}>;

export type RecoveryAnchorAttempt = Readonly<{
  role: 'primary' | 'fallback';
  fallbackIndex: number | null;
  anchor: SnapshotAnchor;
  status: 'valid' | 'invalid';
  support: string | null;
  reason: string | null;
  blockerLabels: readonly string[];
}>;

export type PlayerRecoveryWorld = Readonly<{
  readonly failureZone: FailureZoneSnapshot;
  readonly state: PlayerState;
  readonly frozenTemporaryObjectIds: readonly string[];
  applyTemporarySnapshot(objects: readonly TemporarySnapshotObject[]): void;
  rebuildRecoveryWorld(): void;
  validateRecoveryWorld(
    objects: readonly TemporarySnapshotObject[],
    expectedPermanentEffects: readonly PermanentEffectSnapshot[],
  ): RecoveryWorldValidationResult;
  validateRecoveryAnchor(
    anchor: SnapshotAnchor,
    checkpointId: string,
  ): RecoveryAnchorValidationResult;
  placePlayerAtAnchor(anchor: SnapshotAnchor): void;
  synchronizeRecoveryOccupancy(tick: number): void;
}>;

export type PlayerRecoveryPhase =
  | 'idle'
  | 'fading-out'
  | 'waiting-for-capture'
  | 'auto-rebuilding'
  | 'manual-retry-pending'
  | 'restoring'
  | 'validating'
  | 'fading-in'
  | 'succeeded'
  | 'failed';

export type PlayerRecoveryView = 'game' | 'recovery-error' | 'title';

export type RecoveryRetryResult = Readonly<{
  status: 'started' | 'ignored' | 'blocked';
  message: string;
}>;

export type RecoveryViewResult = Readonly<{
  status: 'changed' | 'ignored';
  message: string;
}>;

export type PlayerRecoveryFaultPoint =
  | 'after-source-validation'
  | 'after-temporary-snapshot'
  | 'after-permanent-effects'
  | 'after-rebuild'
  | 'after-anchor-validation'
  | 'after-player-placement'
  | 'before-control-release';

export type PlayerRecoveryOptions = Readonly<{
  snapshotScenario?: SnapshotScenario;
  faultInjector?: (point: PlayerRecoveryFaultPoint) => void;
  // Read-only test seam for exercising preflight rejection through the complete
  // recovery flow. Hosts cannot submit replacement snapshots through this API.
  sourceOverride?: () => unknown;
  // A production decoration system does not exist yet. This narrow seam lets
  // integration tests prove that non-critical warnings do not alter recovery.
  worldValidationWarningInjector?: (
    context: Readonly<{
      runtimeInstanceId: string;
      checkpoint: GrayboxCheckpointConfig;
      objects: readonly TemporarySnapshotObject[];
    }>,
  ) => readonly string[];
}>;

export type PlayerRecoveryPhaseRecord = Readonly<{
  phase: PlayerRecoveryPhase;
  tick: number;
}>;

export type PlayerRecoverySnapshot = Readonly<{
  runtimeInstanceId: string;
  phase: PlayerRecoveryPhase;
  view: PlayerRecoveryView;
  message: string;
  detectionCount: number;
  recoveryCount: number;
  ignoredSignalCount: number;
  controlLockHeld: boolean;
  triggersShielded: boolean;
  fadeElapsedMs: number;
  fadeAlpha: number;
  captureWaitTicks: number;
  currentFailureId: string | null;
  failureEventId: number | null;
  failureEventAcknowledged: boolean;
  failureEventRetired: boolean;
  detectedTick: number | null;
  admittedTick: number | null;
  sourceSelectedTick: number | null;
  restoredTick: number | null;
  validatedTick: number | null;
  placedTick: number | null;
  fadeInCompletedTick: number | null;
  releasedTick: number | null;
  sourceCheckpointId: string | null;
  sourceAnchor: SnapshotAnchor | null;
  selectedAnchor: SnapshotAnchor | null;
  selectedAnchorRole: 'primary' | 'fallback' | null;
  selectedFallbackIndex: number | null;
  anchorAttempts: readonly RecoveryAnchorAttempt[];
  worldValidation: RecoveryWorldValidationResult | null;
  sourceSnapshot: TemporarySnapshot | null;
  anchorValidation: RecoveryAnchorValidationResult | null;
  lastError: string | null;
  lastFailureStage: string | null;
  lastFailureCode: string | null;
  automaticRebuildAttempts: number;
  automaticRebuildCount: number;
  managedWorldRebuildCount: number;
  manualRetryCount: number;
  manualRetryPending: boolean;
  errorPauseHeld: boolean;
  errorPauseRequestCount: number;
  titleRoundTrips: number;
  phaseHistory: readonly PlayerRecoveryPhaseRecord[];
}>;

export type PlayerRecoveryRuntimeOptions = Readonly<{
  bus: BusinessRuntimeBus;
  controls: PlayerControlCoordinator;
  world: PlayerRecoveryWorld;
  getCurrentSnapshot: () => TemporarySnapshot | null;
  getCaptureSnapshot: () => SnapshotCaptureRuntimeSnapshot;
  reconcilePermanentEffects: () => void;
  getPermanentEffects: () => readonly PermanentEffectSnapshot[];
  interruptInteraction: () => void;
  resetInputsAfterPlacement: () => void;
  restoreFacing: (facing: -1 | 1) => void;
  synchronizeCheckpointBaseline: (
    states: readonly CheckpointTriggerOccupancySnapshot[],
    enabled: boolean,
    tick: number,
  ) => void;
  getCheckpointStates: () => readonly CheckpointTriggerOccupancySnapshot[];
  getCheckpointEnabled: () => boolean;
  getLifecycle: () => RuntimeLifecycleController;
  options?: PlayerRecoveryOptions;
}>;

type RecoveryAttemptMode = 'initial' | 'automatic-rebuild' | 'manual-retry';
type RecoveryAttemptStage =
  | 'preflight'
  | 'source-validation'
  | 'temporary-snapshot'
  | 'permanent-effects'
  | 'managed-world-rebuild'
  | 'world-validation'
  | 'anchor-validation'
  | 'player-placement'
  | 'control-release';

export class PlayerRecoveryRuntime {
  readonly runtimeInstanceId: string;
  readonly #bus: BusinessRuntimeBus;
  readonly #controls: PlayerControlCoordinator;
  readonly #world: PlayerRecoveryWorld;
  readonly #getCurrentSnapshot: () => TemporarySnapshot | null;
  readonly #getCaptureSnapshot: () => SnapshotCaptureRuntimeSnapshot;
  readonly #reconcilePermanentEffects: () => void;
  readonly #getPermanentEffects: () => readonly PermanentEffectSnapshot[];
  readonly #interruptInteraction: () => void;
  readonly #resetInputsAfterPlacement: () => void;
  readonly #restoreFacing: (facing: -1 | 1) => void;
  readonly #synchronizeCheckpointBaseline: (
    states: readonly CheckpointTriggerOccupancySnapshot[],
    enabled: boolean,
    tick: number,
  ) => void;
  readonly #getCheckpointStates: PlayerRecoveryRuntimeOptions['getCheckpointStates'];
  readonly #getCheckpointEnabled: () => boolean;
  readonly #getLifecycle: PlayerRecoveryRuntimeOptions['getLifecycle'];
  readonly #producer: EventProducerHandle;
  readonly #owner = Symbol('player-recovery-control');
  readonly #errorPauseOwner: PauseOwner = Symbol('player-recovery-error-pause-owner');
  readonly #faultInjector: PlayerRecoveryOptions['faultInjector'];
  readonly #sourceOverride: PlayerRecoveryOptions['sourceOverride'];
  readonly #snapshotScenario: SnapshotScenario;
  readonly #worldValidationWarningInjector:
    PlayerRecoveryOptions['worldValidationWarningInjector'];
  readonly #phaseHistory: PlayerRecoveryPhaseRecord[] = [];
  #phase: PlayerRecoveryPhase = 'idle';
  #view: PlayerRecoveryView = 'game';
  #message = 'Fall recovery is idle.';
  #detectionCount = 0;
  #recoveryCount = 0;
  #ignoredSignalCount = 0;
  #controlLockHeld = false;
  #triggersShielded = false;
  #fadeElapsedMs = 0;
  #captureWaitTicks = 0;
  #failureOrdinal = 0;
  #currentFailureId: string | null = null;
  #failureEventId: number | null = null;
  #failureEventAcknowledged = false;
  #failureEventRetired = false;
  #detectedTick: number | null = null;
  #admittedTick: number | null = null;
  #sourceSelectedTick: number | null = null;
  #restoredTick: number | null = null;
  #validatedTick: number | null = null;
  #placedTick: number | null = null;
  #fadeInCompletedTick: number | null = null;
  #releasedTick: number | null = null;
  #lastObservedTick = 0;
  #rawSource: unknown = null;
  #sourceCaptured = false;
  #sourceSnapshot: TemporarySnapshot | null = null;
  #sourceCheckpointId: string | null = null;
  #selectedAnchor: SnapshotAnchor | null = null;
  #selectedAnchorRole: 'primary' | 'fallback' | null = null;
  #selectedFallbackIndex: number | null = null;
  #anchorAttempts: RecoveryAnchorAttempt[] = [];
  #worldValidation: RecoveryWorldValidationResult | null = null;
  #anchorValidation: RecoveryAnchorValidationResult | null = null;
  #lastError: string | null = null;
  #lastFailureStage: RecoveryAttemptStage | null = null;
  #lastFailureCode: string | null = null;
  #attemptStage: RecoveryAttemptStage = 'preflight';
  #automaticRebuildAttempts = 0;
  #automaticRebuildCount = 0;
  #managedWorldRebuildCount = 0;
  #manualRetryCount = 0;
  #manualRetryPending = false;
  #errorPauseToken: PauseToken | undefined;
  #errorPauseRequestCount = 0;
  #nextErrorPauseKeyOrdinal = 0;
  #titleRoundTrips = 0;

  constructor(options: PlayerRecoveryRuntimeOptions) {
    this.#bus = options.bus;
    this.runtimeInstanceId = options.bus.runtimeInstanceId;
    this.#controls = options.controls;
    this.#world = options.world;
    this.#getCurrentSnapshot = options.getCurrentSnapshot;
    this.#getCaptureSnapshot = options.getCaptureSnapshot;
    this.#reconcilePermanentEffects = options.reconcilePermanentEffects;
    this.#getPermanentEffects = options.getPermanentEffects;
    this.#interruptInteraction = options.interruptInteraction;
    this.#resetInputsAfterPlacement = options.resetInputsAfterPlacement;
    this.#restoreFacing = options.restoreFacing;
    this.#synchronizeCheckpointBaseline = options.synchronizeCheckpointBaseline;
    this.#getCheckpointStates = options.getCheckpointStates;
    this.#getCheckpointEnabled = options.getCheckpointEnabled;
    this.#getLifecycle = options.getLifecycle;
    this.#producer = options.bus.createProducer();
    this.#faultInjector = options.options?.faultInjector;
    this.#sourceOverride = options.options?.sourceOverride;
    this.#snapshotScenario =
      options.options?.snapshotScenario ?? GRAYBOX_SNAPSHOT_SCENARIO;
    this.#worldValidationWarningInjector =
      options.options?.worldValidationWarningInjector;
  }

  get triggersShielded(): boolean {
    return this.#triggersShielded;
  }

  get controlLockHeld(): boolean {
    return this.#controlLockHeld;
  }

  get blocksDebugActions(): boolean {
    return this.#controlLockHeld;
  }

  detectFailureAfterPhysics(tick: number, zone: FailureZoneSnapshot): void {
    if (!zone.enteredThisStep) return;
    this.#detectionCount++;
    if (this.#controlLockHeld) {
      this.#ignoredSignalCount++;
      this.#message =
        `Tick ${tick} 的重复坠落信号被现有恢复流程吸收；未新建流程。`;
      return;
    }

    this.#lockControl(tick);
    const failureId =
      `${this.runtimeInstanceId}:failure:${++this.#failureOrdinal}`;
    this.#currentFailureId = failureId;
    this.#detectedTick = tick;
    this.#failureEventId = null;
    this.#failureEventAcknowledged = false;
    this.#failureEventRetired = false;
    this.#sourceSelectedTick = null;
    this.#restoredTick = null;
    this.#validatedTick = null;
    this.#placedTick = null;
    this.#fadeInCompletedTick = null;
    this.#releasedTick = null;
    this.#lastObservedTick = tick;
    this.#rawSource = null;
    this.#sourceCaptured = false;
    this.#sourceSnapshot = null;
    this.#sourceCheckpointId = null;
    this.#selectedAnchor = null;
    this.#selectedAnchorRole = null;
    this.#selectedFallbackIndex = null;
    this.#anchorAttempts = [];
    this.#worldValidation = null;
    this.#anchorValidation = null;
    this.#lastError = null;
    this.#lastFailureStage = null;
    this.#lastFailureCode = null;
    this.#attemptStage = 'preflight';
    this.#automaticRebuildAttempts = 0;
    this.#automaticRebuildCount = 0;
    this.#managedWorldRebuildCount = 0;
    this.#manualRetryCount = 0;
    this.#manualRetryPending = false;
    this.#titleRoundTrips = 0;
    this.#view = 'game';
    this.#fadeElapsedMs = 0;
    this.#captureWaitTicks = 0;

    const created = this.#bus.events.create({
      type: PLAYER_FAILURE_EVENT_TYPE,
      payload: {
        failureId,
        zoneId: zone.zoneId,
        detectedTick: tick,
      },
    }, this.#producer);
    if (created.status !== 'created') {
      this.#fail(
        tick,
        `坠落失败事件创建失败：${created.message}`,
      );
      return;
    }
    this.#failureEventId = created.event.eventId;
    const result: PlayerFailureCoordinationResult = Object.freeze({
      status: 'player-failure-recovery-admitted' as const,
      failureId,
      zoneId: zone.zoneId,
      detectedTick: tick,
      admittedTick: tick,
      decision: 'admitted' as const,
      reason: 'single active recovery accepted the real fall signal',
    });
    const completed = this.#bus.completePlayerFailure(
      this.#producer,
      created.event.eventId,
      result,
    );
    if (completed.status !== 'completed') {
      this.#fail(
        tick,
        `坠落失败事件协调结束失败：${completed.message}`,
      );
      return;
    }
    const read = this.#bus.events.readFinalResult(
      this.#producer,
      created.event.eventId,
    );
    if (read.status !== 'available') {
      this.#fail(tick, `坠落失败事件结果不可读取：${read.message}`);
      return;
    }
    const acknowledged = this.#bus.events.acknowledge(
      this.#producer,
      read.result,
    );
    if (acknowledged.status !== 'acknowledged' &&
        acknowledged.status !== 'already-acknowledged') {
      this.#fail(tick, `坠落失败事件确认失败：${acknowledged.message}`);
      return;
    }
    this.#failureEventAcknowledged = true;
    const retired = this.#bus.events.retire(this.#producer, read.result);
    if (retired.status !== 'retired' &&
        retired.status !== 'already-retired') {
      this.#fail(
        tick,
        'message' in retired
          ? `坠落失败事件退役失败：${retired.message}`
          : `坠落失败事件退役失败：${retired.failure.message}`,
      );
      return;
    }
    this.#failureEventRetired = true;
    this.#admittedTick = tick;
    this.#setPhase(
      'fading-out',
      tick,
      `Event #${created.event.eventId} 接纳坠落；控制锁定，开始淡出。`,
    );
  }

  advanceAfterCoordination(tick: number, deltaMs: number): void {
    this.#lastObservedTick = tick;
    if (this.#phase === 'auto-rebuilding') {
      const source = this.#sourceSnapshot;
      if (!source) {
        this.#fail(
          tick,
          '自动重建无法取得已预检查的原始快照。',
          'preflight',
          'automatic-rebuild-source-missing',
        );
        return;
      }
      if (!this.#resourceSafeForWorldWrites(tick)) return;
      this.#runValidatedAttempt(tick, source, 'automatic-rebuild');
      return;
    }
    if (this.#phase === 'manual-retry-pending') {
      if (!this.#resourceSafeForWorldWrites(tick)) return;
      this.#manualRetryPending = false;
      this.#beginAttempt(tick, 'manual-retry');
      return;
    }
    if (this.#phase === 'fading-out') {
      this.#fadeElapsedMs = Math.min(
        PLAYER_RECOVERY_PROTOTYPE.fadeOutMs,
        this.#fadeElapsedMs + deltaMs,
      );
      if (this.#fadeElapsedMs >= PLAYER_RECOVERY_PROTOTYPE.fadeOutMs) {
        this.#setPhase(
          'waiting-for-capture',
          tick,
          '淡出完成；等待既有检查点捕获安全释放资源。',
        );
        this.#advanceInitialAttemptAfterResourceGate(tick);
      }
      return;
    }
    if (this.#phase === 'waiting-for-capture') {
      this.#advanceInitialAttemptAfterResourceGate(tick);
      return;
    }
    if (this.#phase === 'fading-in') {
      this.#fadeElapsedMs = Math.min(
        PLAYER_RECOVERY_PROTOTYPE.fadeInMs,
        this.#fadeElapsedMs + deltaMs,
      );
      if (this.#fadeElapsedMs >= PLAYER_RECOVERY_PROTOTYPE.fadeInMs) {
        try {
          this.#faultInjector?.('before-control-release');
          // Baseline synchronization happens before the independent recovery
          // owner is released, so an anchor inside A/B cannot synthesize enter.
          this.#synchronizeCheckpointBaseline(
            this.#getCheckpointStates(),
            this.#getCheckpointEnabled(),
            tick,
          );
          this.#triggersShielded = false;
          this.#controls.request(this.#owner, false);
          this.#controlLockHeld = false;
          this.#fadeInCompletedTick = tick;
          this.#releasedTick = tick;
          this.#recoveryCount++;
          this.#view = 'game';
          this.#lastError = null;
          this.#lastFailureStage = null;
          this.#lastFailureCode = null;
          this.#manualRetryPending = false;
          this.#setPhase(
            'succeeded',
            tick,
            `恢复完成于 ${this.#sourceSnapshot?.checkpointId ?? '-'}，` +
              `落点 ${this.#selectedAnchorRole ?? '-'}；` +
              '控制与触发已释放。',
          );
        } catch (error) {
          this.#fail(
            tick,
            `恢复最终释放失败：${toMessage(error)}`,
            'control-release',
            'control-release-failed',
          );
        }
      }
    }
  }

  get snapshot(): PlayerRecoverySnapshot {
    const phaseHistory = Object.freeze(
      this.#phaseHistory.map(record => Object.freeze({ ...record })),
    );
    return Object.freeze({
      runtimeInstanceId: this.runtimeInstanceId,
      phase: this.#phase,
      view: this.#view,
      message: this.#message,
      detectionCount: this.#detectionCount,
      recoveryCount: this.#recoveryCount,
      ignoredSignalCount: this.#ignoredSignalCount,
      controlLockHeld: this.#controlLockHeld,
      triggersShielded: this.#triggersShielded,
      fadeElapsedMs: this.#fadeElapsedMs,
      fadeAlpha: this.#fadeAlpha(),
      captureWaitTicks: this.#captureWaitTicks,
      currentFailureId: this.#currentFailureId,
      failureEventId: this.#failureEventId,
      failureEventAcknowledged: this.#failureEventAcknowledged,
      failureEventRetired: this.#failureEventRetired,
      detectedTick: this.#detectedTick,
      admittedTick: this.#admittedTick,
      sourceSelectedTick: this.#sourceSelectedTick,
      restoredTick: this.#restoredTick,
      validatedTick: this.#validatedTick,
      placedTick: this.#placedTick,
      fadeInCompletedTick: this.#fadeInCompletedTick,
      releasedTick: this.#releasedTick,
      sourceCheckpointId:
        this.#sourceSnapshot?.checkpointId ?? this.#sourceCheckpointId,
      sourceAnchor: this.#sourceSnapshot?.anchor ?? null,
      selectedAnchor: this.#selectedAnchor,
      selectedAnchorRole: this.#selectedAnchorRole,
      selectedFallbackIndex: this.#selectedFallbackIndex,
      anchorAttempts: Object.freeze(
        this.#anchorAttempts.map(attempt => Object.freeze({
          ...attempt,
          anchor: Object.freeze({ ...attempt.anchor }),
          blockerLabels: Object.freeze([...attempt.blockerLabels]),
        })),
      ),
      worldValidation: this.#worldValidation
        ? Object.freeze({
          ...this.#worldValidation,
          critical: Object.freeze(
            this.#worldValidation.critical.map(issue => Object.freeze({ ...issue })),
          ),
          warnings: Object.freeze(
            this.#worldValidation.warnings.map(issue => Object.freeze({ ...issue })),
          ),
        })
        : null,
      sourceSnapshot: this.#sourceSnapshot,
      anchorValidation: this.#anchorValidation,
      lastError: this.#lastError,
      lastFailureStage: this.#lastFailureStage,
      lastFailureCode: this.#lastFailureCode,
      automaticRebuildAttempts: this.#automaticRebuildAttempts,
      automaticRebuildCount: this.#automaticRebuildCount,
      managedWorldRebuildCount: this.#managedWorldRebuildCount,
      manualRetryCount: this.#manualRetryCount,
      manualRetryPending: this.#manualRetryPending,
      errorPauseHeld: this.#errorPauseToken !== undefined,
      errorPauseRequestCount: this.#errorPauseRequestCount,
      titleRoundTrips: this.#titleRoundTrips,
      phaseHistory,
    });
  }

  requestManualRetry(): RecoveryRetryResult {
    if (this.#phase !== 'failed' || this.#view !== 'recovery-error' ||
        this.#manualRetryPending) {
      return Object.freeze({
        status: 'ignored' as const,
        message: '手动重试仅在 RecoveryError 状态下接受一次。',
      });
    }
    const released = this.#releaseErrorPause();
    if (!released) {
      return Object.freeze({
        status: 'blocked' as const,
        message: '无法释放当前 RecoveryError 暂停令牌；继续保持锁定。',
      });
    }
    this.#manualRetryCount++;
    this.#manualRetryPending = true;
    this.#view = 'game';
    this.#setPhase(
      'manual-retry-pending',
      this.#lastObservedTick,
      `手动重试 #${this.#manualRetryCount} 已登记；等待下一个合法模拟阶段。`,
    );
    return Object.freeze({
      status: 'started' as const,
      message: this.#message,
    });
  }

  showRecoveryTitle(): RecoveryViewResult {
    if (this.#phase !== 'failed' || this.#view !== 'recovery-error') {
      return Object.freeze({
        status: 'ignored' as const,
        message: '当前没有可返回标题的 RecoveryError。',
      });
    }
    this.#view = 'title';
    return Object.freeze({
      status: 'changed' as const,
      message: '已返回同一运行实例内的最小标题视图。',
    });
  }

  returnToRecoveryError(): RecoveryViewResult {
    if (this.#phase !== 'failed' || this.#view !== 'title') {
      return Object.freeze({
        status: 'ignored' as const,
        message: '当前不在 RecoveryError 标题视图。',
      });
    }
    this.#view = 'recovery-error';
    this.#titleRoundTrips++;
    return Object.freeze({
      status: 'changed' as const,
      message: '已返回原 RecoveryError；快照、进度和身份保持不变。',
    });
  }

  #beginAttempt(tick: number, mode: RecoveryAttemptMode): void {
    let source: TemporarySnapshot;
    try {
      source = this.#resolveAndValidateOriginalSource(tick);
    } catch (error) {
      this.#fail(
        tick,
        `检查点恢复预检查失败：${toMessage(error)}`,
        'preflight',
        sourceFailureCode(error),
      );
      return;
    }
    this.#runValidatedAttempt(tick, source, mode);
  }

  #resolveAndValidateOriginalSource(tick: number): TemporarySnapshot {
    this.#attemptStage = 'preflight';
    if (!this.#sourceCaptured) {
      // Capture the source exactly once. Manual retries and automatic rebuilds
      // must reuse this value even if the current checkpoint record later changes.
      this.#rawSource = this.#sourceOverride
        ? this.#sourceOverride()
        : this.#getCurrentSnapshot();
      this.#sourceCaptured = true;
      this.#sourceCheckpointId = sourceCheckpointIdOf(this.#rawSource);
    }
    if (this.#rawSource === null || this.#rawSource === undefined) {
      throw new SnapshotValidationError(
        'invalid-source',
        '当前没有可用的检查点快照。',
      );
    }
    const source = validateTemporarySnapshot(
      this.#rawSource,
      this.#sourceCheckpointId ?? undefined,
      this.#snapshotScenario,
    );
    if (source.runtimeInstanceId !== this.runtimeInstanceId) {
      throw new SnapshotValidationError(
        'invalid-source',
        '检查点快照不属于当前 Runtime Instance。',
      );
    }
    this.#sourceSnapshot = source;
    this.#sourceCheckpointId = source.checkpointId;
    this.#sourceSelectedTick ??= tick;
    this.#attemptStage = 'source-validation';
    this.#faultInjector?.('after-source-validation');
    return source;
  }

  #runValidatedAttempt(
    tick: number,
    source: TemporarySnapshot,
    mode: RecoveryAttemptMode,
  ): void {
    try {
      this.#restoreValidatedSource(tick, source, mode);
    } catch (error) {
      const stage = this.#attemptStage;
      if (mode === 'initial' && this.#automaticRebuildAttempts === 0) {
        this.#automaticRebuildAttempts = 1;
        this.#fadeElapsedMs = PLAYER_RECOVERY_PROTOTYPE.fadeOutMs;
        this.#setPhase(
          'auto-rebuilding',
          tick,
          `恢复在 ${stage} 阶段失败；使用原快照执行一次完整受管对象重建。`,
        );
        return;
      }
      this.#fail(
        tick,
        `检查点恢复失败于 ${stage}：${toMessage(error)}`,
        stage,
        attemptFailureCode(stage),
      );
    }
  }

  #restoreValidatedSource(
    tick: number,
    source: TemporarySnapshot,
    mode: RecoveryAttemptMode,
  ): void {
    this.#view = 'game';
    this.#setPhase(
      'restoring',
      tick,
      mode === 'automatic-rebuild'
        ? `自动完整重建 ${source.checkpointId} 的全部受管临时对象。`
        : mode === 'manual-retry'
          ? `手动重试 ${source.checkpointId}；从预检查后的原快照重新恢复。`
          : `已原子选取 ${source.checkpointId}；恢复临时平台逻辑状态。`,
    );
    this.#attemptStage = 'temporary-snapshot';
    this.#world.applyTemporarySnapshot(source.objects);
    this.#faultInjector?.('after-temporary-snapshot');
    this.#attemptStage = 'permanent-effects';
    this.#reconcilePermanentEffects();
    this.#faultInjector?.('after-permanent-effects');
    this.#attemptStage = 'managed-world-rebuild';
    this.#world.rebuildRecoveryWorld();
    this.#managedWorldRebuildCount++;
    if (mode === 'automatic-rebuild') this.#automaticRebuildCount++;
    this.#restoredTick = tick;
    this.#faultInjector?.('after-rebuild');
    this.#attemptStage = 'world-validation';
    this.#setPhase(
      'validating',
      tick,
      '临时状态与永久效果已形成完整逻辑结果；验证恢复世界与预设锚点。',
    );
    const checkpoint = getGrayboxCheckpointConfig(
      source.checkpointId,
      this.#snapshotScenario,
    );
    const worldValidation = this.#validateRecoveredWorld(
      source,
      checkpoint,
    );
    this.#worldValidation = worldValidation;
    if (worldValidation.status !== 'valid') {
      throw new Error(
        `恢复世界一致性验证失败：` +
          worldValidation.critical.map(issue => issue.message).join('；'),
      );
    }
    this.#attemptStage = 'anchor-validation';
    this.#anchorAttempts = [];
    this.#anchorValidation = null;
    const anchors: readonly Readonly<{
      anchor: SnapshotAnchor;
      role: 'primary' | 'fallback';
      fallbackIndex: number | null;
    }>[] = [
      Object.freeze({
        anchor: source.anchor,
        role: 'primary' as const,
        fallbackIndex: null,
      }),
      ...checkpoint.fallbackAnchors.map((anchor, fallbackIndex) =>
        Object.freeze({
          anchor,
          role: 'fallback' as const,
          fallbackIndex,
        })),
    ];
    let selected: Readonly<{
      anchor: SnapshotAnchor;
      role: 'primary' | 'fallback';
      fallbackIndex: number | null;
      validation: Extract<RecoveryAnchorValidationResult, { status: 'valid' }>;
    }> | null = null;
    for (const candidate of anchors) {
      const validation = this.#world.validateRecoveryAnchor(
        candidate.anchor,
        source.checkpointId,
      );
      this.#anchorAttempts.push(Object.freeze({
        role: candidate.role,
        fallbackIndex: candidate.fallbackIndex,
        anchor: Object.freeze({ ...candidate.anchor }),
        status: validation.status,
        support: validation.status === 'valid' ? validation.support : null,
        reason: validation.status === 'invalid' ? validation.reason : null,
        blockerLabels: Object.freeze([...validation.blockerLabels]),
      }));
      if (validation.status === 'valid') {
        selected = Object.freeze({ ...candidate, validation });
        break;
      }
      this.#anchorValidation = validation;
    }
    if (!selected) {
      const reasons = this.#anchorAttempts
        .map(attempt =>
          `${attempt.role === 'primary'
            ? 'primary'
            : `fallback[${attempt.fallbackIndex}]`}: ${attempt.reason ?? 'unsafe'}`)
        .join('；');
      throw new Error(
        `锚点验证失败：所有 ${anchors.length} 个预设锚点均不安全（${reasons}）。`,
      );
    }
    this.#selectedAnchor = Object.freeze({ ...selected.anchor });
    this.#selectedAnchorRole = selected.role;
    this.#selectedFallbackIndex = selected.fallbackIndex;
    this.#anchorValidation = selected.validation;
    this.#validatedTick = tick;
    this.#faultInjector?.('after-anchor-validation');
    this.#attemptStage = 'player-placement';
    this.#world.placePlayerAtAnchor(selected.anchor);
    this.#placedTick = tick;
    this.#faultInjector?.('after-player-placement');
    this.#world.synchronizeRecoveryOccupancy(tick);
    this.#synchronizeCheckpointBaseline(
      this.#getCheckpointStates(),
      false,
      tick,
    );
    this.#resetInputsAfterPlacement();
    this.#restoreFacing(selected.anchor.facing);
    this.#fadeElapsedMs = 0;
    this.#attemptStage = 'control-release';
    this.#setPhase(
      'fading-in',
      tick,
      `已放置到 ${source.checkpointId} 的 ` +
        `${selected.role === 'primary'
          ? '主锚点'
          : `备用锚点 #${(selected.fallbackIndex ?? 0) + 1}`}；开始淡入。`,
    );
  }

  #validateRecoveredWorld(
    source: TemporarySnapshot,
    checkpoint: GrayboxCheckpointConfig,
  ): RecoveryWorldValidationResult {
    const worldResult = this.#world.validateRecoveryWorld(
      source.objects,
      this.#getPermanentEffects(),
    );
    const critical = [...worldResult.critical];
    if (!this.#controlLockHeld) {
      critical.push(Object.freeze({
        code: 'recovery-control-lock-missing',
        message: '恢复世界验证期间控制锁未保持。',
      }));
    }
    if (!this.#triggersShielded) {
      critical.push(Object.freeze({
        code: 'recovery-trigger-shield-missing',
        message: '恢复世界验证期间检查点触发屏蔽未保持。',
      }));
    }
    const injectedWarnings = this.#worldValidationWarningInjector?.({
      runtimeInstanceId: this.runtimeInstanceId,
      checkpoint,
      objects: source.objects,
    }) ?? [];
    const warnings = [
      ...worldResult.warnings,
      ...injectedWarnings.map((message, index) => Object.freeze({
        code: `synthetic-warning-${index + 1}`,
        message,
      })),
    ];
    return Object.freeze({
      status: critical.length === 0 ? 'valid' as const : 'invalid' as const,
      critical: Object.freeze(critical),
      warnings: Object.freeze(warnings),
    });
  }

  #captureSafe(): boolean {
    const capture = this.#getCaptureSnapshot();
    return !capture.lock.held &&
      !capture.resourceOwnership.executorOwnerHeld &&
      capture.resourceOwnership.resourcesReleased &&
      this.#world.frozenTemporaryObjectIds.length === 0;
  }

  #advanceInitialAttemptAfterResourceGate(tick: number): void {
    if (!this.#resourceSafeForWorldWrites(tick)) return;
    this.#beginAttempt(tick, 'initial');
  }

  #resourceSafeForWorldWrites(tick: number): boolean {
    if (this.#captureSafe()) return true;
    this.#captureWaitTicks++;
    if (this.#captureWaitTicks >
        PLAYER_RECOVERY_PROTOTYPE.maxCaptureSettleTicks) {
      this.#fail(
        tick,
        `等待受管捕获资源安全释放超过 ` +
          `${PLAYER_RECOVERY_PROTOTYPE.maxCaptureSettleTicks} Tick；` +
          '未执行任何恢复性世界写入。',
      );
      return false;
    }
    this.#message =
      `等待捕获锁、资源所有权或临时对象冻结安全释放；` +
      `已等待 ${this.#captureWaitTicks} Tick。`;
    return false;
  }

  #lockControl(tick: number): void {
    this.#controls.request(this.#owner, true);
    this.#controlLockHeld = true;
    this.#triggersShielded = true;
    this.#interruptInteraction();
    this.#setPhase(
      'fading-out',
      tick,
      '坠落已检测；控制锁定并屏蔽新检查点／失败请求。',
    );
  }

  #setPhase(
    phase: PlayerRecoveryPhase,
    tick: number,
    message: string,
  ): void {
    this.#phase = phase;
    this.#message = message;
    const last = this.#phaseHistory.at(-1);
    if (!last || last.phase !== phase || last.tick !== tick) {
      this.#phaseHistory.push(Object.freeze({ phase, tick }));
      if (this.#phaseHistory.length > 32) this.#phaseHistory.shift();
    }
  }

  #fail(
    tick: number,
    message: string,
    stage: RecoveryAttemptStage = 'preflight',
    code = 'recovery-error',
  ): void {
    this.#lastError = message;
    this.#lastFailureStage = stage;
    this.#lastFailureCode = code;
    this.#triggersShielded = true;
    this.#view = 'recovery-error';
    this.#manualRetryPending = false;
    this.#fadeElapsedMs = PLAYER_RECOVERY_PROTOTYPE.fadeOutMs;
    this.#setPhase('failed', tick, message);
    this.#acquireErrorPause();
  }

  #acquireErrorPause(): void {
    if (this.#errorPauseToken !== undefined) return;
    try {
      const key: PauseRequestKey = Symbol(
        `player-recovery-error-${++this.#nextErrorPauseKeyOrdinal}`,
      );
      const token = this.#getLifecycle().acquire(this.#errorPauseOwner, key);
      if (token) {
        this.#errorPauseToken = token;
        this.#errorPauseRequestCount++;
      }
    } catch (error) {
      this.#lastError += `；RecoveryError 暂停令牌申请失败：${toMessage(error)}`;
    }
  }

  #releaseErrorPause(): boolean {
    const token = this.#errorPauseToken;
    if (token === undefined) return true;
    try {
      const result = this.#getLifecycle().release(this.#errorPauseOwner, token);
      if (result === 'released' || result === 'already-released') {
        this.#errorPauseToken = undefined;
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  #fadeAlpha(): number {
    if (this.#phase === 'fading-out') {
      return Math.min(
        1,
        this.#fadeElapsedMs / PLAYER_RECOVERY_PROTOTYPE.fadeOutMs,
      );
    }
    if (this.#phase === 'waiting-for-capture' ||
        this.#phase === 'auto-rebuilding' ||
        this.#phase === 'manual-retry-pending' ||
        this.#phase === 'restoring' ||
        this.#phase === 'validating' ||
        this.#phase === 'failed') {
      return 1;
    }
    if (this.#phase === 'fading-in') {
      return Math.max(
        0,
        1 - this.#fadeElapsedMs / PLAYER_RECOVERY_PROTOTYPE.fadeInMs,
      );
    }
    return 0;
  }
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function sourceCheckpointIdOf(value: unknown): string | null {
  return typeof value === 'object' && value !== null &&
    'checkpointId' in value &&
    typeof value.checkpointId === 'string' &&
    value.checkpointId.length > 0
    ? value.checkpointId
    : null;
}

function sourceFailureCode(error: unknown): string {
  if (error instanceof SnapshotValidationError &&
      error.kind === 'version-incompatible') {
    return 'snapshot-version-incompatible';
  }
  return 'snapshot-invalid-source';
}

function attemptFailureCode(stage: RecoveryAttemptStage): string {
  switch (stage) {
    case 'source-validation': return 'source-validation-failed';
    case 'temporary-snapshot': return 'temporary-snapshot-failed';
    case 'permanent-effects': return 'permanent-effects-failed';
    case 'managed-world-rebuild': return 'managed-world-rebuild-failed';
    case 'world-validation': return 'world-validation-failed';
    case 'anchor-validation': return 'anchor-validation-failed';
    case 'player-placement': return 'player-placement-failed';
    case 'control-release': return 'control-release-failed';
    case 'preflight': return 'preflight-failed';
  }
}
