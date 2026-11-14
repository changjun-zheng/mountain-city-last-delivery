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
  TemporarySnapshot,
  TemporarySnapshotObject,
} from './snapshot.ts';
import {
  getGrayboxCheckpointConfig,
  validateTemporarySnapshot,
} from './snapshot.ts';
import type { SnapshotCaptureRuntimeSnapshot } from './snapshot-capture-runtime.ts';
import type { CheckpointTriggerOccupancySnapshot } from './checkpoint-triggers.ts';

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
  | 'restoring'
  | 'validating'
  | 'fading-in'
  | 'succeeded'
  | 'failed';

export type PlayerRecoveryFaultPoint =
  | 'after-source-validation'
  | 'after-temporary-snapshot'
  | 'after-permanent-effects'
  | 'after-rebuild'
  | 'after-anchor-validation'
  | 'after-player-placement'
  | 'before-control-release';

export type PlayerRecoveryOptions = Readonly<{
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
  options?: PlayerRecoveryOptions;
}>;

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
  readonly #producer: EventProducerHandle;
  readonly #owner = Symbol('player-recovery-control');
  readonly #faultInjector: PlayerRecoveryOptions['faultInjector'];
  readonly #sourceOverride: PlayerRecoveryOptions['sourceOverride'];
  readonly #worldValidationWarningInjector:
    PlayerRecoveryOptions['worldValidationWarningInjector'];
  readonly #phaseHistory: PlayerRecoveryPhaseRecord[] = [];
  #phase: PlayerRecoveryPhase = 'idle';
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
  #sourceSnapshot: TemporarySnapshot | null = null;
  #selectedAnchor: SnapshotAnchor | null = null;
  #selectedAnchorRole: 'primary' | 'fallback' | null = null;
  #selectedFallbackIndex: number | null = null;
  #anchorAttempts: RecoveryAnchorAttempt[] = [];
  #worldValidation: RecoveryWorldValidationResult | null = null;
  #anchorValidation: RecoveryAnchorValidationResult | null = null;
  #lastError: string | null = null;

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
    this.#producer = options.bus.createProducer();
    this.#faultInjector = options.options?.faultInjector;
    this.#sourceOverride = options.options?.sourceOverride;
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
    this.#sourceSnapshot = null;
    this.#selectedAnchor = null;
    this.#selectedAnchorRole = null;
    this.#selectedFallbackIndex = null;
    this.#anchorAttempts = [];
    this.#worldValidation = null;
    this.#anchorValidation = null;
    this.#lastError = null;
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
        this.#tryRestore(tick);
      }
      return;
    }
    if (this.#phase === 'waiting-for-capture') {
      this.#captureWaitTicks++;
      if (!this.#captureSafe()) {
        if (this.#captureWaitTicks >
            PLAYER_RECOVERY_PROTOTYPE.maxCaptureSettleTicks) {
          this.#fail(
            tick,
            `等待既有捕获安全释放超过 ` +
              `${PLAYER_RECOVERY_PROTOTYPE.maxCaptureSettleTicks} Tick。`,
          );
          return;
        }
        this.#message =
          `等待既有捕获释放；已等待 ${this.#captureWaitTicks} Tick。`;
        return;
      }
      this.#tryRestore(tick);
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
      sourceCheckpointId: this.#sourceSnapshot?.checkpointId ?? null,
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
      phaseHistory,
    });
  }

  #tryRestore(tick: number): void {
    try {
      if (!this.#captureSafe()) return;
      const current = this.#sourceOverride
        ? this.#sourceOverride()
        : this.#getCurrentSnapshot();
      if (!current) throw new Error('当前没有可用的检查点快照。');
      const requestedCheckpointId =
        typeof current === 'object' && current !== null &&
        'checkpointId' in current &&
        typeof current.checkpointId === 'string'
          ? current.checkpointId
          : undefined;
      const source = validateTemporarySnapshot(current, requestedCheckpointId);
      if (source.runtimeInstanceId !== this.runtimeInstanceId) {
        throw new Error('检查点快照不属于当前 Runtime Instance。');
      }
      this.#sourceSnapshot = source;
      this.#sourceSelectedTick = tick;
      this.#faultInjector?.('after-source-validation');
      this.#setPhase(
        'restoring',
        tick,
        `已原子选取 ${source.checkpointId}；恢复临时平台逻辑状态。`,
      );
      this.#world.applyTemporarySnapshot(source.objects);
      this.#faultInjector?.('after-temporary-snapshot');
      this.#reconcilePermanentEffects();
      this.#faultInjector?.('after-permanent-effects');
      this.#world.rebuildRecoveryWorld();
      this.#restoredTick = tick;
      this.#faultInjector?.('after-rebuild');
      this.#setPhase(
        'validating',
        tick,
        '临时状态与永久效果已形成完整逻辑结果；验证恢复世界与预设锚点。',
      );
      const checkpoint = getGrayboxCheckpointConfig(source.checkpointId);
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
      this.#setPhase(
        'fading-in',
        tick,
        `已放置到 ${source.checkpointId} 的 ` +
          `${selected.role === 'primary'
            ? '主锚点'
            : `备用锚点 #${(selected.fallbackIndex ?? 0) + 1}`}；开始淡入。`,
      );
    } catch (error) {
      this.#fail(tick, `检查点恢复失败：${toMessage(error)}`);
    }
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

  #fail(tick: number, message: string): void {
    this.#lastError = message;
    this.#triggersShielded = true;
    this.#fadeElapsedMs = PLAYER_RECOVERY_PROTOTYPE.fadeOutMs;
    this.#setPhase('failed', tick, message);
  }

  #fadeAlpha(): number {
    if (this.#phase === 'fading-out') {
      return Math.min(
        1,
        this.#fadeElapsedMs / PLAYER_RECOVERY_PROTOTYPE.fadeOutMs,
      );
    }
    if (this.#phase === 'waiting-for-capture' ||
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
