import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RuntimeEventContext } from '../src/core/events.ts';

const UUID_A = '20000000-0000-4000-8000-000000000001';
const UUID_B = '20000000-0000-4000-8000-000000000002';
const EVENT_TYPES = Object.freeze([
  'test.progress',
  'test.diagnostic',
  'test.follow-up',
]);

function makeCoordinator(options = {}) {
  const context = new RuntimeEventContext(
    { generate: () => options.runtimeInstanceId ?? UUID_A },
    { initialNextEventId: options.initialNextEventId },
  );
  const coordinator = context.createCoordinator({
    inboxCapacity: options.inboxCapacity ?? 8,
    historyCapacity: options.historyCapacity ?? 16,
    allowedEventTypes: EVENT_TYPES,
    dispatchHandler: options.dispatchHandler ?? (() => {}),
    commandReceiptTestDouble: options.commandReceiptTestDouble ?? acceptingReceipt,
    retirementFaultInjector: options.retirementFaultInjector,
  });
  return { context, coordinator };
}

function acceptingReceipt(event) {
  return Object.freeze({
    status: 'accepted',
    testCommandReference: `test-command-${event.eventId}`,
  });
}

function request(payload = { value: 1 }, type = 'test.progress') {
  return { type, payload };
}

function createOwned(coordinator, producer, payload = { value: 1 }, type = 'test.progress') {
  const result = coordinator.create(request(payload, type), producer);
  assert.equal(result.status, 'created');
  return result.event;
}

function dispatch(coordinator, tick, runtimeInstanceId = UUID_A) {
  const result = coordinator.dispatch({
    runtimeInstanceId,
    simulationTick: tick,
    phase: 'coordination',
  });
  assert.equal(result.status, 'completed');
  return result;
}

function finalResult(coordinator, producer, eventId) {
  const read = coordinator.readFinalResult(producer, eventId);
  assert.equal(read.status, 'available');
  return read.result;
}

function acknowledge(coordinator, producer, result) {
  const acknowledged = coordinator.acknowledge(producer, result);
  assert.ok(
    acknowledged.status === 'acknowledged' ||
    acknowledged.status === 'already-acknowledged',
  );
  return acknowledged;
}

function retire(coordinator, producer, result) {
  const retired = coordinator.retire(producer, result);
  assert.equal(retired.status, 'retired');
  return retired;
}

