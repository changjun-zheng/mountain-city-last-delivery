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

export type EventLifecycleState = 'pending' | 'processing' | 'completed';
export type EventDispatchPhase = 'coordination';

export type EventDispatchContext = Readonly<{
  runtimeInstanceId: string;
  simulationTick: number;
  phase: EventDispatchPhase;
}>;

export type EventDispatchHandlerContext = Readonly<{
  runtimeInstanceId: string;
  simulationTick: number;
  phase: EventDispatchPhase;
  create: (request: EventCreationRequest) => EventCreationResult;
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

export type EventDispatchFaultPoint =
  | 'before-processing-transition'
  | 'before-completion-transition';

export type EventDispatchFaultInjector = (point: EventDispatchFaultPoint) => void;

export type EventCreationFaultPoint =
  | 'validation'
  | 'candidate-prepared'
  | 'registration-prepared'
  | 'inbox-prepared'
  | 'event-id-committed'
  | 'registration-committed'
  | 'inbox-committed'
  | 'rollback';

export type EventCreationFaultInjector = (point: EventCreationFaultPoint) => void;

export type EventCreationOptions = Readonly<{
  inboxCapacity: number;
  historyCapacity?: number;
  allowedEventTypes?: readonly string[];
  dispatchHandler?: EventDispatchHandler;
  commandReceiptTestDouble?: CommandReceiptTestDouble;
  // Deterministic failure seam for tests. Runtime composition does not supply it.
  faultInjector?: EventCreationFaultInjector;
  // A separate deterministic seam verifies lifecycle transitions without
  // exposing registry mutation to callers.
  dispatchFaultInjector?: EventDispatchFaultInjector;
}>;

export type RuntimeEventContextOptions = Readonly<{
  initialNextEventId?: number;
}>;

export type EventCreationRejectionReason =
  | 'invalid-request'
  | 'unsupported-event-type'
  | 'invalid-payload'
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
  simulationTick?: number;
  testCommandReference?: string;
}>;

export type EventDispatchProgress = Readonly<{
  processedEventIds: readonly number[];
  completedEventIds: readonly number[];
  pendingEventIds: readonly number[];
}>;

export type EventDispatchFailure = Readonly<{
  code:
    | 'handler-threw'
    | 'receipt-not-accepted'
    | 'receipt-unknown'
    | 'invalid-receipt'
    | 'lifecycle-invalid'
    | 'dispatch-blocked';
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
      | 'dispatch-not-configured';
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
    reason: 'invalid-context' | 'runtime-mismatch' | 'unknown-event' | 'integrity-mismatch';
    message: string;
  }>;

export type EventKernelSnapshot = Readonly<{
  runtimeInstanceId: string;
  nextEventId: number | null;
  lifecycleRecords: readonly EventLifecycleRecord[];
  inboxEvents: readonly PendingEvent[];
  counts: Readonly<{ lifecycleRecords: number; inboxEvents: number }>;
  blocked: boolean;
  lastDispatchTick: number | null;
  dispatchBlocked: boolean;
  lastFailure?: EventCreationFailure;
  dispatchFailure?: EventDispatchFailure;
}>;

