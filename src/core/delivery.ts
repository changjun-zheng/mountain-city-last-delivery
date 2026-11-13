import {
  type AcceptedCommandQuery,
  type CommandAcceptanceResult,
  type EventCommand,
  type TargetTransactionModule,
} from './commands.ts';

export type CommandDeliveryStatus =
  | 'accepted'
  | 'retryable'
  | 'rejected'
  | 'unknown';

export type CommandDeliveryFaultPoint =
  | 'after-target-accept-returned';

export type CommandDeliveryFaultInjector =
  (point: CommandDeliveryFaultPoint) => void;

export type DeliverySourceEvent = Readonly<{
  eventId: number;
  runtimeInstanceId: string;
  type: string;
  payload: Readonly<Record<string, unknown>>;
  status: 'pending';
}>;

export type CommandDeliveryRecord = Readonly<{
  eventId: number;
  runtimeInstanceId: string;
  status: CommandDeliveryStatus;
  targetId?: string;
  commandId?: number;
  transactionId?: number;
  lastAttemptTransactionId?: number;
  reasonCode: string;
  message: string;
  acceptanceAttempts: number;
  reconciliationQueries: number;
}>;

export type CommandDeliverySnapshot = Readonly<{
  records: readonly CommandDeliveryRecord[];
  counts: Readonly<{
    records: number;
    capacity: number;
    accepted: number;
    retryable: number;
    rejected: number;
    unknown: number;
    businessExecutions: 0;
  }>;
  capacityFailureCount: number;
  lastCapacityFailureEventId: number | null;
}>;

export type CommandDeliveryOperationResult =
  | Readonly<{
    status: 'recorded';
    record: CommandDeliveryRecord;
  }>
  | Readonly<{
    status: 'capacity';
    eventId: number;
    message: string;
  }>
  | Readonly<{
    status: 'identity-mismatch';
    eventId: number;
    message: string;
  }>
  | Readonly<{
    status: 'not-retryable';
    eventId: number;
    message: string;
  }>
  | Readonly<{
    status: 'unknown-event';
    eventId: number;
  }>;

export type RealCommandDeliveryOptions = Readonly<{
  capacity?: number;
  faultInjector?: CommandDeliveryFaultInjector;
}>;

type ClassificationHint = 'retryable' | 'rejected';

type StoredDelivery = Readonly<{
  event: DeliverySourceEvent;
  command?: EventCommand;
  target?: TargetTransactionModule;
  record: CommandDeliveryRecord;
  classificationHint?: ClassificationHint;
}>;

const DEFAULT_DELIVERY_CAPACITY = 1024;

// This coordinator owns one finite delivery record per source event. It calls
// the real target module, but never starts or executes the target transaction.
export class RealCommandDeliveryCoordinator {
  readonly #capacity: number;
  readonly #faultInjector: CommandDeliveryFaultInjector | undefined;
  readonly #deliveriesByEventId = new Map<number, StoredDelivery>();
  #capacityFailureCount = 0;
  #lastCapacityFailureEventId: number | undefined;

  constructor(options: RealCommandDeliveryOptions = {}) {
    const capacity = options.capacity ?? DEFAULT_DELIVERY_CAPACITY;
    if (!Number.isSafeInteger(capacity) || capacity <= 0) {
      throw new RangeError('Delivery record capacity must be a positive safe integer.');
    }
    this.#capacity = capacity;
    this.#faultInjector = options.faultInjector;
  }

