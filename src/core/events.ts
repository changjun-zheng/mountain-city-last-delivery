import {
  CommandCreationCoordinator,
  RuntimeBusinessIdentityInfrastructure,
  type CommandCreationRequest,
  type EventCommand,
  type TargetTransactionModule,
  type CommandEventSource,
  type CommandSourceEvent,
  type CommandSourceInspection,
} from './commands.ts';
import {
  RealCommandDeliveryCoordinator,
  type CommandDeliveryOperationResult,
  type CommandDeliveryRecord,
  type CommandDeliverySnapshot,
  type CommandDeliveryStatus,
  type DeliverySourceEvent,
  type RealCommandDeliveryOptions as DeliveryCoordinatorOptions,
} from './delivery.ts';
import {
  TRANSACTION_RESULT_EVENT_TYPE,
  transactionResultRequestsEqual,
  type TransactionFinalResult,
  type TransactionResultAuthority,
  type TransactionResultAuthorityRegistrationResult,
  type TransactionResultAssociation,
  type TransactionResultConsumer,
  type TransactionResultCreationResult,
  type TransactionResultEvent,
  type TransactionResultEventPort,
  type TransactionResultLifecycle,
  type TransactionResultQuery,
  type TransactionResultRequest,
  type TransactionResultSourceHandle,
} from './transaction-results.ts';

export interface RuntimeUuidProvider {
  generate(): string;
}

export type EventPayload = Readonly<Record<string, unknown>>;

export type PendingEvent = Readonly<{
  eventId: number;
  runtimeInstanceId: string;
  type: string;
  payload: EventPayload;
  status: 'pending';
}>;

export type EventCreationRequest = Readonly<{
  type: string;
  payload: EventPayload;
}>;

export type EventProducerHandle = Readonly<{
  producerId: string;
}>;

export type EventLifecycleState = 'pending' | 'processing' | 'completed';
export type EventDispatchPhase = 'coordination';

export type EventDispatchContext = Readonly<{
  runtimeInstanceId: string;
  simulationTick: number;
  phase: EventDispatchPhase;
  retryDeliveryEventIds?: readonly number[];
}>;

export type EventDispatchHandlerContext = Readonly<{
  runtimeInstanceId: string;
  simulationTick: number;
  phase: EventDispatchPhase;
  create: (
    request: EventCreationRequest,
    producer?: EventProducerHandle,
  ) => EventCreationResult;
  statusOf: (eventId: number) => EventLifecycleState | undefined;
}>;

export type EventDispatchHandler = (
  event: PendingEvent,
  context: EventDispatchHandlerContext,
) => void;

export type TestCommandReceiptResult =
  | Readonly<{ status: 'accepted'; testCommandReference: string }>
  | Readonly<{ status: 'not-accepted'; reason: string }>
  | Readonly<{ status: 'unknown'; reason: string }>;

// Explicitly a test double. It does not represent a real Command ID Generator,
// command receiver or transaction and is not part of the production host.
export type CommandReceiptTestDouble = (
  event: PendingEvent,
  context: EventDispatchHandlerContext,
) => TestCommandReceiptResult;

export type RealCommandDeliveryHandler = (
  event: PendingEvent,
  context: EventDispatchHandlerContext,
) => CommandCreationRequest;

export type RealCommandDeliveryOptions = Readonly<{
  handler: RealCommandDeliveryHandler;
  targetFor: (targetId: string) => TargetTransactionModule | undefined;
  capacity?: number;
  faultInjector?: DeliveryCoordinatorOptions['faultInjector'];
}>;

export type EventDispatchFaultPoint =
  | 'before-processing-transition'
  | 'before-completion-transition';

export type EventDispatchFaultInjector = (point: EventDispatchFaultPoint) => void;

export type EventRetirementFaultPoint =
  | 'before-retirement-ledger-commit'
  | 'before-lifecycle-record-remove'
  | 'after-lifecycle-record-remove';

export type EventRetirementFaultInjector =
  (point: EventRetirementFaultPoint) => void;

export type EventCreationFaultPoint =
  | 'validation'
  | 'candidate-prepared'
  | 'registration-prepared'
  | 'inbox-prepared'
  | 'event-id-committed'
  | 'registration-committed'
  | 'inbox-committed'
  | 'before-result-binding-commit'
  | 'after-result-commit'
  | 'rollback';

export type EventCreationFaultInjector = (point: EventCreationFaultPoint) => void;

export type EventCreationOptions = Readonly<{
  inboxCapacity: number;
  historyCapacity?: number;
  transactionResultCapacity?: number;
  allowedEventTypes?: readonly string[];
  dispatchHandler?: EventDispatchHandler;
  commandReceiptTestDouble?: CommandReceiptTestDouble;
  realCommandDelivery?: RealCommandDeliveryOptions;
  transactionResultConsumer?: TransactionResultConsumer;
  // Deterministic failure seam for tests. Runtime composition does not supply it.
  faultInjector?: EventCreationFaultInjector;
  // A separate deterministic seam verifies lifecycle transitions without
  // exposing registry mutation to callers.
  dispatchFaultInjector?: EventDispatchFaultInjector;
  retirementFaultInjector?: EventRetirementFaultInjector;
}>;

export type RuntimeEventContextOptions = Readonly<{
  initialNextEventId?: number;
  initialNextCommandId?: number;
  initialNextTransactionId?: number;
}>;

export type EventCreationRejectionReason =
  | 'invalid-request'
  | 'unsupported-event-type'
  | 'reserved-event-type'
  | 'invalid-payload'
  | 'invalid-producer'
  | 'inbox-capacity'
  | 'history-capacity'
  | 'event-id-exhausted'
  | 'transaction-aborted';

export type EventCreationFailure = Readonly<{
  code: 'transaction-aborted' | 'rollback-unconfirmed';
  point: EventCreationFaultPoint;
  message: string;
  rollback: 'complete' | 'unconfirmed';
}>;

export type EventCreationResult =
  | Readonly<{ status: 'created'; event: PendingEvent }>
  | Readonly<{
    status: 'rejected';
    reason: EventCreationRejectionReason;
    message: string;
    failure?: EventCreationFailure;
  }>
  | Readonly<{
    status: 'blocked';
    reason: 'event-creation-blocked';
    message: string;
    failure: EventCreationFailure;
  }>;

export type EventLifecycleRecord = Readonly<{
  eventId: number;
  runtimeInstanceId: string;
  status: EventLifecycleState;
  producerId?: string;
  resultDelivered?: boolean;
  acknowledged?: boolean;
  simulationTick?: number;
  testCommandReference?: string;
  realCommand?: RealCommandAssociation;
  transactionResult?: TransactionResultAssociation;
  transactionResultConsumed?: boolean;
}>;

export type RealCommandAssociation = Readonly<{
  commandId: number;
  targetId: string;
  transactionId: number;
}>;

export type RealCommandDeliveryProgress = Readonly<{
  acceptedEventIds: readonly number[];
  retryableEventIds: readonly number[];
  rejectedEventIds: readonly number[];
  unknownEventIds: readonly number[];
  reconciledEventIds: readonly number[];
  retriedEventIds: readonly number[];
}>;

export type EventDispatchProgress = Readonly<{
  processedEventIds: readonly number[];
  completedEventIds: readonly number[];
  pendingEventIds: readonly number[];
  delivery?: RealCommandDeliveryProgress;
}>;

export type EventDispatchFailure = Readonly<{
  code:
    | 'handler-threw'
    | 'receipt-not-accepted'
    | 'receipt-unknown'
    | 'invalid-receipt'
    | 'lifecycle-invalid'
    | 'dispatch-blocked'
    | 'result-consumer-not-configured'
    | 'result-consumer-threw'
    | 'result-consumer-invalid'
    | 'result-lifecycle-invalid';
  simulationTick: number;
  eventId?: number;
  message: string;
  progress: EventDispatchProgress;
}>;

export type EventDispatchResult =
  | Readonly<{
    status: 'completed';
    simulationTick: number;
    progress: EventDispatchProgress;
  }>
  | Readonly<{
    status: 'rejected';
    reason:
      | 'invalid-phase'
      | 'runtime-mismatch'
      | 'phase-order'
      | 'recursive-dispatch'
      | 'dispatch-not-configured'
      | 'retry-not-allowed';
    message: string;
  }>
  | Readonly<{
    status: 'blocked';
    failure: EventDispatchFailure;
  }>;

export type EventRedeliveryProbeResult =
  | Readonly<{
    status: 'duplicate';
    eventId: number;
    lifecycle: EventLifecycleState;
  }>
  | Readonly<{
    status: 'rejected';
    reason:
      | 'invalid-context'
      | 'runtime-mismatch'
      | 'unknown-event'
      | 'integrity-mismatch'
      | 'retired-event';
    message: string;
  }>;

export type CompletedEventResult = Readonly<{
  status: 'coordinated-completed';
  runtimeInstanceId: string;
  eventId: number;
  producerId: string;
  testCommandReference?: string;
  realCommand?: RealCommandAssociation;
  transactionResult?: TransactionResultAssociation;
}>;

export type FinalEventResultRead =
  | Readonly<{
    status: 'available';
    result: CompletedEventResult;
  }>
  | Readonly<{
    status: 'rejected';
    reason:
      | 'invalid-producer'
      | 'producer-mismatch'
      | 'unknown-event'
      | 'not-completed';
    message: string;
  }>;

export type ProducerAcknowledgementResult =
  | Readonly<{
    status: 'acknowledged';
    eventId: number;
    producerId: string;
  }>
  | Readonly<{
    status: 'already-acknowledged';
    eventId: number;
    producerId: string;
  }>
  | Readonly<{
    status: 'rejected';
    reason:
      | 'invalid-producer'
      | 'invalid-result'
      | 'producer-mismatch'
      | 'unknown-event'
      | 'not-completed';
    message: string;
  }>;

export type EventRetirementFailure = Readonly<{
  code: 'retirement-failed';
  point: EventRetirementFaultPoint;
  eventId?: number;
  message: string;
  lifecyclePreserved: boolean;
  retirementRecordPreserved: boolean;
}>;

export type EventRetirementResult =
  | Readonly<{
    status: 'retired';
    eventId: number;
    watermark: number;
    compactedEventIds: readonly number[];
  }>
  | Readonly<{
    status: 'already-retired';
    eventId: number;
    watermark: number;
  }>
  | Readonly<{
    status: 'rejected';
    reason:
      | 'invalid-producer'
      | 'invalid-result'
      | 'producer-mismatch'
      | 'unknown-event'
      | 'not-completed'
      | 'not-acknowledged'
      | 'dispatch-active'
      | 'inbox-busy';
    message: string;
  }>
  | Readonly<{
    status: 'failed';
    failure: EventRetirementFailure;
  }>;

export type EventKernelSnapshot = Readonly<{
  runtimeInstanceId: string;
  nextEventId: number | null;
  lifecycleRecords: readonly EventLifecycleRecord[];
  inboxEvents: readonly PendingEvent[];
  counts: Readonly<{ lifecycleRecords: number; inboxEvents: number }>;
  retirement: Readonly<{
    initialWatermark: number;
    watermark: number;
    lightweightEventIds: readonly number[];
    counts: Readonly<{
      lightweightRecords: number;
      retainedRecords: number;
    }>;
    resourceCapacity: number;
  }>;
  transactionResults: Readonly<{
    bindings: readonly TransactionResultAssociation[];
    capacity: number;
  }>;
  blocked: boolean;
  lastDispatchTick: number | null;
  dispatchBlocked: boolean;
  delivery?: CommandDeliverySnapshot;
  lastFailure?: EventCreationFailure;
  dispatchFailure?: EventDispatchFailure;
  resultDispatchFailure?: EventDispatchFailure;
  retirementFailure?: EventRetirementFailure;
}>;

type CandidateEventId = Readonly<{ eventId: number; previousEventId: number }>;
type PreparedRegistration = Readonly<{
  eventId: number;
  runtimeInstanceId: string;
  status: 'pending';
  eventFingerprint: string;
  producerId?: string;
  transactionResult?: TransactionResultAssociation;
}>;

type StoredTransactionResult = Readonly<{
  sourceId: string;
  producerId: string;
  event: TransactionResultEvent;
  association: TransactionResultAssociation;
}>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EVENT_TYPE_PATTERN = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;
const DEFAULT_HISTORY_CAPACITY = 1024;
const DEFAULT_TRANSACTION_RESULT_CAPACITY = 256;

