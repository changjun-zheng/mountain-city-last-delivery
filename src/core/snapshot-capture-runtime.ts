import { BusinessRuntimeBus } from './business-runtime-bus.ts';
import type {
  CommandSourceEvent,
  TargetTransactionModule,
} from './commands.ts';
import type {
  EventDispatchResult,
  EventProducerHandle,
} from './events.ts';
import type {
  GrayboxPhysics,
  TemporaryObjectReleaseResult,
} from './graybox.ts';
import type { InMemoryRunProgress } from './progress.ts';
import {
  captureTemporarySnapshot,
  FixedTemporarySnapshotStore,
  getGrayboxCheckpointConfig,
  GRAYBOX_CHECKPOINT_ID,
  GRAYBOX_SNAPSHOT_REGISTRY,
  type GrayboxCheckpointConfig,
  type SnapshotFaultInjector,
  type TemporarySnapshot,
} from './snapshot.ts';
import {
  RuntimeTransactionExecutionManager,
  type TransactionExecutionFaultInjector,
  type TransactionExecutionStatus,
  type TransactionExecutor,
  type TransactionExecutorRequest,
  type TransactionExecutorResult,
} from './transactions.ts';
import {
  TRANSACTION_RESULT_EVENT_TYPE,
  type TransactionFinalResult,
  type TransactionResultAssociation,
  type TransactionResultConsumerContext,
  type TransactionResultLifecycle,
  type TransactionResultSourceHandle,
} from './transaction-results.ts';

export const CHECKPOINT_CAPTURE_EVENT_TYPE =
  'prototype.checkpoint.capture.requested' as const;
export const CHECKPOINT_CAPTURE_COMMAND_TYPE =
  'prototype.snapshot.capture' as const;
export const CHECKPOINT_CAPTURE_TARGET_ID =
  'prototype.snapshot.target' as const;

export type CheckpointCaptureAuthorization = Readonly<{
  runtimeInstanceId: string;
  levelId: string;
  checkpointId: string;
  requestId: string;
  granted: boolean;
}>;

export type SnapshotCaptureFaultPoint =
  | 'before-freeze'
  | 'before-release-freeze'
  | 'before-release-lock';

export type SnapshotCaptureFaultInjector =
  (point: SnapshotCaptureFaultPoint) => void;

export type SnapshotCaptureRuntimeOptions = Readonly<{
  captureFaultInjector?: SnapshotFaultInjector;
  resourceFaultInjector?: SnapshotCaptureFaultInjector;
  transactionFaultInjector?: TransactionExecutionFaultInjector;
}>;

export type SnapshotCapturePhase =
  | 'idle'
  | 'request-pending'
  | 'accepted'
  | 'applying'
  | 'verifying'
  | 'recovery-pending'
  | 'result-pending'
  | 'result-consumed'
  | 'succeeded'
  | 'failed'
  | 'blocked'
  | 'rejected';

export type SnapshotCaptureRequestResult =
  | Readonly<{
    status: 'created' | 'existing';
    feedback: string;
  }>
  | Readonly<{
    status: 'rejected';
    reason:
      | 'invalid-request'
      | 'not-authorized'
      | 'lock-busy'
      | 'event-capacity'
      | 'blocked';
    feedback: string;
  }>;

export type SnapshotCaptureCleanupResult = Readonly<{
  status: 'released' | 'already-released' | 'failed' | 'blocked';
  message: string;
}>;

export type SnapshotCaptureRuntimeSnapshot = Readonly<{
  runtimeInstanceId: string;
  targetId: string;
  phase: SnapshotCapturePhase;
  message: string;
  requestedCheckpointId: string | null;
  candidateCheckpointId: string | null;
  previousCheckpointId: string | null;
  currentCheckpointId: string | null;
  authorizationRequestId: string | null;
  eventId: number | null;
  commandId: number | null;
  transactionId: number | null;
  resultEventId: number | null;
  deliveryStatus: string | null;
  transactionStatus: TransactionExecutionStatus | null;
  terminal: TransactionFinalResult | null;
  resultLifecycle: TransactionResultLifecycle | null;
  acceptedTick: number | null;
  freezeTick: number | null;
  capturedAtTick: number | null;
  verifyTick: number | null;
  committedAtTick: number | null;
  terminalTick: number | null;
  resultCreatedTick: number | null;
  resultConsumedTick: number | null;
  lock: Readonly<{
    levelId: string;
    held: boolean;
    ownedByCapture: boolean;
  }>;
  frozenObjectIds: readonly string[];
  resourceOwnership: Readonly<{
    executorOwnerHeld: boolean;
    freezeOwnedByCapture: boolean;
    lockOwnedByCapture: boolean;
    resourcesReleased: boolean;
  }>;
  captureAttempts: number;
  commitAttempts: number;
  successfulCommits: number;
  cleanupAttempts: number;
  cleanupFailures: number;
  lastCleanupError: string | null;
  originalAcknowledged: boolean;
  originalRetired: boolean;
  resultAcknowledged: boolean;
  resultRetired: boolean;
  resultConsumerAttempts: number;
  resultConsumptionCount: number;
  counts: Readonly<{
    nextEventId: number | null;
    events: number;
    inboxEvents: number;
    commands: number;
    acceptedCommands: number;
    transactionIntents: number;
    transactions: number;
    resultEvents: number;
  }>;
  lastError: string | null;
}>;