  start(
    event: DeliverySourceEvent,
    command: EventCommand,
    target: TargetTransactionModule,
  ): CommandDeliveryOperationResult {
    const identityError = validateDeliveryIdentity(event, command, target);
    if (identityError) {
      return Object.freeze({
        status: 'identity-mismatch' as const,
        eventId: event.eventId,
        message: identityError,
      });
    }

    const existing = this.#deliveriesByEventId.get(event.eventId);
    if (existing) {
      if (existing.command?.commandId !== command.commandId ||
          existing.target !== target) {
        return Object.freeze({
          status: 'identity-mismatch' as const,
          eventId: event.eventId,
          message: 'An event delivery cannot change its original command or target.',
        });
      }
      return recorded(existing.record);
    }

    const capacity = this.#ensureCapacity(event.eventId);
    if (capacity) return capacity;

    const stored = this.#store({
      event,
      command,
      target,
      record: createRecord(event, {
        status: 'unknown',
        targetId: command.targetId,
        commandId: command.commandId,
        reasonCode: 'acceptance-in-flight',
        message: 'The target acceptance result has not been observed.',
      }),
    });
    return recorded(this.#attemptAcceptance(stored).record);
  }

  recordPreparationFailure(
    event: DeliverySourceEvent,
    reasonCode: string,
    message: string,
  ): CommandDeliveryOperationResult {
    const existing = this.#deliveriesByEventId.get(event.eventId);
    if (existing) return recorded(existing.record);

    const capacity = this.#ensureCapacity(event.eventId);
    if (capacity) return capacity;

    const stored = this.#store({
      event,
      record: createRecord(event, {
        status: 'rejected',
        reasonCode,
        message,
      }),
    });
    return recorded(stored.record);
  }

  recordCommandRejection(
    event: DeliverySourceEvent,
    command: EventCommand,
    reasonCode: string,
    message: string,
  ): CommandDeliveryOperationResult {
    const existing = this.#deliveriesByEventId.get(event.eventId);
    if (existing) return recorded(existing.record);

    const capacity = this.#ensureCapacity(event.eventId);
    if (capacity) return capacity;

    const stored = this.#store({
      event,
      command,
      record: createRecord(event, {
        status: 'rejected',
        targetId: command.targetId,
        commandId: command.commandId,
        reasonCode,
        message,
      }),
    });
    return recorded(stored.record);
  }

  reconcile(eventId: number): CommandDeliveryOperationResult {
    const stored = this.#deliveriesByEventId.get(eventId);
    if (!stored) {
      return Object.freeze({ status: 'unknown-event' as const, eventId });
    }
    if (stored.record.status !== 'unknown') return recorded(stored.record);
    return recorded(this.#reconcileStored(stored).record);
  }

  reconcileUnknown(): readonly CommandDeliveryOperationResult[] {
    const unknown = [...this.#deliveriesByEventId.values()]
      .filter(stored => stored.record.status === 'unknown')
      .sort((left, right) =>
        left.record.eventId - right.record.eventId);
    return Object.freeze(unknown.map(stored =>
      recorded(this.#reconcileStored(stored).record)));
  }

  retry(eventId: number): CommandDeliveryOperationResult {
    const stored = this.#deliveriesByEventId.get(eventId);
    if (!stored) {
      return Object.freeze({ status: 'unknown-event' as const, eventId });
    }
    if (stored.record.status !== 'retryable') {
      return Object.freeze({
        status: 'not-retryable' as const,
        eventId,
        message: 'Only a delivery confirmed Retryable can be retried explicitly.',
      });
    }
    if (!stored.command || !stored.target) {
      return Object.freeze({
        status: 'not-retryable' as const,
        eventId,
        message: 'Retryable delivery has no stable command and target capability.',
      });
    }

    return recorded(this.#attemptAcceptance(stored).record);
  }

  canRetry(eventId: number): boolean {
    return this.#deliveriesByEventId.get(eventId)?.record.status === 'retryable';
  }

  get(eventId: number): CommandDeliveryRecord | undefined {
    return this.#deliveriesByEventId.get(eventId)?.record;
  }

  get snapshot(): CommandDeliverySnapshot {
    const records = Object.freeze([...this.#deliveriesByEventId.values()]
      .map(stored => stored.record)
      .sort((left, right) => left.eventId - right.eventId));
    return Object.freeze({
      records,
      counts: Object.freeze({
        records: records.length,
        capacity: this.#capacity,
        accepted: records.filter(record => record.status === 'accepted').length,
        retryable: records.filter(record => record.status === 'retryable').length,
        rejected: records.filter(record => record.status === 'rejected').length,
        unknown: records.filter(record => record.status === 'unknown').length,
        businessExecutions: 0 as const,
      }),
      capacityFailureCount: this.#capacityFailureCount,
      lastCapacityFailureEventId: this.#lastCapacityFailureEventId ?? null,
    });
  }

  #attemptAcceptance(stored: StoredDelivery): StoredDelivery {
    const command = stored.command as EventCommand;
    const target = stored.target as TargetTransactionModule;
    let result: CommandAcceptanceResult | undefined;
    let failure: unknown;
    try {
      result = target.accept(command);
      this.#fault('after-target-accept-returned');
    } catch (error) {
      failure = error;
      result = undefined;
    }

    if (!result) {
      return this.#replace(stored, {
        status: 'unknown',
        acceptanceAttempts: stored.record.acceptanceAttempts + 1,
        reasonCode: 'acceptance-result-unknown',
        message: `Target acceptance result could not be observed: ${toMessage(failure)}`,
      });
    }
    return this.#classifyAcceptanceResult(stored, result);
  }

  #classifyAcceptanceResult(
    stored: StoredDelivery,
    result: CommandAcceptanceResult,
  ): StoredDelivery {
    const command = stored.command as EventCommand;
    if (result.status === 'accepted') {
      if (!acceptanceMatchesCommand(command, result.record, result.intent)) {
        return this.#replace(stored, {
          status: 'unknown',
          acceptanceAttempts: stored.record.acceptanceAttempts + 1,
          reasonCode: 'accepted-association-invalid',
          message: 'Target returned Accepted with inconsistent command associations.',
        });
      }
      return this.#replace(stored, {
        status: 'accepted',
        transactionId: result.intent.transactionId,
        lastAttemptTransactionId: result.intent.transactionId,
        acceptanceAttempts: stored.record.acceptanceAttempts + 1,
        reasonCode: 'target-accepted',
        message: 'The target atomically accepted the stable command.',
      });
    }

    if (result.status === 'rejected') {
      return this.#replace(stored, {
        status: 'rejected',
        acceptanceAttempts: stored.record.acceptanceAttempts + 1,
        reasonCode: `target-${result.reason}`,
        message: result.message,
      });
    }

    if (result.status === 'blocked') {
      return this.#replace(stored, {
        status: 'unknown',
        lastAttemptTransactionId: result.failure.transactionId,
        acceptanceAttempts: stored.record.acceptanceAttempts + 1,
        reasonCode: 'target-blocked',
        message: result.failure.message,
      });
    }

    if (result.failure.rollback !== 'complete') {
      return this.#replace(stored, {
        status: 'unknown',
        lastAttemptTransactionId: result.failure.transactionId,
        acceptanceAttempts: stored.record.acceptanceAttempts + 1,
        reasonCode: 'acceptance-rollback-unconfirmed',
        message: result.failure.message,
      });
    }

    const hint = classificationHint(result.failure.retryability);
    if (!hint) {
      return this.#replace(stored, {
        status: 'unknown',
        lastAttemptTransactionId: result.failure.transactionId,
        acceptanceAttempts: stored.record.acceptanceAttempts + 1,
        reasonCode: 'acceptance-failure-unclassified',
        message: result.failure.message,
      });
    }

    return this.#queryConfirmedClassification(
      this.#replace(stored, {
        status: 'unknown',
        lastAttemptTransactionId: result.failure.transactionId,
        acceptanceAttempts: stored.record.acceptanceAttempts + 1,
        reasonCode: 'acceptance-unconfirmed',
        message: result.failure.message,
      }, hint),
    );
  }

  #queryConfirmedClassification(stored: StoredDelivery): StoredDelivery {
    const target = stored.target as TargetTransactionModule;
    const command = stored.command as EventCommand;
    const queryCount = stored.record.reconciliationQueries + 1;
    let query: AcceptedCommandQuery;
    try {
      query = target.query(command.commandId);
    } catch (error) {
      return this.#replace(stored, {
        status: 'unknown',
        reconciliationQueries: queryCount,
        reasonCode: 'reconciliation-failed',
        message: `Authoritative query failed: ${toMessage(error)}`,
      }, stored.classificationHint);
    }

    if (query.status === 'found') {
      if (!queryMatchesCommand(command, query)) {
        return this.#replace(stored, {
          status: 'unknown',
          reconciliationQueries: queryCount,
          reasonCode: 'reconciliation-association-invalid',
          message: 'Authoritative query returned inconsistent command associations.',
        });
      }
      return this.#replace(stored, {
        status: 'accepted',
        transactionId: query.intent.transactionId,
        reconciliationQueries: queryCount,
        reasonCode: 'reconciled-accepted',
        message: 'The original command was already accepted by the target.',
      });
    }

    if (query.status === 'not-found') {
      if (stored.classificationHint === 'retryable') {
        return this.#replace(stored, {
          status: 'retryable',
          reconciliationQueries: queryCount,
          reasonCode: 'confirmed-not-accepted-temporary',
          message: 'The target confirmed no acceptance after a temporary failure.',
        });
      }
      if (stored.classificationHint === 'rejected') {
        return this.#replace(stored, {
          status: 'rejected',
          reconciliationQueries: queryCount,
          reasonCode: 'confirmed-not-accepted-permanent',
          message: 'The target confirmed no acceptance after a permanent failure.',
        });
      }
      return this.#replace(stored, {
        status: 'unknown',
        reconciliationQueries: queryCount,
        reasonCode: 'not-found-without-classification',
        message: 'The target has no command record, but acceptance outcome remains unknown.',
      });
    }

    return this.#replace(stored, {
      status: 'unknown',
      reconciliationQueries: queryCount,
      reasonCode: `reconciliation-${query.status}`,
      message: query.status === 'blocked'
        ? query.failure.message
        : query.message,
    }, stored.classificationHint);
  }

  #reconcileStored(stored: StoredDelivery): StoredDelivery {
    return this.#queryConfirmedClassification(stored);
  }

  #replace(
    stored: StoredDelivery,
    changes: Readonly<{
      status: CommandDeliveryStatus;
      targetId?: string;
      commandId?: number;
      transactionId?: number;
      lastAttemptTransactionId?: number;
      reasonCode: string;
      message: string;
      acceptanceAttempts?: number;
      reconciliationQueries?: number;
    }>,
    classificationHint?: ClassificationHint,
  ): StoredDelivery {
    const record: CommandDeliveryRecord = Object.freeze({
      eventId: stored.record.eventId,
      runtimeInstanceId: stored.record.runtimeInstanceId,
      status: changes.status,
      ...(changes.targetId ?? stored.record.targetId
        ? { targetId: changes.targetId ?? stored.record.targetId }
        : {}),
      ...(changes.commandId ?? stored.record.commandId
        ? { commandId: changes.commandId ?? stored.record.commandId }
        : {}),
      ...(changes.transactionId ?? stored.record.transactionId
        ? { transactionId: changes.transactionId ?? stored.record.transactionId }
        : {}),
      ...(changes.lastAttemptTransactionId ?? stored.record.lastAttemptTransactionId
        ? {
          lastAttemptTransactionId:
            changes.lastAttemptTransactionId ?? stored.record.lastAttemptTransactionId,
        }
        : {}),
      reasonCode: changes.reasonCode,
      message: changes.message,
      acceptanceAttempts:
        changes.acceptanceAttempts ?? stored.record.acceptanceAttempts,
      reconciliationQueries:
        changes.reconciliationQueries ?? stored.record.reconciliationQueries,
    });
    const replacement: StoredDelivery = Object.freeze({
      event: stored.event,
      ...(stored.command ? { command: stored.command } : {}),
      ...(stored.target ? { target: stored.target } : {}),
      record,
      ...(classificationHint ? { classificationHint } : {}),
    });
    this.#deliveriesByEventId.set(record.eventId, replacement);
    return replacement;
  }

  #store(stored: StoredDelivery): StoredDelivery {
    this.#deliveriesByEventId.set(stored.event.eventId, stored);
    return stored;
  }

  #ensureCapacity(eventId: number): Extract<
    CommandDeliveryOperationResult,
    { status: 'capacity' }
  > | undefined {
    if (this.#deliveriesByEventId.size < this.#capacity) return undefined;
    this.#capacityFailureCount += 1;
    this.#lastCapacityFailureEventId = eventId;
    return Object.freeze({
      status: 'capacity' as const,
      eventId,
      message: 'The finite delivery record capacity is full.',
    });
  }

  #fault(point: CommandDeliveryFaultPoint): void {
    this.#faultInjector?.(point);
  }
}

