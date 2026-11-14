import {
  type AcceptedCommandQuery,
  type AcceptedCommandRecord,
  type TargetTransactionModule,
  type TransactionCreationIntent,
} from './commands.ts';
import {
  InMemoryRunProgress,
  PROTOTYPE_PROGRESS_CONTENT,
  type RunProgressSnapshot,
} from './progress.ts';
import {
  type TransactionFinalResult,
  type TransactionResultAssociation,
  type TransactionResultCreationResult,
  type TransactionResultEventPort,
  type TransactionResultLifecycle,
  type TransactionResultQuery,
  type TransactionResultRequest,
  type TransactionResultSourceHandle,
} from './transaction-results.ts';

export type TransactionExecutionStatus =
  | 'not-started'
  | 'running'
  | 'retry-pending'
  | 'recovery-pending'
  | 'terminal-pending'
  | 'succeeded'
  | 'failed';

export type TransactionExecutionPhase = 'apply' | 'verify';
export type TransactionAttemptKind = 'advance' | 'retry' | 'recovery';
export type TransactionExecutionErrorClass =
  | 'temporary'
  | 'recoverable'
  | 'permanent'
  | 'unclassified';

export type TransactionExecutionContext = Readonly<{
  runtimeInstanceId: string;
  simulationTick: number;
  phase: 'transaction';
}>;

export type TransactionResultRequestContext = Readonly<{
  runtimeInstanceId: string;
  simulationTick: number;
  phase: 'result';
}>;

export type TransactionExecutorRequest = Readonly<{
  runtimeInstanceId: string;
  transactionId: number;
  commandId: number;
  eventId: number;
  targetId: string;
  commandType: string;
  payload: Readonly<Record<string, unknown>>;
  phase: TransactionExecutionPhase;
  attemptKind: TransactionAttemptKind;
  simulationTick: number;
}>;

export type TransactionExecutorResult =
  | Readonly<{
    status: 'completed';
    effectsApplied?: boolean;
  }>
  | Readonly<{
    status: 'error';
    error: Readonly<{ code: string; message: string }>;
    effectsApplied?: boolean;
  }>;

export interface TransactionExecutor {
  execute(request: TransactionExecutorRequest): TransactionExecutorResult;
}

export type TransactionErrorHistoryEntry = Readonly<{
  code: string;
  message: string;
  phase: TransactionExecutionPhase;
  simulationTick: number;
  classification: TransactionExecutionErrorClass;
  effectsApplied: boolean;
}>;

export type TransactionProgressAddition = Readonly<{
  goals: number;
  rewards: number;
  effects: number;
}>;

export type TransactionTerminalResult =
  | Readonly<{
    status: 'succeeded';
    simulationTick: number;
  }>
  | Readonly<{
    status: 'failed';
    simulationTick: number;
    reasonCode: string;
    message: string;
  }>;

export type TransactionExecutionRecord = Readonly<{
  runtimeInstanceId: string;
  transactionId: number;
  commandId: number;
  eventId: number;
  targetId: string;
  commandType: string;
  payload: Readonly<Record<string, unknown>>;
  status: TransactionExecutionStatus;
  phase: TransactionExecutionPhase;
  lastSimulationTick: number | null;
  lastAttemptKind: TransactionAttemptKind | null;
  executionAttempts: number;
  retryAttempts: number;
  recoveryAttempts: number;
  terminalCommitAttempts: number;
  resultRequestAttempts: number;
  lastResultRequestTick: number | null;
  businessAdditions: TransactionProgressAddition;
  remainingPaths: Readonly<{
    retries: number;
    recoveries: number;
  }>;
  errors: readonly TransactionErrorHistoryEntry[];
  pendingTerminal?: TransactionTerminalResult;
  terminal?: TransactionTerminalResult;
  resultEventId?: number;
  resultEventLifecycle?: TransactionResultLifecycle;
  resultRequestError?: string;
}>;

export type TransactionExecutionSnapshot = Readonly<{
  runtimeInstanceId: string;
  records: readonly TransactionExecutionRecord[];
  counts: Readonly<{
    records: number;
    capacity: number;
    notStarted: number;
    running: number;
    retryPending: number;
    recoveryPending: number;
    terminalPending: number;
    succeeded: number;
    failed: number;
    resultEvents: number;
    retiredResultEvents: number;
  }>;
}>;

export type TransactionStartResult =
  | Readonly<{
    status: 'started' | 'existing';
    record: TransactionExecutionRecord;
  }>
  | Readonly<{
    status: 'rejected';
    reason:
      | 'invalid-input'
      | 'runtime-mismatch'
      | 'command-not-found'
      | 'command-blocked'
      | 'command-rejected'
      | 'association-mismatch'
      | 'unexpected-command-type'
      | 'capacity';
    message: string;
  }>;

export type TransactionOperationResult =
  | Readonly<{
    status:
      | 'progressed'
      | 'succeeded'
      | 'failed'
      | 'retry-pending'
      | 'recovery-pending'
      | 'terminal-pending';
    record: TransactionExecutionRecord;
  }>
  | Readonly<{
    status: 'rejected';
    reason:
      | 'invalid-input'
      | 'runtime-mismatch'
      | 'unknown-transaction'
      | 'terminal'
      | 'phase-order'
      | 'recursive-operation'
      | 'explicit-retry-required'
      | 'explicit-recovery-required'
      | 'not-retryable'
      | 'not-recoverable'
      | 'target-query-failed'
      | 'accepted-association-changed';
    message: string;
  }>;

