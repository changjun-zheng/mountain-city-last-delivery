export type CommandPayload = Readonly<Record<string, unknown>>;

export type CommandSourceEvent = Readonly<{
  eventId: number;
  runtimeInstanceId: string;
  type: string;
  payload: CommandPayload;
  status: 'pending';
}>;

export type CommandSourceInspection =
  | Readonly<{
    status: 'registered';
    lifecycle: 'pending' | 'processing' | 'completed';
  }>
  | Readonly<{
    status: 'rejected';
    reason:
      | 'invalid-source-event'
      | 'runtime-mismatch'
      | 'unknown-event'
      | 'integrity-mismatch'
      | 'retired-event';
    message: string;
  }>;

export interface CommandEventSource {
  inspectCommandSource(event: CommandSourceEvent): CommandSourceInspection;
}

export type RuntimeBusinessIdentityOptions = Readonly<{
  initialNextCommandId?: number;
  initialNextTransactionId?: number;
}>;

export type RuntimeBusinessIdentitySnapshot = Readonly<{
  runtimeInstanceId: string;
  nextCommandId: number | null;
  nextTransactionId: number | null;
}>;

export type CommandCreationRequest = Readonly<{
  sourceEvent: CommandSourceEvent;
  targetId: string;
  commandType: string;
  payload: CommandPayload;
}>;

export type EventCommand = Readonly<{
  runtimeInstanceId: string;
  eventId: number;
  commandId: number;
  targetId: string;
  type: string;
  payload: CommandPayload;
}>;

export type CommandCreationResult =
  | Readonly<{
    status: 'created';
    disposition: 'created' | 'existing';
    command: EventCommand;
  }>
  | Readonly<{
    status: 'rejected';
    reason:
      | 'invalid-request'
      | 'invalid-source-event'
      | 'runtime-mismatch'
      | 'unknown-event'
      | 'integrity-mismatch'
      | 'retired-event'
      | 'invalid-target'
      | 'invalid-command-type'
      | 'invalid-payload'
      | 'second-command'
      | 'command-capacity'
      | 'command-id-exhausted';
    message: string;
  }>;

export type CommandCreationCoordinatorSnapshot = Readonly<{
  runtimeInstanceId: string;
  commandIds: Readonly<{ nextId: number | null }>;
  transactionIds: Readonly<{ nextId: number | null }>;
  commands: readonly EventCommand[];
  targetIds: readonly string[];
  counts: Readonly<{
    commands: number;
    targets: number;
    capacity: number;
  }>;
}>;

export type AcceptedCommandRecord = Readonly<{
  status: 'accepted';
  runtimeInstanceId: string;
  commandId: number;
  eventId: number;
  targetId: string;
  commandType: string;
  payload: CommandPayload;
}>;

export type TransactionCreationIntent = Readonly<{
  status: 'intent-created';
  executionState: 'not-started';
  runtimeInstanceId: string;
  transactionId: number;
  commandId: number;
  eventId: number;
  targetId: string;
  commandType: string;
  payload: CommandPayload;
}>;

export type CommandAcceptanceFaultPoint =
  | 'transaction-id-allocated'
  | 'receipt-prepared'
  | 'before-atomic-commit'
  | 'after-atomic-commit';

export type CommandRollbackFaultPoint = 'before-rollback';

export type CommandAcceptanceFaultInjector =
  (point: CommandAcceptanceFaultPoint) => void;
export type CommandRollbackFaultInjector =
  (point: CommandRollbackFaultPoint) => void;

export type CommandAcceptanceRetryability =
  | 'temporary'
  | 'permanent'
  | 'unknown';

export type CommandAcceptanceFailure = Readonly<{
  code: 'acceptance-aborted' | 'rollback-unconfirmed';
  point: CommandAcceptanceFaultPoint;
  transactionId: number;
  rollback: 'complete' | 'unconfirmed';
  retryability: CommandAcceptanceRetryability;
  message: string;
}>;

// Explicit error types let a target distinguish a temporary acceptance
// failure from a permanent invalid request. The delivery coordinator still
// queries the target before classifying the command as Retryable.
export class TemporaryCommandAcceptanceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TemporaryCommandAcceptanceError';
  }
}

export class PermanentCommandAcceptanceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermanentCommandAcceptanceError';
  }
}