// Event IDs are an in-memory prototype sequence. A successful creation advances
// it; candidates and rolled-back transactions never consume an ID.
class EventIdSequence {
  #lastCommitted: number;

  constructor(initialNextEventId: number) {
    if (!Number.isSafeInteger(initialNextEventId) || initialNextEventId < 1) {
      throw new RangeError('initialNextEventId must be a positive safe integer.');
    }
    this.#lastCommitted = initialNextEventId - 1;
  }

  prepare(): CandidateEventId | undefined {
    if (this.#lastCommitted >= Number.MAX_SAFE_INTEGER) return undefined;
    return Object.freeze({
      eventId: this.#lastCommitted + 1,
      previousEventId: this.#lastCommitted,
    });
  }

  commit(candidate: CandidateEventId): void {
    if (candidate.eventId !== this.#lastCommitted + 1 ||
        candidate.previousEventId !== this.#lastCommitted) {
      throw new Error('Stale event ID candidate.');
    }
    this.#lastCommitted = candidate.eventId;
  }

  rollback(previousEventId: number): void {
    if (this.#lastCommitted === previousEventId + 1) {
      this.#lastCommitted = previousEventId;
    }
  }

  get nextEventId(): number | null {
    return this.#lastCommitted >= Number.MAX_SAFE_INTEGER
      ? null
      : this.#lastCommitted + 1;
  }
}

type RetirementLedgerResult = Readonly<{
  wasAlreadyRetired: boolean;
  compactedEventIds: readonly number[];
}>;
type RetirementLedgerState = Readonly<{
  watermark: number;
  retiredGapEventIds: readonly number[];
}>;

// This ledger owns only retirement identity: one continuous watermark plus
// lightweight IDs above an unresolved gap.
class EventRetirementLedger {
  readonly #initialWatermark: number;
  readonly #retiredGapEventIds = new Set<number>();
  #watermark: number;

  constructor(initialNextEventId: number) {
    this.#initialWatermark = initialNextEventId - 1;
    this.#watermark = this.#initialWatermark;
  }

  isRetired(eventId: number): boolean {
    return eventId <= this.#watermark || this.#retiredGapEventIds.has(eventId);
  }

  retire(eventId: number): RetirementLedgerResult {
    if (this.isRetired(eventId)) {
      return Object.freeze({
        wasAlreadyRetired: true,
        compactedEventIds: Object.freeze([]),
      });
    }

    this.#retiredGapEventIds.add(eventId);
    const compactedEventIds: number[] = [];
    while (this.#watermark < Number.MAX_SAFE_INTEGER &&
           this.#retiredGapEventIds.has(this.#watermark + 1)) {
      const compacted = this.#watermark + 1;
      this.#retiredGapEventIds.delete(compacted);
      this.#watermark = compacted;
      compactedEventIds.push(compacted);
    }
    return Object.freeze({
      wasAlreadyRetired: false,
      compactedEventIds: Object.freeze(compactedEventIds),
    });
  }

  capture(): RetirementLedgerState {
    return Object.freeze({
      watermark: this.#watermark,
      retiredGapEventIds: Object.freeze([...this.#retiredGapEventIds]),
    });
  }

  restore(state: RetirementLedgerState): void {
    this.#watermark = state.watermark;
    this.#retiredGapEventIds.clear();
    for (const eventId of state.retiredGapEventIds) {
      this.#retiredGapEventIds.add(eventId);
    }
  }

  get initialWatermark(): number {
    return this.#initialWatermark;
  }

  get watermark(): number {
    return this.#watermark;
  }

  get lightweightCount(): number {
    return this.#retiredGapEventIds.size;
  }

  get lightweightEventIds(): readonly number[] {
    return Object.freeze([...this.#retiredGapEventIds].sort((left, right) => left - right));
  }
}

type StoredLifecycleRecord = Readonly<EventLifecycleRecord & {
  eventFingerprint: string;
}>;

// The registry owns event identity and lifecycle records. Callers can only
// observe snapshots; transitions stay inside the coordinator.
class EventLifecycleRegistry {
  readonly #capacity: number;
  readonly #records = new Map<number, StoredLifecycleRecord>();

  constructor(capacity: number) {
    if (!Number.isSafeInteger(capacity) || capacity <= 0) {
      throw new RangeError('historyCapacity must be a positive safe integer.');
    }
    this.#capacity = capacity;
  }

  get hasCapacity(): boolean {
    return this.#records.size < this.#capacity;
  }

  get count(): number {
    return this.#records.size;
  }

  prepare(
    event: PendingEvent,
    producerId?: string,
    transactionResult?: TransactionResultAssociation,
  ): PreparedRegistration {
    if (!this.hasCapacity) {
      throw new Error('The lifecycle history has no capacity for another event.');
    }
    if (this.#records.has(event.eventId)) {
      throw new Error(`Lifecycle record ${event.eventId} already exists.`);
    }
    return Object.freeze({
      eventId: event.eventId,
      runtimeInstanceId: event.runtimeInstanceId,
      status: 'pending' as const,
      eventFingerprint: fingerprintEvent(event),
      ...(producerId === undefined ? {} : { producerId }),
      ...(transactionResult === undefined ? {} : { transactionResult }),
    });
  }

  commit(registration: PreparedRegistration): void {
    if (!this.hasCapacity) {
      throw new Error('The lifecycle history has no capacity for another event.');
    }
    if (this.#records.has(registration.eventId)) {
      throw new Error(`Lifecycle record ${registration.eventId} already exists.`);
    }
    this.#records.set(registration.eventId, Object.freeze({ ...registration }));
  }

  rollback(eventId: number): void {
    this.#records.delete(eventId);
  }

  get(eventId: number): StoredLifecycleRecord | undefined {
    return this.#records.get(eventId);
  }

  statusOf(eventId: number): EventLifecycleState | undefined {
    return this.#records.get(eventId)?.status;
  }

  transition(
    eventId: number,
    expected: EventLifecycleState,
    next: EventLifecycleState,
    details: Readonly<{
      simulationTick: number;
      testCommandReference?: string;
      realCommand?: RealCommandAssociation;
      transactionResultConsumed?: boolean;
    }>,
  ): EventLifecycleRecord {
    const current = this.#records.get(eventId);
    if (!current || current.status !== expected) {
      throw new Error(
        `Event ${eventId} cannot transition from ${expected}; current state is ` +
        `${current?.status ?? 'missing'}.`,
      );
    }
    const updated: StoredLifecycleRecord = Object.freeze({
      eventId: current.eventId,
      runtimeInstanceId: current.runtimeInstanceId,
      status: next,
      ...(current.producerId === undefined ? {} : { producerId: current.producerId }),
      ...(current.resultDelivered === undefined
        ? {}
        : { resultDelivered: current.resultDelivered }),
      ...(current.acknowledged === undefined
        ? {}
        : { acknowledged: current.acknowledged }),
      simulationTick: details.simulationTick,
      ...(details.testCommandReference
        ? { testCommandReference: details.testCommandReference }
        : {}),
      ...(details.realCommand ? { realCommand: details.realCommand } : {}),
      ...(current.transactionResult === undefined
        ? {}
        : { transactionResult: current.transactionResult }),
      ...((details.transactionResultConsumed ?? current.transactionResultConsumed) === undefined
        ? {}
        : {
          transactionResultConsumed:
            details.transactionResultConsumed ?? current.transactionResultConsumed,
        }),
      eventFingerprint: current.eventFingerprint,
    });
    this.#records.set(eventId, updated);
    return publicLifecycleRecord(updated);
  }

  markResultDelivered(eventId: number): void {
    this.#updateFlags(eventId, { resultDelivered: true });
  }

  markAcknowledged(eventId: number): void {
    this.#updateFlags(eventId, { acknowledged: true });
  }

  removeRetired(eventId: number): void {
    const current = this.#records.get(eventId);
    if (!current || current.status !== 'completed') {
      throw new Error(`Event ${eventId} is not a Completed record eligible for retirement.`);
    }
    this.#records.delete(eventId);
  }

  get snapshot(): readonly EventLifecycleRecord[] {
    return Object.freeze([...this.#records.values()].map(publicLifecycleRecord));
  }

  #updateFlags(
    eventId: number,
    flags: Readonly<{ resultDelivered?: true; acknowledged?: true }>,
  ): void {
    const current = this.#records.get(eventId);
    if (!current) {
      throw new Error(`Lifecycle record ${eventId} does not exist.`);
    }
    this.#records.set(eventId, Object.freeze({
      ...current,
      ...flags,
    }));
  }
}

// The inbox owns queue capacity and insertion only. It does not dispatch or
// change lifecycle state.
class EventInbox {
  readonly #capacity: number;
  readonly #queue: PendingEvent[] = [];
  readonly #eventIds = new Set<number>();

  constructor(capacity: number) {
    if (!Number.isSafeInteger(capacity) || capacity <= 0) {
      throw new RangeError('inboxCapacity must be a positive safe integer.');
    }
    this.#capacity = capacity;
  }

  prepare(event: PendingEvent): boolean {
    return this.#queue.length < this.#capacity && !this.#eventIds.has(event.eventId);
  }

  commit(event: PendingEvent): void {
    if (!this.prepare(event)) {
      throw new Error(`Inbox cannot accept event ${event.eventId}.`);
    }
    this.#queue.push(event);
    this.#eventIds.add(event.eventId);
  }

  rollback(eventId: number): void {
    this.#eventIds.delete(eventId);
    for (let index = this.#queue.length - 1; index >= 0; index--) {
      if (this.#queue[index].eventId === eventId) this.#queue.splice(index, 1);
    }
  }

  remove(eventId: number): PendingEvent {
    const index = this.#queue.findIndex(event => event.eventId === eventId);
    if (index < 0) {
      throw new Error(`Inbox event ${eventId} is not pending.`);
    }
    const [event] = this.#queue.splice(index, 1);
    this.#eventIds.delete(eventId);
    return event;
  }

  contains(eventId: number): boolean {
    return this.#eventIds.has(eventId);
  }

  get snapshot(): readonly PendingEvent[] {
    return Object.freeze([...this.#queue]);
  }
}

type NormalizedRequest =
  | Readonly<{ ok: true; type: string; payload: EventPayload }>
  | Readonly<{
    ok: false;
    reason:
      | 'invalid-request'
      | 'unsupported-event-type'
      | 'reserved-event-type'
      | 'invalid-payload';
    message: string;
  }>;

export class RuntimeEventContext {
  readonly runtimeInstanceId: string;
  readonly #eventIds: EventIdSequence;
  readonly #initialNextEventId: number;
  readonly #businessIdentities: RuntimeBusinessIdentityInfrastructure;
  #coordinator: EventCreationCoordinator | undefined;

  constructor(
    uuidProvider: RuntimeUuidProvider,
    options: RuntimeEventContextOptions = {},
  ) {
    const runtimeInstanceId = uuidProvider.generate();
    if (typeof runtimeInstanceId !== 'string' || !UUID_PATTERN.test(runtimeInstanceId)) {
      throw new TypeError('Runtime UUID provider must return a UUID.');
    }
    this.runtimeInstanceId = runtimeInstanceId;
    this.#initialNextEventId = options.initialNextEventId ?? 1;
    this.#eventIds = new EventIdSequence(this.#initialNextEventId);
    this.#businessIdentities = new RuntimeBusinessIdentityInfrastructure(
      runtimeInstanceId,
      {
        initialNextCommandId: options.initialNextCommandId,
        initialNextTransactionId: options.initialNextTransactionId,
      },
    );
  }

  createCoordinator(options: EventCreationOptions): EventCreationCoordinator {
    if (this.#coordinator) {
      throw new Error('A runtime context can only own one event coordinator.');
    }
    this.#coordinator = new EventCreationCoordinator(
      this.runtimeInstanceId,
      this.#eventIds,
      this.#initialNextEventId,
      this.#businessIdentities,
      options,
    );
    return this.#coordinator;
  }
}

// This is the only public event creation entry. Generator, lifecycle registry
// and Inbox retain their own state while the coordinator controls the commit.
export class EventCreationCoordinator implements CommandEventSource, TransactionResultEventPort {
  readonly #runtimeInstanceId: string;
  readonly #eventIds: EventIdSequence;
  readonly #businessIdentities: RuntimeBusinessIdentityInfrastructure;
  readonly #lifecycle: EventLifecycleRegistry;
  readonly #retirement: EventRetirementLedger;
  readonly #inbox: EventInbox;
  readonly #resourceCapacity: number;
  readonly #transactionResultCapacity: number;
  readonly #allowedEventTypes: ReadonlySet<string> | undefined;
  readonly #faultInjector: EventCreationFaultInjector | undefined;
  readonly #dispatchFaultInjector: EventDispatchFaultInjector | undefined;
  readonly #retirementFaultInjector: EventRetirementFaultInjector | undefined;
  readonly #dispatchHandler: EventDispatchHandler | undefined;
  readonly #commandReceiptTestDouble: CommandReceiptTestDouble | undefined;
  readonly #realCommandDeliveryOptions: RealCommandDeliveryOptions | undefined;
  readonly #transactionResultConsumer: TransactionResultConsumer | undefined;
  readonly #producerHandles = new WeakMap<object, string>();
  readonly #transactionResultSources = new WeakMap<
    object,
    {
      sourceId: string;
      runtimeInstanceId: string;
      targetId: string;
      producerId: string;
      producer: EventProducerHandle;
      authority?: TransactionResultAuthority;
    }
  >();
  readonly #transactionResults = new Map<number, StoredTransactionResult>();
  readonly #finalResultObjects = new WeakSet<object>();
  readonly #acknowledgedResultObjects = new WeakSet<object>();
  readonly #finalResults = new Map<number, CompletedEventResult>();
  #blockedFailure: EventCreationFailure | undefined;
  #lastFailure: EventCreationFailure | undefined;
  #lastDispatchTick: number | undefined;
  #dispatchFailure: EventDispatchFailure | undefined;
  #resultDispatchFailure: EventDispatchFailure | undefined;
  #retirementFailure: EventRetirementFailure | undefined;
  #dispatching = false;
  #nextProducerNumber = 1;
  #nextTransactionResultSourceNumber = 1;
  #commandCoordinator: CommandCreationCoordinator | undefined;
  #realCommandDelivery: RealCommandDeliveryCoordinator | undefined;

  constructor(
    runtimeInstanceId: string,
    eventIds: EventIdSequence,
    initialNextEventId: number,
    businessIdentities: RuntimeBusinessIdentityInfrastructure,
    options: EventCreationOptions,
  ) {
    this.#runtimeInstanceId = runtimeInstanceId;
    this.#eventIds = eventIds;
    this.#businessIdentities = businessIdentities;
    this.#resourceCapacity = options.historyCapacity ?? DEFAULT_HISTORY_CAPACITY;
    this.#transactionResultCapacity =
      options.transactionResultCapacity ?? DEFAULT_TRANSACTION_RESULT_CAPACITY;
    if (!Number.isSafeInteger(this.#transactionResultCapacity) ||
        this.#transactionResultCapacity <= 0) {
      throw new RangeError(
        'transactionResultCapacity must be a positive safe integer.',
      );
    }
    this.#lifecycle = new EventLifecycleRegistry(this.#resourceCapacity);
    this.#retirement = new EventRetirementLedger(initialNextEventId);
    this.#inbox = new EventInbox(options.inboxCapacity);
    this.#allowedEventTypes = options.allowedEventTypes
      ? new Set(options.allowedEventTypes)
      : undefined;
    this.#faultInjector = options.faultInjector;
    this.#dispatchFaultInjector = options.dispatchFaultInjector;
    this.#retirementFaultInjector = options.retirementFaultInjector;
    this.#dispatchHandler = options.dispatchHandler;
    this.#commandReceiptTestDouble = options.commandReceiptTestDouble;
    this.#realCommandDeliveryOptions = options.realCommandDelivery;
    this.#transactionResultConsumer = options.transactionResultConsumer;
    if (this.#commandReceiptTestDouble && this.#realCommandDeliveryOptions) {
      throw new Error(
        'Command receipt test-double and real target delivery modes are mutually exclusive.',
      );
    }
    if (this.#realCommandDeliveryOptions && options.dispatchHandler) {
      throw new Error(
        'Real target delivery owns event processing; a separate dispatch handler is not allowed.',
      );
    }
  }

  createCommandCoordinator(
    options: Readonly<{ capacity?: number }> = {},
  ): CommandCreationCoordinator {
    if (this.#commandCoordinator) {
      throw new Error('A runtime context can only own one command coordinator.');
    }
    this.#commandCoordinator = new CommandCreationCoordinator(
      this.#businessIdentities,
      this,
      options,
    );
    if (this.#realCommandDeliveryOptions) {
      this.#realCommandDelivery = new RealCommandDeliveryCoordinator({
        capacity: this.#realCommandDeliveryOptions.capacity,
        faultInjector: this.#realCommandDeliveryOptions.faultInjector,
      });
    }
    return this.#commandCoordinator;
  }

  inspectCommandSource(event: CommandSourceEvent): CommandSourceInspection {
    const inspection = this.probeRedelivery(event as PendingEvent);
    if (inspection.status === 'duplicate') {
      return Object.freeze({
        status: 'registered' as const,
        lifecycle: inspection.lifecycle,
      });
    }
    return Object.freeze({
      status: 'rejected' as const,
      reason: inspection.reason === 'invalid-context'
        ? 'invalid-source-event' as const
        : inspection.reason,
      message: inspection.message,
    });
  }

  createProducer(): EventProducerHandle {
    const producerId =
      `${this.#runtimeInstanceId}:producer:${this.#nextProducerNumber++}`;
    const handle: EventProducerHandle = Object.freeze({ producerId });
    this.#producerHandles.set(handle, producerId);
    return handle;
  }

  createTransactionResultSource(targetId: string): TransactionResultSourceHandle {
    if (typeof targetId !== 'string' || targetId.trim().length === 0) {
      throw new TypeError('Transaction result target ID must be a non-empty string.');
    }
    const producer = this.createProducer();
    const sourceId =
      `${this.#runtimeInstanceId}:transaction-result-source:` +
      `${this.#nextTransactionResultSourceNumber++}`;
    const source: TransactionResultSourceHandle = Object.freeze({
      sourceId,
      runtimeInstanceId: this.#runtimeInstanceId,
      targetId,
      producer,
    });
    this.#transactionResultSources.set(source, {
      sourceId,
      runtimeInstanceId: this.#runtimeInstanceId,
      targetId,
      producerId: producer.producerId,
      producer,
    });
    return source;
  }