export type TransactionResultRequestResult =
  | Readonly<{
    status: 'created' | 'existing';
    record: TransactionExecutionRecord;
    association: TransactionResultAssociation;
  }>
  | Readonly<{
    status: 'unknown';
    record: TransactionExecutionRecord;
    message: string;
  }>
  | Readonly<{
    status: 'rejected';
    reason:
      | 'invalid-input'
      | 'runtime-mismatch'
      | 'unknown-transaction'
      | 'not-configured'
      | 'not-terminal'
      | 'phase-order'
      | 'recursive-operation'
      | 'association-mismatch'
      | 'result-capacity'
      | 'inbox-capacity'
      | 'history-capacity'
      | 'event-id-exhausted'
      | 'transaction-aborted'
      | 'blocked';
    message: string;
  }>;

export type TransactionExecutionFaultPoint = 'before-terminal-commit';
export type TransactionExecutionFaultInjector =
  (point: TransactionExecutionFaultPoint) => void;

export type RuntimeTransactionExecutionManagerOptions = Readonly<{
  capacity?: number;
  retryBudget?: number;
  recoveryBudget?: number;
  faultInjector?: TransactionExecutionFaultInjector;
  transactionResults?: Readonly<{
    port: TransactionResultEventPort;
    source: TransactionResultSourceHandle;
  }>;
}>;

type InternalRecord = Readonly<{
  publicRecord: TransactionExecutionRecord;
  target: TargetTransactionModule;
  acceptedRecord: AcceptedCommandRecord;
  creationIntent: TransactionCreationIntent;
}>;

type ErrorClassification = Readonly<{
  classification: TransactionExecutionErrorClass;
  retryable: boolean;
  recoverable: boolean;
}>;

const DEFAULT_TRANSACTION_CAPACITY = 256;
const DEFAULT_RETRY_BUDGET = 1;
const DEFAULT_RECOVERY_BUDGET = 1;
const OWNED_TARGET_MODULES = new WeakSet<object>();

// One target transaction module is bound to one execution manager. The
// creation intent remains the immutable Accepted record; all mutable execution
// state is projected from the separate publicRecord.
export class RuntimeTransactionExecutionManager {
  readonly runtimeInstanceId: string;
  readonly targetId: string;
  readonly #target: TargetTransactionModule;
  readonly #progress: InMemoryRunProgress;
  readonly #executor: TransactionExecutor;
  readonly #capacity: number;
  readonly #initialRetryBudget: number;
  readonly #initialRecoveryBudget: number;
  readonly #faultInjector: TransactionExecutionFaultInjector | undefined;
  readonly #transactionResultPort: TransactionResultEventPort | undefined;
  readonly #transactionResultSource: TransactionResultSourceHandle | undefined;
  readonly #recordsByTransactionId = new Map<number, InternalRecord>();
  readonly #transactionIdByCommandId = new Map<number, number>();
  #operating = false;
  #requestingResult = false;