export type SnapshotCaptureLockSnapshot = Readonly<{
  levelId: string;
  held: boolean;
  acquireAttempts: number;
  successfulAcquisitions: number;
  releases: number;
}>;

class SnapshotCaptureLock {
  readonly levelId: string;
  #owner: object | undefined;
  #acquireAttempts = 0;
  #successfulAcquisitions = 0;
  #releases = 0;

  constructor(levelId: string) {
    this.levelId = levelId;
  }

  acquire(): object | undefined {
    this.#acquireAttempts++;
    if (this.#owner) return undefined;
    const owner = Object.freeze({ lockOwner: this.#successfulAcquisitions + 1 });
    this.#owner = owner;
    this.#successfulAcquisitions++;
    return owner;
  }

  release(owner: object): TemporaryObjectReleaseResult['status'] {
    if (!this.#owner) return 'already-released';
    if (this.#owner !== owner) return 'owner-mismatch';
    this.#owner = undefined;
    this.#releases++;
    return 'released';
  }

  isHeldBy(owner: object | undefined): boolean {
    return owner !== undefined && this.#owner === owner;
  }

  get snapshot(): SnapshotCaptureLockSnapshot {
    return Object.freeze({
      levelId: this.levelId,
      held: this.#owner !== undefined,
      acquireAttempts: this.#acquireAttempts,
      successfulAcquisitions: this.#successfulAcquisitions,
      releases: this.#releases,
    });
  }
}

type ExecutorState = Readonly<{
  captureAttempts: number;
  commitAttempts: number;
  successfulCommits: number;
  freezeTick: number | null;
  capturedAtTick: number | null;
  committedAtTick: number | null;
  executorOwnerHeld: boolean;
  freezeOwnedByCapture: boolean;
  lockOwnedByCapture: boolean;
  resourceOwnerHeld: boolean;
  cleanupAttempts: number;
  cleanupFailures: number;
  lastCleanupError: string | null;
}>;

type CaptureRequestReceipt = Readonly<{
  checkpointId: string;
  eventId: number;
  commandId: number | null;
  transactionId: number | null;
  resultEventId: number | null;
  phase: SnapshotCapturePhase;
}>;

class SnapshotCaptureExecutor implements TransactionExecutor {
  readonly #source: GrayboxPhysics;
  readonly #store: FixedTemporarySnapshotStore;
  readonly #lock: SnapshotCaptureLock;
  readonly #options: SnapshotCaptureRuntimeOptions;
  #owner: object | undefined;
  #ownsFreeze = false;
  #checkpointId: string | undefined;
  #candidate: TemporarySnapshot | undefined;
  #committed: TemporarySnapshot | undefined;
  #captureAttempts = 0;
  #commitAttempts = 0;
  #successfulCommits = 0;
  #freezeTick: number | null = null;
  #capturedAtTick: number | null = null;
  #committedAtTick: number | null = null;
  #lastError: string | null = null;
  #cleanupAttempts = 0;
  #cleanupFailures = 0;
  #lastCleanupError: string | null = null;

  constructor(
    source: GrayboxPhysics,
    store: FixedTemporarySnapshotStore,
    lock: SnapshotCaptureLock,
    options: SnapshotCaptureRuntimeOptions,
  ) {
    this.#source = source;
    this.#store = store;
    this.#lock = lock;
    this.#options = options;
  }

  begin(owner: object, checkpointId: string): void {
    if (this.#owner !== undefined && this.#owner !== owner) {
      throw new Error('A second capture candidate cannot start before resource release.');
    }
    this.#owner = owner;
    this.#ownsFreeze = false;
    this.#checkpointId = checkpointId;
    this.#candidate = undefined;
    this.#committed = undefined;
    this.#freezeTick = null;
    this.#capturedAtTick = null;
    this.#committedAtTick = null;
    this.#lastError = null;
    this.#cleanupAttempts = 0;
    this.#cleanupFailures = 0;
    this.#lastCleanupError = null;
  }

  cancelBeforeCapture(owner: object): void {
    if (this.#owner === owner && this.#candidate === undefined) {
      this.#owner = undefined;
      this.#ownsFreeze = false;
      this.#checkpointId = undefined;
    }
  }

  execute(request: TransactionExecutorRequest): TransactionExecutorResult {
    try {
      const owner = this.#owner;
      const checkpointId = this.#checkpointId;
      const committedCandidate = this.#committed !== undefined;
      if (!owner ||
          !checkpointId ||
          (!committedCandidate && !this.#lock.isHeldBy(owner))) {
        return this.#permanentError(
          'prototype.snapshot-capture-not-authorized',
          'The capture transaction no longer owns its level lock.',
        );
      }
      if (request.payload.checkpointId !== checkpointId) {
        return this.#permanentError(
          'prototype.snapshot-capture-failed',
          'The transaction checkpoint does not match the capture that acquired the lock.',
        );
      }
      if (request.phase === 'apply') return this.#apply(request, owner, checkpointId);
      return this.#verify(request, owner);
    } catch (error) {
      this.#lastError = toMessage(error);
      return this.#permanentError(
        'prototype.snapshot-capture-failed',
        this.#lastError,
      );
    }
  }

  get snapshot(): ExecutorState {
    return Object.freeze({
      captureAttempts: this.#captureAttempts,
      commitAttempts: this.#commitAttempts,
      successfulCommits: this.#successfulCommits,
      freezeTick: this.#freezeTick,
      capturedAtTick: this.#capturedAtTick,
      committedAtTick: this.#committedAtTick,
      executorOwnerHeld: this.#owner !== undefined,
      freezeOwnedByCapture: this.#owner !== undefined && this.#ownsFreeze,
      lockOwnedByCapture: this.#lock.isHeldBy(this.#owner),
      resourceOwnerHeld: this.#owner !== undefined,
      cleanupAttempts: this.#cleanupAttempts,
      cleanupFailures: this.#cleanupFailures,
      lastCleanupError: this.#lastCleanupError,
    });
  }

  get resourceOwnerHeld(): boolean {
    return this.#owner !== undefined;
  }

  cleanupTerminalResources(): SnapshotCaptureCleanupResult {
    this.#cleanupAttempts++;
    const owner = this.#owner;
    if (owner === undefined) {
      return Object.freeze({
        status: 'already-released' as const,
        message: 'Capture resources were already released.',
      });
    }
    if (!this.#ownsFreeze && !this.#lock.isHeldBy(owner)) {
      this.#finish(owner);
      return Object.freeze({
        status: 'already-released' as const,
        message: 'Capture resources were already released.',
      });
    }

    const cleanupError = this.#releaseResources(owner);
    this.#finish(owner);
    if (cleanupError) {
      this.#cleanupFailures++;
      this.#lastCleanupError = cleanupError;
      return Object.freeze({
        status: 'failed' as const,
        message: cleanupError,
      });
    }
    this.#lastCleanupError = null;
    return Object.freeze({
      status: 'released' as const,
      message: 'Capture-owned freeze and level lock were released.',
    });
  }

  #apply(
    request: TransactionExecutorRequest,
    owner: object,
    checkpointId: string,
  ): TransactionExecutorResult {
    if (this.#candidate) {
      return Object.freeze({ status: 'completed' as const, effectsApplied: false });
    }
    try {
      this.#options.resourceFaultInjector?.('before-freeze');
      const frozen = this.#source.freezeTemporaryObjects(
        GRAYBOX_SNAPSHOT_REGISTRY.map(entry => entry.objectId),
        owner,
      );
      if (frozen.status === 'busy') {
        const cleanup = this.#releaseResources(owner);
        if (!cleanup) this.#finish(owner);
        return this.#permanentError(
          'prototype.snapshot-freeze-failed',
          'Registered capture objects already belong to another freeze owner.',
        );
      }
      this.#ownsFreeze = true;
    } catch (error) {
      const cleanup = this.#releaseResources(owner);
      if (!cleanup) this.#finish(owner);
      return this.#permanentError(
        'prototype.snapshot-freeze-failed',
        `Capture freeze failed: ${toMessage(error)}${cleanup}`,
      );
    }
    this.#freezeTick = request.simulationTick;
    this.#captureAttempts++;
    try {
      this.#candidate = captureTemporarySnapshot(
        this.#source,
        {
          runtimeInstanceId: request.runtimeInstanceId,
          checkpointId,
        },
        this.#options.captureFaultInjector,
      );
      this.#capturedAtTick = request.simulationTick;
      return Object.freeze({ status: 'completed' as const, effectsApplied: false });
    } catch (error) {
      this.#lastError = toMessage(error);
      const cleanup = this.#releaseResources(owner);
      if (!cleanup) this.#finish(owner);
      return this.#permanentError(
        'prototype.snapshot-capture-failed',
        `Candidate capture failed before commit: ${this.#lastError}${cleanup}`,
      );
    }
  }

  #verify(
    request: TransactionExecutorRequest,
    owner: object,
  ): TransactionExecutorResult {
    if (!this.#candidate || !this.#checkpointId) {
      return this.#permanentError(
        'prototype.snapshot-validation-failed',
        'No preserved capture candidate exists for verification.',
      );
    }
    if (this.#committed) {
      const cleanupError = this.#releaseResources(owner);
      if (!cleanupError) this.#finish(owner);
      return cleanupError
        ? Object.freeze({
          status: 'error' as const,
          error: Object.freeze({
            code: 'prototype.snapshot-resource-release-failed',
            message: cleanupError,
          }),
          effectsApplied: true,
        })
        : Object.freeze({ status: 'completed' as const, effectsApplied: true });
    }

    this.#commitAttempts++;
    try {
      this.#committed = this.#store.commit(
        this.#candidate,
        this.#options.captureFaultInjector,
      );
      this.#successfulCommits++;
      this.#committedAtTick = request.simulationTick;
      const cleanupError = this.#releaseResources(owner);
      if (cleanupError) {
        return Object.freeze({
          status: 'error' as const,
          error: Object.freeze({
            code: 'prototype.snapshot-resource-release-failed',
            message: cleanupError,
          }),
          effectsApplied: true,
        });
      }
      this.#finish(owner);
      return Object.freeze({ status: 'completed' as const, effectsApplied: true });
    } catch (error) {
      const committedCurrent = this.#store.current;
      if (committedCurrent &&
          snapshotsEqual(committedCurrent, this.#candidate)) {
        this.#committed = committedCurrent;
        this.#successfulCommits++;
        this.#committedAtTick = request.simulationTick;
        const cleanupError = this.#releaseResources(owner);
        return Object.freeze({
          status: 'error' as const,
          error: Object.freeze({
            code: 'prototype.snapshot-commit-receipt-unknown',
            message:
              `Snapshot committed, but the receipt was interrupted: ` +
              `${toMessage(error)}${cleanupError}`,
          }),
          effectsApplied: true,
        });
      }

      this.#lastError = toMessage(error);
      const cleanupError = this.#releaseResources(owner);
      if (!cleanupError) this.#finish(owner);
      return this.#permanentError(
        'prototype.snapshot-commit-failed',
        `Snapshot commit failed before replacement: ${this.#lastError}${cleanupError}`,
      );
    }
  }

  #releaseResources(owner: object): string {
    const errors: string[] = [];
    if (this.#ownsFreeze) {
      try {
        this.#options.resourceFaultInjector?.('before-release-freeze');
        const released = this.#source.releaseTemporaryObjects(owner);
        if (released.status === 'released' ||
            released.status === 'already-released') {
          this.#ownsFreeze = false;
        } else {
          errors.push('freeze release owner did not match');
        }
      } catch (releaseError) {
        errors.push(`freeze release failed: ${toMessage(releaseError)}`);
      }
    }
    if (this.#lock.isHeldBy(owner)) {
      try {
        this.#options.resourceFaultInjector?.('before-release-lock');
        const lockRelease = this.#lock.release(owner);
        if (lockRelease !== 'released' && lockRelease !== 'already-released') {
          errors.push(`lock release returned ${lockRelease}`);
        }
      } catch (releaseError) {
        errors.push(`lock release failed: ${toMessage(releaseError)}`);
      }
    }
    return errors.length === 0 ? '' : `; ${errors.join('; ')}`;
  }

  #finish(owner: object): void {
    if (this.#owner !== owner) return;
    if (this.#ownsFreeze || this.#lock.isHeldBy(owner)) {
      return;
    }
    this.#owner = undefined;
    this.#checkpointId = undefined;
  }

  #permanentError(code: string, message: string): TransactionExecutorResult {
    return Object.freeze({
      status: 'error' as const,
      error: Object.freeze({ code, message }),
      effectsApplied: false,
    });
  }
}