type CandidateEventId = Readonly<{ eventId: number; previousEventId: number }>;
type PreparedRegistration = Readonly<{
  eventId: number;
  runtimeInstanceId: string;
  status: 'pending';
  eventFingerprint: string;
}>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EVENT_TYPE_PATTERN = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;
const DEFAULT_HISTORY_CAPACITY = 1024;

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

  prepare(event: PendingEvent): PreparedRegistration {
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
    details: Readonly<{ simulationTick: number; testCommandReference?: string }>,
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
      simulationTick: details.simulationTick,
      ...(details.testCommandReference
        ? { testCommandReference: details.testCommandReference }
        : {}),
      eventFingerprint: current.eventFingerprint,
    });
    this.#records.set(eventId, updated);
    return publicLifecycleRecord(updated);
  }

  get snapshot(): readonly EventLifecycleRecord[] {
    return Object.freeze([...this.#records.values()].map(publicLifecycleRecord));
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

  get snapshot(): readonly PendingEvent[] {
    return Object.freeze([...this.#queue]);
  }
}

type NormalizedRequest =
  | Readonly<{ ok: true; type: string; payload: EventPayload }>
  | Readonly<{
    ok: false;
    reason: 'invalid-request' | 'unsupported-event-type' | 'invalid-payload';
    message: string;
  }>;

export class RuntimeEventContext {
  readonly runtimeInstanceId: string;
  readonly #eventIds: EventIdSequence;
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
    this.#eventIds = new EventIdSequence(options.initialNextEventId ?? 1);
  }

  createCoordinator(options: EventCreationOptions): EventCreationCoordinator {
    if (this.#coordinator) {
      throw new Error('A runtime context can only own one event coordinator.');
    }
    this.#coordinator = new EventCreationCoordinator(
      this.runtimeInstanceId,
      this.#eventIds,
      options,
    );
    return this.#coordinator;
  }
}

// This is the only public event creation entry. Generator, lifecycle registry
// and Inbox retain their own state while the coordinator controls the commit.
export class EventCreationCoordinator {
  readonly #runtimeInstanceId: string;
  readonly #eventIds: EventIdSequence;
  readonly #lifecycle: EventLifecycleRegistry;
  readonly #inbox: EventInbox;
  readonly #allowedEventTypes: ReadonlySet<string> | undefined;
  readonly #faultInjector: EventCreationFaultInjector | undefined;
  readonly #dispatchFaultInjector: EventDispatchFaultInjector | undefined;
  readonly #dispatchHandler: EventDispatchHandler | undefined;
  readonly #commandReceiptTestDouble: CommandReceiptTestDouble | undefined;
  #blockedFailure: EventCreationFailure | undefined;
  #lastFailure: EventCreationFailure | undefined;
  #lastDispatchTick: number | undefined;
  #dispatchFailure: EventDispatchFailure | undefined;
  #dispatching = false;

  constructor(
    runtimeInstanceId: string,
    eventIds: EventIdSequence,
    options: EventCreationOptions,
  ) {
    this.#runtimeInstanceId = runtimeInstanceId;
    this.#eventIds = eventIds;
    this.#lifecycle = new EventLifecycleRegistry(
      options.historyCapacity ?? DEFAULT_HISTORY_CAPACITY,
    );
    this.#inbox = new EventInbox(options.inboxCapacity);
    this.#allowedEventTypes = options.allowedEventTypes
      ? new Set(options.allowedEventTypes)
      : undefined;
    this.#faultInjector = options.faultInjector;
    this.#dispatchFaultInjector = options.dispatchFaultInjector;
    this.#dispatchHandler = options.dispatchHandler;
    this.#commandReceiptTestDouble = options.commandReceiptTestDouble;
  }

  create(request: EventCreationRequest): EventCreationResult {
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

      if (!this.#lifecycle.hasCapacity) {
        return Object.freeze({
          status: 'rejected' as const,
          reason: 'history-capacity' as const,
          message: 'The lifecycle history has no capacity for another event.',
        });
      }

      const event = createPendingEvent(
        this.#runtimeInstanceId,
        candidate.eventId,
        normalized.type,
        normalized.payload,
      );
      const registration = this.#lifecycle.prepare(event);
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

    const handler = this.#dispatchHandler;
    const receiptTestDouble = this.#commandReceiptTestDouble;
    if (!handler || !receiptTestDouble) {
      return rejectDispatch(
        'dispatch-not-configured',
        'A coordination handler and command receipt test double are both required.',
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

    this.#lastDispatchTick = normalized.simulationTick;
    this.#dispatching = true;
    const processedEventIds: number[] = [];
    const completedEventIds: number[] = [];
    const handlerContext = Object.freeze({
      runtimeInstanceId: this.#runtimeInstanceId,
      simulationTick: normalized.simulationTick,
      phase: normalized.phase,
      create: (request: EventCreationRequest) => this.create(request),
      statusOf: (eventId: number) => this.#lifecycle.statusOf(eventId),
    }) satisfies EventDispatchHandlerContext;

    try {
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
    } finally {
      this.#dispatching = false;
    }
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
      blocked: this.#blockedFailure !== undefined,
      lastDispatchTick: this.#lastDispatchTick ?? null,
      dispatchBlocked: this.#dispatchFailure !== undefined,
      ...(this.#lastFailure ? { lastFailure: this.#lastFailure } : {}),
      ...(this.#dispatchFailure ? { dispatchFailure: this.#dispatchFailure } : {}),
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

  #normalize(request: EventCreationRequest): NormalizedRequest {
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

function normalizeDispatchContext(context: EventDispatchContext): NormalizedDispatchContext {
  let runtimeInstanceId: unknown;
  let simulationTick: unknown;
  let phase: unknown;
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
  return Object.freeze({
    ok: true as const,
    runtimeInstanceId,
    simulationTick: simulationTick as number,
    phase,
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
): EventDispatchProgress {
  return Object.freeze({
    processedEventIds: Object.freeze([...processedEventIds]),
    completedEventIds: Object.freeze([...completedEventIds]),
    pendingEventIds: Object.freeze([...pendingEventIds]),
  });
}

function rejectDispatch(
  reason:
    | 'invalid-phase'
    | 'runtime-mismatch'
    | 'phase-order'
    | 'recursive-dispatch'
    | 'dispatch-not-configured',
  message: string,
): Readonly<{
  status: 'rejected';
  reason:
    | 'invalid-phase'
    | 'runtime-mismatch'
    | 'phase-order'
    | 'recursive-dispatch'
    | 'dispatch-not-configured';
  message: string;
}> {
  return Object.freeze({ status: 'rejected' as const, reason, message });
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
    ...(record.simulationTick === undefined
      ? {}
      : { simulationTick: record.simulationTick }),
    ...(record.testCommandReference === undefined
      ? {}
      : { testCommandReference: record.testCommandReference }),
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
