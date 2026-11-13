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
  allowedEventTypes?: readonly string[];
  // Deterministic failure seam for tests. Runtime composition does not supply it.
  faultInjector?: EventCreationFaultInjector;
}>;

export type RuntimeEventContextOptions = Readonly<{
  initialNextEventId?: number;
}>;

export type EventCreationRejectionReason =
  | 'invalid-request'
  | 'unsupported-event-type'
  | 'invalid-payload'
  | 'inbox-capacity'
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

export type PendingLifecycleRecord = Readonly<{
  eventId: number;
  runtimeInstanceId: string;
  status: 'pending';
}>;

export type EventKernelSnapshot = Readonly<{
  runtimeInstanceId: string;
  nextEventId: number | null;
  lifecycleRecords: readonly PendingLifecycleRecord[];
  inboxEvents: readonly PendingEvent[];
  counts: Readonly<{ lifecycleRecords: number; inboxEvents: number }>;
  blocked: boolean;
  lastFailure?: EventCreationFailure;
}>;

type CandidateEventId = Readonly<{ eventId: number; previousEventId: number }>;
type PreparedRegistration = Readonly<{
  eventId: number;
  runtimeInstanceId: string;
  status: 'pending';
}>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EVENT_TYPE_PATTERN = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;

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

// The registry owns lifecycle records only. Creation starts at Pending; this
// task deliberately has no transition or cleanup API.
class EventLifecycleRegistry {
  readonly #records = new Map<number, PendingLifecycleRecord>();

  prepare(event: PendingEvent): PreparedRegistration {
    if (this.#records.has(event.eventId)) {
      throw new Error(`Lifecycle record ${event.eventId} already exists.`);
    }
    return Object.freeze({
      eventId: event.eventId,
      runtimeInstanceId: event.runtimeInstanceId,
      status: 'pending' as const,
    });
  }

  commit(record: PreparedRegistration): void {
    if (this.#records.has(record.eventId)) {
      throw new Error(`Lifecycle record ${record.eventId} already exists.`);
    }
    this.#records.set(record.eventId, Object.freeze({ ...record }));
  }

  rollback(eventId: number): void {
    this.#records.delete(eventId);
  }

  get snapshot(): readonly PendingLifecycleRecord[] {
    return Object.freeze([...this.#records.values()].map(record =>
      Object.freeze({ ...record })));
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
  readonly #lifecycle = new EventLifecycleRegistry();
  readonly #inbox: EventInbox;
  readonly #allowedEventTypes: ReadonlySet<string> | undefined;
  readonly #faultInjector: EventCreationFaultInjector | undefined;
  #blockedFailure: EventCreationFailure | undefined;
  #lastFailure: EventCreationFailure | undefined;

  constructor(
    runtimeInstanceId: string,
    eventIds: EventIdSequence,
    options: EventCreationOptions,
  ) {
    this.#runtimeInstanceId = runtimeInstanceId;
    this.#eventIds = eventIds;
    this.#inbox = new EventInbox(options.inboxCapacity);
    this.#allowedEventTypes = options.allowedEventTypes
      ? new Set(options.allowedEventTypes)
      : undefined;
    this.#faultInjector = options.faultInjector;
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
      ...(this.#lastFailure ? { lastFailure: this.#lastFailure } : {}),
    });
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