export class SnapshotCaptureRuntime {
  readonly runtimeInstanceId: string;
  readonly #bus: BusinessRuntimeBus;
  readonly #target: TargetTransactionModule;
  readonly #resultSource: TransactionResultSourceHandle;
  readonly #producer: EventProducerHandle;
  readonly #manager: RuntimeTransactionExecutionManager;
  readonly #executor: SnapshotCaptureExecutor;
  readonly #source: GrayboxPhysics;
  readonly #store: FixedTemporarySnapshotStore;
  readonly #lock: SnapshotCaptureLock;
  readonly #consumedResultEventIds = new Set<number>();
  readonly #requestReceipts = new Map<string, CaptureRequestReceipt>();
  #phase: SnapshotCapturePhase = 'idle';
  #message = 'No runtime checkpoint capture requested.';
  #lastError: string | null = null;
  #lastStepTick = 0;
  #owner: object | undefined;
  #requestedCheckpointId: string | null = null;
  #authorizationRequestId: string | null = null;
  #eventId: number | null = null;
  #commandId: number | null = null;
  #transactionId: number | null = null;
  #resultEventId: number | null = null;
  #deliveryStatus: string | null = null;
  #transactionStatus: TransactionExecutionStatus | null = null;
  #terminal: TransactionFinalResult | null = null;
  #resultLifecycle: TransactionResultLifecycle | null = null;
  #acceptedTick: number | null = null;
  #verifyTick: number | null = null;
  #terminalTick: number | null = null;
  #resultCreatedTick: number | null = null;
  #resultConsumedTick: number | null = null;
  #originalCompletedTick: number | null = null;
  #originalAcknowledged = false;
  #originalRetired = false;
  #resultAcknowledged = false;
  #resultRetired = false;
  #resultConsumerAttempts = 0;
  #resultConsumptionCount = 0;
  #resultPublicationAttempted = false;
  #previousCheckpointId: string | null;

