import type {
  CommandCreationCoordinator,
  TargetTransactionModule,
} from './commands.ts';
import {
  RuntimeEventContext,
  type EventCreationFaultInjector,
  type EventCreationCoordinator,
  type EventProducerHandle,
  type EventRetirementFaultInjector,
  type RuntimeUuidProvider,
} from './events.ts';
import {
  InMemoryRunProgress,
  PROTOTYPE_PROGRESS_CONTENT,
} from './progress.ts';
import {
  TRANSACTION_RESULT_EVENT_TYPE,
  type TransactionFinalResult,
  type TransactionResultAssociation,
  type TransactionResultConsumerContext,
  type TransactionResultLifecycle,
  type TransactionResultSourceHandle,
} from './transaction-results.ts';
import {
  PrototypeProgressTransactionExecutor,
  RuntimeTransactionExecutionManager,
  type PrototypeTransactionExecutorFaultInjector,
  type TransactionExecutionFaultInjector,
  type TransactionExecutionStatus,
} from './transactions.ts';

export const GOAL_ROUTE_EVENT_TYPE = 'prototype.route.open.requested';
export const GOAL_ROUTE_COMMAND_TYPE = 'prototype.progress.complete.goal';
export const GOAL_ROUTE_TARGET_ID = 'prototype.progress.target';

export type GoalRoutePhase =
  | 'idle'
  | 'request-pending'
  | 'accepted'
  | 'applying'
  | 'verifying'
  | 'result-pending'
  | 'result-consumed'
  | 'succeeded'
  | 'failed'
  | 'blocked'
  | 'rejected';

export type GoalRequestResult = Readonly<{
  status: 'created' | 'existing' | 'completed' | 'blocked' | 'rejected';
  feedback: string;
}>;

export type GoalRouteProgressCounts = Readonly<{
  collections: number;
  goals: number;
  rewards: number;
  effects: number;
}>;