function createRecord(
  event: DeliverySourceEvent,
  details: Readonly<{
    status: CommandDeliveryStatus;
    targetId?: string;
    commandId?: number;
    transactionId?: number;
    lastAttemptTransactionId?: number;
    reasonCode: string;
    message: string;
  }>,
): CommandDeliveryRecord {
  return Object.freeze({
    eventId: event.eventId,
    runtimeInstanceId: event.runtimeInstanceId,
    status: details.status,
    ...(details.targetId ? { targetId: details.targetId } : {}),
    ...(details.commandId ? { commandId: details.commandId } : {}),
    ...(details.transactionId ? { transactionId: details.transactionId } : {}),
    ...(details.lastAttemptTransactionId
      ? { lastAttemptTransactionId: details.lastAttemptTransactionId }
      : {}),
    reasonCode: details.reasonCode,
    message: details.message,
    acceptanceAttempts: 0,
    reconciliationQueries: 0,
  });
}

function classificationHint(
  retryability: 'temporary' | 'permanent' | 'unknown',
): ClassificationHint | undefined {
  if (retryability === 'temporary') return 'retryable';
  if (retryability === 'permanent') return 'rejected';
  return undefined;
}

function validateDeliveryIdentity(
  event: DeliverySourceEvent,
  command: EventCommand,
  target: TargetTransactionModule,
): string | undefined {
  if (command.runtimeInstanceId !== event.runtimeInstanceId ||
      command.eventId !== event.eventId) {
    return 'Command does not belong to the source event runtime and Event ID.';
  }
  if (command.targetId !== target.targetId) {
    return 'Delivery target does not match the stable command target.';
  }
  return undefined;
}