  registerTransactionResultAuthority(
    source: TransactionResultSourceHandle,
    authority: TransactionResultAuthority,
  ): TransactionResultAuthorityRegistrationResult {
    const sourceEntry = this.#resolveTransactionResultSource(source);
    if (!sourceEntry) {
      return Object.freeze({
        status: 'rejected' as const,
        reason: 'invalid-source' as const,
        message: 'Transaction result source capability is not owned by this coordinator.',
      });
    }
    if (typeof authority !== 'function') {
      return Object.freeze({
        status: 'rejected' as const,
        reason: 'invalid-authority' as const,
        message: 'Transaction result authority must be a function.',
      });
    }
    if (sourceEntry.authority) {
      return Object.freeze({
        status: 'rejected' as const,
        reason: 'already-registered' as const,
        message: 'Transaction result source already has an authority.',
      });
    }
    sourceEntry.authority = authority;
    return Object.freeze({ status: 'registered' as const });
  }

  requestTransactionResult(
    source: TransactionResultSourceHandle,
    transactionId: number,
  ): TransactionResultCreationResult {
    const sourceEntry = this.#resolveTransactionResultSource(source);
    if (!sourceEntry) {
      return rejectedTransactionResult(
        'invalid-source',
        'Transaction result source capability is not owned by this coordinator.',
      );
    }
    if (!Number.isSafeInteger(transactionId) || transactionId < 1) {
      return rejectedTransactionResult(
        'invalid-request',
        'Transaction ID must be a positive safe integer.',
      );
    }
    if (!sourceEntry.authority) {
      return rejectedTransactionResult(
        'invalid-source',
        'Transaction result source has no registered authority.',
      );
    }
    let authorityRead;
    try {
      authorityRead = sourceEntry.authority(transactionId);
    } catch (error) {
      return rejectedTransactionResult(
        'invalid-request',
        `Transaction result authority failed: ${toMessage(error)}`,
      );
    }
    if (authorityRead === null ||
        typeof authorityRead !== 'object' ||
        (authorityRead.status !== 'found' &&
          authorityRead.status !== 'not-found' &&
          authorityRead.status !== 'not-terminal')) {
      return rejectedTransactionResult(
        'invalid-request',
        'Transaction result authority returned an invalid snapshot.',
      );
    }
    if (authorityRead.status !== 'found') {
      return rejectedTransactionResult(
        authorityRead.status === 'not-terminal' ? 'invalid-terminal' : 'association-mismatch',
        authorityRead.message,
      );
    }
    const normalized = normalizeTransactionResultRequest(authorityRead.request);
    if (!normalized.ok) {
      return rejectedTransactionResult('invalid-request', normalized.message);
    }
    if (normalized.request.runtimeInstanceId !== this.#runtimeInstanceId ||
        normalized.request.runtimeInstanceId !== sourceEntry.runtimeInstanceId) {
      return rejectedTransactionResult(
        'runtime-mismatch',
        'Transaction result request belongs to another runtime instance.',
      );
    }
    if (normalized.request.targetId !== sourceEntry.targetId) {
      return rejectedTransactionResult(
        'target-mismatch',
        'Transaction result request belongs to another target module.',
      );
    }
    if (this.#blockedFailure) {
      return rejectedTransactionResult(
        'blocked',
        'Transaction result creation is blocked after an unconfirmed rollback.',
      );
    }

    const existing = this.#transactionResults.get(normalized.request.transactionId);
    if (existing) {
      if (existing.sourceId !== sourceEntry.sourceId ||
          !transactionResultRequestsEqual(
            normalized.request,
            transactionResultRequestFromAssociation(existing.association),
          )) {
        return rejectedTransactionResult(
          'association-mismatch',
          'Transaction already owns a different final result event.',
        );
      }
      const lifecycle = this.#transactionResultLifecycle(existing.event.eventId);
      if (!lifecycle) {
        return rejectedTransactionResult(
          'blocked',
          'Transaction result binding exists without a known lifecycle state.',
        );
      }
      return existingTransactionResult(existing, lifecycle);
    }
    if (this.#transactionResults.size >= this.#transactionResultCapacity) {
      return rejectedTransactionResult(
        'result-capacity',
        'Transaction result binding capacity is full.',
      );
    }

    let currentPoint: EventCreationFaultPoint = 'validation';
    let candidate: CandidateEventId | undefined;
    let eventIdCommitted = false;
    let registrationCommitted = false;
    let inboxCommitted = false;
    let bindingCommitted = false;
    let stored: StoredTransactionResult | undefined;
    try {
      this.#fault('validation');
      candidate = this.#eventIds.prepare();
      if (!candidate) {
        return rejectedTransactionResult(
          'event-id-exhausted',
          'The runtime Event ID sequence reached its safe integer boundary.',
        );
      }
      currentPoint = 'candidate-prepared';
      this.#fault(currentPoint);

      if (!this.#hasResourceCapacity()) {
        return rejectedTransactionResult(
          'history-capacity',
          'The combined lifecycle and retirement budget is full.',
        );
      }

      const association = transactionResultAssociation(
        candidate.eventId,
        normalized.request,
      );
      const payload = transactionResultPayload(association);
      const eventNormalization = this.#normalize(
        {
          type: TRANSACTION_RESULT_EVENT_TYPE,
          payload,
        },
        true,
      );
      if (!eventNormalization.ok) {
        return rejectedTransactionResult(
          eventNormalization.reason === 'unsupported-event-type'
            ? 'unsupported-event-type'
            : 'invalid-request',
          eventNormalization.message,
        );
      }
      const event = createPendingEvent(
        this.#runtimeInstanceId,
        candidate.eventId,
        eventNormalization.type,
        eventNormalization.payload,
      ) as TransactionResultEvent;
      const registration = this.#lifecycle.prepare(
        event,
        sourceEntry.producerId,
        association,
      );
      currentPoint = 'registration-prepared';
      this.#fault(currentPoint);

      if (!this.#inbox.prepare(event)) {
        return rejectedTransactionResult(
          'inbox-capacity',
          'The coordinator Inbox has no capacity for the result event.',
        );
      }
      currentPoint = 'inbox-prepared';
      this.#fault(currentPoint);

      this.#eventIds.commit(candidate);
      eventIdCommitted = true;
      currentPoint = 'event-id-committed';
      this.#fault(currentPoint);