export type GoalRouteRuntimeSnapshot = Readonly<{
  runtimeInstanceId: string;
  targetId: string;
  eventType: string;
  commandType: string;
  goalId: string;
  phase: GoalRoutePhase;
  message: string;
  eventId: number | null;
  commandId: number | null;
  transactionId: number | null;
  resultEventId: number | null;
  deliveryStatus: string | null;
  transactionStatus: TransactionExecutionStatus | null;
  resultLifecycle: TransactionResultLifecycle | null;
  terminal: TransactionFinalResult | null;
  acceptedTick: number | null;
  applyTick: number | null;
  verifyTick: number | null;
  terminalTick: number | null;
  originalCompletedTick: number | null;
  resultCreatedTick: number | null;
  resultConsumedTick: number | null;
  originalAcknowledged: boolean;
  originalRetired: boolean;
  resultAcknowledged: boolean;
  resultRetired: boolean;
  resultConsumerAttempts: number;
  resultConsumptionCount: number;
  acceptedBusinessCounts: GoalRouteProgressCounts;
  terminalBusinessCounts: GoalRouteProgressCounts;
  progress: GoalRouteProgressCounts;
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

export type GoalRouteRuntimeOptions = Readonly<{
  inboxCapacity?: number;
  historyCapacity?: number;
  transactionResultCapacity?: number;
  commandCapacity?: number;
  transactionCapacity?: number;
  initialNextEventId?: number;
  initialNextCommandId?: number;
  initialNextTransactionId?: number;
  eventFaultInjector?: EventCreationFaultInjector;
  retirementFaultInjector?: EventRetirementFaultInjector;
  transactionFaultInjector?: TransactionExecutionFaultInjector;
  executorFaultInjector?: PrototypeTransactionExecutorFaultInjector;
  resultConsumerFaultInjector?: (context: TransactionResultConsumerContext) => void;
}>;

const EMPTY_COUNTS: GoalRouteProgressCounts = Object.freeze({
  collections: 0,
  goals: 0,
  rewards: 0,
  effects: 0,
});

// This small host composition owns one run-scoped goal route. It reuses the
// event, command, delivery, transaction and result kernels without moving
// gameplay policy into any of them.
export class PrototypeGoalRouteRuntime {
  readonly runtimeInstanceId: string;
  readonly #progress: InMemoryRunProgress;
  readonly #events: EventCreationCoordinator;
  readonly #commands: CommandCreationCoordinator;
  readonly #target: TargetTransactionModule;
  readonly #manager: RuntimeTransactionExecutionManager;
  readonly #resultSource: TransactionResultSourceHandle;
  readonly #producer: EventProducerHandle;
  readonly #resultConsumerFaultInjector:
    GoalRouteRuntimeOptions['resultConsumerFaultInjector'];
  readonly #consumedResultEventIds = new Set<number>();
  #phase: GoalRoutePhase = 'idle';
  #message = '按 E 请求开启测试路线。';
  #lastError: string | null = null;
  #lastStepTick = 0;
  #eventId: number | null = null;
  #commandId: number | null = null;
  #transactionId: number | null = null;
  #resultEventId: number | null = null;
  #deliveryStatus: string | null = null;
  #transactionStatus: TransactionExecutionStatus | null = null;
  #resultLifecycle: TransactionResultLifecycle | null = null;
  #terminal: TransactionFinalResult | null = null;
  #acceptedTick: number | null = null;
  #applyTick: number | null = null;
  #verifyTick: number | null = null;
  #terminalTick: number | null = null;
  #originalCompletedTick: number | null = null;
  #resultCreatedTick: number | null = null;
  #resultConsumedTick: number | null = null;
  #originalAcknowledged = false;
  #originalRetired = false;
  #resultAcknowledged = false;
  #resultRetired = false;
  #resultConsumerAttempts = 0;
  #resultConsumptionCount = 0;
  #resultPublicationAttempted = false;
  #acceptedBusinessCounts = EMPTY_COUNTS;
  #terminalBusinessCounts = EMPTY_COUNTS;

  constructor(
    progress: InMemoryRunProgress,
    uuidProvider: RuntimeUuidProvider,
    options: GoalRouteRuntimeOptions = {},
  ) {
    this.#progress = progress;
    const context = new RuntimeEventContext(uuidProvider, {
      initialNextEventId: options.initialNextEventId,
      initialNextCommandId: options.initialNextCommandId,
      initialNextTransactionId: options.initialNextTransactionId,
    });
    this.runtimeInstanceId = context.runtimeInstanceId;

    let target: TargetTransactionModule | undefined;
    this.#events = context.createCoordinator({
      inboxCapacity: options.inboxCapacity ?? 16,
      historyCapacity: options.historyCapacity ?? 64,
      transactionResultCapacity: options.transactionResultCapacity ?? 8,
      allowedEventTypes: [
        GOAL_ROUTE_EVENT_TYPE,
        TRANSACTION_RESULT_EVENT_TYPE,
      ],
      faultInjector: options.eventFaultInjector,
      retirementFaultInjector: options.retirementFaultInjector,
      transactionResultConsumer: result => this.#consumeTransactionResult(result),
      realCommandDelivery: {
        capacity: 16,
        handler: event => {
          if (event.type !== GOAL_ROUTE_EVENT_TYPE ||
              event.payload.goalId !== PROTOTYPE_PROGRESS_CONTENT.goal.businessId) {
            throw new Error('The route event does not request the configured goal.');
          }
          return {
            sourceEvent: event,
            targetId: GOAL_ROUTE_TARGET_ID,
            commandType: GOAL_ROUTE_COMMAND_TYPE,
            payload: {
              goalId: PROTOTYPE_PROGRESS_CONTENT.goal.businessId,
            },
          };
        },
        targetFor: targetId => targetId === GOAL_ROUTE_TARGET_ID ? target : undefined,
      },
    });
    this.#commands = this.#events.createCommandCoordinator({
      capacity: options.commandCapacity ?? 16,
    });
    this.#target = this.#commands.createTargetTransactionModule(
      GOAL_ROUTE_TARGET_ID,
      { capacity: 16 },
    );
    target = this.#target;
    this.#resultSource = this.#events.createTransactionResultSource(
      GOAL_ROUTE_TARGET_ID,
    );
    this.#producer = this.#events.createProducer();
    this.#manager = new RuntimeTransactionExecutionManager(
      this.#target,
      this.runtimeInstanceId,
      progress,
      new PrototypeProgressTransactionExecutor(progress, {
        goalId: PROTOTYPE_PROGRESS_CONTENT.goal.businessId,
        faultInjector: options.executorFaultInjector,
      }),
      {
        capacity: options.transactionCapacity ?? 16,
        retryBudget: 0,
        recoveryBudget: 0,
        faultInjector: options.transactionFaultInjector,
        transactionResults: {
          port: this.#events,
          source: this.#resultSource,
        },
      },
    );
    this.#resultConsumerFaultInjector = options.resultConsumerFaultInjector;
    if (this.#progress.snapshot.goals.includes(
      PROTOTYPE_PROGRESS_CONTENT.goal.businessId,
    )) {
      this.#phase = 'succeeded';
      this.#message = '目标 E 在共享运行进度中已经完成。';
      this.#terminalBusinessCounts = Object.freeze({
        ...this.#progress.snapshot.counts,
      });
    }
  }

  requestGoal(): GoalRequestResult {
    if (this.#progress.snapshot.goals.includes(
      PROTOTYPE_PROGRESS_CONTENT.goal.businessId,
    )) {
      this.#phase = this.#phase === 'idle' ? 'succeeded' : this.#phase;
      this.#message = '目标 E 已完成；本次运行不重复发放奖励。';
      return Object.freeze({
        status: 'completed' as const,
        feedback: this.#message,
      });
    }
    if (this.#eventId !== null) {
      return Object.freeze({
        status: this.#phase === 'blocked' || this.#phase === 'rejected' ||
            this.#phase === 'failed'
          ? 'blocked' as const
          : 'existing' as const,
        feedback: this.#message,
      });
    }

    const created = this.#events.create({
      type: GOAL_ROUTE_EVENT_TYPE,
      payload: {
        goalId: PROTOTYPE_PROGRESS_CONTENT.goal.businessId,
        interactionId: PROTOTYPE_PROGRESS_CONTENT.goal.interactionId,
      },
    }, this.#producer);
    if (created.status !== 'created') {
      this.#phase = created.status === 'blocked' ? 'blocked' : 'rejected';
      this.#lastError = created.status === 'blocked'
        ? created.failure.message
        : created.failure?.message ?? created.message;
      this.#message = `目标 E 请求未创建：${created.message}`;
      return Object.freeze({
        status: created.status === 'blocked' ? 'blocked' as const : 'rejected' as const,
        feedback: this.#message,
      });
    }

    this.#eventId = created.event.eventId;
    this.#phase = 'request-pending';
    this.#message =
      `Event #${created.event.eventId} 已创建为 Pending；业务尚未修改。`;
    return Object.freeze({
      status: 'created' as const,
      feedback: this.#message,
    });
  }

  step(simulationTick: number): void {
    if (!Number.isSafeInteger(simulationTick) || simulationTick < 1) {
      throw new RangeError('Goal route simulation tick must be a positive safe integer.');
    }
    if (simulationTick <= this.#lastStepTick) {
      throw new Error('Goal route ticks must be strictly increasing.');
    }
    this.#lastStepTick = simulationTick;

    try {
      // Coordination is one fixed, single-pass phase. Events created after the
      // snapshot remain Pending until the next actual SimulationTick.
      const dispatch = this.#events.dispatch({
        runtimeInstanceId: this.runtimeInstanceId,
        simulationTick,
        phase: 'coordination',
      });
      if (dispatch.status !== 'completed') {
        this.#setBlocked(
          dispatch.status === 'blocked'
            ? dispatch.failure.message
            : dispatch.message,
        );
        return;
      }

      this.#observeEventLifecycles(simulationTick);
      this.#observeDelivery(simulationTick);
      this.#confirmOriginalEvent();
      this.#advanceAcceptedTransaction(simulationTick);
      this.#publishTerminalResult(simulationTick);
      this.#refreshResultLifecycle();
      this.#confirmResultEvent();
      this.#refreshTerminalPhase();
    } catch (error) {
      this.#setBlocked(toMessage(error));
    }
  }

  get snapshot(): GoalRouteRuntimeSnapshot {
    const events = this.#events.snapshot;
    const commands = this.#commands.snapshot;
    const target = this.#target.snapshot;
    const transactions = this.#manager.snapshot;
    const progress = this.#progress.snapshot.counts;
    return Object.freeze({
      runtimeInstanceId: this.runtimeInstanceId,
      targetId: GOAL_ROUTE_TARGET_ID,
      eventType: GOAL_ROUTE_EVENT_TYPE,
      commandType: GOAL_ROUTE_COMMAND_TYPE,
      goalId: PROTOTYPE_PROGRESS_CONTENT.goal.businessId,
      phase: this.#phase,
      message: this.#message,
      eventId: this.#eventId,
      commandId: this.#commandId,
      transactionId: this.#transactionId,
      resultEventId: this.#resultEventId,
      deliveryStatus: this.#deliveryStatus,
      transactionStatus: this.#transactionStatus,
      resultLifecycle: this.#resultLifecycle,
      terminal: this.#terminal,
      acceptedTick: this.#acceptedTick,
      applyTick: this.#applyTick,
      verifyTick: this.#verifyTick,
      terminalTick: this.#terminalTick,
      originalCompletedTick: this.#originalCompletedTick,
      resultCreatedTick: this.#resultCreatedTick,
      resultConsumedTick: this.#resultConsumedTick,
      originalAcknowledged: this.#originalAcknowledged,
      originalRetired: this.#originalRetired,
      resultAcknowledged: this.#resultAcknowledged,
      resultRetired: this.#resultRetired,
      resultConsumerAttempts: this.#resultConsumerAttempts,
      resultConsumptionCount: this.#resultConsumptionCount,
      acceptedBusinessCounts: this.#acceptedBusinessCounts,
      terminalBusinessCounts: this.#terminalBusinessCounts,
      progress: Object.freeze({ ...progress }),
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

  #observeEventLifecycles(simulationTick: number): void {
    const snapshot = this.#events.snapshot;
    const original = snapshot.lifecycleRecords.find(
      record => record.eventId === this.#eventId,
    );
    if (original?.status === 'completed' && this.#originalCompletedTick === null) {
      this.#originalCompletedTick = simulationTick;
      this.#acceptedTick ??= simulationTick;
    }
    const result = snapshot.lifecycleRecords.find(
      record => record.eventId === this.#resultEventId,
    );
    if (result?.status === 'completed' && this.#phase !== 'blocked') {
      this.#phase = 'result-consumed';
    }
  }

  #observeDelivery(simulationTick: number): void {
    if (this.#eventId === null) return;
    const record = this.#events.snapshot.delivery?.records.find(
      delivery => delivery.eventId === this.#eventId,
    );
    if (!record) return;
    this.#deliveryStatus = record.status;
    if (record.status === 'accepted') {
      this.#acceptedTick ??= simulationTick;
      this.#commandId ??= record.commandId ?? null;
      this.#transactionId ??= record.transactionId ?? null;
      if (this.#acceptedBusinessCounts === EMPTY_COUNTS) {
        this.#acceptedBusinessCounts = Object.freeze({
          ...this.#progress.snapshot.counts,
        });
      }
      if (this.#phase === 'request-pending') {
        this.#phase = 'accepted';
        this.#message =
          `Event #${record.eventId} 已被目标接收；Accepted 不代表业务成功。`;
      }
      return;
    }
    if (record.status === 'retryable' || record.status === 'unknown') {
      this.#setBlocked(record.message);
    } else if (record.status === 'rejected') {
      this.#phase = 'blocked';
      this.#lastError = record.message;
      this.#message = `命令接收被拒绝：${record.message}`;
    }
  }

  #advanceAcceptedTransaction(simulationTick: number): void {
    if (this.#commandId === null || this.#phase === 'blocked') return;
    // A registered terminal remains queryable forever. Once it has been
    // captured, later Ticks only continue result notification and retirement;
    // they must not rewrite the phase back to result-pending.
    if (this.#terminal !== null || this.#resultEventId !== null) return;
    const started = this.#manager.start(this.#commandId);
    if (started.status === 'rejected') {
      this.#setBlocked(started.message);
      return;
    }
    this.#transactionId = started.record.transactionId;
    this.#transactionStatus = started.record.status;

    if (started.record.status === 'succeeded' ||
        started.record.status === 'failed') {
      this.#captureTerminal(started.record);
      return;
    }
    if (started.record.status === 'retry-pending' ||
        started.record.status === 'recovery-pending' ||
        started.record.status === 'terminal-pending') {
      this.#setBlocked(
        `Transaction #${started.record.transactionId} requires explicit ${started.record.status} recovery.`,
      );
      return;
    }
    if (started.record.lastSimulationTick === simulationTick) return;

    const operation = this.#manager.advance(started.record.transactionId, {
      runtimeInstanceId: this.runtimeInstanceId,
      simulationTick,
      phase: 'transaction',
    });
    if (operation.status === 'rejected') {
      this.#setBlocked(operation.message);
      return;
    }

    this.#transactionStatus = operation.record.status;
    if (operation.status === 'progressed') {
      this.#applyTick ??= simulationTick;
      this.#phase = 'verifying';
      this.#message =
        `Transaction #${operation.record.transactionId} apply 完成；等待下一 Tick verify。`;
      return;
    }
    if (operation.status === 'succeeded' || operation.status === 'failed') {
      this.#verifyTick ??= simulationTick;
      this.#terminalTick = simulationTick;
      this.#captureTerminal(operation.record);
      return;
    }
    this.#setBlocked(
      `Transaction #${operation.record.transactionId} entered ${operation.status}.`,
    );
  }

  #publishTerminalResult(simulationTick: number): void {
    if (this.#transactionId === null || this.#terminal === null ||
        this.#phase === 'blocked') {
      return;
    }
    const query = this.#manager.readResultEvent(this.#transactionId);
    if (query.status === 'found') {
      this.#captureResult(
        query.association,
        query.lifecycle,
        this.#resultCreatedTick,
      );
      return;
    }
    if (query.status === 'rejected') {
      this.#setBlocked(query.message);
      return;
    }
    if (this.#resultPublicationAttempted) {
      if (this.#resultEventId === null) {
        this.#setBlocked('Result creation outcome remains unknown without a stable Result Event ID.');
      }
      return;
    }

    this.#resultPublicationAttempted = true;
    const created = this.#manager.requestResultEvent(this.#transactionId, {
      runtimeInstanceId: this.runtimeInstanceId,
      simulationTick,
      phase: 'result',
    });
    if (created.status === 'created' || created.status === 'existing') {
      this.#captureResult(created.association, created.record.resultEventLifecycle,
        simulationTick);
      return;
    }
    if (created.status === 'unknown') {
      this.#resultEventId = created.record.resultEventId ?? null;
      this.#phase = 'blocked';
      this.#lastError = created.message;
      this.#message =
        `结果创建回执丢失；Transaction #${created.record.transactionId} 保持原终态。`;
      return;
    }
    if (created.status === 'rejected') {
      this.#phase = 'blocked';
      this.#lastError = created.message;
      this.#message = `结果事件创建被拒绝：${created.message}`;
    }
  }

  #captureResult(
    association: TransactionResultAssociation,
    lifecycle: TransactionResultLifecycle | undefined,
    createdTick: number | null,
  ): void {
    this.#resultEventId = association.resultEventId;
    this.#terminal = association.terminal;
    this.#resultLifecycle = lifecycle ?? this.#resultLifecycle;
    this.#resultCreatedTick ??= createdTick;
    if (this.#phase !== 'result-consumed' && !this.#resultRetired) {
      this.#phase = 'result-pending';
      this.#message =
        `Transaction #${association.transactionId} ${association.terminal.status}；` +
        `Result Event #${association.resultEventId} 等待固定协调阶段。`;
    }
  }

  #consumeTransactionResult(
    context: TransactionResultConsumerContext,
  ): Readonly<{ status: 'consumed' | 'already-consumed' }> |
    Readonly<{ status: 'failed'; message: string }> {
    this.#resultConsumerAttempts++;
    if (this.#consumedResultEventIds.has(context.event.eventId)) {
      return Object.freeze({ status: 'already-consumed' as const });
    }
    try {
      this.#resultConsumerFaultInjector?.(context);
    } catch (error) {
      return Object.freeze({
        status: 'failed' as const,
        message: toMessage(error),
      });
    }

    // Result consumption records feedback only. The business effect remains
    // owned by the transaction executor and the shared progress repository.
    this.#consumedResultEventIds.add(context.event.eventId);
    this.#resultConsumptionCount++;
    this.#resultConsumedTick = context.simulationTick;
    this.#terminal = context.association.terminal;
    this.#phase = 'result-consumed';
    this.#message =
      `Result Event #${context.event.eventId} 已消费；目标、奖励和路线效果不再追加。`;
    return Object.freeze({ status: 'consumed' as const });
  }

  #confirmOriginalEvent(): void {
    if (this.#eventId === null ||
        this.#originalCompletedTick === null ||
        this.#originalRetired) {
      return;
    }
    const read = this.#events.readFinalResult(this.#producer, this.#eventId);
    if (read.status !== 'available') return;
    const acknowledged = this.#events.acknowledge(this.#producer, read.result);
    if (acknowledged.status !== 'acknowledged' &&
        acknowledged.status !== 'already-acknowledged') {
      this.#setBlocked(acknowledged.message);
      return;
    }
    this.#originalAcknowledged = true;
    const retired = this.#events.retire(this.#producer, read.result);
    if (retired.status === 'retired' || retired.status === 'already-retired') {
      this.#originalRetired = true;
    } else if (retired.status === 'failed') {
      this.#setBlocked(retired.failure.message);
    } else {
      this.#setBlocked(retired.message);
    }
  }

  #confirmResultEvent(): void {
    if (this.#resultEventId === null ||
        this.#phase !== 'result-consumed' ||
        this.#resultRetired) {
      return;
    }
    const producer = this.#resultSource.producer;
    const read = this.#events.readFinalResult(producer, this.#resultEventId);
    if (read.status !== 'available') return;
    const acknowledged = this.#events.acknowledge(producer, read.result);
    if (acknowledged.status !== 'acknowledged' &&
        acknowledged.status !== 'already-acknowledged') {
      this.#setBlocked(acknowledged.message);
      return;
    }
    this.#resultAcknowledged = true;
    const retired = this.#events.retire(producer, read.result);
    if (retired.status === 'retired' || retired.status === 'already-retired') {
      this.#resultRetired = true;
      this.#resultLifecycle = 'retired';
    } else if (retired.status === 'failed') {
      this.#setBlocked(retired.failure.message);
    } else {
      this.#setBlocked(retired.message);
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
    if (this.#phase === 'blocked') return;
    if (this.#resultRetired && this.#originalRetired &&
        this.#terminal?.status === 'succeeded') {
      this.#phase = 'succeeded';
      this.#message = '链路完成：路线 OPEN，目标、奖励和效果各记录一次。';
      return;
    }
    if (this.#resultRetired && this.#originalRetired &&
        this.#terminal?.status === 'failed') {
      this.#phase = 'failed';
      this.#message =
        `链路结束于 Failed：${this.#terminal.reasonCode}。`;
      return;
    }
    if (this.#resultLifecycle === 'retired') {
      this.#phase = this.#terminal?.status ?? this.#phase;
    }
  }

  #captureTerminal(
    record: Readonly<{
      status: TransactionExecutionStatus;
      terminal?: TransactionFinalResult;
    }>,
  ): void {
    this.#transactionStatus = record.status;
    if (!record.terminal) return;
    this.#terminal = record.terminal;
    this.#terminalBusinessCounts = Object.freeze({
      ...this.#progress.snapshot.counts,
    });
    if (this.#phase !== 'result-consumed' && !this.#resultRetired) {
      this.#phase = 'result-pending';
      this.#message =
        `Transaction 已进入 ${record.terminal.status}；等待唯一最终结果事件。`;
    }
  }

  #setBlocked(message: string): void {
    this.#phase = 'blocked';
    this.#lastError = message;
    this.#message = `链路受阻：${message}`;
  }
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