export type CommandAcceptanceResult =
  | Readonly<{
    status: 'accepted';
    disposition: 'committed' | 'duplicate';
    record: AcceptedCommandRecord;
    intent: TransactionCreationIntent;
  }>
  | Readonly<{
    status: 'rejected';
    reason:
      | 'invalid-command'
      | 'runtime-mismatch'
      | 'target-mismatch'
      | 'capacity'
      | 'transaction-id-exhausted';
    message: string;
  }>
  | Readonly<{
    status: 'failed';
    failure: CommandAcceptanceFailure;
  }>
  | Readonly<{
    status: 'blocked';
    failure: CommandAcceptanceFailure;
  }>;

export type AcceptedCommandQuery =
  | Readonly<{
    status: 'found';
    record: AcceptedCommandRecord;
    intent: TransactionCreationIntent;
  }>
  | Readonly<{ status: 'not-found'; commandId: number }>
  | Readonly<{
    status: 'blocked';
    failure: CommandAcceptanceFailure;
  }>
  | Readonly<{
    status: 'rejected';
    reason: 'invalid-command-id';
    message: string;
  }>;

export type TargetTransactionModuleSnapshot =
  | Readonly<{
    status: 'healthy';
    targetId: string;
    runtimeInstanceId: string;
    nextTransactionId: number | null;
    acceptedRecords: readonly AcceptedCommandRecord[];
    intents: readonly TransactionCreationIntent[];
    counts: Readonly<{
      acceptedRecords: number;
      intents: number;
      capacity: number;
      businessExecutions: 0;
    }>;
  }>
  | Readonly<{
    status: 'blocked';
    targetId: string;
    runtimeInstanceId: string;
    nextTransactionId: number | null;
    acceptedRecords: readonly [];
    intents: readonly [];
    diagnosticCommandIds: readonly number[];
    counts: Readonly<{
      acceptedRecords: 0;
      intents: 0;
      capacity: number;
      businessExecutions: 0;
    }>;
    failure: CommandAcceptanceFailure;
  }>;

export type TargetTransactionModuleOptions = Readonly<{
  capacity?: number;
  faultInjector?: CommandAcceptanceFaultInjector;
  rollbackFaultInjector?: CommandRollbackFaultInjector;
}>;

const DEFAULT_RECORD_CAPACITY = 1024;
const IDENTIFIER_PATTERN =
  /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;

class MonotonicIdGenerator {
  #lastAllocated: number;

  constructor(initialNextId: number, label: string) {
    if (!Number.isSafeInteger(initialNextId) || initialNextId < 1) {
      throw new RangeError(`${label} must be a positive safe integer.`);
    }
    this.#lastAllocated = initialNextId - 1;
  }

  allocate(): number | undefined {
    if (this.#lastAllocated >= Number.MAX_SAFE_INTEGER) return undefined;
    this.#lastAllocated += 1;
    return this.#lastAllocated;
  }

  get nextId(): number | null {
    return this.#lastAllocated >= Number.MAX_SAFE_INTEGER
      ? null
      : this.#lastAllocated + 1;
  }
}

// The runtime context owns one instance. Event IDs live in events.ts while
// Command and Transaction IDs use these separate monotonic sequences.
export class RuntimeBusinessIdentityInfrastructure {
  readonly runtimeInstanceId: string;
  readonly #commandIds: MonotonicIdGenerator;
  readonly #transactionIds: MonotonicIdGenerator;

  constructor(
    runtimeInstanceId: string,
    options: RuntimeBusinessIdentityOptions = {},
  ) {
    this.runtimeInstanceId = runtimeInstanceId;
    this.#commandIds = new MonotonicIdGenerator(
      options.initialNextCommandId ?? 1,
      'initialNextCommandId',
    );
    this.#transactionIds = new MonotonicIdGenerator(
      options.initialNextTransactionId ?? 1,
      'initialNextTransactionId',
    );
  }

  allocateCommandId(): number | undefined {
    return this.#commandIds.allocate();
  }

  allocateTransactionId(): number | undefined {
    return this.#transactionIds.allocate();
  }

  get snapshot(): RuntimeBusinessIdentitySnapshot {
    return Object.freeze({
      runtimeInstanceId: this.runtimeInstanceId,
      nextCommandId: this.#commandIds.nextId,
      nextTransactionId: this.#transactionIds.nextId,
    });
  }
}

type StoredCommand = Readonly<{
  command: EventCommand;
  fingerprint: string;
}>;