test('D09-A3 C01 final results are producer-scoped and acknowledgement does not clean data', () => {
  const { coordinator } = makeCoordinator();
  const producerA = coordinator.createProducer();
  const producerB = coordinator.createProducer();
  const event = createOwned(coordinator, producerA, { value: 'owned-a' });
  dispatch(coordinator, 1);

  const otherRuntimeContext = new RuntimeEventContext(
    { generate: () => UUID_B },
  );
  const otherRuntimeCoordinator = otherRuntimeContext.createCoordinator({
    inboxCapacity: 2,
    allowedEventTypes: EVENT_TYPES,
  });
  const foreignProducer = otherRuntimeCoordinator.createProducer();
  const foreignCreate = coordinator.create(request(), foreignProducer);
  assert.equal(foreignCreate.status, 'rejected');
  assert.equal(foreignCreate.reason, 'invalid-producer');
  assert.equal(coordinator.snapshot.nextEventId, 2);

  const forgedProducer = coordinator.create(request(), {
    producerId: producerA.producerId,
  });
  assert.equal(forgedProducer.status, 'rejected');
  assert.equal(forgedProducer.reason, 'invalid-producer');
  assert.equal(coordinator.snapshot.nextEventId, 2);

  const wrongProducerRead = coordinator.readFinalResult(producerB, event.eventId);
  assert.equal(
    wrongProducerRead.status === 'rejected' ? wrongProducerRead.reason : wrongProducerRead.status,
    'producer-mismatch',
  );
  const foreignRead = coordinator.readFinalResult(foreignProducer, event.eventId);
  assert.equal(
    foreignRead.status === 'rejected' ? foreignRead.reason : foreignRead.status,
    'invalid-producer',
  );
  const unknownRead = coordinator.readFinalResult(producerA, 999);
  assert.equal(
    unknownRead.status === 'rejected' ? unknownRead.reason : unknownRead.status,
    'unknown-event',
  );
  assert.equal(coordinator.snapshot.lifecycleRecords[0].resultDelivered, undefined);

  const read = coordinator.readFinalResult(producerA, event.eventId);
  assert.equal(read.status, 'available');
  assert.equal(read.result.status, 'coordinated-completed');
  assert.equal(read.result.runtimeInstanceId, UUID_A);
  assert.equal(read.result.eventId, event.eventId);
  assert.equal(read.result.producerId, producerA.producerId);
  assert.equal(read.result.testCommandReference, 'test-command-1');
  assert.equal(Object.isFrozen(read.result), true);
  assert.equal(
    coordinator.readFinalResult(producerA, event.eventId).result,
    read.result,
    'Repeated final-result reads reuse one capability.',
  );

  const beforeAck = coordinator.snapshot;
  assert.equal(beforeAck.lifecycleRecords[0].resultDelivered, true);
  assert.equal(beforeAck.lifecycleRecords[0].acknowledged, undefined);
  assert.equal(beforeAck.counts.lifecycleRecords, 1);

  const earlyRetirement = coordinator.retire(producerA, read.result);
  assert.equal(
    earlyRetirement.status === 'rejected' ? earlyRetirement.reason : earlyRetirement.status,
    'not-acknowledged',
  );
  const wrongProducerAck = coordinator.acknowledge(producerB, read.result);
  assert.equal(
    wrongProducerAck.status === 'rejected' ? wrongProducerAck.reason : wrongProducerAck.status,
    'producer-mismatch',
  );
  const forgedAck = coordinator.acknowledge(producerA, {
    ...read.result,
  });
  assert.equal(
    forgedAck.status === 'rejected' ? forgedAck.reason : forgedAck.status,
    'invalid-result',
  );
  assert.equal(coordinator.snapshot.lifecycleRecords[0].acknowledged, undefined);

  const acknowledged = coordinator.acknowledge(producerA, read.result);
  assert.equal(acknowledged.status, 'acknowledged');
  let localResultReference = read.result;
  localResultReference = null;
  assert.equal(localResultReference, null);
  assert.equal(coordinator.snapshot.lifecycleRecords[0].status, 'completed');
  assert.equal(coordinator.snapshot.lifecycleRecords[0].acknowledged, true);
  assert.equal(coordinator.snapshot.counts.lifecycleRecords, 1,
    'Acknowledgement records a promise but does not clean the full record.');

  const repeated = coordinator.acknowledge(producerA, read.result);
  assert.equal(repeated.status, 'already-acknowledged');
  assert.equal(coordinator.snapshot.lifecycleRecords[0].acknowledged, true);
});