  constructor(
    target: TargetTransactionModule,
    runtimeInstanceId: string,
    progress: InMemoryRunProgress,
    executor: TransactionExecutor,
    options: RuntimeTransactionExecutionManagerOptions = {},
  ) {
    if (OWNED_TARGET_MODULES.has(target)) {
      throw new Error(
        `Target transaction module "${target.targetId}" already has an execution manager.`,
      );
    }
    this.#capacity = normalizeNonNegativeInteger(
      options.capacity ?? DEFAULT_TRANSACTION_CAPACITY,
      'Transaction execution capacity',
      false,
    );
    this.#initialRetryBudget = normalizeNonNegativeInteger(
      options.retryBudget ?? DEFAULT_RETRY_BUDGET,
      'Prototype retry budget',
      true,
    );
    this.#initialRecoveryBudget = normalizeNonNegativeInteger(
      options.recoveryBudget ?? DEFAULT_RECOVERY_BUDGET,
      'Prototype recovery budget',
      true,
    );
    this.runtimeInstanceId = runtimeInstanceId;
    this.targetId = target.targetId;
    this.#target = target;
    this.#progress = progress;
    this.#executor = executor;
    this.#faultInjector = options.faultInjector;
    const transactionResults = options.transactionResults;
    if (transactionResults &&
        (transactionResults.source.runtimeInstanceId !== runtimeInstanceId ||
          transactionResults.source.targetId !== target.targetId)) {
      throw new Error(
        'Transaction result source must belong to the manager runtime and target.',
      );
    }
    this.#transactionResultPort = transactionResults?.port;
    this.#transactionResultSource = transactionResults?.source;
    if (transactionResults) {
      const registered =
        transactionResults.port.registerTransactionResultAuthority(
          transactionResults.source,
          transactionId => {
            const record = this.#recordsByTransactionId.get(transactionId)?.publicRecord;
            if (!record) {
              return {
                status: 'not-found' as const,
                transactionId,
                message: 'Transaction execution record does not exist.',
              };
            }
            if ((record.status !== 'succeeded' && record.status !== 'failed') ||
                !record.terminal) {
              return {
                status: 'not-terminal' as const,
                transactionId,
                message:
                  `Transaction status ${record.status} is not a registered terminal.`,
              };
            }
            return {
              status: 'found' as const,
              request: transactionResultRequestForRecord(record),
            };
          },
        );
      if (registered.status !== 'registered') {
        throw new Error(`Transaction result source registration failed: ${registered.message}`);
      }
    }
    OWNED_TARGET_MODULES.add(target);
  }

  start(commandId: number): TransactionStartResult {
    if (!Number.isSafeInteger(commandId) || commandId < 1) {
      return rejectedStart('invalid-input', 'Command ID must be a positive safe integer.');
    }
    const existingTransactionId = this.#transactionIdByCommandId.get(commandId);
    if (existingTransactionId !== undefined) {
      const existing = this.#recordsByTransactionId.get(existingTransactionId);
      if (existing) {
        return Object.freeze({
          status: 'existing' as const,
          record: existing.publicRecord,
        });
      }
    }

    const query = this.#target.query(commandId);
    if (query.status === 'not-found') {
      return rejectedStart('command-not-found', 'Accepted command was not found.');
    }
    if (query.status === 'blocked') {
      return rejectedStart('command-blocked', query.failure.message);
    }
    if (query.status === 'rejected') {
      return rejectedStart('command-rejected', query.message);
    }
    const associationError = validateAcceptedAssociation(
      query,
      this.runtimeInstanceId,
      this.#target.targetId,
    );
    if (associationError) {
      return rejectedStart('association-mismatch', associationError);
    }
    if (this.#recordsByTransactionId.size >= this.#capacity) {
      return rejectedStart(
        'capacity',
        'Transaction execution record capacity is full.',
      );
    }

    const publicRecord = createExecutionRecord(
      query.intent,
      this.#initialRetryBudget,
      this.#initialRecoveryBudget,
    );
    const internal: InternalRecord = Object.freeze({
      publicRecord,
      target: this.#target,
      acceptedRecord: query.record,
      creationIntent: query.intent,
    });
    this.#recordsByTransactionId.set(publicRecord.transactionId, internal);
    this.#transactionIdByCommandId.set(publicRecord.commandId, publicRecord.transactionId);
    return Object.freeze({
      status: 'started' as const,
      record: publicRecord,
    });
  }

  advance(
    transactionId: number,
    context: TransactionExecutionContext,
  ): TransactionOperationResult {
    return this.#operate(transactionId, context, 'advance');
  }

  retry(
    transactionId: number,
    context: TransactionExecutionContext,
  ): TransactionOperationResult {
    return this.#operate(transactionId, context, 'retry');
  }

  recover(
    transactionId: number,
    context: TransactionExecutionContext,
  ): TransactionOperationResult {
    return this.#operate(transactionId, context, 'recovery');
  }

  read(transactionId: number): TransactionExecutionRecord | undefined {
    return this.#recordsByTransactionId.get(transactionId)?.publicRecord;
  }

  readByCommandId(commandId: number): TransactionExecutionRecord | undefined {
    const transactionId = this.#transactionIdByCommandId.get(commandId);
    return transactionId === undefined ? undefined : this.read(transactionId);
  }

  requestResultEvent(
    transactionId: number,
    context: TransactionResultRequestContext,
  ): TransactionResultRequestResult {
    if (this.#requestingResult) {
      return rejectedTransactionResultRequest(
        'recursive-operation',
        'Transaction result creation cannot be re-entered.',
      );
    }
    if (!Number.isSafeInteger(transactionId) || transactionId < 1) {
      return rejectedTransactionResultRequest(
        'invalid-input',
        'Transaction ID must be a positive safe integer.',
      );
    }
    const normalized = normalizeTransactionResultContext(context);
    if (!normalized.ok) {
      return rejectedTransactionResultRequest('invalid-input', normalized.message);
    }
    if (normalized.runtimeInstanceId !== this.runtimeInstanceId) {
      return rejectedTransactionResultRequest(
        'runtime-mismatch',
        'Result request context belongs to another runtime instance.',
      );
    }
    const stored = this.#recordsByTransactionId.get(transactionId);
    if (!stored) {
      return rejectedTransactionResultRequest(
        'unknown-transaction',
        'Transaction record does not exist.',
      );
    }
    const record = stored.publicRecord;
    if (record.status !== 'succeeded' &&
        record.status !== 'failed') {
      return rejectedTransactionResultRequest(
        'not-terminal',
        `Transaction status ${record.status} cannot publish a final result event.`,
      );
    }
    if (!record.terminal) {
      return rejectedTransactionResultRequest(
        'not-terminal',
        'Registered terminal result is missing from the transaction record.',
      );
    }
    const port = this.#transactionResultPort;
    const source = this.#transactionResultSource;
    if (!port || !source) {
      return rejectedTransactionResultRequest(
        'not-configured',
        'Transaction result event creation is not configured for this manager.',
      );
    }
    if (record.lastResultRequestTick !== null &&
        normalized.simulationTick <= record.lastResultRequestTick) {
      return rejectedTransactionResultRequest(
        'phase-order',
        'Transaction result creation requires a strictly increasing Result phase Tick.',
      );
    }

    const attempted: TransactionExecutionRecord = Object.freeze({
      ...record,
      resultRequestAttempts: record.resultRequestAttempts + 1,
      lastResultRequestTick: normalized.simulationTick,
    });
    this.#replaceRecord(stored, attempted);
    this.#requestingResult = true;
    try {
      let created: TransactionResultCreationResult;
      try {
        created = port.requestTransactionResult(source, transactionId);
      } catch (error) {
        const message = `Transaction result creation threw: ${toMessage(error)}`;
        const unknownRecord = Object.freeze({
          ...attempted,
          resultRequestError: message,
        });
        this.#replaceRecord(stored, unknownRecord);
        return Object.freeze({
          status: 'unknown' as const,
          record: unknownRecord,
          message,
        });
      }

      if (created.status === 'created' || created.status === 'existing') {
        const updated: TransactionExecutionRecord = Object.freeze({
          ...attempted,
          resultEventId: created.association.resultEventId,
          resultEventLifecycle: created.lifecycle,
          resultRequestError: undefined,
        });
        this.#replaceRecord(stored, updated);
        return Object.freeze({
          status: created.status,
          record: updated,
          association: created.association,
        });
      }
      if (created.status === 'unknown') {
        const unknownRecord: TransactionExecutionRecord = Object.freeze({
          ...attempted,
          resultEventId: created.resultEventId,
          resultEventLifecycle: undefined,
          resultRequestError: created.message,
        });
        this.#replaceRecord(stored, unknownRecord);
        return Object.freeze({
          status: 'unknown' as const,
          record: unknownRecord,
          message: created.message,
        });
      }

      if (created.status === 'rejected') {
        const rejectedRecord: TransactionExecutionRecord = Object.freeze({
          ...attempted,
          resultRequestError: created.message,
        });
        this.#replaceRecord(stored, rejectedRecord);
        return rejectedTransactionResultRequest(
          mapTransactionResultRejection(created.reason),
          created.message,
        );
      }
      return rejectedTransactionResultRequest(
        'transaction-aborted',
        'Transaction result creation returned an unsupported status.',
      );
    } finally {
      this.#requestingResult = false;
    }
  }

  readResultEvent(transactionId: number): TransactionResultQuery {
    const port = this.#transactionResultPort;
    const source = this.#transactionResultSource;
    if (!port || !source) {
      return Object.freeze({
        status: 'rejected' as const,
        reason: 'invalid-source' as const,
        message: 'Transaction result event creation is not configured.',
      });
    }
    return port.queryTransactionResult(source, transactionId);
  }

  get resultProducer(): TransactionResultSourceHandle['producer'] | undefined {
    return this.#transactionResultSource?.producer;
  }

  get snapshot(): TransactionExecutionSnapshot {
    const records = Object.freeze([...this.#recordsByTransactionId.values()]
      .map(record => record.publicRecord)
      .sort((left, right) => left.transactionId - right.transactionId));
    return Object.freeze({
      runtimeInstanceId: this.runtimeInstanceId,
      records,
      counts: Object.freeze({
        records: records.length,
        capacity: this.#capacity,
        notStarted: countStatus(records, 'not-started'),
        running: countStatus(records, 'running'),
        retryPending: countStatus(records, 'retry-pending'),
        recoveryPending: countStatus(records, 'recovery-pending'),
        terminalPending: countStatus(records, 'terminal-pending'),
        succeeded: countStatus(records, 'succeeded'),
        failed: countStatus(records, 'failed'),
        resultEvents: records.filter(record => record.resultEventId !== undefined).length,
        retiredResultEvents: records.filter(
          record => record.resultEventLifecycle === 'retired',
        ).length,
      }),
    });
  }

  #operate(
    transactionId: number,
    context: TransactionExecutionContext,
    attemptKind: TransactionAttemptKind,
  ): TransactionOperationResult {
    if (this.#operating) {
      return rejectedOperation(
        'recursive-operation',
        'Transaction execution cannot be re-entered from a running attempt.',
      );
    }
    if (!Number.isSafeInteger(transactionId) || transactionId < 1) {
      return rejectedOperation(
        'invalid-input',
        'Transaction ID must be a positive safe integer.',
      );
    }
    const normalized = normalizeExecutionContext(context);
    if (!normalized.ok) return normalized.rejected;
    if (normalized.runtimeInstanceId !== this.runtimeInstanceId) {
      return rejectedOperation(
        'runtime-mismatch',
        'Execution context belongs to another runtime instance.',
      );
    }
    const stored = this.#recordsByTransactionId.get(transactionId);
    if (!stored) {
      return rejectedOperation('unknown-transaction', 'Transaction record does not exist.');
    }
    const terminalError = terminalRejection(stored.publicRecord);
    if (terminalError) return terminalError;
    if (stored.publicRecord.lastSimulationTick !== null &&
        normalized.simulationTick <= stored.publicRecord.lastSimulationTick) {
      return rejectedOperation(
        'phase-order',
        'Transaction execution requires a strictly increasing SimulationTick.',
      );
    }

    if (attemptKind === 'advance') {
      if (stored.publicRecord.status === 'retry-pending') {
        return rejectedOperation(
          'explicit-retry-required',
          'A Retryable transaction requires an explicit retry operation.',
        );
      }
      if (stored.publicRecord.status === 'recovery-pending') {
        return rejectedOperation(
          'explicit-recovery-required',
          'A transaction awaiting safe recovery requires an explicit recovery operation.',
        );
      }
      if (stored.publicRecord.status === 'terminal-pending') {
        return rejectedOperation(
          'explicit-recovery-required',
          'A verified terminal result awaiting registration requires an explicit recovery operation.',
        );
      }
    }
    if (attemptKind === 'retry' && stored.publicRecord.status !== 'retry-pending') {
      return rejectedOperation(
        'not-retryable',
        'Only a retry-pending transaction can be retried.',
      );
    }
    if (attemptKind === 'recovery' &&
        stored.publicRecord.status !== 'recovery-pending' &&
        stored.publicRecord.status !== 'terminal-pending') {
      return rejectedOperation(
        'not-recoverable',
        'Only recovery-pending or terminal-pending transactions can be recovered.',
      );
    }

    this.#operating = true;
    try {
      const acceptedError = this.#verifyAccepted(stored);
      if (acceptedError) return acceptedError;
      let record = stored.publicRecord;
      if (record.status === 'terminal-pending') {
        if (!record.pendingTerminal) {
          return rejectedOperation(
            'not-recoverable',
            'Terminal-pending transaction has no preserved terminal result.',
          );
        }
        const pendingTerminal = record.pendingTerminal;
        record = Object.freeze({
          ...record,
          status: 'running' as const,
          lastSimulationTick: normalized.simulationTick,
          lastAttemptKind: 'recovery' as const,
        });
        return this.#commitTerminal(stored, record, pendingTerminal);
      }
      let retries = record.remainingPaths.retries;
      let recoveries = record.remainingPaths.recoveries;
      let retryAttempts = record.retryAttempts;
      let recoveryAttempts = record.recoveryAttempts;
      if (attemptKind === 'retry') {
        if (retries <= 0) {
          return rejectedOperation('not-retryable', 'No prototype retry path remains.');
        }
        retries -= 1;
        retryAttempts += 1;
      }
      if (attemptKind === 'recovery') {
        if (recoveries <= 0) {
          return rejectedOperation(
            'not-recoverable',
            'No safe recovery path remains.',
          );
        }
        recoveries -= 1;
        recoveryAttempts += 1;
      }

      record = Object.freeze({
        ...record,
        status: 'running' as const,
        lastSimulationTick: normalized.simulationTick,
        lastAttemptKind: attemptKind,
        retryAttempts,
        recoveryAttempts,
        remainingPaths: Object.freeze({ retries, recoveries }),
      });
      const before = this.#progress.snapshot;
      let outcome: TransactionExecutorResult;
      try {
        outcome = this.#executor.execute(Object.freeze({
          runtimeInstanceId: record.runtimeInstanceId,
          transactionId: record.transactionId,
          commandId: record.commandId,
          eventId: record.eventId,
          targetId: record.targetId,
          commandType: record.commandType,
          payload: record.payload,
          phase: record.phase,
          attemptKind,
          simulationTick: normalized.simulationTick,
        }));
      } catch (error) {
        outcome = Object.freeze({
          status: 'error' as const,
          error: Object.freeze({
            code: 'prototype.unhandled-executor-exception',
            message: toMessage(error),
          }),
        });
      }
      const after = this.#progress.snapshot;
      const additions = progressDelta(before, after);
      const effectsApplied = outcome.effectsApplied ?? (
        additions.goals > 0 ||
        additions.rewards > 0 ||
        additions.effects > 0
      );
      record = Object.freeze({
        ...record,
        executionAttempts: record.executionAttempts + 1,
        businessAdditions: Object.freeze({
          goals: record.businessAdditions.goals + additions.goals,
          rewards: record.businessAdditions.rewards + additions.rewards,
          effects: record.businessAdditions.effects + additions.effects,
        }),
      });

      if (outcome.status === 'error') {
        return this.#handleExecutorError(
          stored,
          record,
          outcome.error,
          additions,
          normalized.simulationTick,
          effectsApplied,
        );
      }

      const nextPhase = advancePhase(record.phase);
      if (nextPhase === 'terminal') {
        return this.#commitTerminal(
          stored,
          record,
          succeededTerminalResult(normalized.simulationTick),
        );
      }
      record = Object.freeze({ ...record, phase: nextPhase });
      this.#replaceRecord(stored, record);
      return Object.freeze({ status: 'progressed' as const, record });
    } finally {
      this.#operating = false;
    }
  }

  #handleExecutorError(
    stored: InternalRecord,
    record: TransactionExecutionRecord,
    error: Readonly<{ code: string; message: string }>,
    additions: TransactionProgressAddition,
    simulationTick: number,
    effectsApplied: boolean,
  ): TransactionOperationResult {
    const classification = classifyError(error.code, additions, effectsApplied);
    const withError: TransactionExecutionRecord = Object.freeze({
      ...record,
      errors: Object.freeze([
        ...record.errors,
        Object.freeze({
          code: error.code,
          message: error.message,
          phase: record.phase,
          simulationTick,
          classification: classification.classification,
          effectsApplied,
        }),
      ]),
    });
    return this.#routeAfterError(stored, withError, error, classification);
  }

  #routeAfterError(
    stored: InternalRecord,
    record: TransactionExecutionRecord,
    error: Readonly<{ code: string; message: string }>,
    classification: ErrorClassification,
  ): TransactionOperationResult {
    if (classification.classification === 'permanent') {
      return this.#commitTerminal(
        stored,
        record,
        failedTerminalResult(
          record.lastSimulationTick as number,
          error.code,
          error.message,
        ),
      );
    }

    if (classification.retryable && record.remainingPaths.retries > 0) {
      const pending = Object.freeze({ ...record, status: 'retry-pending' as const });
      this.#replaceRecord(stored, pending);
      return Object.freeze({ status: 'retry-pending' as const, record: pending });
    }
    if (classification.recoverable && record.remainingPaths.recoveries > 0) {
      const pending = pendingRecoveryRecord(record);
      this.#replaceRecord(stored, pending);
      return Object.freeze({
        status: 'recovery-pending' as const,
        record: pending,
      });
    }
    if (record.errors.at(-1)?.effectsApplied) {
      return this.#commitTerminal(
        stored,
        record,
        failedTerminalResult(
          record.lastSimulationTick as number,
          'prototype.safe-recovery-unavailable',
          `Business effects were observed after ${error.code}, and no safe recovery path remains.`,
        ),
      );
    }
    if (record.remainingPaths.recoveries > 0) {
      const pending = pendingRecoveryRecord(record);
      this.#replaceRecord(stored, pending);
      return Object.freeze({
        status: 'recovery-pending' as const,
        record: pending,
      });
    }
    if (record.remainingPaths.retries > 0) {
      const pending = Object.freeze({ ...record, status: 'retry-pending' as const });
      this.#replaceRecord(stored, pending);
      return Object.freeze({ status: 'retry-pending' as const, record: pending });
    }
    return this.#commitTerminal(
      stored,
      record,
      failedTerminalResult(
        record.lastSimulationTick as number,
        'prototype.paths-exhausted',
        `No legal retry or safe recovery path remains after ${error.code}.`,
      ),
    );
  }

  #commitTerminal(
    stored: InternalRecord,
    record: TransactionExecutionRecord,
    pendingTerminal: TransactionTerminalResult,
  ): TransactionOperationResult {
    const attemptedRecord: TransactionExecutionRecord = Object.freeze({
      ...record,
      terminalCommitAttempts: record.terminalCommitAttempts + 1,
    });
    try {
      this.#fault('before-terminal-commit');
    } catch (error) {
      const terminalError = Object.freeze({
        code: 'prototype.terminal-commit-interrupted',
        message: `Terminal registration was interrupted: ${toMessage(error)}`,
      });
      const pendingRecord: TransactionExecutionRecord = Object.freeze({
        ...attemptedRecord,
        status: 'terminal-pending' as const,
        pendingTerminal,
        terminal: undefined,
        remainingPaths: Object.freeze({ retries: 0, recoveries: 0 }),
        errors: Object.freeze([
          ...attemptedRecord.errors,
          Object.freeze({
            code: terminalError.code,
            message: terminalError.message,
            phase: attemptedRecord.phase,
            simulationTick: attemptedRecord.lastSimulationTick as number,
            classification: 'recoverable' as const,
            effectsApplied: hasBusinessAdditions(attemptedRecord),
          }),
        ]),
      });
      this.#replaceRecord(stored, pendingRecord);
      return Object.freeze({
        status: 'terminal-pending' as const,
        record: pendingRecord,
      });
    }

    const terminalRecord: TransactionExecutionRecord = Object.freeze({
      ...attemptedRecord,
      status: pendingTerminal.status,
      pendingTerminal: undefined,
      terminal: pendingTerminal,
      remainingPaths: Object.freeze({ retries: 0, recoveries: 0 }),
    });
    this.#replaceRecord(stored, terminalRecord);
    return Object.freeze({
      status: pendingTerminal.status,
      record: terminalRecord,
    });
  }

  #verifyAccepted(
    stored: InternalRecord,
  ): Extract<TransactionOperationResult, { status: 'rejected' }> | undefined {
    let query: AcceptedCommandQuery;
    try {
      query = stored.target.query(stored.publicRecord.commandId);
    } catch (error) {
      return rejectedOperation(
        'target-query-failed',
        `Accepted command query failed: ${toMessage(error)}`,
      );
    }
    if (query.status !== 'found') {
      return rejectedOperation(
        'target-query-failed',
        `Accepted command query returned ${query.status}.`,
      );
    }
    const associationError = validateAcceptedAssociation(
      query,
      this.runtimeInstanceId,
      this.targetId,
    );
    if (associationError ||
        stableSerialize(query.record) !== stableSerialize(stored.acceptedRecord) ||
        stableSerialize(query.intent) !== stableSerialize(stored.creationIntent)) {
      return rejectedOperation(
        'accepted-association-changed',
        'Accepted command associations changed after execution started.',
      );
    }
    return undefined;
  }

  #replaceRecord(
    stored: InternalRecord,
    record: TransactionExecutionRecord,
  ): void {
    this.#recordsByTransactionId.set(record.transactionId, Object.freeze({
      ...stored,
      publicRecord: Object.freeze(record),
    }));
  }

  #fault(point: TransactionExecutionFaultPoint): void {
    this.#faultInjector?.(point);
  }
}