// One coordinator per runtime context owns the Event-to-Command cardinality.
// Target modules receive commands through this authority and own their records.
export class CommandCreationCoordinator {
  readonly #identities: RuntimeBusinessIdentityInfrastructure;
  readonly #eventSource: CommandEventSource;
  readonly #capacity: number;
  readonly #commandsByEventId = new Map<number, StoredCommand>();
  readonly #issuedCommands = new WeakSet<object>();
  readonly #targets = new Map<string, TargetTransactionModule>();

  constructor(
    identities: RuntimeBusinessIdentityInfrastructure,
    eventSource: CommandEventSource,
    options: Readonly<{ capacity?: number }> = {},
  ) {
    this.#identities = identities;
    this.#eventSource = eventSource;
    this.#capacity = normalizeCapacity(
      options.capacity ?? DEFAULT_RECORD_CAPACITY,
      'Command creation capacity',
    );
  }

  createCommand(request: CommandCreationRequest): CommandCreationResult {
    const normalized = normalizeCommandRequest(request);
    if (!normalized.ok) {
      return rejectedCommand(normalized.reason, normalized.message);
    }

    const { sourceEvent, targetId, commandType, payload } = normalized.value;
    const inspection = this.#inspectSourceEvent(sourceEvent);
    if (inspection.status !== 'registered') {
      return rejectedCommand(inspection.reason, inspection.message);
    }

    const fingerprint = commandFingerprint(targetId, commandType, payload);
    const existing = this.#commandsByEventId.get(sourceEvent.eventId);
    if (existing) {
      if (existing.fingerprint !== fingerprint) {
        return rejectedCommand(
          'second-command',
          'A source event may create at most one stable command.',
        );
      }
      return Object.freeze({
        status: 'created' as const,
        disposition: 'existing' as const,
        command: existing.command,
      });
    }

    if (this.#commandsByEventId.size >= this.#capacity) {
      return rejectedCommand(
        'command-capacity',
        'Command identity capacity is full.',
      );
    }

    const commandId = this.#identities.allocateCommandId();
    if (commandId === undefined) {
      return rejectedCommand(
        'command-id-exhausted',
        'The runtime Command ID sequence is exhausted.',
      );
    }

    const command: EventCommand = deepFreeze({
      runtimeInstanceId: this.#identities.runtimeInstanceId,
      eventId: sourceEvent.eventId,
      commandId,
      targetId,
      type: commandType,
      payload,
    });
    this.#issuedCommands.add(command);
    this.#commandsByEventId.set(sourceEvent.eventId, Object.freeze({
      command,
      fingerprint,
    }));
    return Object.freeze({
      status: 'created' as const,
      disposition: 'created' as const,
      command,
    });
  }

  createTargetTransactionModule(
    targetId: string,
    options: TargetTransactionModuleOptions = {},
  ): TargetTransactionModule {
    if (typeof targetId !== 'string' || !IDENTIFIER_PATTERN.test(targetId)) {
      throw new TypeError('targetId must be a non-empty stable identifier.');
    }
    if (this.#targets.has(targetId)) {
      throw new Error(`Target transaction module "${targetId}" already exists.`);
    }
    const target = new TargetTransactionModule(
      this.#identities,
      targetId,
      command => this.#issuedCommands.has(command as object),
      options,
    );
    this.#targets.set(targetId, target);
    return target;
  }

  get snapshot(): CommandCreationCoordinatorSnapshot {
    const commands = Object.freeze([...this.#commandsByEventId.values()]
      .map(stored => stored.command));
    const targetIds = Object.freeze([...this.#targets.keys()].sort());
    return Object.freeze({
      runtimeInstanceId: this.#identities.runtimeInstanceId,
      commandIds: Object.freeze({
        nextId: this.#identities.snapshot.nextCommandId,
      }),
      transactionIds: Object.freeze({
        nextId: this.#identities.snapshot.nextTransactionId,
      }),
      commands,
      targetIds,
      counts: Object.freeze({
        commands: commands.length,
        targets: targetIds.length,
        capacity: this.#capacity,
      }),
    });
  }

  #inspectSourceEvent(event: CommandSourceEvent): CommandSourceInspection {
    try {
      return this.#eventSource.inspectCommandSource(event);
    } catch (error) {
      return Object.freeze({
        status: 'rejected' as const,
        reason: 'invalid-source-event' as const,
        message: `Source event could not be inspected: ${toMessage(error)}`,
      });
    }
  }
}

type StoredAcceptance = Readonly<{
  command: EventCommand;
  record: AcceptedCommandRecord;
  intent: TransactionCreationIntent;
}>;

// Each target owns its own idempotent acceptance map. Receipt and intent are
// projected from one stored value so no externally visible half-record exists.
export class TargetTransactionModule {
  readonly targetId: string;
  readonly #identities: RuntimeBusinessIdentityInfrastructure;
  readonly #acceptsIssuedCommand: (command: EventCommand) => boolean;
  readonly #capacity: number;
  readonly #faultInjector: CommandAcceptanceFaultInjector | undefined;
  readonly #rollbackFaultInjector: CommandRollbackFaultInjector | undefined;
  readonly #acceptedByCommandId = new Map<number, StoredAcceptance>();
  #blockedFailure: CommandAcceptanceFailure | undefined;
  #lastFailure: CommandAcceptanceFailure | undefined;

  constructor(
    identities: RuntimeBusinessIdentityInfrastructure,
    targetId: string,
    acceptsIssuedCommand: (command: EventCommand) => boolean,
    options: TargetTransactionModuleOptions,
  ) {
    this.targetId = targetId;
    this.#identities = identities;
    this.#acceptsIssuedCommand = acceptsIssuedCommand;
    this.#capacity = normalizeCapacity(
      options.capacity ?? DEFAULT_RECORD_CAPACITY,
      'Target transaction module capacity',
    );
    this.#faultInjector = options.faultInjector;
    this.#rollbackFaultInjector = options.rollbackFaultInjector;
  }

  accept(command: EventCommand): CommandAcceptanceResult {
    if (this.#blockedFailure) {
      return blockedAcceptance(this.#blockedFailure);
    }
    if (!this.#isCanonicalCommand(command)) {
      return rejectedAcceptance(
        'invalid-command',
        'Command is not an immutable command issued by this runtime.',
      );
    }
    if (command.runtimeInstanceId !== this.#identities.runtimeInstanceId) {
      return rejectedAcceptance(
        'runtime-mismatch',
        'Command belongs to another runtime instance.',
      );
    }
    if (command.targetId !== this.targetId) {
      return rejectedAcceptance(
        'target-mismatch',
        'Command targets a different transaction module.',
      );
    }

    const existing = this.#acceptedByCommandId.get(command.commandId);
    if (existing) {
      if (existing.command !== command) {
        return rejectedAcceptance(
          'invalid-command',
          'Command identity was reused by a different immutable command.',
        );
      }
      return Object.freeze({
        status: 'accepted' as const,
        disposition: 'duplicate' as const,
        record: existing.record,
        intent: existing.intent,
      });
    }
    if (this.#acceptedByCommandId.size >= this.#capacity) {
      return rejectedAcceptance(
        'capacity',
        'The target transaction module has no acceptance capacity.',
      );
    }

    return this.#commitAcceptance(command);
  }

  query(commandId: number): AcceptedCommandQuery {
    if (this.#blockedFailure) {
      return Object.freeze({
        status: 'blocked' as const,
        failure: this.#blockedFailure,
      });
    }
    if (!Number.isSafeInteger(commandId) || commandId < 1) {
      return Object.freeze({
        status: 'rejected' as const,
        reason: 'invalid-command-id' as const,
        message: 'Command ID must be a positive safe integer.',
      });
    }
    const existing = this.#acceptedByCommandId.get(commandId);
    if (!existing) {
      return Object.freeze({
        status: 'not-found' as const,
        commandId,
      });
    }
    return Object.freeze({
      status: 'found' as const,
      record: existing.record,
      intent: existing.intent,
    });
  }

  get snapshot(): TargetTransactionModuleSnapshot {
    const nextTransactionId = this.#identities.snapshot.nextTransactionId;
    if (this.#blockedFailure) {
      return Object.freeze({
        status: 'blocked' as const,
        targetId: this.targetId,
        runtimeInstanceId: this.#identities.runtimeInstanceId,
        nextTransactionId,
        acceptedRecords: Object.freeze([]) as readonly [],
        intents: Object.freeze([]) as readonly [],
        diagnosticCommandIds: Object.freeze(
          [...this.#acceptedByCommandId.keys()].sort((left, right) => left - right),
        ),
        counts: Object.freeze({
          acceptedRecords: 0 as const,
          intents: 0 as const,
          capacity: this.#capacity,
          businessExecutions: 0 as const,
        }),
        failure: this.#blockedFailure,
      });
    }
    const stored = [...this.#acceptedByCommandId.values()];
    const acceptedRecords = Object.freeze(stored.map(item => item.record));
    const intents = Object.freeze(stored.map(item => item.intent));
    return Object.freeze({
      status: 'healthy' as const,
      targetId: this.targetId,
      runtimeInstanceId: this.#identities.runtimeInstanceId,
      nextTransactionId,
      acceptedRecords,
      intents,
      counts: Object.freeze({
        acceptedRecords: acceptedRecords.length,
        intents: intents.length,
        capacity: this.#capacity,
        businessExecutions: 0 as const,
      }),
      ...(this.#lastFailure ? { lastFailure: this.#lastFailure } : {}),
    });
  }

  #commitAcceptance(command: EventCommand): CommandAcceptanceResult {
    const transactionId = this.#identities.allocateTransactionId();
    if (transactionId === undefined) {
      return rejectedAcceptance(
        'transaction-id-exhausted',
        'The runtime Transaction ID sequence is exhausted.',
      );
    }

    let point: CommandAcceptanceFaultPoint = 'transaction-id-allocated';
    try {
      this.#fault(point);
      point = 'receipt-prepared';
      const record: AcceptedCommandRecord = deepFreeze({
        status: 'accepted',
        runtimeInstanceId: this.#identities.runtimeInstanceId,
        commandId: command.commandId,
        eventId: command.eventId,
        targetId: command.targetId,
        commandType: command.type,
        payload: command.payload,
      });
      const intent: TransactionCreationIntent = deepFreeze({
        status: 'intent-created',
        executionState: 'not-started',
        runtimeInstanceId: this.#identities.runtimeInstanceId,
        transactionId,
        commandId: command.commandId,
        eventId: command.eventId,
        targetId: command.targetId,
        commandType: command.type,
        payload: command.payload,
      });
      const stored: StoredAcceptance = Object.freeze({ command, record, intent });
      this.#fault(point);

      point = 'before-atomic-commit';
      this.#fault(point);
      this.#acceptedByCommandId.set(command.commandId, stored);

      point = 'after-atomic-commit';
      this.#fault(point);
      this.#lastFailure = undefined;
      return Object.freeze({
        status: 'accepted' as const,
        disposition: 'committed' as const,
        record,
        intent,
      });
    } catch (error) {
      return this.#rollbackAcceptance(command.commandId, transactionId, point, error);
    }
  }

  #rollbackAcceptance(
    commandId: number,
    transactionId: number,
    point: CommandAcceptanceFaultPoint,
    cause: unknown,
  ): CommandAcceptanceResult {
    try {
      this.#rollbackFaultInjector?.('before-rollback');
      this.#acceptedByCommandId.delete(commandId);
    } catch (rollbackError) {
      const failure: CommandAcceptanceFailure = Object.freeze({
        code: 'rollback-unconfirmed' as const,
        point,
        transactionId,
        rollback: 'unconfirmed' as const,
        retryability: 'unknown' as const,
        message:
          `Acceptance failed at ${point}: ${toMessage(cause)}; ` +
          `rollback could not be confirmed: ${toMessage(rollbackError)}`,
      });
      this.#blockedFailure = failure;
      return blockedAcceptance(failure);
    }

    const failure: CommandAcceptanceFailure = Object.freeze({
      code: 'acceptance-aborted' as const,
      point,
      transactionId,
      rollback: 'complete' as const,
      retryability: classifyAcceptanceFailure(cause),
      message: `Acceptance failed at ${point}: ${toMessage(cause)}`,
    });
    this.#lastFailure = failure;
    return Object.freeze({
      status: 'failed' as const,
      failure,
    });
  }

  #fault(point: CommandAcceptanceFaultPoint): void {
    this.#faultInjector?.(point);
  }

  #isCanonicalCommand(command: EventCommand): boolean {
    if (command === null || typeof command !== 'object') return false;
    try {
      return Number.isSafeInteger(command.commandId) &&
        Number.isSafeInteger(command.eventId) &&
        command.commandId > 0 &&
        command.eventId > 0 &&
        this.#acceptsIssuedCommand(command);
    } catch {
      return false;
    }
  }
}