test('D09-A3 C02 unsafe lifecycle states cannot retire and handler attempts preserve the round', () => {
  let coordinator;
  let currentResultRead;
  let handlerAcknowledgement;
  let handlerRetirement;
  let handlerCalls = 0;
  ({ coordinator } = makeCoordinator({
    dispatchHandler: (event) => {
      handlerCalls += 1;
      if (event.eventId === 2) {
        currentResultRead = coordinator.readFinalResult(producer, event.eventId);
        handlerAcknowledgement = coordinator.acknowledge(producer, firstResult);
        handlerRetirement = coordinator.retire(producer, firstResult);
      }
    },
  }));
  const producer = coordinator.createProducer();
  const first = createOwned(coordinator, producer, { role: 'first' });
  dispatch(coordinator, 1);
  const firstResult = finalResult(coordinator, producer, first.eventId);
  acknowledge(coordinator, producer, firstResult);

  const second = createOwned(coordinator, producer, { role: 'second' });
  const pendingRead = coordinator.readFinalResult(producer, second.eventId);
  assert.equal(
    pendingRead.status === 'rejected' ? pendingRead.reason : pendingRead.status,
    'not-completed',
  );

  dispatch(coordinator, 2);
  assert.equal(
    currentResultRead.status === 'rejected' ? currentResultRead.reason : currentResultRead.status,
    'not-completed',
  );
  assert.equal(
    handlerRetirement.status === 'rejected' ? handlerRetirement.reason : handlerRetirement.status,
    'dispatch-active',
  );
  assert.equal(handlerAcknowledgement.status, 'already-acknowledged');
  assert.equal(handlerCalls, 2);
  assert.equal(coordinator.snapshot.lifecycleRecords[0].status, 'completed');
  assert.equal(coordinator.snapshot.inboxEvents.length, 0);

  const outsideRound = retire(coordinator, producer, firstResult);
  assert.equal(outsideRound.watermark, 1);

  const { coordinator: blockedCoordinator } = makeCoordinator({
    commandReceiptTestDouble: () => ({
      status: 'unknown',
      reason: 'delivery uncertain',
    }),
  });
  const blockedProducer = blockedCoordinator.createProducer();
  const blockedEvent = createOwned(blockedCoordinator, blockedProducer);
  const blockedDispatch = blockedCoordinator.dispatch({
    runtimeInstanceId: UUID_A,
    simulationTick: 1,
    phase: 'coordination',
  });
  assert.equal(blockedDispatch.status, 'blocked');
  const blockedRead = blockedCoordinator.readFinalResult(
    blockedProducer,
    blockedEvent.eventId,
  );
  assert.equal(
    blockedRead.status === 'rejected' ? blockedRead.reason : blockedRead.status,
    'not-completed',
  );
  assert.equal(blockedCoordinator.snapshot.lifecycleRecords[0].status, 'processing');
  assert.equal(blockedCoordinator.snapshot.retirement.watermark, 0);
});

test('D09-A3 C03 out-of-order retirement keeps a watermark gap and compacts contiguously', () => {
  const { coordinator } = makeCoordinator();
  const producer = coordinator.createProducer();
  const events = [1, 2, 3].map(value =>
    createOwned(coordinator, producer, { value }));
  dispatch(coordinator, 1);
  const results = events.map(event =>
    finalResult(coordinator, producer, event.eventId));
  results.forEach(result => acknowledge(coordinator, producer, result));

  const beforeRetirement = coordinator.snapshot;
  assert.equal(beforeRetirement.retirement.watermark, 0);
  assert.deepEqual(beforeRetirement.retirement.lightweightEventIds, []);
  assert.deepEqual(
    beforeRetirement.lifecycleRecords.map(record => record.status),
    ['completed', 'completed', 'completed'],
  );
  assert.equal(beforeRetirement.retirement.watermark, 0,
    'Completed plus acknowledged does not advance the retirement watermark.');

  const high = retire(coordinator, producer, results[2]);
  assert.deepEqual(high.compactedEventIds, []);
  let snapshot = coordinator.snapshot;
  assert.equal(snapshot.retirement.watermark, 0);
  assert.deepEqual(snapshot.retirement.lightweightEventIds, [3]);
  assert.deepEqual(snapshot.retirement.counts, {
    lightweightRecords: 1,
    retainedRecords: 3,
  });

  const middle = retire(coordinator, producer, results[1]);
  assert.deepEqual(middle.compactedEventIds, []);
  snapshot = coordinator.snapshot;
  assert.equal(snapshot.retirement.watermark, 0);
  assert.deepEqual(snapshot.retirement.lightweightEventIds, [2, 3]);
  assert.equal(snapshot.counts.lifecycleRecords, 1);

  const low = retire(coordinator, producer, results[0]);
  assert.deepEqual(low.compactedEventIds, [1, 2, 3]);
  snapshot = coordinator.snapshot;
  assert.equal(snapshot.retirement.watermark, 3);
  assert.deepEqual(snapshot.retirement.lightweightEventIds, []);
  assert.deepEqual(snapshot.retirement.counts, {
    lightweightRecords: 0,
    retainedRecords: 0,
  });
  assert.equal(snapshot.nextEventId, 4);
});

