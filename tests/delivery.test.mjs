import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import {
  PermanentCommandAcceptanceError,
  TemporaryCommandAcceptanceError,
} from '../src/core/commands.ts';
import { RuntimeEventContext } from '../src/core/events.ts';

const UUID = '70000000-0000-4000-8000-000000000001';
const TARGET = 'door.transaction';

function makeRealRuntime(options = {}) {
  let target;
  const handlerCounts = new Map();
  let deliveryFaultPoint;
  const context = new RuntimeEventContext(
    { generate: () => UUID },
    { initialNextEventId: 1, initialNextCommandId: 1, initialNextTransactionId: 1 },
  );
  const events = context.createCoordinator({
    inboxCapacity: 32,
    historyCapacity: 64,
    allowedEventTypes: ['test.progress', 'test.follow-up'],
    realCommandDelivery: {
      capacity: options.deliveryCapacity ?? 32,
      faultInjector: point => {
        if (point === deliveryFaultPoint) {
          deliveryFaultPoint = undefined;
          throw new Error(`injected delivery fault at ${point}`);
        }
      },
      handler: (event, dispatchContext) => {
        handlerCounts.set(
          event.eventId,
          (handlerCounts.get(event.eventId) ?? 0) + 1,
        );
        if (options.handler) {
          return options.handler(event, dispatchContext);
        }
        return {
          sourceEvent: event,
          targetId: TARGET,
          commandType: 'test.open-door',
          payload: { event: event.eventId },
        };
      },
      targetFor: targetId => targetId === target?.targetId ? target : undefined,
    },
  });
  const commands = events.createCommandCoordinator({ capacity: 32 });
  target = commands.createTargetTransactionModule(TARGET, {
    capacity: options.targetCapacity ?? 32,
    ...(options.targetFaultInjector
      ? { faultInjector: options.targetFaultInjector }
      : {}),
    ...(options.targetRollbackFaultInjector
      ? { rollbackFaultInjector: options.targetRollbackFaultInjector }
      : {}),
  });
  if (options.wrapTarget) target = options.wrapTarget(target);

  return {
    context,
    events,
    commands,
    target,
    handlerCounts,
    armDeliveryFault(point) {
      deliveryFaultPoint = point;
    },
  };
}

function createEvent(events, payload = { value: 1 }, producer) {
  const created = events.create(
    { type: 'test.progress', payload },
    producer,
  );
  assert.equal(created.status, 'created');
  return created.event;
}

function dispatch(events, simulationTick, retryDeliveryEventIds) {
  return events.dispatch({
    runtimeInstanceId: UUID,
    simulationTick,
    phase: 'coordination',
    ...(retryDeliveryEventIds
      ? { retryDeliveryEventIds }
      : {}),
  });
}

test('D09-B2 E01 real target acceptance completes the original event without business execution', () => {
  const runtime = makeRealRuntime();
  const producer = runtime.events.createProducer();
  const event = createEvent(runtime.events, { value: 'real' }, producer);

  const result = dispatch(runtime.events, 1);
  assert.equal(result.status, 'completed');
  assert.deepEqual(result.progress.completedEventIds, [event.eventId]);
  assert.deepEqual(result.progress.delivery, {
    acceptedEventIds: [event.eventId],
    retryableEventIds: [],
    rejectedEventIds: [],
    unknownEventIds: [],
    reconciledEventIds: [],
    retriedEventIds: [],
  });

  const lifecycle = runtime.events.snapshot.lifecycleRecords[0];
  assert.equal(lifecycle.status, 'completed');
  assert.deepEqual(lifecycle.realCommand, {
    commandId: 1,
    targetId: TARGET,
    transactionId: 1,
  });
  assert.equal(lifecycle.testCommandReference, undefined);
  assert.equal(runtime.handlerCounts.get(event.eventId), 1);

  const delivery = runtime.events.snapshot.delivery.records[0];
  assert.equal(delivery.status, 'accepted');
  assert.equal(delivery.acceptanceAttempts, 1);
  assert.equal(delivery.reconciliationQueries, 0);

  const target = runtime.target.snapshot;
  assert.equal(target.status, 'healthy');
  assert.equal(target.counts.acceptedRecords, 1);
  assert.equal(target.counts.intents, 1);
  assert.equal(target.counts.businessExecutions, 0);
  assert.equal(runtime.commands.snapshot.transactionIds.nextId, 2);

  const final = runtime.events.readFinalResult(producer, event.eventId);
  assert.equal(final.status, 'available');
  assert.deepEqual(final.result.realCommand, {
    commandId: 1,
    targetId: TARGET,
    transactionId: 1,
  });
  assert.equal(final.result.testCommandReference, undefined);
});