type NormalizedCommandRequest =
  | Readonly<{
    ok: true;
    value: Readonly<{
      sourceEvent: CommandSourceEvent;
      targetId: string;
      commandType: string;
      payload: CommandPayload;
    }>;
  }>
  | Readonly<{
    ok: false;
    reason:
      | 'invalid-request'
      | 'invalid-source-event'
      | 'invalid-target'
      | 'invalid-command-type'
      | 'invalid-payload';
    message: string;
  }>;

function normalizeCommandRequest(request: CommandCreationRequest): NormalizedCommandRequest {
  let sourceEvent: unknown;
  let targetId: unknown;
  let commandType: unknown;
  let payload: unknown;
  try {
    if (!isPlainRecord(request)) {
      return invalidCommandRequest('invalid-request', 'Command request must be a plain object.');
    }
    sourceEvent = request.sourceEvent;
    targetId = request.targetId;
    commandType = request.commandType;
    payload = request.payload;
  } catch {
    return invalidCommandRequest(
      'invalid-request',
      'Command request fields could not be read.',
    );
  }
  if (!isPlainRecord(sourceEvent) ||
      typeof sourceEvent.runtimeInstanceId !== 'string' ||
      sourceEvent.status !== 'pending') {
    return invalidCommandRequest(
      'invalid-source-event',
      'sourceEvent must be a registered Pending event envelope.',
    );
  }
  if (typeof targetId !== 'string' || !IDENTIFIER_PATTERN.test(targetId)) {
    return invalidCommandRequest(
      'invalid-target',
      'targetId must be a stable lower-case identifier.',
    );
  }
  if (typeof commandType !== 'string' || !IDENTIFIER_PATTERN.test(commandType)) {
    return invalidCommandRequest(
      'invalid-command-type',
      'commandType must be a stable lower-case identifier.',
    );
  }
  const normalizedPayload = cloneAndFreezeJsonRecord(payload);
  if (!normalizedPayload) {
    return invalidCommandRequest(
      'invalid-payload',
      'payload must be a finite, acyclic JSON record.',
    );
  }
  return Object.freeze({
    ok: true as const,
    value: Object.freeze({
      sourceEvent: sourceEvent as CommandSourceEvent,
      targetId,
      commandType,
      payload: normalizedPayload,
    }),
  });
}