test('D09-A3 C04 retired IDs reject redelivery while generation and runtime isolation continue', () => {
  let handlerCalls = 0;
  const { coordinator } = makeCoordinator({
    dispatchHandler: () => {
      handlerCalls += 1;
    },
  });
  const producer = coordinator.createProducer();
  const events = [1, 2, 3].map(value =>
    createOwned(coordinator, producer, { value }));
  dispatch(coordinator, 1);
  const results = events.map(event =>
    finalResult(coordinator, producer, event.eventId));
  results.forEach(result => acknowledge(coordinator, producer, result));

  retire(coordinator, producer, results[2]);
  const retiredHigh = coordinator.probeRedelivery(events[2]);
  assert.equal(
    retiredHigh.status === 'rejected' ? retiredHigh.reason : retiredHigh.status,
    'retired-event',
  );
  const tamperedHigh = coordinator.probeRedelivery({
    ...events[2],
    payload: { value: 'forged' },
  });
  assert.equal(
    tamperedHigh.status === 'rejected' ? tamperedHigh.reason : tamperedHigh.status,
    'retired-event',
  );
  const wrongRuntime = coordinator.probeRedelivery({
    ...events[2],
    runtimeInstanceId: UUID_B,
  });
  assert.equal(
    wrongRuntime.status === 'rejected' ? wrongRuntime.reason : wrongRuntime.status,
    'runtime-mismatch',
  );
  const unknown = coordinator.probeRedelivery({
    ...events[2],
    eventId: 999,
  });
  assert.equal(
    unknown.status === 'rejected' ? unknown.reason : unknown.status,
    'unknown-event',
  );

  retire(coordinator, producer, results[1]);
  retire(coordinator, producer, results[0]);
  assert.equal(coordinator.snapshot.retirement.watermark, 3);
  const belowWatermark = coordinator.probeRedelivery(events[0]);
  assert.equal(
    belowWatermark.status === 'rejected' ? belowWatermark.reason : belowWatermark.status,
    'retired-event',
  );

  const next = createOwned(coordinator, producer, { value: 'next' });
  assert.equal(next.eventId, 4);
  assert.equal(coordinator.snapshot.nextEventId, 5);
  assert.equal(coordinator.snapshot.inboxEvents[0].eventId, 4);
  const repeatedRetire = coordinator.retire(producer, results[2]);
  assert.equal(repeatedRetire.status, 'already-retired');
  const repeatedAcknowledgement = coordinator.acknowledge(producer, results[2]);
  assert.equal(repeatedAcknowledgement.status, 'already-acknowledged');
  assert.equal(handlerCalls, 3, 'Retired IDs never re-enter the handler.');
});