export class PrototypeTransactionExecutorError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'PrototypeTransactionExecutorError';
    this.code = code;
  }
}

export type PrototypeTransactionExecutorFaultPoint =
  | 'before-apply'
  | 'after-progress-mutation'
  | 'before-verify';

export type PrototypeTransactionExecutorFaultInjector =
  (
    point: PrototypeTransactionExecutorFaultPoint,
    request: TransactionExecutorRequest,
  ) => void;

export type PrototypeProgressTransactionExecutorOptions = Readonly<{
  goalId?: string;
  faultInjector?: PrototypeTransactionExecutorFaultInjector;
}>;

// This executor only reports phase results and errors. It does not classify
// errors, choose retries, perform recovery, or decide terminal outcomes.
export class PrototypeProgressTransactionExecutor implements TransactionExecutor {
  readonly #progress: InMemoryRunProgress;
  readonly #goalId: string;
  readonly #faultInjector: PrototypeTransactionExecutorFaultInjector | undefined;

  constructor(
    progress: InMemoryRunProgress,
    options: PrototypeProgressTransactionExecutorOptions = {},
  ) {
    this.#progress = progress;
    this.#goalId = options.goalId ?? PROTOTYPE_PROGRESS_CONTENT.goal.businessId;
    this.#faultInjector = options.faultInjector;
  }