  constructor(
    bus: BusinessRuntimeBus,
    progress: InMemoryRunProgress,
    source: GrayboxPhysics,
    store: FixedTemporarySnapshotStore,
    options: SnapshotCaptureRuntimeOptions = {},
  ) {
    this.#bus = bus;
    this.runtimeInstanceId = bus.runtimeInstanceId;
    this.#source = source;
    this.#store = store;
    this.#previousCheckpointId = store.current?.checkpointId ?? null;
    this.#lock = new SnapshotCaptureLock(
      getGrayboxCheckpointConfig(GRAYBOX_CHECKPOINT_ID).levelId,
    );
    this.#target = bus.commands.createTargetTransactionModule(
      CHECKPOINT_CAPTURE_TARGET_ID,
      { capacity: 16 },
    );
    this.#resultSource = bus.events.createTransactionResultSource(
      CHECKPOINT_CAPTURE_TARGET_ID,
    );
    this.#producer = bus.createProducer();
    this.#executor = new SnapshotCaptureExecutor(
      source,
      store,
      this.#lock,
      options,
    );
    this.#manager = new RuntimeTransactionExecutionManager(
      this.#target,
      this.runtimeInstanceId,
      progress,
      this.#executor,
      {
        capacity: 16,
        retryBudget: 0,
        recoveryBudget: 2,
        faultInjector: options.transactionFaultInjector,
        transactionResults: {
          port: bus.resultPort,
          source: this.#resultSource,
        },
      },
    );
    bus.register({
      eventType: CHECKPOINT_CAPTURE_EVENT_TYPE,
      target: this.#target,
      createCommand: event => {
        const checkpointId = event.payload.checkpointId;
        if (typeof checkpointId !== 'string') {
          throw new Error('Checkpoint capture event has no checkpoint ID.');
        }
        const config = getGrayboxCheckpointConfig(checkpointId);
        return {
          sourceEvent: event as CommandSourceEvent,
          targetId: CHECKPOINT_CAPTURE_TARGET_ID,
          commandType: CHECKPOINT_CAPTURE_COMMAND_TYPE,
          payload: {
            checkpointId: config.checkpointId,
            levelId: config.levelId,
          },
        };
      },
      consumeResult: result => this.#consumeResult(result),
    });
  }

  requestCapture(
    checkpointId: string,
    simulationTick: number,
    authorization: CheckpointCaptureAuthorization,
  ): SnapshotCaptureRequestResult {
    if (!Number.isSafeInteger(simulationTick) || simulationTick < 1) {
      return rejectedCaptureRequest('invalid-request', 'Capture Tick must be positive.');
    }
    let config: GrayboxCheckpointConfig;
    try {
      config = getGrayboxCheckpointConfig(checkpointId);
    } catch (error) {
      return rejectedCaptureRequest('invalid-request', toMessage(error));
    }
    if (!authorization.granted ||
        authorization.runtimeInstanceId !== this.runtimeInstanceId ||
        authorization.levelId !== config.levelId ||
        authorization.checkpointId !== config.checkpointId ||
        typeof authorization.requestId !== 'string' ||
        authorization.requestId.length === 0) {
      return rejectedCaptureRequest(
        'not-authorized',
        'Checkpoint capture requires a matching trusted authorization.',
      );
    }
    const previousReceipt = this.#requestReceipts.get(authorization.requestId);
    if (previousReceipt) {
      if (previousReceipt.checkpointId !== checkpointId) {
        return rejectedCaptureRequest(
          'invalid-request',
          `Request ID ${authorization.requestId} already belongs to checkpoint ` +
            `${previousReceipt.checkpointId}.`,
        );
      }
      return Object.freeze({
        status: 'existing' as const,
        feedback: describeExistingRequest(previousReceipt),
      });
    }
    // Lock release follows the atomic snapshot commit, while the transaction
    // can still be waiting for its terminal result. The complete capture
    // lifecycle remains exclusive until confirmation and safe retirement end.
    const lifecycleActive = this.#owner !== undefined ||
      (this.#phase !== 'idle' &&
       this.#phase !== 'succeeded' &&
       this.#phase !== 'failed');
    if (lifecycleActive) {
      return rejectedCaptureRequest(
        'lock-busy',
        `Level ${config.levelId} has a capture lifecycle owned by request ` +
          `${this.#authorizationRequestId ?? '-'}; no request was queued.`,
      );
    }

    const owner = this.#lock.acquire();
    if (!owner) {
      return rejectedCaptureRequest(
        'lock-busy',
        `Level ${config.levelId} already has an active capture; no request was queued.`,
      );
    }
    this.#executor.begin(owner, checkpointId);
    const created = this.#bus.events.create({
      type: CHECKPOINT_CAPTURE_EVENT_TYPE,
      payload: {
        checkpointId: config.checkpointId,
        requestId: authorization.requestId,
      },
    }, this.#producer);
    if (created.status !== 'created') {
      this.#lock.release(owner);
      this.#executor.cancelBeforeCapture(owner);
      const reason = created.status === 'blocked' ? 'blocked' as const : 'event-capacity' as const;
      return rejectedCaptureRequest(reason, created.message);
    }

    this.#owner = owner;
    this.#requestedCheckpointId = checkpointId;
    this.#authorizationRequestId = authorization.requestId;
    this.#eventId = created.event.eventId;
    this.#commandId = null;
    this.#transactionId = null;
    this.#resultEventId = null;
    this.#deliveryStatus = null;
    this.#transactionStatus = null;
    this.#terminal = null;
    this.#resultLifecycle = null;
    this.#acceptedTick = null;
    this.#verifyTick = null;
    this.#terminalTick = null;
    this.#resultCreatedTick = null;
    this.#resultConsumedTick = null;
    this.#originalCompletedTick = null;
    this.#originalAcknowledged = false;
    this.#originalRetired = false;
    this.#resultAcknowledged = false;
    this.#resultRetired = false;
    this.#resultConsumerAttempts = 0;
    this.#resultConsumptionCount = 0;
    this.#resultPublicationAttempted = false;
    this.#previousCheckpointId = this.#store.current?.checkpointId ?? null;
    this.#phase = 'request-pending';
    this.#message =
      `Event #${created.event.eventId} created for ${checkpointId}; ` +
      `capture lock acquired without freezing.`;
    this.#syncCurrentRequestReceipt();
    return Object.freeze({
      status: 'created' as const,
      feedback: this.#message,
    });
  }

  step(simulationTick: number): void {
    const dispatch = this.#bus.dispatch(simulationTick);
    this.afterDispatch(simulationTick, dispatch);
  }

  afterDispatch(simulationTick: number, dispatch: EventDispatchResult): void {
    if (!Number.isSafeInteger(simulationTick) || simulationTick < 1) {
      throw new RangeError('Snapshot capture Tick must be a positive safe integer.');
    }
    if (simulationTick <= this.#lastStepTick) {
      throw new Error('Snapshot capture Ticks must be strictly increasing.');
    }
    this.#lastStepTick = simulationTick;
    try {
      if (dispatch.status !== 'completed') {
        this.#setBlocked(
          dispatch.status === 'blocked'
            ? dispatch.failure.message
            : dispatch.message,
        );
        return;
      }
      this.#observeEventLifecycle();
      this.#observeDelivery(simulationTick);
      this.#confirmOriginalEvent();
      this.#advanceTransaction(simulationTick);
      this.#publishResult(simulationTick);
      this.#refreshResultLifecycle();
      this.#confirmResultEvent();
      this.#refreshTerminalPhase();
      this.#syncCurrentRequestReceipt();
    } catch (error) {
      this.#setBlocked(toMessage(error));
      this.#syncCurrentRequestReceipt();
    }
  }

  recover(simulationTick: number): void {
    if (this.#transactionId === null) {
      this.#setBlocked('No capture transaction exists to recover.');
      return;
    }
    const record = this.#manager.read(this.#transactionId);
    if (!record) {
      this.#setBlocked(
        `Capture transaction ${this.#transactionId} does not require recovery.`,
      );
      return;
    }
    if (record.status === 'succeeded' || record.status === 'failed') {
      // Terminal state never reopens. Recovery here only drains resources
      // owned by the original transaction, once per explicit call.
      const cleanup = this.#executor.cleanupTerminalResources();
      this.#syncRuntimeOwner();
      if (cleanup.status === 'failed') {
        this.#lastError = cleanup.message;
        this.#message =
          `Capture transaction ${record.transactionId} remains ${record.status}; ` +
          `owned resources still require cleanup: ${cleanup.message}`;
      } else {
        this.#lastError = null;
        this.#message =
          `Capture transaction ${record.transactionId} remains ${record.status}; ` +
          `${cleanup.message}`;
      }
      this.#syncCurrentRequestReceipt();
      return;
    }
    if (record.status !== 'recovery-pending' &&
        record.status !== 'terminal-pending') {
      this.#setBlocked(
        `Capture transaction ${this.#transactionId} does not require recovery.`,
      );
      return;
    }
    const operation = this.#manager.recover(this.#transactionId, {
      runtimeInstanceId: this.runtimeInstanceId,
      simulationTick,
      phase: 'transaction',
    });
    this.#applyOperationResult(operation, simulationTick);
  }

  get snapshot(): SnapshotCaptureRuntimeSnapshot {
    const events = this.#bus.events.snapshot;
    const commands = this.#bus.commands.snapshot;
    const target = this.#target.snapshot;
    const transactions = this.#manager.snapshot;
    const executor = this.#executor.snapshot;
    const lock = this.#lock.snapshot;
    return Object.freeze({
      runtimeInstanceId: this.runtimeInstanceId,
      targetId: CHECKPOINT_CAPTURE_TARGET_ID,
      phase: this.#phase,
      message: this.#message,
      requestedCheckpointId: this.#requestedCheckpointId,
      candidateCheckpointId:
        executor.capturedAtTick === null ? null : this.#requestedCheckpointId,
      previousCheckpointId: this.#previousCheckpointId,
      currentCheckpointId: this.#store.current?.checkpointId ?? null,
      authorizationRequestId: this.#authorizationRequestId,
      eventId: this.#eventId,
      commandId: this.#commandId,
      transactionId: this.#transactionId,
      resultEventId: this.#resultEventId,
      deliveryStatus: this.#deliveryStatus,
      transactionStatus: this.#transactionStatus,
      terminal: this.#terminal,
      resultLifecycle: this.#resultLifecycle,
      acceptedTick: this.#acceptedTick,
      freezeTick: executor.freezeTick,
      capturedAtTick: executor.capturedAtTick,
      verifyTick: this.#verifyTick,
      committedAtTick: executor.committedAtTick,
      terminalTick: this.#terminalTick,
      resultCreatedTick: this.#resultCreatedTick,
      resultConsumedTick: this.#resultConsumedTick,
      lock: Object.freeze({
        levelId: lock.levelId,
        held: lock.held,
        ownedByCapture: this.#owner !== undefined && lock.held,
      }),
      frozenObjectIds: Object.freeze([...this.#source.frozenTemporaryObjectIds]),
      resourceOwnership: Object.freeze({
        executorOwnerHeld: executor.executorOwnerHeld,
        freezeOwnedByCapture: executor.freezeOwnedByCapture,
        lockOwnedByCapture: executor.lockOwnedByCapture,
        resourcesReleased:
          !executor.freezeOwnedByCapture && !executor.lockOwnedByCapture,
      }),
      captureAttempts: executor.captureAttempts,
      commitAttempts: executor.commitAttempts,
      successfulCommits: executor.successfulCommits,
      cleanupAttempts: executor.cleanupAttempts,
      cleanupFailures: executor.cleanupFailures,
      lastCleanupError: executor.lastCleanupError,
      originalAcknowledged: this.#originalAcknowledged,
      originalRetired: this.#originalRetired,
      resultAcknowledged: this.#resultAcknowledged,
      resultRetired: this.#resultRetired,
      resultConsumerAttempts: this.#resultConsumerAttempts,
      resultConsumptionCount: this.#resultConsumptionCount,
      counts: Object.freeze({
        nextEventId: events.nextEventId,
        events: events.lifecycleRecords.length,
        inboxEvents: events.counts.inboxEvents,
        commands: commands.counts.commands,
        acceptedCommands: target.counts.acceptedRecords,
        transactionIntents: target.counts.intents,
        transactions: transactions.counts.records,
        resultEvents: transactions.counts.resultEvents,
      }),
      lastError: this.#lastError,
    });
  }

  #observeEventLifecycle(): void {
    const original = this.#bus.events.snapshot.lifecycleRecords.find(
      record => record.eventId === this.#eventId,
    );
    if (original?.status === 'completed' && this.#originalCompletedTick === null) {
      this.#originalCompletedTick = this.#lastStepTick;
    }
  }

  #observeDelivery(simulationTick: number): void {
    if (this.#eventId === null) return;
    const delivery = this.#bus.events.snapshot.delivery?.records.find(
      record => record.eventId === this.#eventId,
    );
    if (!delivery) return;
    this.#deliveryStatus = delivery.status;
    if (delivery.status === 'accepted') {
      this.#acceptedTick ??= simulationTick;
      this.#commandId ??= delivery.commandId ?? null;
      this.#transactionId ??= delivery.transactionId ?? null;
      if (this.#phase === 'request-pending') this.#phase = 'accepted';
      this.#syncCurrentRequestReceipt();
      return;
    }
    if (delivery.status === 'rejected' ||
        delivery.status === 'retryable' ||
        delivery.status === 'unknown') {
      this.#setBlocked(delivery.message);
    }
  }

  #advanceTransaction(simulationTick: number): void {
    if (this.#commandId === null ||
        this.#phase === 'blocked' ||
        this.#phase === 'recovery-pending' ||
        this.#terminal !== null ||
        this.#resultEventId !== null) {
      return;
    }
    const started = this.#manager.start(this.#commandId);
    if (started.status === 'rejected') {
      this.#setBlocked(started.message);
      return;
    }
    this.#transactionId = started.record.transactionId;
    this.#transactionStatus = started.record.status;
    const operation = this.#manager.advance(started.record.transactionId, {
      runtimeInstanceId: this.runtimeInstanceId,
      simulationTick,
      phase: 'transaction',
    });
    this.#applyOperationResult(operation, simulationTick);
  }

  #applyOperationResult(
    operation: ReturnType<RuntimeTransactionExecutionManager['advance']>,
    simulationTick: number,
  ): void {
    if (operation.status === 'rejected') {
      this.#setBlocked(operation.message);
      return;
    }
    this.#transactionStatus = operation.record.status;
    if (operation.status === 'progressed') {
      if (operation.record.phase === 'verify') {
        this.#phase = 'verifying';
        this.#message =
          `Candidate for ${operation.record.payload.checkpointId} captured; ` +
          `waiting for a later Tick verification.`;
      } else {
        this.#phase = 'applying';
      }
      return;
    }
    if (operation.status === 'recovery-pending' ||
        operation.status === 'terminal-pending') {
      this.#phase = 'recovery-pending';
      this.#lastError = operation.record.errors.at(-1)?.message ??
        (operation.record.pendingTerminal?.status === 'failed'
          ? operation.record.pendingTerminal.message
          : undefined) ??
        operation.status;
      this.#message =
        `Transaction ${operation.record.transactionId} requires explicit ` +
        `${operation.status} recovery.`;
      return;
    }
    if (operation.status === 'retry-pending') {
      this.#setBlocked('Checkpoint capture unexpectedly entered retry-pending.');
      return;
    }
    if (operation.status === 'succeeded' || operation.status === 'failed') {
      this.#verifyTick ??= simulationTick;
      this.#terminalTick = simulationTick;
      this.#terminal = operation.record.terminal ?? null;
      this.#phase = operation.status;
      this.#message =
        operation.status === 'succeeded'
          ? `Checkpoint ${this.#store.current?.checkpointId ?? '-'} committed atomically.`
          : `Checkpoint capture failed; previous record was preserved.`;
    }
    this.#syncCurrentRequestReceipt();
  }

  #publishResult(simulationTick: number): void {
    if (this.#transactionId === null ||
        this.#terminal === null ||
        this.#phase === 'blocked') {
      return;
    }
    const query = this.#manager.readResultEvent(this.#transactionId);
    if (query.status === 'found') {
      this.#captureResult(query.association, query.lifecycle);
      return;
    }
    if (query.status === 'rejected') {
      this.#setBlocked(query.message);
      return;
    }
    if (this.#resultPublicationAttempted) return;
    this.#resultPublicationAttempted = true;
    const created = this.#manager.requestResultEvent(this.#transactionId, {
      runtimeInstanceId: this.runtimeInstanceId,
      simulationTick,
      phase: 'result',
    });
    if (created.status === 'created' || created.status === 'existing') {
      this.#captureResult(created.association, created.record.resultEventLifecycle);
      this.#resultCreatedTick = simulationTick;
      return;
    }
    if (created.status === 'unknown') {
      this.#resultEventId = created.record.resultEventId ?? null;
      this.#setBlocked(created.message);
    } else if (created.status === 'rejected') {
      this.#setBlocked(created.message);
    }
  }

  #captureResult(
    association: TransactionResultAssociation,
    lifecycle: TransactionResultLifecycle | undefined,
  ): void {
    this.#resultEventId = association.resultEventId;
    this.#terminal = association.terminal;
    this.#resultLifecycle = lifecycle ?? this.#resultLifecycle;
    if (!this.#resultRetired && this.#phase !== 'result-consumed') {
      this.#phase = 'result-pending';
      this.#message =
        `Result Event #${association.resultEventId} waits for a fixed coordination phase.`;
    }
    this.#syncCurrentRequestReceipt();
  }

  #consumeResult(
    context: TransactionResultConsumerContext,
  ):
    | Readonly<{ status: 'consumed' | 'already-consumed' }>
    | Readonly<{ status: 'failed'; message: string }> {
    this.#resultConsumerAttempts++;
    if (this.#consumedResultEventIds.has(context.event.eventId)) {
      return Object.freeze({ status: 'already-consumed' as const });
    }
    this.#consumedResultEventIds.add(context.event.eventId);
    this.#resultConsumptionCount++;
    this.#resultConsumedTick = context.simulationTick;
    this.#terminal = context.association.terminal;
    this.#phase = 'result-consumed';
    this.#message =
      `Result Event #${context.event.eventId} consumed; no capture was repeated.`;
    return Object.freeze({ status: 'consumed' as const });
  }

  #confirmOriginalEvent(): void {
    if (this.#eventId === null ||
        this.#originalCompletedTick === null ||
        this.#originalRetired) {
      return;
    }
    const read = this.#bus.events.readFinalResult(this.#producer, this.#eventId);
    if (read.status !== 'available') return;
    const acknowledged = this.#bus.events.acknowledge(this.#producer, read.result);
    if (acknowledged.status !== 'acknowledged' &&
        acknowledged.status !== 'already-acknowledged') {
      this.#setBlocked(acknowledged.message);
      return;
    }
    this.#originalAcknowledged = true;
    const retired = this.#bus.events.retire(this.#producer, read.result);
    if (retired.status === 'retired' || retired.status === 'already-retired') {
      this.#originalRetired = true;
    } else {
      this.#setBlocked('message' in retired ? retired.message : retired.failure.message);
    }
  }

  #confirmResultEvent(): void {
    if (this.#resultEventId === null ||
        this.#phase !== 'result-consumed' ||
        this.#resultRetired) {
      return;
    }
    const producer = this.#resultSource.producer;
    const read = this.#bus.events.readFinalResult(producer, this.#resultEventId);
    if (read.status !== 'available') return;
    const acknowledged = this.#bus.events.acknowledge(producer, read.result);
    if (acknowledged.status !== 'acknowledged' &&
        acknowledged.status !== 'already-acknowledged') {
      this.#setBlocked(acknowledged.message);
      return;
    }
    this.#resultAcknowledged = true;
    const retired = this.#bus.events.retire(producer, read.result);
    if (retired.status === 'retired' || retired.status === 'already-retired') {
      this.#resultRetired = true;
      this.#resultLifecycle = 'retired';
    } else {
      this.#setBlocked('message' in retired ? retired.message : retired.failure.message);
    }
  }

  #refreshResultLifecycle(): void {
    if (this.#transactionId === null) return;
    const query = this.#manager.readResultEvent(this.#transactionId);
    if (query.status === 'found') {
      this.#resultEventId = query.association.resultEventId;
      this.#resultLifecycle = query.lifecycle;
    }
  }

  #refreshTerminalPhase(): void {
    if (this.#phase === 'blocked' || this.#phase === 'recovery-pending') return;
    if (this.#originalRetired && this.#resultRetired &&
        this.#terminal?.status === 'succeeded') {
      this.#syncRuntimeOwner();
      this.#phase = 'succeeded';
      this.#message =
        `Capture ${this.#store.current?.checkpointId ?? '-'} completed; ` +
        `lock and object freeze released.`;
      return;
    }
    if (this.#originalRetired && this.#resultRetired &&
        this.#terminal?.status === 'failed') {
      this.#syncRuntimeOwner();
      this.#phase = 'failed';
      this.#message =
        `Capture ended Failed: ${this.#terminal.reasonCode}; previous checkpoint preserved.`;
    }
  }

  #syncRuntimeOwner(): void {
    if (!this.#executor.resourceOwnerHeld) this.#owner = undefined;
  }

  #syncCurrentRequestReceipt(): void {
    const requestId = this.#authorizationRequestId;
    const checkpointId = this.#requestedCheckpointId;
    const eventId = this.#eventId;
    if (requestId === null || checkpointId === null || eventId === null) return;
    this.#requestReceipts.set(requestId, Object.freeze({
      checkpointId,
      eventId,
      commandId: this.#commandId,
      transactionId: this.#transactionId,
      resultEventId: this.#resultEventId,
      phase: this.#phase,
    }));
  }

  #setBlocked(message: string): void {
    this.#phase = 'blocked';
    this.#lastError = message;
    this.#message = message;
  }
}

function resourceHeld(lock: SnapshotCaptureLock, owner: object): boolean {
  return lock.isHeldBy(owner);
}

function snapshotsEqual(left: TemporarySnapshot, right: TemporarySnapshot): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function rejectedCaptureRequest(
  reason: Extract<SnapshotCaptureRequestResult, { status: 'rejected' }>['reason'],
  feedback: string,
): SnapshotCaptureRequestResult {
  return Object.freeze({ status: 'rejected' as const, reason, feedback });
}

function describeExistingRequest(receipt: CaptureRequestReceipt): string {
  const command = receipt.commandId === null
    ? ''
    : `, Command #${receipt.commandId}`;
  const transaction = receipt.transactionId === null
    ? ''
    : `, Transaction #${receipt.transactionId}`;
  const result = receipt.resultEventId === null
    ? ''
    : `, Result Event #${receipt.resultEventId}`;
  return `Checkpoint ${receipt.checkpointId} request ${receipt.phase} for ` +
    `Event #${receipt.eventId}${command}${transaction}${result}.`;
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