      this.#lifecycle.commit(registration);
      registrationCommitted = true;
      currentPoint = 'registration-committed';
      this.#fault(currentPoint);

      this.#inbox.commit(event);
      inboxCommitted = true;
      currentPoint = 'inbox-committed';
      this.#fault(currentPoint);

      currentPoint = 'before-result-binding-commit';
      this.#fault(currentPoint);
      stored = Object.freeze({
        sourceId: sourceEntry.sourceId,
        producerId: sourceEntry.producerId,
        event,
        association,
      });
      this.#transactionResults.set(normalized.request.transactionId, stored);
      bindingCommitted = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (bindingCommitted) this.#transactionResults.delete(normalized.request.transactionId);
      try {
        this.#rollback(candidate, {
          eventIdCommitted,
          registrationCommitted,
          inboxCommitted,
        });
        this.#fault('rollback');
      } catch (rollbackError) {
        const failure: EventCreationFailure = Object.freeze({
          code: 'rollback-unconfirmed' as const,
          point: currentPoint,
          message: `${message}; rollback failed: ${toMessage(rollbackError)}`,
          rollback: 'unconfirmed' as const,
        });
        this.#blockedFailure = failure;
        this.#lastFailure = failure;
        return rejectedTransactionResult(
          'blocked',
          'Transaction result creation stopped after rollback could not be confirmed.',
        );
      }
      const failure: EventCreationFailure = Object.freeze({
        code: 'transaction-aborted' as const,
        point: currentPoint,
        message,
        rollback: 'complete' as const,
      });
      this.#lastFailure = failure;
      return rejectedTransactionResult(
        'transaction-aborted',
        `Transaction result creation was rolled back: ${message}`,
      );
    }

    if (!stored) {
      return rejectedTransactionResult(
        'transaction-aborted',
        'Transaction result creation completed without a stored binding.',
      );
    }
    try {
      this.#fault('after-result-commit');
    } catch (error) {
      return Object.freeze({
        status: 'unknown' as const,
        transactionId: stored.association.transactionId,
        resultEventId: stored.association.resultEventId,
        message:
          'Transaction result committed, but its creation response was lost: ' +
          toMessage(error),
      });
    }
    return createdTransactionResult(stored, 'pending');
  }

  queryTransactionResult(
    source: TransactionResultSourceHandle,
    transactionId: number,
  ): TransactionResultQuery {
    const sourceEntry = this.#resolveTransactionResultSource(source);
    if (!sourceEntry) {
      return rejectedTransactionResultQuery(
        'invalid-source',
        'Transaction result source capability is not owned by this coordinator.',
      );
    }
    if (sourceEntry.runtimeInstanceId !== this.#runtimeInstanceId) {
      return rejectedTransactionResultQuery(
        'runtime-mismatch',
        'Transaction result source belongs to another runtime instance.',
      );
    }
    if (!Number.isSafeInteger(transactionId) || transactionId < 1) {
      return rejectedTransactionResultQuery(
        'invalid-input',
        'Transaction ID must be a positive safe integer.',
      );
    }
    const stored = this.#transactionResults.get(transactionId);
    if (!stored) {
      return Object.freeze({
        status: 'not-found' as const,
        transactionId,
      });
    }
    if (stored.sourceId !== sourceEntry.sourceId) {
      return rejectedTransactionResultQuery(
        'target-mismatch',
        'Transaction result belongs to another target source.',
      );
    }
    const lifecycle = this.#transactionResultLifecycle(stored.event.eventId);
    if (!lifecycle) {
      return rejectedTransactionResultQuery(
        'invalid-input',
        'Transaction result binding has no known lifecycle state.',
      );
    }
    return foundTransactionResult(stored, lifecycle);
  }

  readFinalResult(
    producer: EventProducerHandle,
    eventId: number,
  ): FinalEventResultRead {
    const producerId = this.#resolveProducer(producer);
    if (!producerId) return invalidFinalResultProducer();
    if (!Number.isSafeInteger(eventId) || eventId < 1) {
      return rejectedFinalResult('unknown-event', 'Event ID is not registered.');
    }
    const record = this.#lifecycle.get(eventId);
    if (!record) {
      return rejectedFinalResult('unknown-event', 'Event ID is not registered.');
    }
    if (record.producerId !== producerId) {
      return rejectedFinalResult(
        'producer-mismatch',
        'Final result is only available to the event producer.',
      );
    }
    if (record.status !== 'completed' ||
        (!record.testCommandReference &&
          !record.realCommand &&
          !record.transactionResult)) {
      return rejectedFinalResult(
        'not-completed',
        'Final coordination result does not exist yet.',
      );
    }

    let result = this.#finalResults.get(eventId);
    if (!result) {
      result = Object.freeze({
        status: 'coordinated-completed' as const,
        runtimeInstanceId: this.#runtimeInstanceId,
        eventId,
        producerId,
        ...(record.testCommandReference
          ? { testCommandReference: record.testCommandReference }
          : {}),
        ...(record.realCommand ? { realCommand: record.realCommand } : {}),
        ...(record.transactionResult
          ? { transactionResult: record.transactionResult }
          : {}),
      });
      this.#finalResults.set(eventId, result);
      this.#finalResultObjects.add(result);
    }
    this.#lifecycle.markResultDelivered(eventId);
    return Object.freeze({
      status: 'available' as const,
      result,
    });
  }

  acknowledge(
    producer: EventProducerHandle,
    result: CompletedEventResult,
  ): ProducerAcknowledgementResult {
    const verified = this.#verifyResult(producer, result);
    if (!verified.ok) return verified.rejected;
    const record = this.#lifecycle.get(verified.eventId);
    if (!record) {
      if (this.#retirement.isRetired(verified.eventId) &&
          this.#acknowledgedResultObjects.has(result)) {
        return Object.freeze({
          status: 'already-acknowledged' as const,
          eventId: verified.eventId,
          producerId: verified.producerId,
        });
      }
      return rejectedAcknowledgement('unknown-event', 'Event record no longer exists.');
    }
    if (record.status !== 'completed') {
      return rejectedAcknowledgement(
        'not-completed',
        'Only a Completed coordination result can be acknowledged.',
      );
    }
    if (record.acknowledged) {
      return Object.freeze({
        status: 'already-acknowledged' as const,
        eventId: verified.eventId,
        producerId: verified.producerId,
      });
    }
    this.#lifecycle.markAcknowledged(verified.eventId);
    this.#acknowledgedResultObjects.add(result);
    return Object.freeze({
      status: 'acknowledged' as const,
      eventId: verified.eventId,
      producerId: verified.producerId,
    });
  }

  retire(
    producer: EventProducerHandle,
    result: CompletedEventResult,
  ): EventRetirementResult {
    const verified = this.#verifyResult(producer, result);
    if (!verified.ok) return verified.rejectedRetirement;
    if (this.#dispatching) {
      return rejectedRetirement(
        'dispatch-active',
        'Retirement is unavailable while a coordination round is active.',
      );
    }
    if (this.#inbox.contains(verified.eventId)) {
      return rejectedRetirement(
        'inbox-busy',
        'Retirement cannot remove an event still held by the Inbox.',
      );
    }

    const record = this.#lifecycle.get(verified.eventId);
    if (!record) {
      if (this.#retirement.isRetired(verified.eventId)) {
        this.#retirementFailure = undefined;
        return Object.freeze({
          status: 'already-retired' as const,
          eventId: verified.eventId,
          watermark: this.#retirement.watermark,
        });
      }
      return rejectedRetirement('unknown-event', 'Event record no longer exists.');
    }
    if (record.producerId !== verified.producerId) {
      return rejectedRetirement(
        'producer-mismatch',
        'Only the event producer can retire this event.',
      );
    }
    if (record.status !== 'completed') {
      return rejectedRetirement(
        'not-completed',
        'Only a Completed event can be retired.',
      );
    }
    if (!record.resultDelivered) {
      return rejectedRetirement(
        'not-completed',
        'The producer must receive the final result before retirement.',
      );
    }
    if (!record.acknowledged) {
      return rejectedRetirement(
        'not-acknowledged',
        'The producer must explicitly acknowledge the final result first.',
      );
    }

    try {
      this.#retirementFault('before-retirement-ledger-commit');
    } catch (error) {
      return this.#failRetirement(
        'before-retirement-ledger-commit',
        verified.eventId,
        error,
      );
    }

    const retirementState = this.#retirement.capture();
    let ledgerResult: RetirementLedgerResult;
    try {
      ledgerResult = this.#retirement.retire(verified.eventId);
    } catch (error) {
      return this.#failRetirement(
        'before-retirement-ledger-commit',
        verified.eventId,
        error,
      );
    }

    try {
      this.#retirementFault('before-lifecycle-record-remove');
      this.#lifecycle.removeRetired(verified.eventId);
    } catch (error) {
      this.#retirement.restore(retirementState);
      return this.#failRetirement(
        'before-lifecycle-record-remove',
        verified.eventId,
        error,
      );
    }
    this.#finalResults.delete(verified.eventId);

    try {
      this.#retirementFault('after-lifecycle-record-remove');
    } catch (error) {
      return this.#failRetirement(
        'after-lifecycle-record-remove',
        verified.eventId,
        error,
      );
    }
    this.#retirementFailure = undefined;
    return Object.freeze({
      status: 'retired' as const,
      eventId: verified.eventId,
      watermark: this.#retirement.watermark,
      compactedEventIds: ledgerResult.compactedEventIds,
    });
  }

  create(
    request: EventCreationRequest,
    producer?: EventProducerHandle,
  ): EventCreationResult {
    if (this.#blockedFailure) {
      return Object.freeze({
        status: 'blocked' as const,
        reason: 'event-creation-blocked' as const,
        message: 'Event creation is blocked after an unconfirmed rollback.',
        failure: this.#blockedFailure,
      });
    }

    const normalized = this.#normalize(request);
    if (!normalized.ok) {
      return Object.freeze({
        status: 'rejected' as const,
        reason: normalized.reason,
        message: normalized.message,
      });
    }

    const producerId = producer === undefined
      ? undefined
      : this.#resolveProducer(producer);
    if (producer !== undefined && producerId === undefined) {
      return Object.freeze({
        status: 'rejected' as const,
        reason: 'invalid-producer' as const,
        message: 'Event producer handle is not owned by this coordinator.',
      });
    }

    let currentPoint: EventCreationFaultPoint = 'validation';
    let candidate: CandidateEventId | undefined;
    let eventIdCommitted = false;
    let registrationCommitted = false;
    let inboxCommitted = false;
    try {
      this.#fault('validation');

      candidate = this.#eventIds.prepare();
      if (!candidate) {
        return Object.freeze({
          status: 'rejected' as const,
          reason: 'event-id-exhausted' as const,
          message: 'The runtime Event ID sequence reached its safe integer boundary.',
        });
      }
      currentPoint = 'candidate-prepared';
      this.#fault(currentPoint);

      if (!this.#hasResourceCapacity()) {
        return Object.freeze({
          status: 'rejected' as const,
          reason: 'history-capacity' as const,
          message: 'The combined lifecycle and retirement budget is full.',
        });
      }

      const event = createPendingEvent(
        this.#runtimeInstanceId,
        candidate.eventId,
        normalized.type,
        normalized.payload,
      );
      const registration = this.#lifecycle.prepare(event, producerId);
      currentPoint = 'registration-prepared';
      this.#fault(currentPoint);

      if (!this.#inbox.prepare(event)) {
        return Object.freeze({
          status: 'rejected' as const,
          reason: 'inbox-capacity' as const,
          message: 'The coordinator Inbox has no capacity for another Pending event.',
        });
      }
      currentPoint = 'inbox-prepared';
      this.#fault(currentPoint);

      this.#eventIds.commit(candidate);
      eventIdCommitted = true;
      currentPoint = 'event-id-committed';
      this.#fault(currentPoint);

      this.#lifecycle.commit(registration);
      registrationCommitted = true;
      currentPoint = 'registration-committed';
      this.#fault(currentPoint);

      this.#inbox.commit(event);
      inboxCommitted = true;
      currentPoint = 'inbox-committed';
      this.#fault(currentPoint);

      return Object.freeze({ status: 'created' as const, event });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      try {
        this.#rollback(candidate, {
          eventIdCommitted,
          registrationCommitted,
          inboxCommitted,
        });
        this.#fault('rollback');
      } catch (rollbackError) {
        const rollbackMessage = rollbackError instanceof Error
          ? rollbackError.message
          : String(rollbackError);
        const failure: EventCreationFailure = Object.freeze({
          code: 'rollback-unconfirmed' as const,
          point: currentPoint,
          message: `${message}; rollback failed: ${rollbackMessage}`,
          rollback: 'unconfirmed' as const,
        });
        this.#blockedFailure = failure;
        this.#lastFailure = failure;
        return Object.freeze({
          status: 'blocked' as const,
          reason: 'event-creation-blocked' as const,
          message: 'Event creation stopped after rollback could not be confirmed.',
          failure,
        });
      }

      const failure: EventCreationFailure = Object.freeze({
        code: 'transaction-aborted' as const,
        point: currentPoint,
        message,
        rollback: 'complete' as const,
      });
      this.#lastFailure = failure;
      return Object.freeze({
        status: 'rejected' as const,
        reason: 'transaction-aborted' as const,
        message: 'Event creation was rejected and the transaction was rolled back.',
        failure,
      });
    }
  }

  dispatch(context: EventDispatchContext): EventDispatchResult {
    const normalized = normalizeDispatchContext(context);
    if (!normalized.ok) {
      return rejectDispatch('invalid-phase', normalized.message);
    }
    if (normalized.runtimeInstanceId !== this.#runtimeInstanceId) {
      return rejectDispatch(
        'runtime-mismatch',
        'Dispatch context belongs to another runtime instance.',
      );
    }
    if (this.#dispatching) {
      return rejectDispatch(
        'recursive-dispatch',
        'Event dispatch cannot be re-entered from a running handler.',
      );
    }

    if (this.#dispatchFailure) {
      return blockedDispatch(this.#dispatchFailure);
    }
    if (this.#blockedFailure) {
      return this.#blockDispatch(
        'dispatch-blocked',
        'Event dispatch is blocked after an unconfirmed creation rollback.',
        undefined,
        [],
        [],
      );
    }
    if (this.#lastDispatchTick !== undefined &&
        normalized.simulationTick <= this.#lastDispatchTick) {
      return rejectDispatch(
        'phase-order',
        'Coordination dispatch requires a strictly increasing SimulationTick.',
      );
    }

    const realDelivery = this.#realCommandDelivery;
    const realDeliveryOptions = this.#realCommandDeliveryOptions;
    if (realDeliveryOptions) {
      if (!realDelivery || !this.#commandCoordinator) {
        return rejectDispatch(
          'dispatch-not-configured',
          'Real command delivery requires a command coordinator.',
        );
      }
      const retryError = this.#validateRetryRequests(
        normalized.retryDeliveryEventIds,
        realDelivery,
      );
      if (retryError) return rejectDispatch('retry-not-allowed', retryError);

      this.#lastDispatchTick = normalized.simulationTick;
      this.#dispatching = true;
      try {
        return this.#dispatchReal(
          normalized,
          realDeliveryOptions,
          realDelivery,
        );
      } finally {
        this.#dispatching = false;
      }
    }

    const handler = this.#dispatchHandler;
    const receiptTestDouble = this.#commandReceiptTestDouble;
    if (!handler && !receiptTestDouble && this.#transactionResultConsumer) {
      if (normalized.retryDeliveryEventIds.length > 0) {
        return rejectDispatch(
          'retry-not-allowed',
          'Explicit delivery retry requires real target delivery mode.',
        );
      }
      this.#lastDispatchTick = normalized.simulationTick;
      this.#dispatching = true;
      try {
        return this.#dispatchTransactionResultsOnly(normalized);
      } finally {
        this.#dispatching = false;
      }
    }
    if (!handler || !receiptTestDouble) {
      return rejectDispatch(
        'dispatch-not-configured',
        'A transaction result consumer or a command dispatch mode is required.',
      );
    }
    if (normalized.retryDeliveryEventIds &&
        normalized.retryDeliveryEventIds.length > 0) {
      return rejectDispatch(
        'retry-not-allowed',
        'Explicit delivery retry requires real target delivery mode.',
      );
    }

    this.#lastDispatchTick = normalized.simulationTick;
    this.#dispatching = true;
    try {
      return this.#dispatchWithTestDouble(
        normalized,
        handler,
        receiptTestDouble,
      );
    } finally {
      this.#dispatching = false;
    }
  }

  #dispatchTransactionResultsOnly(
    normalized: NormalizedDispatchContext & { ok: true },
  ): EventDispatchResult {
    const processedEventIds: number[] = [];
    const completedEventIds: number[] = [];
    const batchEvents = this.#inbox.snapshot;
    for (const event of batchEvents) {
      const current = this.#lifecycle.get(event.eventId);
      if (!current?.transactionResult) {
        return this.#blockDispatch(
          'dispatch-blocked',
          `Event ${event.eventId} requires a command dispatch mode.`,
          event.eventId,
          processedEventIds,
          completedEventIds,
        );
      }
      const failure = this.#dispatchTransactionResultEvent(
        event,
        current,
        normalized,
        processedEventIds,
        completedEventIds,
      );
      if (failure) return failure;
    }
    this.#resultDispatchFailure = undefined;
    return Object.freeze({
      status: 'completed' as const,
      simulationTick: normalized.simulationTick,
      progress: createDispatchProgress(
        processedEventIds,
        completedEventIds,
        this.#inbox.snapshot.map(event => event.eventId),
      ),
    });
  }

  #dispatchTransactionResultEvent(
    event: PendingEvent,
    current: StoredLifecycleRecord,
    normalized: NormalizedDispatchContext & { ok: true },
    processedEventIds: number[],
    completedEventIds: number[],
  ): Extract<EventDispatchResult, { status: 'blocked' }> | undefined {
    const association = current.transactionResult;
    const consumer = this.#transactionResultConsumer;
    if (!association || !consumer) {
      return this.#blockTransactionResultDispatch(
        'result-consumer-not-configured',
        `Transaction result event ${event.eventId} has no result notification consumer.`,
        event.eventId,
        processedEventIds,
        completedEventIds,
      );
    }
    if (!transactionResultEventMatches(event, association)) {
      return this.#blockTransactionResultDispatch(
        'result-lifecycle-invalid',
        `Transaction result event ${event.eventId} does not match its association.`,
        event.eventId,
        processedEventIds,
        completedEventIds,
      );
    }

    try {
      this.#dispatchFault('before-processing-transition');
      this.#lifecycle.transition(
        event.eventId,
        'pending',
        'processing',
        { simulationTick: normalized.simulationTick },
      );
      this.#inbox.remove(event.eventId);
    } catch (error) {
      return this.#blockTransactionResultDispatch(
        'result-lifecycle-invalid',
        `Transaction result Pending to Processing transition failed: ${toMessage(error)}`,
        event.eventId,
        processedEventIds,
        completedEventIds,
      );
    }
    processedEventIds.push(event.eventId);

    let consumption;
    try {
      consumption = consumer(Object.freeze({
        runtimeInstanceId: this.#runtimeInstanceId,
        simulationTick: normalized.simulationTick,
        phase: normalized.phase,
        event: event as TransactionResultEvent,
        association,
      }));
    } catch (error) {
      const requeueError = this.#requeueTransactionResultEvent(
        event,
        normalized.simulationTick,
      );
      if (requeueError) {
        return this.#blockDispatch(
          'result-lifecycle-invalid',
          requeueError,
          event.eventId,
          processedEventIds,
          completedEventIds,
        );
      }
      return this.#blockTransactionResultDispatch(
        'result-consumer-threw',
        `Transaction result consumer ${event.eventId} threw: ${toMessage(error)}`,
        event.eventId,
        processedEventIds,
        completedEventIds,
      );
    }
    if (consumption === null ||
        typeof consumption !== 'object' ||
        (consumption.status !== 'consumed' &&
          consumption.status !== 'already-consumed' &&
          consumption.status !== 'failed')) {
      const requeueError = this.#requeueTransactionResultEvent(
        event,
        normalized.simulationTick,
      );
      if (requeueError) {
        return this.#blockDispatch(
          'result-lifecycle-invalid',
          requeueError,
          event.eventId,
          processedEventIds,
          completedEventIds,
        );
      }
      return this.#blockTransactionResultDispatch(
        'result-consumer-invalid',
        `Transaction result consumer ${event.eventId} returned an invalid result.`,
        event.eventId,
        processedEventIds,
        completedEventIds,
      );
    }
    if (consumption.status === 'failed') {
      const requeueError = this.#requeueTransactionResultEvent(
        event,
        normalized.simulationTick,
      );
      if (requeueError) {
        return this.#blockDispatch(
          'result-lifecycle-invalid',
          requeueError,
          event.eventId,
          processedEventIds,
          completedEventIds,
        );
      }
      return this.#blockTransactionResultDispatch(
        'result-consumer-threw',
        `Transaction result consumer ${event.eventId} failed: ${
          typeof consumption.message === 'string'
            ? consumption.message
            : 'no reason supplied'
        }`,
        event.eventId,
        processedEventIds,
        completedEventIds,
      );
    }

    try {
      this.#dispatchFault('before-completion-transition');
      this.#lifecycle.transition(
        event.eventId,
        'processing',
        'completed',
        {
          simulationTick: normalized.simulationTick,
          transactionResultConsumed: true,
        },
      );
    } catch (error) {
      const requeueError = this.#requeueTransactionResultEvent(
        event,
        normalized.simulationTick,
      );
      if (requeueError) {
        return this.#blockDispatch(
          'result-lifecycle-invalid',
          requeueError,
          event.eventId,
          processedEventIds,
          completedEventIds,
        );
      }
      return this.#blockTransactionResultDispatch(
        'result-lifecycle-invalid',
        `Transaction result Processing to Completed transition failed: ${toMessage(error)}`,
        event.eventId,
        processedEventIds,
        completedEventIds,
      );
    }
    completedEventIds.push(event.eventId);
    this.#resultDispatchFailure = undefined;
    return undefined;
  }

  #requeueTransactionResultEvent(
    event: PendingEvent,
    simulationTick: number,
  ): string | undefined {
    try {
      this.#lifecycle.transition(
        event.eventId,
        'processing',
        'pending',
        { simulationTick },
      );
      this.#inbox.commit(event);
      return undefined;
    } catch (error) {
      return `Transaction result event ${event.eventId} could not be restored to Pending: ` +
        toMessage(error);
    }
  }

  #dispatchWithTestDouble(
    normalized: NormalizedDispatchContext & { ok: true },
    handler: EventDispatchHandler,
    receiptTestDouble: CommandReceiptTestDouble,
  ): EventDispatchResult {
    const processedEventIds: number[] = [];
    const completedEventIds: number[] = [];
    const handlerContext = this.#handlerContext(normalized);

    // Snapshot once. Events created by handlers enter the Inbox but cannot
    // mutate the set selected for this fixed coordination round.
    const batchEvents = this.#inbox.snapshot;
    for (const event of batchEvents) {
      const current = this.#lifecycle.get(event.eventId);
      let fingerprintMatches = false;
      try {
        fingerprintMatches = fingerprintEvent(event) === current?.eventFingerprint;
      } catch {
        fingerprintMatches = false;
      }
      if (!current ||
          current.runtimeInstanceId !== this.#runtimeInstanceId ||
          current.status !== 'pending' ||
          !fingerprintMatches) {
        return this.#blockDispatch(
          'lifecycle-invalid',
          `Event ${event.eventId} is not eligible for Pending to Processing dispatch.`,
          event.eventId,
          processedEventIds,
          completedEventIds,
        );
      }
      if (event.type === TRANSACTION_RESULT_EVENT_TYPE ||
          current.transactionResult) {
        if (!current.transactionResult) {
          return this.#blockTransactionResultDispatch(
            'result-lifecycle-invalid',
            `Transaction result event ${event.eventId} has no authoritative association.`,
            event.eventId,
            processedEventIds,
            completedEventIds,
          );
        }
        const resultFailure = this.#dispatchTransactionResultEvent(
          event,
          current,
          normalized,
          processedEventIds,
          completedEventIds,
        );
        if (resultFailure) return resultFailure;
        continue;
      }
      try {
        this.#dispatchFault('before-processing-transition');
        this.#lifecycle.transition(
          event.eventId,
          'pending',
          'processing',
          { simulationTick: normalized.simulationTick },
        );
        this.#inbox.remove(event.eventId);
      } catch (error) {
        return this.#blockDispatch(
          'lifecycle-invalid',
          `Pending to Processing transition failed: ${toMessage(error)}`,
          event.eventId,
          processedEventIds,
          completedEventIds,
        );
      }

      processedEventIds.push(event.eventId);
      try {
        handler(event, handlerContext);
      } catch (error) {
        return this.#blockDispatch(
          'handler-threw',
          `Event handler ${event.eventId} threw: ${toMessage(error)}`,
          event.eventId,
          processedEventIds,
          completedEventIds,
        );
      }

      let normalizedReceipt: NormalizedCommandReceipt;
      try {
        normalizedReceipt = normalizeCommandReceipt(
          receiptTestDouble(event, handlerContext),
          event.eventId,
        );
      } catch (error) {
        return this.#blockDispatch(
          'invalid-receipt',
          `Command receipt test double ${event.eventId} failed: ${toMessage(error)}`,
          event.eventId,
          processedEventIds,
          completedEventIds,
        );
      }
      if (!normalizedReceipt.ok) {
        return this.#blockDispatch(
          normalizedReceipt.failureCode,
          `Event ${event.eventId}: ${normalizedReceipt.message}`,
          event.eventId,
          processedEventIds,
          completedEventIds,
        );
      }
      try {
        this.#dispatchFault('before-completion-transition');
        this.#lifecycle.transition(
          event.eventId,
          'processing',
          'completed',
          {
            simulationTick: normalized.simulationTick,
            testCommandReference: normalizedReceipt.testCommandReference,
          },
        );
      } catch (error) {
        return this.#blockDispatch(
          'lifecycle-invalid',
          `Processing to Completed transition failed: ${toMessage(error)}`,
          event.eventId,
          processedEventIds,
          completedEventIds,
        );
      }
      completedEventIds.push(event.eventId);
    }

    return Object.freeze({
      status: 'completed' as const,
      simulationTick: normalized.simulationTick,
      progress: createDispatchProgress(
        processedEventIds,
        completedEventIds,
        this.#inbox.snapshot.map(event => event.eventId),
      ),
    });
  }

  #dispatchReal(
    normalized: NormalizedDispatchContext & { ok: true },
    options: RealCommandDeliveryOptions,
    delivery: RealCommandDeliveryCoordinator,
  ): EventDispatchResult {
    const processedEventIds: number[] = [];
    const completedEventIds: number[] = [];
    const reconciledEventIds = delivery.snapshot.records
      .filter(record => record.status === 'unknown')
      .map(record => record.eventId);
    const retriedEventIds = [...normalized.retryDeliveryEventIds];
    const handlerContext = this.#handlerContext(normalized);

    // Reconciliation uses the original target and Command ID only. It never
    // invokes the event handler or calls target.accept().
    delivery.reconcileUnknown();

    for (const eventId of normalized.retryDeliveryEventIds) {
      delivery.retry(eventId);
    }

    // Fixed batch semantics match the test-double path: follow-up events
    // created by a real handler remain Pending until the next coordination.
    const batchEvents = this.#inbox.snapshot;
    for (const event of batchEvents) {
      const current = this.#lifecycle.get(event.eventId);
      let fingerprintMatches = false;
      try {
        fingerprintMatches = fingerprintEvent(event) === current?.eventFingerprint;
      } catch {
        fingerprintMatches = false;
      }
      if (!current ||
          current.runtimeInstanceId !== this.#runtimeInstanceId ||
          current.status !== 'pending' ||
          !fingerprintMatches) {
        return this.#blockDispatch(
          'lifecycle-invalid',
          `Event ${event.eventId} is not eligible for Pending to Processing dispatch.`,
          event.eventId,
          processedEventIds,
          completedEventIds,
        );
      }
      if (event.type === TRANSACTION_RESULT_EVENT_TYPE ||
          current.transactionResult) {
        if (!current.transactionResult) {
          return this.#blockTransactionResultDispatch(
            'result-lifecycle-invalid',
            `Transaction result event ${event.eventId} has no authoritative association.`,
            event.eventId,
            processedEventIds,
            completedEventIds,
          );
        }
        const resultFailure = this.#dispatchTransactionResultEvent(
          event,
          current,
          normalized,
          processedEventIds,
          completedEventIds,
        );
        if (resultFailure) return resultFailure;
        continue;
      }

      try {
        this.#dispatchFault('before-processing-transition');
        this.#lifecycle.transition(
          event.eventId,
          'pending',
          'processing',
          { simulationTick: normalized.simulationTick },
        );
        this.#inbox.remove(event.eventId);
      } catch (error) {
        return this.#blockDispatch(
          'lifecycle-invalid',
          `Pending to Processing transition failed: ${toMessage(error)}`,
          event.eventId,
          processedEventIds,
          completedEventIds,
        );
      }
      processedEventIds.push(event.eventId);

      if (delivery.get(event.eventId)) continue;
      this.#startRealDelivery(event, handlerContext, options, delivery);
    }

    const completionFailure = this.#completeAcceptedRealDeliveries(
      normalized,
      delivery,
      completedEventIds,
    );
    if (completionFailure) return completionFailure;

    return Object.freeze({
      status: 'completed' as const,
      simulationTick: normalized.simulationTick,
      progress: createDispatchProgress(
        processedEventIds,
        completedEventIds,
        this.#inbox.snapshot.map(event => event.eventId),
        createRealDeliveryProgress(
          delivery.snapshot,
          reconciledEventIds,
          retriedEventIds,
        ),
      ),
    });
  }

  #startRealDelivery(
    event: PendingEvent,
    handlerContext: EventDispatchHandlerContext,
    options: RealCommandDeliveryOptions,
    delivery: RealCommandDeliveryCoordinator,
  ): void {
    let request: CommandCreationRequest;
    try {
      request = options.handler(event, handlerContext);
    } catch (error) {
      delivery.recordPreparationFailure(
        event as DeliverySourceEvent,
        'handler-threw',
        `Real command handler threw: ${toMessage(error)}`,
      );
      return;
    }

    const requestError = validateCommandRequestForEvent(request, event);
    if (requestError) {
      delivery.recordPreparationFailure(
        event as DeliverySourceEvent,
        'invalid-command-request',
        requestError,
      );
      return;
    }

    const created = (this.#commandCoordinator as CommandCreationCoordinator)
      .createCommand(request);
    if (created.status !== 'created') {
      delivery.recordPreparationFailure(
        event as DeliverySourceEvent,
        `command-${created.reason}`,
        created.message,
      );
      return;
    }

    const target = options.targetFor(created.command.targetId);
    if (!target) {
      delivery.recordCommandRejection(
        event as DeliverySourceEvent,
        created.command,
        'target-unavailable',
        `No target transaction module is registered for ${created.command.targetId}.`,
      );
      return;
    }
    delivery.start(event as DeliverySourceEvent, created.command, target);
  }

  #completeAcceptedRealDeliveries(
    normalized: NormalizedDispatchContext & { ok: true },
    delivery: RealCommandDeliveryCoordinator,
    completedEventIds: number[],
  ): Extract<EventDispatchResult, { status: 'blocked' }> | undefined {
    for (const record of delivery.snapshot.records) {
      if (record.status !== 'accepted' ||
          record.commandId === undefined ||
          record.targetId === undefined ||
          record.transactionId === undefined) {
        continue;
      }
      const lifecycle = this.#lifecycle.get(record.eventId);
      if (!lifecycle || lifecycle.status !== 'processing') continue;
      const realCommand: RealCommandAssociation = Object.freeze({
        commandId: record.commandId,
        targetId: record.targetId,
        transactionId: record.transactionId,
      });
      try {
        this.#dispatchFault('before-completion-transition');
        this.#lifecycle.transition(
          record.eventId,
          'processing',
          'completed',
          {
            simulationTick: normalized.simulationTick,
            realCommand,
          },
        );
      } catch (error) {
        return this.#blockDispatch(
          'lifecycle-invalid',
          `Processing to Completed transition failed: ${toMessage(error)}`,
          record.eventId,
          [],
          completedEventIds,
        );
      }
      completedEventIds.push(record.eventId);
    }
    return undefined;
  }

  #handlerContext(
    normalized: NormalizedDispatchContext & { ok: true },
  ): EventDispatchHandlerContext {
    return Object.freeze({
      runtimeInstanceId: this.#runtimeInstanceId,
      simulationTick: normalized.simulationTick,
      phase: normalized.phase,
      create: (
        request: EventCreationRequest,
        producer?: EventProducerHandle,
      ) => this.create(request, producer),
      statusOf: (eventId: number) => this.#lifecycle.statusOf(eventId),
    });
  }

  #validateRetryRequests(
    eventIds: readonly number[],
    delivery: RealCommandDeliveryCoordinator,
  ): string | undefined {
    for (const eventId of eventIds) {
      const record = delivery.get(eventId);
      if (!record) return `Delivery Event ID ${eventId} does not exist.`;
      if (record.status !== 'retryable') {
        return `Delivery Event ID ${eventId} is ${record.status}, not Retryable.`;
      }
    }
    return undefined;
  }

  probeRedelivery(event: PendingEvent): EventRedeliveryProbeResult {
    let eventId: unknown;
    let runtimeInstanceId: unknown;
    let status: unknown;
    try {
      if (!isPlainRecord(event)) return invalidRedeliveryContext();
      eventId = event.eventId;
      runtimeInstanceId = event.runtimeInstanceId;
      status = event.status;
    } catch {
      return invalidRedeliveryContext();
    }
    if (!Number.isSafeInteger(eventId) || (eventId as number) < 1 ||
        typeof runtimeInstanceId !== 'string' || status !== 'pending') {
      return invalidRedeliveryContext();
    }
    if (runtimeInstanceId !== this.#runtimeInstanceId) {
      return Object.freeze({
        status: 'rejected' as const,
        reason: 'runtime-mismatch' as const,
        message: 'Redelivered event belongs to another runtime instance.',
      });
    }
    if (this.#retirement.isRetired(eventId as number)) {
      return Object.freeze({
        status: 'rejected' as const,
        reason: 'retired-event' as const,
        message: 'Event ID has already been safely retired and cannot execute again.',
      });
    }

    const registered = this.#lifecycle.get(eventId as number);
    if (!registered) {
      return Object.freeze({
        status: 'rejected' as const,
        reason: 'unknown-event' as const,
        message: 'Redelivered Event ID is not registered in this runtime.',
      });
    }
    let fingerprintMatches = false;
    try {
      fingerprintMatches = fingerprintEvent(event) === registered.eventFingerprint;
    } catch {
      fingerprintMatches = false;
    }
    if (!fingerprintMatches) {
      return Object.freeze({
        status: 'rejected' as const,
        reason: 'integrity-mismatch' as const,
        message: 'Redelivered event type or payload differs from the registered event.',
      });
    }
    return Object.freeze({
      status: 'duplicate' as const,
      eventId: eventId as number,
      lifecycle: registered.status,
    });
  }

  get snapshot(): EventKernelSnapshot {
    const lifecycleRecords = this.#lifecycle.snapshot;
    const inboxEvents = this.#inbox.snapshot;
    return Object.freeze({
      runtimeInstanceId: this.#runtimeInstanceId,
      nextEventId: this.#eventIds.nextEventId,
      lifecycleRecords,
      inboxEvents,
      counts: Object.freeze({
        lifecycleRecords: lifecycleRecords.length,
        inboxEvents: inboxEvents.length,
      }),
      retirement: Object.freeze({
        initialWatermark: this.#retirement.initialWatermark,
        watermark: this.#retirement.watermark,
        lightweightEventIds: this.#retirement.lightweightEventIds,
        counts: Object.freeze({
          lightweightRecords: this.#retirement.lightweightCount,
          retainedRecords:
            lifecycleRecords.length + this.#retirement.lightweightCount,
        }),
        resourceCapacity: this.#resourceCapacity,
      }),
      transactionResults: Object.freeze({
        bindings: Object.freeze(
          [...this.#transactionResults.values()]
            .map(result => result.association),
        ),
        capacity: this.#transactionResultCapacity,
      }),
      blocked: this.#blockedFailure !== undefined,
      lastDispatchTick: this.#lastDispatchTick ?? null,
      dispatchBlocked: this.#dispatchFailure !== undefined,
      ...(this.#realCommandDelivery
        ? { delivery: this.#realCommandDelivery.snapshot }
        : {}),
      ...(this.#lastFailure ? { lastFailure: this.#lastFailure } : {}),
      ...(this.#dispatchFailure ? { dispatchFailure: this.#dispatchFailure } : {}),
      ...(this.#resultDispatchFailure
        ? { resultDispatchFailure: this.#resultDispatchFailure }
        : {}),
      ...(this.#retirementFailure
        ? { retirementFailure: this.#retirementFailure }
        : {}),
    });
  }

  #hasResourceCapacity(): boolean {
    return this.#lifecycle.count + this.#retirement.lightweightCount <
      this.#resourceCapacity;
  }

  #resolveProducer(producer: EventProducerHandle): string | undefined {
    if (producer === null ||
        (typeof producer !== 'object' && typeof producer !== 'function')) {
      return undefined;
    }
    return this.#producerHandles.get(producer as object);
  }

  #resolveTransactionResultSource(
    source: TransactionResultSourceHandle,
  ):
    | {
      sourceId: string;
      runtimeInstanceId: string;
      targetId: string;
      producerId: string;
      producer: EventProducerHandle;
      authority?: TransactionResultAuthority;
    }
    | undefined {
    if (source === null ||
        (typeof source !== 'object' && typeof source !== 'function')) {
      return undefined;
    }
    return this.#transactionResultSources.get(source as object);
  }

  #transactionResultLifecycle(eventId: number): TransactionResultLifecycle | undefined {
    const lifecycle = this.#lifecycle.get(eventId)?.status;
    if (lifecycle) return lifecycle;
    return this.#retirement.isRetired(eventId) ? 'retired' : undefined;
  }

  #verifyResult(
    producer: EventProducerHandle,
    result: CompletedEventResult,
  ): VerifiedCompletedResult {
    const producerId = this.#resolveProducer(producer);
    if (!producerId) {
      const message = 'Producer handle is not owned by this coordinator.';
      return {
        ok: false,
        rejected: rejectedAcknowledgement('invalid-producer', message),
        rejectedRetirement: rejectedRetirement('invalid-producer', message),
      };
    }
    if (result === null || typeof result !== 'object' ||
        !this.#finalResultObjects.has(result)) {
      const message = 'Completed result capability is not owned by this coordinator.';
      return {
        ok: false,
        rejected: rejectedAcknowledgement('invalid-result', message),
        rejectedRetirement: rejectedRetirement('invalid-result', message),
      };
    }
    if (result.runtimeInstanceId !== this.#runtimeInstanceId ||
        !Number.isSafeInteger(result.eventId) ||
        result.eventId < 1) {
      const message = 'Completed result capability has an invalid runtime or Event ID.';
      return {
        ok: false,
        rejected: rejectedAcknowledgement('invalid-result', message),
        rejectedRetirement: rejectedRetirement('invalid-result', message),
      };
    }
    if (result.producerId !== producerId) {
      const message = 'Completed result belongs to another producer.';
      return {
        ok: false,
        rejected: rejectedAcknowledgement('producer-mismatch', message),
        rejectedRetirement: rejectedRetirement('producer-mismatch', message),
      };
    }
    return {
      ok: true,
      producerId,
      eventId: result.eventId,
    };
  }

  #failRetirement(
    point: EventRetirementFaultPoint,
    eventId: number,
    error: unknown,
  ): Readonly<{ status: 'failed'; failure: EventRetirementFailure }> {
    const failure: EventRetirementFailure = Object.freeze({
      code: 'retirement-failed' as const,
      point,
      eventId,
      message: toMessage(error),
      lifecyclePreserved: this.#lifecycle.get(eventId) !== undefined,
      retirementRecordPreserved: this.#retirement.isRetired(eventId),
    });
    this.#retirementFailure = failure;
    return Object.freeze({
      status: 'failed' as const,
      failure,
    });
  }

  #blockDispatch(
    code: EventDispatchFailure['code'],
    message: string,
    eventId: number | undefined,
    processedEventIds: readonly number[],
    completedEventIds: readonly number[],
  ): Readonly<{ status: 'blocked'; failure: EventDispatchFailure }> {
    const failure: EventDispatchFailure = Object.freeze({
      code,
      simulationTick: this.#lastDispatchTick as number,
      ...(eventId === undefined ? {} : { eventId }),
      message,
      progress: createDispatchProgress(
        processedEventIds,
        completedEventIds,
        this.#inbox.snapshot.map(event => event.eventId),
      ),
    });
    this.#dispatchFailure = failure;
    return blockedDispatch(failure);
  }

  #blockTransactionResultDispatch(
    code: EventDispatchFailure['code'],
    message: string,
    eventId: number,
    processedEventIds: readonly number[],
    completedEventIds: readonly number[],
  ): Readonly<{ status: 'blocked'; failure: EventDispatchFailure }> {
    const failure: EventDispatchFailure = Object.freeze({
      code,
      simulationTick: this.#lastDispatchTick as number,
      eventId,
      message,
      progress: createDispatchProgress(
        processedEventIds,
        completedEventIds,
        this.#inbox.snapshot.map(event => event.eventId),
      ),
    });
    this.#resultDispatchFailure = failure;
    return blockedDispatch(failure);
  }

  #normalize(
    request: EventCreationRequest,
    allowReservedTransactionResult = false,
  ): NormalizedRequest {
    let type: unknown;
    let payload: unknown;
    try {
      if (!isPlainRecord(request)) {
        return invalidRequest('Event request must be a plain object.');
      }
      type = request.type;
      payload = request.payload;
    } catch {
      return invalidRequest('Event request fields could not be read.');
    }

    if (typeof type !== 'string' || type.length === 0) {
      return invalidRequest('Event type must be a non-empty string.');
    }
    if (!EVENT_TYPE_PATTERN.test(type) || type.length > 96) {
      return invalidRequest('Event type uses an unsupported format.');
    }
    if (!allowReservedTransactionResult &&
        type === TRANSACTION_RESULT_EVENT_TYPE) {
      return Object.freeze({
        ok: false as const,
        reason: 'reserved-event-type' as const,
        message:
          'Transaction result events can only be created through the authoritative result path.',
      });
    }
    if (this.#allowedEventTypes && !this.#allowedEventTypes.has(type)) {
      return Object.freeze({
        ok: false as const,
        reason: 'unsupported-event-type' as const,
        message: `Event type "${type}" is not enabled for this coordinator.`,
      });
    }

    let validPayload = false;
    try {
      validPayload = isPlainRecord(payload) && isJsonValue(payload, new Set<object>());
    } catch {
      validPayload = false;
    }
    if (!validPayload) {
      return Object.freeze({
        ok: false as const,
        reason: 'invalid-payload' as const,
        message: 'Event payload must be a JSON-compatible object.',
      });
    }

    try {
      const cloned = JSON.parse(JSON.stringify(payload)) as unknown;
      if (!isPlainRecord(cloned)) throw new Error('Payload clone is not an object.');
      return Object.freeze({
        ok: true as const,
        type,
        payload: deepFreeze(cloned) as EventPayload,
      });
    } catch {
      return Object.freeze({
        ok: false as const,
        reason: 'invalid-payload' as const,
        message: 'Event payload could not be copied safely.',
      });
    }
  }

  #rollback(
    candidate: CandidateEventId | undefined,
    committed: Readonly<{
      eventIdCommitted: boolean;
      registrationCommitted: boolean;
      inboxCommitted: boolean;
    }>,
  ): void {
    if (!candidate) return;
    const failures: string[] = [];
    if (committed.inboxCommitted) {
      try {
        this.#inbox.rollback(candidate.eventId);
      } catch (error) {
        failures.push(toMessage(error));
      }
    }
    if (committed.registrationCommitted) {
      try {
        this.#lifecycle.rollback(candidate.eventId);
      } catch (error) {
        failures.push(toMessage(error));
      }
    }
    if (committed.eventIdCommitted) {
      try {
        this.#eventIds.rollback(candidate.previousEventId);
      } catch (error) {
        failures.push(toMessage(error));
      }
    }
    if (failures.length > 0) throw new Error(failures.join('; '));
  }

  #fault(point: EventCreationFaultPoint): void {
    this.#faultInjector?.(point);
  }

  #dispatchFault(point: EventDispatchFaultPoint): void {
    this.#dispatchFaultInjector?.(point);
  }

  #retirementFault(point: EventRetirementFaultPoint): void {
    this.#retirementFaultInjector?.(point);
  }
}