  execute(request: TransactionExecutorRequest): TransactionExecutorResult {
    try {
      if (request.payload.goalId !== this.#goalId) {
        return executorError(
          'prototype.invalid-completion-request',
          'Command payload does not contain the configured prototype goal ID.',
        );
      }
      if (request.phase === 'apply') {
        this.#fault('before-apply', request);
        const result = this.#progress.completeGoal(this.#goalId);
        this.#fault('after-progress-mutation', request);
        if (result.status === 'rejected') {
          return executorError(
            'prototype.invalid-progress',
            'The configured prototype goal was rejected by run progress.',
          );
        }
        return completedExecutor();
      }

      this.#fault('before-verify', request);
      const complete = this.#progress.verifyGoal(this.#goalId);
      return complete
        ? completedExecutor()
        : executorError(
          'prototype.progress-incomplete',
          'Configured goal and its required permanent records are not all present.',
        );
    } catch (error) {
      const code = error instanceof PrototypeTransactionExecutorError
        ? error.code
        : 'prototype.unhandled-executor-exception';
      return executorError(code, toMessage(error));
    }
  }

  #fault(
    point: PrototypeTransactionExecutorFaultPoint,
    request: TransactionExecutorRequest,
  ): void {
    this.#faultInjector?.(point, request);
  }
}