test('D09-B2 E02 Accepted, Retryable, Rejected and Unknown follow distinct evidence', () => {
  let acceptanceNumber = 0;
  const runtime = makeRealRuntime({
    targetFaultInjector: point => {
      if (point !== 'before-atomic-commit') return;
      acceptanceNumber += 1;
      if (acceptanceNumber === 2) {
        throw new TemporaryCommandAcceptanceError('test temporary failure');
      }
      if (acceptanceNumber === 3) {
        throw new PermanentCommandAcceptanceError('test permanent failure');
      }
      if (acceptanceNumber === 4) {
        throw new Error('test unclassified failure');
      }
    },
  });
  createEvent(runtime.events, { value: 'accepted' });
  createEvent(runtime.events, { value: 'temporary' });
  createEvent(runtime.events, { value: 'permanent' });
  createEvent(runtime.events, { value: 'unknown' });

  assert.equal(dispatch(runtime.events, 1).status, 'completed');
  assert.deepEqual(
    runtime.events.snapshot.delivery.records.map(record => record.status),
    ['accepted', 'retryable', 'rejected', 'unknown'],
  );
  assert.deepEqual(
    runtime.events.snapshot.lifecycleRecords.map(record => record.status),
    ['completed', 'processing', 'processing', 'processing'],
  );
  assert.equal(
    runtime.events.snapshot.delivery.records[1].reconciliationQueries,
    1,
  );
  assert.equal(
    runtime.events.snapshot.delivery.records[2].reconciliationQueries,
    1,
  );
  assert.equal(
    runtime.events.snapshot.delivery.records[3].reconciliationQueries,
    0,
  );
  assert.equal(runtime.target.snapshot.counts.acceptedRecords, 1);
  assert.equal(runtime.target.snapshot.counts.intents, 1);
  assert.equal(runtime.commands.snapshot.transactionIds.nextId, 5);
  assert.deepEqual([...runtime.handlerCounts.values()], [1, 1, 1, 1]);
});

test('D09-B2 E03 a lost receipt stays Unknown until query confirms the original transaction intent', () => {
  const runtime = makeRealRuntime();
  const producer = runtime.events.createProducer();
  const event = createEvent(runtime.events, { value: 'lost-receipt' }, producer);
  runtime.armDeliveryFault('after-target-accept-returned');

  const first = dispatch(runtime.events, 1);
  assert.equal(first.status, 'completed');
  assert.deepEqual(first.progress.delivery.unknownEventIds, [event.eventId]);
  assert.equal(runtime.events.snapshot.lifecycleRecords[0].status, 'processing');
  assert.equal(runtime.target.snapshot.counts.acceptedRecords, 1);
  assert.equal(runtime.target.snapshot.counts.intents, 1);
  assert.equal(runtime.commands.snapshot.commandIds.nextId, 2);
  assert.equal(runtime.commands.snapshot.transactionIds.nextId, 2);
  const initialDelivery = runtime.events.snapshot.delivery.records[0];
  assert.equal(initialDelivery.status, 'unknown');
  assert.equal(initialDelivery.acceptanceAttempts, 1);
  assert.equal(initialDelivery.reconciliationQueries, 0);

  const second = dispatch(runtime.events, 2);
  assert.equal(second.status, 'completed');
  assert.deepEqual(second.progress.delivery.reconciledEventIds, [event.eventId]);
  assert.deepEqual(second.progress.delivery.acceptedEventIds, [event.eventId]);
  assert.equal(runtime.events.snapshot.lifecycleRecords[0].status, 'completed');
  assert.equal(runtime.handlerCounts.get(event.eventId), 1);
  assert.equal(runtime.target.snapshot.counts.acceptedRecords, 1);
  assert.equal(runtime.target.snapshot.counts.intents, 1);
  assert.equal(runtime.commands.snapshot.commandIds.nextId, 2);
  assert.equal(runtime.commands.snapshot.transactionIds.nextId, 2);

  const reconciled = runtime.events.snapshot.delivery.records[0];
  assert.equal(reconciled.status, 'accepted');
  assert.equal(reconciled.acceptanceAttempts, 1);
  assert.equal(reconciled.reconciliationQueries, 1);
  const final = runtime.events.readFinalResult(producer, event.eventId);
  assert.equal(final.status, 'available');
  assert.deepEqual(final.result.realCommand, {
    commandId: 1,
    targetId: TARGET,
    transactionId: 1,
  });
});