type NormalizedTransactionResultRequest =
  | Readonly<{ ok: true; request: TransactionResultRequest }>
  | Readonly<{ ok: false; message: string }>;

function normalizeTransactionResultRequest(
  request: TransactionResultRequest,
): NormalizedTransactionResultRequest {
  try {
    if (!isPlainRecord(request)) {
      return { ok: false, message: 'Transaction result request must be a plain object.' };
    }
    if (typeof request.runtimeInstanceId !== 'string' ||
        !UUID_PATTERN.test(request.runtimeInstanceId)) {
      return { ok: false, message: 'Transaction result runtime must be a UUID.' };
    }
    if (!Number.isSafeInteger(request.sourceEventId) || request.sourceEventId < 1 ||
        !Number.isSafeInteger(request.commandId) || request.commandId < 1 ||
        !Number.isSafeInteger(request.transactionId) || request.transactionId < 1) {
      return {
        ok: false,
        message: 'Transaction result Event, Command and Transaction IDs must be positive safe integers.',
      };
    }
    if (typeof request.targetId !== 'string' || request.targetId.trim().length === 0) {
      return { ok: false, message: 'Transaction result target ID must be non-empty.' };
    }
    if (!isPlainRecord(request.terminal) ||
        (request.terminal.status !== 'succeeded' && request.terminal.status !== 'failed') ||
        !Number.isSafeInteger(request.terminal.simulationTick) ||
        request.terminal.simulationTick < 1) {
      return {
        ok: false,
        message: 'Only a registered Succeeded or Failed terminal can publish a result event.',
      };
    }
    if (request.terminal.status === 'failed' &&
        (typeof request.terminal.reasonCode !== 'string' ||
          request.terminal.reasonCode.trim().length === 0 ||
          typeof request.terminal.message !== 'string' ||
          request.terminal.message.trim().length === 0)) {
      return {
        ok: false,
        message: 'A Failed terminal must preserve a non-empty reason code and message.',
      };
    }
    const terminal: TransactionFinalResult = request.terminal.status === 'succeeded'
      ? Object.freeze({
        status: 'succeeded' as const,
        simulationTick: request.terminal.simulationTick,
      })
      : Object.freeze({
        status: 'failed' as const,
        simulationTick: request.terminal.simulationTick,
        reasonCode: request.terminal.reasonCode,
        message: request.terminal.message,
      });
    return {
      ok: true,
      request: Object.freeze({
        runtimeInstanceId: request.runtimeInstanceId,
        sourceEventId: request.sourceEventId,
        commandId: request.commandId,
        transactionId: request.transactionId,
        targetId: request.targetId,
        terminal,
      }),
    };
  } catch {
    return {
      ok: false,
      message: 'Transaction result request fields could not be read.',
    };
  }
}