function createExecutionRecord(
  intent: TransactionCreationIntent,
  retryBudget: number,
  recoveryBudget: number,
): TransactionExecutionRecord {
  return Object.freeze({
    runtimeInstanceId: intent.runtimeInstanceId,
    transactionId: intent.transactionId,
    commandId: intent.commandId,
    eventId: intent.eventId,
    targetId: intent.targetId,
    commandType: intent.commandType,
    payload: intent.payload,
    status: 'not-started' as const,
    phase: 'apply' as const,
    lastSimulationTick: null,
    lastAttemptKind: null,
    executionAttempts: 0,
    retryAttempts: 0,
    recoveryAttempts: 0,
    terminalCommitAttempts: 0,
    resultRequestAttempts: 0,
    lastResultRequestTick: null,
    businessAdditions: Object.freeze({ goals: 0, rewards: 0, effects: 0 }),
    remainingPaths: Object.freeze({
      retries: retryBudget,
      recoveries: recoveryBudget,
    }),
    errors: Object.freeze([]),
  });
}

function validateAcceptedAssociation(
  query: Extract<AcceptedCommandQuery, { status: 'found' }>,
  runtimeInstanceId: string,
  targetId: string,
): string | undefined {
  const { record, intent } = query;
  if (record.runtimeInstanceId !== runtimeInstanceId ||
      intent.runtimeInstanceId !== runtimeInstanceId) {
    return 'Accepted record belongs to another runtime instance.';
  }
  if (record.targetId !== targetId || intent.targetId !== targetId) {
    return 'Accepted record belongs to another target transaction module.';
  }
  if (record.commandId !== intent.commandId ||
      record.eventId !== intent.eventId ||
      record.commandType !== intent.commandType ||
      stableSerialize(record.payload) !== stableSerialize(intent.payload)) {
    return 'Accepted command and creation intent identities do not match.';
  }
  if (intent.status !== 'intent-created' ||
      intent.executionState !== 'not-started') {
    return 'Creation intent is not the immutable not-started acceptance form.';
  }
  return undefined;
}