function invalidCommandRequest(
  reason: Extract<NormalizedCommandRequest, { ok: false }>['reason'],
  message: string,
): NormalizedCommandRequest {
  return Object.freeze({ ok: false as const, reason, message });
}

function commandFingerprint(
  targetId: string,
  commandType: string,
  payload: CommandPayload,
): string {
  return `${targetId}\n${commandType}\n${stableSerialize(payload)}`;
}

function rejectedCommand(
  reason: Extract<CommandCreationResult, { status: 'rejected' }>['reason'],
  message: string,
): CommandCreationResult {
  return Object.freeze({
    status: 'rejected' as const,
    reason,
    message,
  });
}

function rejectedAcceptance(
  reason: Extract<CommandAcceptanceResult, { status: 'rejected' }>['reason'],
  message: string,
): CommandAcceptanceResult {
  return Object.freeze({
    status: 'rejected' as const,
    reason,
    message,
  });
}

function blockedAcceptance(
  failure: CommandAcceptanceFailure,
): CommandAcceptanceResult {
  return Object.freeze({
    status: 'blocked' as const,
    failure,
  });
}

function classifyAcceptanceFailure(
  cause: unknown,
): CommandAcceptanceRetryability {
  if (cause instanceof TemporaryCommandAcceptanceError) return 'temporary';
  if (cause instanceof PermanentCommandAcceptanceError) return 'permanent';
  return 'unknown';
}

function normalizeCapacity(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive safe integer.`);
  }
  return value;
}

function cloneAndFreezeJsonRecord(value: unknown): CommandPayload | undefined {
  if (!isPlainRecord(value)) return undefined;
  try {
    const cloned = cloneJsonValue(value, new Set<object>());
    return isPlainRecord(cloned) ? deepFreeze(cloned) : undefined;
  } catch {
    return undefined;
  }
}

function cloneJsonValue(value: unknown, seen: Set<object>): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Non-finite number.');
    return value;
  }
  if (typeof value !== 'object' || seen.has(value)) {
    throw new TypeError('Unsupported or cyclic JSON value.');
  }
  seen.add(value);
  let cloned: unknown;
  if (Array.isArray(value)) {
    cloned = value.map(item => cloneJsonValue(item, seen));
  } else {
    if (!isPlainRecord(value) || Object.getOwnPropertySymbols(value).length > 0) {
      throw new TypeError('Payload records must be plain objects.');
    }
    const record: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      record[key] = cloneJsonValue(item, seen);
    }
    cloned = record;
  }
  seen.delete(value);
  return cloned;
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

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
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