function acceptanceMatchesCommand(
  command: EventCommand,
  record: Readonly<{
    runtimeInstanceId: string;
    commandId: number;
    eventId: number;
    targetId: string;
    commandType: string;
    payload: Readonly<Record<string, unknown>>;
  }>,
  intent: Readonly<{
    status: string;
    executionState: string;
    runtimeInstanceId: string;
    transactionId: number;
    commandId: number;
    eventId: number;
    targetId: string;
    commandType: string;
    payload: Readonly<Record<string, unknown>>;
  }>,
): boolean {
  return record.runtimeInstanceId === command.runtimeInstanceId &&
    record.commandId === command.commandId &&
    record.eventId === command.eventId &&
    record.targetId === command.targetId &&
    record.commandType === command.type &&
    stableSerialize(record.payload) === stableSerialize(command.payload) &&
    intent.status === 'intent-created' &&
    intent.executionState === 'not-started' &&
    intent.runtimeInstanceId === command.runtimeInstanceId &&
    Number.isSafeInteger(intent.transactionId) &&
    intent.transactionId > 0 &&
    intent.commandId === command.commandId &&
    intent.eventId === command.eventId &&
    intent.targetId === command.targetId &&
    intent.commandType === command.type &&
    stableSerialize(intent.payload) === stableSerialize(command.payload);
}

function queryMatchesCommand(
  command: EventCommand,
  query: Extract<AcceptedCommandQuery, { status: 'found' }>,
): boolean {
  return acceptanceMatchesCommand(command, query.record, query.intent);
}

function recorded(record: CommandDeliveryRecord): Readonly<{
  status: 'recorded';
  record: CommandDeliveryRecord;
}> {
  return Object.freeze({ status: 'recorded' as const, record });
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