function normalizeExecutionContext(
  context: TransactionExecutionContext,
):
  | Readonly<{
    ok: true;
    runtimeInstanceId: string;
    simulationTick: number;
  }>
  | Readonly<{
    ok: false;
    rejected: Extract<TransactionOperationResult, { status: 'rejected' }>;
  }> {
  if (context === null || typeof context !== 'object') {
    return Object.freeze({
      ok: false as const,
      rejected: rejectedOperation(
        'invalid-input',
        'Transaction execution context must be an object.',
      ),
    });
  }
  if (typeof context.runtimeInstanceId !== 'string' ||
      !Number.isSafeInteger(context.simulationTick) ||
      context.simulationTick < 1 ||
      context.phase !== 'transaction') {
    return Object.freeze({
      ok: false as const,
      rejected: rejectedOperation(
        'invalid-input',
        'Context requires a runtime ID, positive safe Tick and transaction phase.',
      ),
    });
  }
  return Object.freeze({
    ok: true as const,
    runtimeInstanceId: context.runtimeInstanceId,
    simulationTick: context.simulationTick,
  });
}

function classifyError(
  code: string,
  additions: TransactionProgressAddition,
  effectsApplied = additions.goals > 0 ||
    additions.rewards > 0 ||
    additions.effects > 0,
): ErrorClassification {
  if (effectsApplied) {
    return Object.freeze({
      classification: 'recoverable' as const,
      retryable: false,
      recoverable: true,
    });
  }
  if (code === 'prototype.temporary-apply') {
    return Object.freeze({
      classification: 'temporary' as const,
      retryable: true,
      recoverable: false,
    });
  }
  if (code === 'prototype.ambiguous-apply' ||
      code === 'prototype.progress-incomplete' ||
      code === 'prototype.recovery-transient') {
    return Object.freeze({
      classification: 'recoverable' as const,
      retryable: false,
      recoverable: true,
    });
  }
  if (code === 'prototype.invalid-completion-request' ||
      code === 'prototype.invalid-progress' ||
      code === 'prototype.snapshot-capture-failed' ||
      code === 'prototype.snapshot-validation-failed' ||
      code === 'prototype.snapshot-freeze-failed' ||
      code === 'prototype.snapshot-commit-failed') {
    return Object.freeze({
      classification: 'permanent' as const,
      retryable: false,
      recoverable: false,
    });
  }
  return Object.freeze({
    classification: 'unclassified' as const,
    retryable: true,
    recoverable: true,
  });
}

function progressDelta(
  before: RunProgressSnapshot,
  after: RunProgressSnapshot,
): TransactionProgressAddition {
  return Object.freeze({
    goals: Math.max(0, after.counts.goals - before.counts.goals),
    rewards: Math.max(0, after.counts.rewards - before.counts.rewards),
    effects: Math.max(0, after.counts.effects - before.counts.effects),
  });
}

function advancePhase(
  phase: TransactionExecutionPhase,
): TransactionExecutionPhase | 'terminal' {
  if (phase === 'apply') return 'verify';
  return 'terminal';
}

function succeededTerminalResult(
  simulationTick: number,
): TransactionTerminalResult {
  return Object.freeze({ status: 'succeeded' as const, simulationTick });
}