function transactionResultAssociation(
  resultEventId: number,
  request: TransactionResultRequest,
): TransactionResultAssociation {
  return deepFreeze({
    ...request,
    resultEventId,
  }) as TransactionResultAssociation;
}

function transactionResultRequestFromAssociation(
  association: TransactionResultAssociation,
): TransactionResultRequest {
  return Object.freeze({
    runtimeInstanceId: association.runtimeInstanceId,
    sourceEventId: association.sourceEventId,
    commandId: association.commandId,
    transactionId: association.transactionId,
    targetId: association.targetId,
    terminal: association.terminal,
  });
}

function transactionResultPayload(
  association: TransactionResultAssociation,
): EventPayload {
  return deepFreeze({
    runtimeInstanceId: association.runtimeInstanceId,
    sourceEventId: association.sourceEventId,
    commandId: association.commandId,
    transactionId: association.transactionId,
    targetId: association.targetId,
    terminal: association.terminal,
    resultEventId: association.resultEventId,
  });
}

function transactionResultEventMatches(
  event: PendingEvent,
  association: TransactionResultAssociation,
): boolean {
  if (event.eventId !== association.resultEventId ||
      event.runtimeInstanceId !== association.runtimeInstanceId ||
      event.type !== TRANSACTION_RESULT_EVENT_TYPE) {
    return false;
  }
  try {
    return stableSerialize(event.payload) ===
      stableSerialize(transactionResultPayload(association));
  } catch {
    return false;
  }
}