test('D09-A3 C05 combined capacity recovers and lightweight gaps remain bounded', () => {
  const { coordinator: cycleCoordinator } = makeCoordinator({
    inboxCapacity: 1,
    historyCapacity: 1,
  });
  const cycleProducer = cycleCoordinator.createProducer();
  for (let cycle = 1; cycle <= 3; cycle += 1) {
    const event = createOwned(cycleCoordinator, cycleProducer, { cycle });
    assert.equal(event.eventId, cycle);
    dispatch(cycleCoordinator, cycle);
    const result = finalResult(cycleCoordinator, cycleProducer, event.eventId);
    acknowledge(cycleCoordinator, cycleProducer, result);
    retire(cycleCoordinator, cycleProducer, result);
    const snapshot = cycleCoordinator.snapshot;
    assert.equal(snapshot.counts.lifecycleRecords, 0);
    assert.deepEqual(snapshot.retirement.counts, {
      lightweightRecords: 0,
      retainedRecords: 0,
    });
    assert.equal(snapshot.retirement.watermark, cycle);
  }
  assert.equal(cycleCoordinator.snapshot.nextEventId, 4);

  const { coordinator } = makeCoordinator({
    inboxCapacity: 4,
    historyCapacity: 4,
  });
  const producer = coordinator.createProducer();
  const events = [1, 2, 3, 4].map(value =>
    createOwned(coordinator, producer, { value }));
  dispatch(coordinator, 1);
  const results = events.map(event =>
    finalResult(coordinator, producer, event.eventId));
  results.slice(1).forEach(result => acknowledge(coordinator, producer, result));
  results.slice(1).reverse().forEach(result => retire(coordinator, producer, result));

  let snapshot = coordinator.snapshot;
  assert.equal(snapshot.counts.lifecycleRecords, 1);
  assert.deepEqual(snapshot.retirement.lightweightEventIds, [2, 3, 4]);
  assert.deepEqual(snapshot.retirement.counts, {
    lightweightRecords: 3,
    retainedRecords: 4,
  });
  assert.equal(snapshot.retirement.watermark, 0);
  assert.equal(snapshot.retirement.resourceCapacity, 4);

  const capacityRejected = coordinator.create(
    request({ value: 5 }),
    producer,
  );
  assert.equal(capacityRejected.status, 'rejected');
  assert.equal(capacityRejected.reason, 'history-capacity');
  assert.equal(coordinator.snapshot.nextEventId, 5);
  assert.equal(coordinator.snapshot.counts.lifecycleRecords, 1,
    'The unacknowledged low Event ID is retained.');

  acknowledge(coordinator, producer, results[0]);
  const compacted = retire(coordinator, producer, results[0]);
  assert.deepEqual(compacted.compactedEventIds, [1, 2, 3, 4]);
  snapshot = coordinator.snapshot;
  assert.equal(snapshot.retirement.watermark, 4);
  assert.deepEqual(snapshot.retirement.lightweightEventIds, []);
  assert.equal(snapshot.retirement.counts.retainedRecords, 0);

  const recovered = createOwned(coordinator, producer, { value: 5 });
  assert.equal(recovered.eventId, 5);
  assert.equal(coordinator.snapshot.retirement.counts.retainedRecords, 1);
});