function failedTerminalResult(
  simulationTick: number,
  reasonCode: string,
  message: string,
): TransactionTerminalResult {
  return Object.freeze({
    status: 'failed' as const,
    simulationTick,
    reasonCode,
    message,
  });
}

function hasBusinessAdditions(record: TransactionExecutionRecord): boolean {
  return record.businessAdditions.goals > 0 ||
    record.businessAdditions.rewards > 0 ||
    record.businessAdditions.effects > 0;
}

function pendingRecoveryRecord(
  record: TransactionExecutionRecord,
): TransactionExecutionRecord {
  return Object.freeze({
    ...record,
    status: 'recovery-pending' as const,
    phase: 'verify' as const,
  });
}

function normalizeTransactionResultContext(
  context: TransactionResultRequestContext,
):
  | Readonly<{
    ok: true;
    runtimeInstanceId: string;
    simulationTick: number;
  }>
  | Readonly<{ ok: false; message: string }> {
  if (context === null || typeof context !== 'object') {
    return {
      ok: false,
      message: 'Transaction result context must be an object.',
    };
  }
  if (typeof context.runtimeInstanceId !== 'string' ||
      !Number.isSafeInteger(context.simulationTick) ||
      context.simulationTick < 1 ||
      context.phase !== 'result') {
    return {
      ok: false,
      message: 'Result context requires a runtime ID, positive safe Tick and result phase.',
    };
  }
  return {
    ok: true,
    runtimeInstanceId: context.runtimeInstanceId,
    simulationTick: context.simulationTick,
  };
}

function toTransactionFinalResult(
  terminal: TransactionTerminalResult,
): TransactionFinalResult {
  return terminal.status === 'succeeded'
    ? Object.freeze({
      status: 'succeeded' as const,
      simulationTick: terminal.simulationTick,
    })
    : Object.freeze({
      status: 'failed' as const,
      simulationTick: terminal.simulationTick,
      reasonCode: terminal.reasonCode,
      message: terminal.message,
    });
}

function transactionResultRequestForRecord(
  record: TransactionExecutionRecord,
): TransactionResultRequest {
  if (!record.terminal) {
    throw new Error('Registered terminal is required for transaction result creation.');
  }
  return Object.freeze({
    runtimeInstanceId: record.runtimeInstanceId,
    sourceEventId: record.eventId,
    commandId: record.commandId,
    transactionId: record.transactionId,
    targetId: record.targetId,
    terminal: toTransactionFinalResult(record.terminal),
  });
}

function mapTransactionResultRejection(
  reason: Extract<TransactionResultCreationResult, { status: 'rejected' }>['reason'],
): Extract<TransactionResultRequestResult, { status: 'rejected' }>['reason'] {
  switch (reason) {
    case 'runtime-mismatch':
      return 'runtime-mismatch';
    case 'association-mismatch':
      return 'association-mismatch';
    case 'result-capacity':
      return 'result-capacity';
    case 'inbox-capacity':
      return 'inbox-capacity';
    case 'history-capacity':
      return 'history-capacity';
    case 'event-id-exhausted':
      return 'event-id-exhausted';
    case 'transaction-aborted':
      return 'transaction-aborted';
    case 'blocked':
      return 'blocked';
    case 'invalid-source':
    case 'target-mismatch':
    case 'invalid-request':
    case 'invalid-terminal':
    case 'unsupported-event-type':
      return 'association-mismatch';
  }
}

function rejectedTransactionResultRequest(
  reason: Extract<TransactionResultRequestResult, { status: 'rejected' }>['reason'],
  message: string,
): Extract<TransactionResultRequestResult, { status: 'rejected' }> {
  return Object.freeze({ status: 'rejected' as const, reason, message });
}

function countStatus(
  records: readonly TransactionExecutionRecord[],
  status: TransactionExecutionStatus,
): number {
  return records.filter(record => record.status === status).length;
}

function terminalRejection(
  record: TransactionExecutionRecord,
): Extract<TransactionOperationResult, { status: 'rejected' }> | undefined {
  if (record.status !== 'succeeded' && record.status !== 'failed') return undefined;
  return rejectedOperation(
    'terminal',
    `Transaction ${record.transactionId} is already ${record.status}.`,
  );
}

function rejectedStart(
  reason: Extract<TransactionStartResult, { status: 'rejected' }>['reason'],
  message: string,
): TransactionStartResult {
  return Object.freeze({ status: 'rejected' as const, reason, message });
}

function rejectedOperation(
  reason: Extract<TransactionOperationResult, { status: 'rejected' }>['reason'],
  message: string,
): Extract<TransactionOperationResult, { status: 'rejected' }> {
  return Object.freeze({ status: 'rejected' as const, reason, message });
}

function completedExecutor(): TransactionExecutorResult {
  return Object.freeze({ status: 'completed' as const });
}

function executorError(code: string, message: string): TransactionExecutorResult {
  return Object.freeze({
    status: 'error' as const,
    error: Object.freeze({ code, message }),
  });
}

function normalizeNonNegativeInteger(
  value: number,
  label: string,
  allowZero: boolean,
): number {
  if (!Number.isSafeInteger(value) || value < (allowZero ? 0 : 1)) {
    throw new RangeError(
      `${label} must be a ${allowZero ? 'non-negative' : 'positive'} safe integer.`,
    );
  }
  return value;
}

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(',')}]`;
  }
  return `{${Object.keys(value as Record<string, unknown>)
    .sort()
    .map(key =>
      `${JSON.stringify(key)}:${stableSerialize((value as Record<string, unknown>)[key])}`)
    .join(',')}}`;
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