test('D09-B2 E04 only confirmed temporary non-acceptance is explicitly retryable', () => {
  let failOnce = true;
  const runtime = makeRealRuntime({
    targetFaultInjector: point => {
      if (failOnce && point === 'before-atomic-commit') {
        failOnce = false;
        throw new TemporaryCommandAcceptanceError('temporary target outage');
      }
    },
  });
  const event = createEvent(runtime.events, { value: 'retry' });

  dispatch(runtime.events, 1);
  assert.equal(runtime.events.snapshot.delivery.records[0].status, 'retryable');
  assert.equal(runtime.target.snapshot.counts.intents, 0);
  assert.equal(runtime.commands.snapshot.transactionIds.nextId, 2);

  const notRequested = dispatch(runtime.events, 2);
  assert.equal(notRequested.status, 'completed');
  assert.deepEqual(notRequested.progress.delivery.retryableEventIds, [event.eventId]);
  assert.equal(runtime.events.snapshot.delivery.records[0].acceptanceAttempts, 1);

  const retried = dispatch(runtime.events, 3, [event.eventId]);
  assert.equal(retried.status, 'completed');
  assert.deepEqual(retried.progress.delivery.retriedEventIds, [event.eventId]);
  assert.equal(runtime.events.snapshot.lifecycleRecords[0].status, 'completed');
  assert.equal(runtime.handlerCounts.get(event.eventId), 1);
  assert.equal(runtime.target.snapshot.counts.acceptedRecords, 1);
  assert.equal(runtime.target.snapshot.counts.intents, 1);
  assert.equal(runtime.commands.snapshot.commandIds.nextId, 2);
  assert.equal(runtime.commands.snapshot.transactionIds.nextId, 3);
  const record = runtime.events.snapshot.delivery.records[0];
  assert.equal(record.status, 'accepted');
  assert.equal(record.acceptanceAttempts, 2);

  const permanentlyRejected = makeRealRuntime({
    targetFaultInjector: point => {
      if (point === 'before-atomic-commit') {
        throw new PermanentCommandAcceptanceError('invalid command contract');
      }
    },
  });
  const rejectedEvent = createEvent(permanentlyRejected.events, { value: 'rejected' });
  dispatch(permanentlyRejected.events, 1);
  assert.equal(
    permanentlyRejected.events.snapshot.delivery.records[0].status,
    'rejected',
  );
  const forbiddenRetry = dispatch(
    permanentlyRejected.events,
    2,
    [rejectedEvent.eventId],
  );
  assert.equal(
    forbiddenRetry.status === 'rejected'
      ? forbiddenRetry.reason
      : forbiddenRetry.status,
    'retry-not-allowed',
  );
  assert.equal(permanentlyRejected.handlerCounts.get(rejectedEvent.eventId), 1);
});

test('D09-B2 E04 query errors, blocked targets and association mismatches remain Unknown', () => {
  const thrownAcceptance = makeRealRuntime({
    wrapTarget: target => ({
      targetId: target.targetId,
      accept: () => {
        throw new Error('injected accept call failure');
      },
      query: commandId => target.query(commandId),
    }),
  });
  createEvent(thrownAcceptance.events, { value: 'accept-call-failure' });
  dispatch(thrownAcceptance.events, 1);
  dispatch(thrownAcceptance.events, 2);
  assert.equal(
    thrownAcceptance.events.snapshot.delivery.records[0].status,
    'unknown',
  );
  assert.equal(
    thrownAcceptance.events.snapshot.delivery.records[0].reasonCode,
    'not-found-without-classification',
  );

  const queryFailure = makeRealRuntime({
    wrapTarget: target => ({
      targetId: target.targetId,
      accept: command => target.accept(command),
      query: () => {
        throw new Error('injected query failure');
      },
    }),
  });
  const queryEvent = createEvent(queryFailure.events, { value: 'query-failure' });
  queryFailure.armDeliveryFault('after-target-accept-returned');
  dispatch(queryFailure.events, 1);
  dispatch(queryFailure.events, 2);
  assert.equal(queryFailure.events.snapshot.delivery.records[0].status, 'unknown');
  assert.equal(
    queryFailure.events.snapshot.delivery.records[0].reconciliationQueries,
    1,
  );
  assert.equal(queryFailure.handlerCounts.get(queryEvent.eventId), 1);

  const mismatch = makeRealRuntime({
    wrapTarget: target => ({
      targetId: target.targetId,
      accept: command => target.accept(command),
      query: commandId => {
        const result = target.query(commandId);
        if (result.status !== 'found') return result;
        return {
          ...result,
          record: {
            ...result.record,
            eventId: result.record.eventId + 1,
          },
        };
      },
    }),
  });
  createEvent(mismatch.events, { value: 'association-mismatch' });
  mismatch.armDeliveryFault('after-target-accept-returned');
  dispatch(mismatch.events, 1);
  dispatch(mismatch.events, 2);
  assert.equal(mismatch.events.snapshot.delivery.records[0].status, 'unknown');
  assert.equal(
    mismatch.events.snapshot.delivery.records[0].reasonCode,
    'reconciliation-association-invalid',
  );

  const blocked = makeRealRuntime({
    targetFaultInjector: point => {
      if (point === 'before-atomic-commit') {
        throw new TemporaryCommandAcceptanceError('acceptance interrupted');
      }
    },
    targetRollbackFaultInjector: () => {
      throw new Error('injected rollback uncertainty');
    },
  });
  createEvent(blocked.events, { value: 'blocked-query' });
  dispatch(blocked.events, 1);
  dispatch(blocked.events, 2);
  assert.equal(blocked.events.snapshot.delivery.records[0].status, 'unknown');
  assert.equal(
    blocked.events.snapshot.delivery.records[0].reasonCode,
    'reconciliation-blocked',
  );
});

