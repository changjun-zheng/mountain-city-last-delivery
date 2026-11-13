export const TRANSACTION_RESULT_EVENT_TYPE = 'transaction.result' as const;

export type TransactionFinalResult =
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

export type TransactionResultRequest = Readonly<{
  runtimeInstanceId: string;
  sourceEventId: number;
  commandId: number;
  transactionId: number;
  targetId: string;
  terminal: TransactionFinalResult;
}>;

export type TransactionResultAssociation = Readonly<
  TransactionResultRequest & {
    resultEventId: number;
  }
>;

export type TransactionResultLifecycle =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'retired';

export type TransactionResultEvent = Readonly<{
  eventId: number;
  runtimeInstanceId: string;
  type: typeof TRANSACTION_RESULT_EVENT_TYPE;
  payload: Readonly<Record<string, unknown>>;
  status: 'pending';
}>;

export type TransactionResultProducerHandle = Readonly<{
  producerId: string;
}>;

// The coordinator owns the actual object identity. A copied object with the
// same fields is not a valid transaction-result source capability.
export type TransactionResultSourceHandle = Readonly<{
  sourceId: string;
  runtimeInstanceId: string;
  targetId: string;
  producer: TransactionResultProducerHandle;
}>;

export type TransactionResultAuthorityRead =
  | Readonly<{ status: 'found'; request: TransactionResultRequest }>
  | Readonly<{
    status: 'not-found' | 'not-terminal';
    transactionId: number;
    message: string;
  }>;

export type TransactionResultAuthority =
  (transactionId: number) => TransactionResultAuthorityRead;

export type TransactionResultAuthorityRegistrationResult =
  | Readonly<{ status: 'registered' }>
  | Readonly<{
    status: 'rejected';
    reason: 'invalid-source' | 'invalid-authority' | 'already-registered';
    message: string;
  }>;

export type TransactionResultCreationResult =
  | Readonly<{
    status: 'created' | 'existing';
    event: TransactionResultEvent;
    association: TransactionResultAssociation;
    lifecycle: TransactionResultLifecycle;
    producerId: string;
  }>
  | Readonly<{
    status: 'unknown';
    transactionId: number;
    resultEventId: number;
    message: string;
  }>
  | Readonly<{
    status: 'rejected';
    reason:
      | 'invalid-source'
      | 'runtime-mismatch'
      | 'target-mismatch'
      | 'invalid-request'
      | 'invalid-terminal'
      | 'unsupported-event-type'
      | 'association-mismatch'
      | 'inbox-capacity'
      | 'history-capacity'
      | 'result-capacity'
      | 'event-id-exhausted'
      | 'transaction-aborted'
      | 'blocked';
    message: string;
  }>;

export type TransactionResultQuery =
  | Readonly<{
    status: 'found';
    event: TransactionResultEvent;
    association: TransactionResultAssociation;
    lifecycle: TransactionResultLifecycle;
    producerId: string;
  }>
  | Readonly<{
    status: 'not-found';
    transactionId: number;
  }>
  | Readonly<{
    status: 'rejected';
    reason: 'invalid-source' | 'runtime-mismatch' | 'target-mismatch' | 'invalid-input';
    message: string;
  }>;

export type TransactionResultConsumerContext = Readonly<{
  runtimeInstanceId: string;
  simulationTick: number;
  phase: 'coordination';
  event: TransactionResultEvent;
  association: TransactionResultAssociation;
}>;

export type TransactionResultConsumerResult =
  | Readonly<{ status: 'consumed' | 'already-consumed' }>
  | Readonly<{ status: 'failed'; message: string }>;

export type TransactionResultConsumer =
  (context: TransactionResultConsumerContext) => TransactionResultConsumerResult;

export interface TransactionResultEventPort {
  registerTransactionResultAuthority(
    source: TransactionResultSourceHandle,
    authority: TransactionResultAuthority,
  ): TransactionResultAuthorityRegistrationResult;
  requestTransactionResult(
    source: TransactionResultSourceHandle,
    transactionId: number,
  ): TransactionResultCreationResult;
  queryTransactionResult(
    source: TransactionResultSourceHandle,
    transactionId: number,
  ): TransactionResultQuery;
}

export function transactionResultRequestsEqual(
  left: TransactionResultRequest,
  right: TransactionResultRequest,
): boolean {
  return left.runtimeInstanceId === right.runtimeInstanceId &&
    left.sourceEventId === right.sourceEventId &&
    left.commandId === right.commandId &&
    left.transactionId === right.transactionId &&
    left.targetId === right.targetId &&
    left.terminal.status === right.terminal.status &&
    left.terminal.simulationTick === right.terminal.simulationTick &&
    (left.terminal.status !== 'failed' ||
      (right.terminal.status === 'failed' &&
        left.terminal.reasonCode === right.terminal.reasonCode &&
        left.terminal.message === right.terminal.message));
}