function createdTransactionResult(
  stored: StoredTransactionResult,
  lifecycle: TransactionResultLifecycle,
): TransactionResultCreationResult {
  return Object.freeze({
    status: 'created' as const,
    event: stored.event,
    association: stored.association,
    lifecycle,
    producerId: stored.producerId,
  });
}

function existingTransactionResult(
  stored: StoredTransactionResult,
  lifecycle: TransactionResultLifecycle,
): TransactionResultCreationResult {
  return Object.freeze({
    status: 'existing' as const,
    event: stored.event,
    association: stored.association,
    lifecycle,
    producerId: stored.producerId,
  });
}

function foundTransactionResult(
  stored: StoredTransactionResult,
  lifecycle: TransactionResultLifecycle,
): TransactionResultQuery {
  return Object.freeze({
    status: 'found' as const,
    event: stored.event,
    association: stored.association,
    lifecycle,
    producerId: stored.producerId,
  });
}

function rejectedTransactionResult(
  reason: Extract<TransactionResultCreationResult, { status: 'rejected' }>['reason'],
  message: string,
): Extract<TransactionResultCreationResult, { status: 'rejected' }> {
  return Object.freeze({ status: 'rejected' as const, reason, message });
}

function rejectedTransactionResultQuery(
  reason: Extract<TransactionResultQuery, { status: 'rejected' }>['reason'],
  message: string,
): Extract<TransactionResultQuery, { status: 'rejected' }> {
  return Object.freeze({ status: 'rejected' as const, reason, message });
}