test('D09-A3 C06 cleanup faults are conservative and non-default/max Event IDs terminate safely', () => {
  function setupFaultCase(point) {
    let armedPoint = point;
    let handlerCalls = 0;
    const made = makeCoordinator({
      dispatchHandler: () => {
        handlerCalls += 1;
      },
      retirementFaultInjector: faultPoint => {
        if (armedPoint === faultPoint) {
          armedPoint = undefined;
          throw new Error(`injected ${faultPoint}`);
        }
      },
    });
    const producer = made.coordinator.createProducer();
    const event = createOwned(made.coordinator, producer);
    dispatch(made.coordinator, 1);
    const result = finalResult(made.coordinator, producer, event.eventId);
    acknowledge(made.coordinator, producer, result);
    return {
      ...made,
      event,
      producer,
      result,
      disarm: () => {
        armedPoint = undefined;
      },
      handlerCalls: () => handlerCalls,
    };
  }

  const beforeLedger = setupFaultCase('before-retirement-ledger-commit');
  const beforeLedgerFailure = beforeLedger.coordinator.retire(
    beforeLedger.producer,
    beforeLedger.result,
  );
  assert.equal(beforeLedgerFailure.status, 'failed');
  assert.equal(beforeLedgerFailure.failure.lifecyclePreserved, true);
  assert.equal(beforeLedgerFailure.failure.retirementRecordPreserved, false);
  assert.equal(beforeLedger.coordinator.snapshot.retirement.watermark, 0);
  assert.equal(beforeLedger.coordinator.snapshot.counts.lifecycleRecords, 1);
  assert.equal(beforeLedger.coordinator.snapshot.nextEventId, 2);
  retire(beforeLedger.coordinator, beforeLedger.producer, beforeLedger.result);
  assert.equal(beforeLedger.coordinator.snapshot.counts.lifecycleRecords, 0);
  assert.equal(beforeLedger.coordinator.snapshot.retirement.watermark, 1);

  const beforeRemove = setupFaultCase('before-lifecycle-record-remove');
  const beforeRemoveFailure = beforeRemove.coordinator.retire(
    beforeRemove.producer,
    beforeRemove.result,
  );
  assert.equal(beforeRemoveFailure.status, 'failed');
  assert.equal(beforeRemoveFailure.failure.lifecyclePreserved, true);
  assert.equal(beforeRemoveFailure.failure.retirementRecordPreserved, false);
  assert.equal(beforeRemove.coordinator.snapshot.retirement.watermark, 0);
  assert.equal(beforeRemove.coordinator.snapshot.nextEventId, 2);
  assert.deepEqual(
    beforeRemove.coordinator.probeRedelivery(beforeRemove.event),
    {
      status: 'duplicate',
      eventId: beforeRemove.event.eventId,
      lifecycle: 'completed',
    },
  );
  retire(beforeRemove.coordinator, beforeRemove.producer, beforeRemove.result);
  assert.equal(beforeRemove.coordinator.snapshot.counts.lifecycleRecords, 0);
  assert.equal(beforeRemove.coordinator.snapshot.retirement.watermark, 1);

  const afterRemove = setupFaultCase('after-lifecycle-record-remove');
  const afterRemoveFailure = afterRemove.coordinator.retire(
    afterRemove.producer,
    afterRemove.result,
  );
  assert.equal(afterRemoveFailure.status, 'failed');
  assert.equal(afterRemoveFailure.failure.lifecyclePreserved, false);
  assert.equal(afterRemoveFailure.failure.retirementRecordPreserved, true);
  assert.equal(afterRemove.coordinator.snapshot.nextEventId, 2);
  assert.equal(
    afterRemove.coordinator.probeRedelivery(afterRemove.event).status,
    'rejected',
  );
  const repeated = afterRemove.coordinator.retire(
    afterRemove.producer,
    afterRemove.result,
  );
  assert.equal(repeated.status, 'already-retired');
  assert.equal(afterRemove.coordinator.snapshot.retirementFailure, undefined);
  assert.equal(beforeLedger.handlerCalls(), 1);
  assert.equal(beforeRemove.handlerCalls(), 1);
  assert.equal(afterRemove.handlerCalls(), 1);

  const { coordinator: nonDefault } = makeCoordinator({
    initialNextEventId: 100,
    historyCapacity: 2,
  });
  const nonDefaultProducer = nonDefault.createProducer();
  assert.equal(nonDefault.snapshot.retirement.initialWatermark, 99);
  const event100 = createOwned(nonDefault, nonDefaultProducer);
  assert.equal(event100.eventId, 100);
  dispatch(nonDefault, 1);
  const result100 = finalResult(nonDefault, nonDefaultProducer, 100);
  acknowledge(nonDefault, nonDefaultProducer, result100);
  retire(nonDefault, nonDefaultProducer, result100);
  assert.equal(nonDefault.snapshot.retirement.watermark, 100);
  assert.equal(nonDefault.snapshot.nextEventId, 101);

  const max = Number.MAX_SAFE_INTEGER;
  const { coordinator: boundary } = makeCoordinator({
    initialNextEventId: max,
    historyCapacity: 1,
  });
  const boundaryProducer = boundary.createProducer();
  const boundaryEvent = createOwned(boundary, boundaryProducer);
  assert.equal(boundaryEvent.eventId, max);
  dispatch(boundary, 1);
  const boundaryResult = finalResult(boundary, boundaryProducer, max);
  acknowledge(boundary, boundaryProducer, boundaryResult);
  retire(boundary, boundaryProducer, boundaryResult);
  assert.equal(boundary.snapshot.retirement.watermark, max);
  assert.equal(boundary.snapshot.nextEventId, null);
  const exhausted = boundary.create(request(), boundaryProducer);
  assert.equal(exhausted.status, 'rejected');
  assert.equal(exhausted.reason, 'event-id-exhausted');
});
