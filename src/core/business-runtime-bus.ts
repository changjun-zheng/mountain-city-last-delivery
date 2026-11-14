import type {
  CommandCreationCoordinator,
  TargetTransactionModule,
} from './commands.ts';
import {
  RuntimeEventContext,
  type EventCreationCoordinator,
  type EventCreationFaultInjector,
  type EventDispatchResult,
  type EventProducerHandle,
  type EventRetirementFaultInjector,
  type CheckpointEntryCoordinationResult,
  type CheckpointEntryCompletionResult,
  type PlayerFailureCoordinationResult,
  type PlayerFailureCompletionResult,
  type PendingEvent,
  type RealCommandDeliveryHandler,
  type RuntimeUuidProvider,
} from './events.ts';
import type {
  TransactionResultConsumer,
  TransactionResultConsumerContext,
  TransactionResultConsumerResult,
  TransactionResultEventPort,
} from './transaction-results.ts';

export type BusinessRuntimeBusOptions = Readonly<{
  allowedEventTypes: readonly string[];
  checkpointEntryEventType?: string;
  playerFailureEventType?: string;
  initialNextEventId?: number;
  initialNextCommandId?: number;
  initialNextTransactionId?: number;
  inboxCapacity?: number;
  historyCapacity?: number;
  transactionResultCapacity?: number;
  commandCapacity?: number;
  eventFaultInjector?: EventCreationFaultInjector;
  retirementFaultInjector?: EventRetirementFaultInjector;
}>;

export type BusinessEventRoute = Readonly<{
  eventType: string;
  target: TargetTransactionModule;
  createCommand: RealCommandDeliveryHandler;
  consumeResult?: TransactionResultConsumer;
}>;

type StoredRoute = BusinessEventRoute;

// One run owns one event coordinator, Inbox and Event ID sequence. Independent
// feature runtimes register a command route and optional result consumer here.
export class BusinessRuntimeBus {
  readonly runtimeInstanceId: string;
  readonly events: EventCreationCoordinator;
  readonly commands: CommandCreationCoordinator;
  readonly #routesByEventType = new Map<string, StoredRoute>();
  readonly #routesByTargetId = new Map<string, StoredRoute>();

  constructor(
    uuidProvider: RuntimeUuidProvider,
    options: BusinessRuntimeBusOptions,
  ) {
    if (options.allowedEventTypes.length === 0) {
      throw new Error('Business runtime event types are required.');
    }
    const context = new RuntimeEventContext(uuidProvider, {
      initialNextEventId: options.initialNextEventId,
      initialNextCommandId: options.initialNextCommandId,
      initialNextTransactionId: options.initialNextTransactionId,
    });
    this.runtimeInstanceId = context.runtimeInstanceId;
    this.events = context.createCoordinator({
      inboxCapacity: options.inboxCapacity ?? 32,
      historyCapacity: options.historyCapacity ?? 128,
      transactionResultCapacity: options.transactionResultCapacity ?? 16,
      allowedEventTypes: options.allowedEventTypes,
      checkpointEntryEventType: options.checkpointEntryEventType,
      playerFailureEventType: options.playerFailureEventType,
      faultInjector: options.eventFaultInjector,
      retirementFaultInjector: options.retirementFaultInjector,
      realCommandDelivery: {
        capacity: 32,
        handler: (event, context) => this.#createCommand(event, context),
        targetFor: targetId => this.#routesByTargetId.get(targetId)?.target,
      },
      transactionResultConsumer: context => this.#consumeResult(context),
    });
    this.commands = this.events.createCommandCoordinator({
      capacity: options.commandCapacity ?? 32,
    });
  }

  createProducer(): EventProducerHandle {
    return this.events.createProducer();
  }

  get resultPort(): TransactionResultEventPort {
    return this.events;
  }

  register(route: BusinessEventRoute): void {
    if (this.#routesByEventType.has(route.eventType) ||
        this.#routesByTargetId.has(route.target.targetId)) {
      throw new Error(
        `Business runtime route "${route.eventType}" is already registered.`,
      );
    }
    this.#routesByEventType.set(route.eventType, route);
    this.#routesByTargetId.set(route.target.targetId, route);
  }

  dispatch(simulationTick: number): EventDispatchResult {
    return this.events.dispatch({
      runtimeInstanceId: this.runtimeInstanceId,
      simulationTick,
      phase: 'coordination',
    });
  }

  completeCheckpointEntry(
    producer: EventProducerHandle,
    eventId: number,
    result: CheckpointEntryCoordinationResult,
  ): CheckpointEntryCompletionResult {
    return this.events.completeCheckpointEntry(producer, eventId, result);
  }

  completePlayerFailure(
    producer: EventProducerHandle,
    eventId: number,
    result: PlayerFailureCoordinationResult,
  ): PlayerFailureCompletionResult {
    return this.events.completePlayerFailure(producer, eventId, result);
  }

  #createCommand(
    event: PendingEvent,
    context: Parameters<RealCommandDeliveryHandler>[1],
  ) {
    const route = this.#routesByEventType.get(event.type);
    if (!route) {
      throw new Error(`No command route is registered for event type ${event.type}.`);
    }
    return route.createCommand(event, context);
  }

  #consumeResult(
    context: TransactionResultConsumerContext,
  ): TransactionResultConsumerResult {
    const route = this.#routesByTargetId.get(context.association.targetId);
    if (!route?.consumeResult) {
      return Object.freeze({
        status: 'failed' as const,
        message:
          `No transaction result consumer is registered for ` +
          `${context.association.targetId}.`,
      });
    }
    return route.consumeResult(context);
  }
}