function createPendingEvent(
  runtimeInstanceId: string,
  eventId: number,
  type: string,
  payload: EventPayload,
): PendingEvent {
  return Object.freeze({
    eventId,
    runtimeInstanceId,
    type,
    payload,
    status: 'pending' as const,
  });
}

type NormalizedDispatchContext =
  | Readonly<{
    ok: true;
    runtimeInstanceId: string;
    simulationTick: number;
    phase: EventDispatchPhase;
    retryDeliveryEventIds: readonly number[];
  }>
  | Readonly<{ ok: false; message: string }>;

type NormalizedCommandReceipt =
  | Readonly<{ ok: true; testCommandReference: string }>
  | Readonly<{
    ok: false;
    failureCode:
      | 'receipt-not-accepted'
      | 'receipt-unknown'
      | 'invalid-receipt';
    message: string;
  }>;

type RejectedAcknowledgement = Extract<
  ProducerAcknowledgementResult,
  { status: 'rejected' }
>;
type RejectedRetirement = Extract<
  EventRetirementResult,
  { status: 'rejected' }
>;
type VerifiedCompletedResult =
  | Readonly<{
    ok: true;
    producerId: string;
    eventId: number;
  }>
  | Readonly<{
    ok: false;
    rejected: RejectedAcknowledgement;
    rejectedRetirement: RejectedRetirement;
  }>;

function invalidFinalResultProducer(): FinalEventResultRead {
  return rejectedFinalResult(
    'invalid-producer',
    'Producer handle is not owned by this coordinator.',
  );
}

function rejectedFinalResult(
  reason: Extract<FinalEventResultRead, { status: 'rejected' }>['reason'],
  message: string,
): FinalEventResultRead {
  return Object.freeze({
    status: 'rejected' as const,
    reason,
    message,
  });
}

function rejectedAcknowledgement(
  reason: RejectedAcknowledgement['reason'],
  message: string,
): RejectedAcknowledgement {
  return Object.freeze({
    status: 'rejected' as const,
    reason,
    message,
  });
}

function rejectedRetirement(
  reason: RejectedRetirement['reason'],
  message: string,
): RejectedRetirement {
  return Object.freeze({
    status: 'rejected' as const,
    reason,
    message,
  });
}

function normalizeDispatchContext(context: EventDispatchContext): NormalizedDispatchContext {
  let runtimeInstanceId: unknown;
  let simulationTick: unknown;
  let phase: unknown;
  let retryDeliveryEventIds: unknown;
  try {
    if (!isPlainRecord(context)) {
      return Object.freeze({
        ok: false as const,
        message: 'Dispatch context must be a plain object.',
      });
    }
    runtimeInstanceId = context.runtimeInstanceId;
    simulationTick = context.simulationTick;
    phase = context.phase;
    retryDeliveryEventIds = context.retryDeliveryEventIds;
  } catch {
    return Object.freeze({
      ok: false as const,
      message: 'Dispatch context fields could not be read.',
    });
  }
  if (typeof runtimeInstanceId !== 'string' ||
      !Number.isSafeInteger(simulationTick) ||
      (simulationTick as number) < 1 ||
      phase !== 'coordination') {
    return Object.freeze({
      ok: false as const,
      message:
        'Dispatch requires a runtime UUID, positive safe SimulationTick and coordination phase.',
    });
  }
  if (retryDeliveryEventIds !== undefined &&
      (!Array.isArray(retryDeliveryEventIds) ||
       retryDeliveryEventIds.length > 64 ||
       retryDeliveryEventIds.some((eventId, index, values) =>
         !Number.isSafeInteger(eventId) ||
         eventId < 1 ||
         values.indexOf(eventId) !== index))) {
    return Object.freeze({
      ok: false as const,
      message:
        'retryDeliveryEventIds must contain unique positive safe Event IDs.',
    });
  }
  return Object.freeze({
    ok: true as const,
    runtimeInstanceId,
    simulationTick: simulationTick as number,
    phase,
    retryDeliveryEventIds: Object.freeze(
      [...(retryDeliveryEventIds as number[] | undefined ?? [])],
    ),
  });
}

function normalizeCommandReceipt(
  receipt: unknown,
  eventId: number,
): NormalizedCommandReceipt {
  if (!isPlainRecord(receipt) || typeof receipt.status !== 'string') {
    return Object.freeze({
      ok: false as const,
      failureCode: 'invalid-receipt' as const,
      message: 'Command receipt must be a plain result object.',
    });
  }
  if (receipt.status === 'accepted') {
    if (typeof receipt.testCommandReference !== 'string' ||
        receipt.testCommandReference.trim().length === 0) {
      return Object.freeze({
        ok: false as const,
        failureCode: 'invalid-receipt' as const,
        message: 'Accepted test receipt requires a non-empty independent reference.',
      });
    }
    if (receipt.testCommandReference === String(eventId)) {
      return Object.freeze({
        ok: false as const,
        failureCode: 'invalid-receipt' as const,
        message: 'Accepted test receipt reference must not reuse the Event ID.',
      });
    }
    return Object.freeze({
      ok: true as const,
      testCommandReference: receipt.testCommandReference,
    });
  }
  if (receipt.status === 'not-accepted') {
    return Object.freeze({
      ok: false as const,
      failureCode: 'receipt-not-accepted' as const,
      message: `Test receipt rejected the event: ${receiptReason(receipt.reason)}.`,
    });
  }
  if (receipt.status === 'unknown') {
    return Object.freeze({
      ok: false as const,
      failureCode: 'receipt-unknown' as const,
      message: `Test receipt returned unknown: ${receiptReason(receipt.reason)}.`,
    });
  }
  return Object.freeze({
    ok: false as const,
    failureCode: 'invalid-receipt' as const,
    message: `Unsupported test receipt status "${receipt.status}".`,
  });
}

function receiptReason(value: unknown): string {
  return typeof value === 'string' && value.trim().length > 0
    ? value
    : 'no reason supplied';
}

function createDispatchProgress(
  processedEventIds: readonly number[],
  completedEventIds: readonly number[],
  pendingEventIds: readonly number[],
  delivery?: RealCommandDeliveryProgress,
): EventDispatchProgress {
  return Object.freeze({
    processedEventIds: Object.freeze([...processedEventIds]),
    completedEventIds: Object.freeze([...completedEventIds]),
    pendingEventIds: Object.freeze([...pendingEventIds]),
    ...(delivery ? { delivery } : {}),
  });
}

function createRealDeliveryProgress(
  snapshot: CommandDeliverySnapshot,
  reconciledEventIds: readonly number[],
  retriedEventIds: readonly number[],
): RealCommandDeliveryProgress {
  const eventIdsWithStatus = (
    status: CommandDeliveryStatus,
  ): readonly number[] => Object.freeze(snapshot.records
    .filter(record => record.status === status)
    .map(record => record.eventId));
  return Object.freeze({
    acceptedEventIds: eventIdsWithStatus('accepted'),
    retryableEventIds: eventIdsWithStatus('retryable'),
    rejectedEventIds: eventIdsWithStatus('rejected'),
    unknownEventIds: eventIdsWithStatus('unknown'),
    reconciledEventIds: Object.freeze([...reconciledEventIds]),
    retriedEventIds: Object.freeze([...retriedEventIds]),
  });
}

function rejectDispatch(
  reason:
    | 'invalid-phase'
    | 'runtime-mismatch'
    | 'phase-order'
    | 'recursive-dispatch'
    | 'dispatch-not-configured'
    | 'retry-not-allowed',
  message: string,
): Readonly<{
  status: 'rejected';
  reason:
    | 'invalid-phase'
    | 'runtime-mismatch'
    | 'phase-order'
    | 'recursive-dispatch'
    | 'dispatch-not-configured'
    | 'retry-not-allowed';
  message: string;
}> {
  return Object.freeze({ status: 'rejected' as const, reason, message });
}

function validateCommandRequestForEvent(
  request: CommandCreationRequest,
  event: PendingEvent,
): string | undefined {
  if (!isPlainRecord(request)) return 'Real command handler must return a command request.';
  const source = request.sourceEvent;
  if (!isPlainRecord(source) ||
      source.runtimeInstanceId !== event.runtimeInstanceId ||
      source.eventId !== event.eventId ||
      source.status !== 'pending') {
    return 'Real command request must reference the Processing event envelope unchanged.';
  }
  try {
    return fingerprintEvent(source) === fingerprintEvent(event)
      ? undefined
      : 'Real command request changed the source event type or payload.';
  } catch (error) {
    return `Real command request has an invalid source event: ${toMessage(error)}`;
  }
}

function blockedDispatch(
  failure: EventDispatchFailure,
): Readonly<{ status: 'blocked'; failure: EventDispatchFailure }> {
  return Object.freeze({ status: 'blocked' as const, failure });
}

function invalidRedeliveryContext(): Readonly<{
  status: 'rejected';
  reason: 'invalid-context';
  message: string;
}> {
  return Object.freeze({
    status: 'rejected' as const,
    reason: 'invalid-context' as const,
    message: 'Redelivery candidate must contain a valid Event ID, runtime and Pending state.',
  });
}

function publicLifecycleRecord(record: StoredLifecycleRecord): EventLifecycleRecord {
  return Object.freeze({
    eventId: record.eventId,
    runtimeInstanceId: record.runtimeInstanceId,
    status: record.status,
    ...(record.producerId === undefined ? {} : { producerId: record.producerId }),
    ...(record.resultDelivered === undefined
      ? {}
      : { resultDelivered: record.resultDelivered }),
    ...(record.acknowledged === undefined
      ? {}
      : { acknowledged: record.acknowledged }),
    ...(record.simulationTick === undefined
      ? {}
      : { simulationTick: record.simulationTick }),
    ...(record.testCommandReference === undefined
      ? {}
      : { testCommandReference: record.testCommandReference }),
    ...(record.realCommand === undefined
      ? {}
      : { realCommand: record.realCommand }),
    ...(record.transactionResult === undefined
      ? {}
      : { transactionResult: record.transactionResult }),
    ...(record.transactionResultConsumed === undefined
      ? {}
      : { transactionResultConsumed: record.transactionResultConsumed }),
  });
}

function fingerprintEvent(
  event: Readonly<{
    type: string;
    payload: EventPayload;
  }>,
): string {
  if (typeof event.type !== 'string' || !isPlainRecord(event.payload) ||
      !isJsonValue(event.payload, new Set<object>())) {
    throw new TypeError('Event identity contains an invalid type or payload.');
  }
  return `${event.type}\n${stableSerialize(event.payload)}`;
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

function invalidRequest(message: string): NormalizedRequest {
  return Object.freeze({
    ok: false as const,
    reason: 'invalid-request' as const,
    message,
  });
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isJsonValue(value: unknown, seen: Set<object>): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);
  const valid = Array.isArray(value)
    ? value.every(item => isJsonValue(item, seen))
    : isPlainRecord(value) && Object.values(value).every(item => isJsonValue(item, seen));
  seen.delete(value);
  return valid;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