test('D09-B2 E05 real dispatch keeps fixed batches, avoids replay and bounds delivery records', () => {
  let events;
  let nested;
  const runtime = makeRealRuntime({
    handler: (event, dispatchContext) => {
      if (event.payload.role === 'root') {
        assert.equal(
          dispatchContext.create({
            type: 'test.follow-up',
            payload: { role: 'follow-up' },
          }).status,
          'created',
        );
        nested = events.dispatch({
          runtimeInstanceId: UUID,
          simulationTick: 2,
          phase: 'coordination',
        });
      }
      return {
        sourceEvent: event,
        targetId: TARGET,
        commandType: `test.command-${event.eventId}`,
        payload: { event: event.eventId },
      };
    },
  });
  events = runtime.events;
  const producer = events.createProducer();
  const root = createEvent(events, { role: 'root' }, producer);

  const first = dispatch(events, 1);
  assert.equal(first.status, 'completed');
  assert.equal(
    nested.status === 'rejected' ? nested.reason : nested.status,
    'recursive-dispatch',
  );
  assert.deepEqual(first.progress.completedEventIds, [root.eventId]);
  assert.deepEqual(
    events.snapshot.lifecycleRecords.map(record => record.status),
    ['completed', 'pending'],
  );
  assert.deepEqual(events.snapshot.inboxEvents.map(event => event.eventId), [2]);

  const second = dispatch(events, 2);
  assert.equal(second.status, 'completed');
  assert.deepEqual(second.progress.completedEventIds, [2]);
  assert.deepEqual(
    events.snapshot.lifecycleRecords.map(record => record.status),
    ['completed', 'completed'],
  );
  assert.deepEqual([...runtime.handlerCounts.values()], [1, 1]);

  const final = events.readFinalResult(producer, root.eventId);
  assert.equal(final.status, 'available');
  assert.equal(events.acknowledge(producer, final.result).status, 'acknowledged');
  assert.equal(events.retire(producer, final.result).status, 'retired');
  assert.equal(runtime.target.query(1).status, 'found');
  assert.equal(events.snapshot.delivery.records[0].status, 'accepted');

  const limited = makeRealRuntime({ deliveryCapacity: 1 });
  createEvent(limited.events, { value: 'first' });
  createEvent(limited.events, { value: 'second' });
  dispatch(limited.events, 1);
  assert.equal(limited.events.snapshot.delivery.counts.records, 1);
  assert.equal(limited.events.snapshot.delivery.counts.capacity, 1);
  assert.equal(limited.events.snapshot.delivery.capacityFailureCount, 1);
  assert.equal(limited.events.snapshot.delivery.lastCapacityFailureEventId, 2);
  assert.deepEqual(
    limited.events.snapshot.lifecycleRecords.map(record => record.status),
    ['completed', 'processing'],
  );
});

test('D09-B2 E06 real and test-double modes are explicit and delivery remains platform-neutral', async () => {
  const context = new RuntimeEventContext(
    { generate: () => UUID },
    {},
  );
  assert.throws(
    () => context.createCoordinator({
      inboxCapacity: 4,
      allowedEventTypes: ['test.progress'],
      dispatchHandler: () => {},
      commandReceiptTestDouble: () => ({
        status: 'accepted',
        testCommandReference: 'test-only',
      }),
      realCommandDelivery: {
        handler: event => ({
          sourceEvent: event,
          targetId: TARGET,
          commandType: 'test.open-door',
          payload: {},
        }),
        targetFor: () => undefined,
      },
    }),
    /mutually exclusive/,
  );

  const source = await readFile(
    new URL('../src/core/delivery.ts', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(
    source,
    /from\s+['"](?:node:|electron|phaser|fs|path|os|crypto)/,
  );
  assert.doesNotMatch(source, /\b(?:document|window|localStorage|sessionStorage)\b/);
});
