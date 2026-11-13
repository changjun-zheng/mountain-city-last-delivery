import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RuntimeEventContext } from '../src/core/events.ts';

const UUID_A = '10000000-0000-4000-8000-000000000001';
const UUID_B = '10000000-0000-4000-8000-000000000002';
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
    historyCapacity: options.historyCapacity ?? 32,
    allowedEventTypes: EVENT_TYPES,
    dispatchHandler: options.dispatchHandler,
    commandReceiptTestDouble: options.commandReceiptTestDouble,
    faultInjector: options.faultInjector,
    dispatchFaultInjector: options.dispatchFaultInjector,
  });
  return { context, coordinator };
}

function acceptingReceipt(event) {
  return Object.freeze({
    status: 'accepted',
    testCommandReference: `test-command-${event.eventId}`,
  });
}

function request(type = 'test.progress', payload = { value: 1 }) {
  return { type, payload };
}

function create(coordinator, payload = { value: 1 }, type = 'test.progress') {
  const result = coordinator.create(request(type, payload));
  assert.equal(result.status, 'created');
  return result.event;
}

function dispatchContext(tick, options = {}) {
  return {
    runtimeInstanceId: options.runtimeInstanceId ?? UUID_A,
    simulationTick: tick,
    phase: options.phase ?? 'coordination',
  };
}

test('D09-A2 B01 only an explicit coordination stage dispatches with per-event transitions', () => {
  const observations = [];
  const { coordinator } = makeCoordinator({
    dispatchHandler: (event, context) => {
      observations.push({
        eventId: event.eventId,
        own: context.statusOf(event.eventId),
        peer: context.statusOf(event.eventId === 1 ? 2 : 1),
      });
    },
    commandReceiptTestDouble: acceptingReceipt,
  });
  const first = create(coordinator, { value: 'first' });
  const second = create(coordinator, { value: 'second' }, 'test.diagnostic');

  const before = coordinator.snapshot;
  assert.deepEqual(
    before.lifecycleRecords.map(record => record.status),
    ['pending', 'pending'],
  );
  assert.deepEqual(
    before.inboxEvents.map(event => event.eventId),
    [first.eventId, second.eventId],
  );
  assert.equal(before.lastDispatchTick, null);
  assert.equal(observations.length, 0);
  assert.deepEqual(before.lifecycleRecords, [
    { eventId: 1, runtimeInstanceId: UUID_A, status: 'pending' },
    { eventId: 2, runtimeInstanceId: UUID_A, status: 'pending' },
  ]);

  const result = coordinator.dispatch(dispatchContext(7));
  assert.equal(result.status, 'completed');
  assert.equal(result.simulationTick, 7);
  assert.deepEqual(result.progress, {
    processedEventIds: [1, 2],
    completedEventIds: [1, 2],
    pendingEventIds: [],
  });
  assert.deepEqual(observations, [
    { eventId: 1, own: 'processing', peer: 'pending' },
    { eventId: 2, own: 'processing', peer: 'completed' },
  ]);

  const after = coordinator.snapshot;
  assert.equal(after.lastDispatchTick, 7);
  assert.equal(after.dispatchBlocked, false);
  assert.deepEqual(after.lifecycleRecords, [
    {
      eventId: 1,
      runtimeInstanceId: UUID_A,
      status: 'completed',
      simulationTick: 7,
      testCommandReference: 'test-command-1',
    },
    {
      eventId: 2,
      runtimeInstanceId: UUID_A,
      status: 'completed',
      simulationTick: 7,
      testCommandReference: 'test-command-2',
    },
  ]);
  assert.deepEqual(after.inboxEvents, []);
});

test('D09-A2 B01 invalid stages and non-increasing ticks have no handler side effects', () => {
  let calls = 0;
  const { coordinator } = makeCoordinator({
    dispatchHandler: () => {
      calls += 1;
    },
    commandReceiptTestDouble: acceptingReceipt,
  });
  create(coordinator);

  const invalidResults = [
    coordinator.dispatch(dispatchContext(1, { runtimeInstanceId: UUID_B })),
    coordinator.dispatch(dispatchContext(1, { phase: 'render' })),
    coordinator.dispatch(dispatchContext(0)),
    coordinator.dispatch(dispatchContext(1.5)),
  ];
  assert.deepEqual(
    invalidResults.map(result => result.status === 'rejected' ? result.reason : result.status),
    ['runtime-mismatch', 'invalid-phase', 'invalid-phase', 'invalid-phase'],
  );
  assert.equal(calls, 0);
  assert.equal(coordinator.snapshot.lastDispatchTick, null);

  assert.equal(coordinator.dispatch(dispatchContext(5)).status, 'completed');
  assert.equal(calls, 1);
  const repeated = coordinator.dispatch(dispatchContext(5));
  const regressed = coordinator.dispatch(dispatchContext(4));
  assert.equal(repeated.status === 'rejected' ? repeated.reason : repeated.status, 'phase-order');
  assert.equal(regressed.status === 'rejected' ? regressed.reason : regressed.status, 'phase-order');
  assert.equal(calls, 1);
  assert.equal(coordinator.snapshot.lastDispatchTick, 5);

  const { coordinator: unconfigured } = makeCoordinator();
  create(unconfigured);
  const missing = unconfigured.dispatch(dispatchContext(1));
  assert.equal(
    missing.status === 'rejected' ? missing.reason : missing.status,
    'dispatch-not-configured',
  );
  assert.equal(unconfigured.snapshot.lastDispatchTick, null);
});

test('D09-A2 B01 failed Pending to Processing transition retains the event without calling handler', () => {
  let handlerCalls = 0;
  const { coordinator } = makeCoordinator({
    dispatchHandler: () => {
      handlerCalls += 1;
    },
    commandReceiptTestDouble: acceptingReceipt,
    dispatchFaultInjector: point => {
      if (point === 'before-processing-transition') {
        throw new Error('injected transition failure');
      }
    },
  });
  create(coordinator);

  const first = coordinator.dispatch(dispatchContext(3));
  assert.equal(first.status, 'blocked');
  assert.equal(first.failure.code, 'lifecycle-invalid');
  assert.deepEqual(first.failure.progress, {
    processedEventIds: [],
    completedEventIds: [],
    pendingEventIds: [1],
  });
  assert.equal(handlerCalls, 0);
  assert.equal(coordinator.snapshot.lifecycleRecords[0].status, 'pending');
  assert.deepEqual(coordinator.snapshot.inboxEvents.map(event => event.eventId), [1]);
  assert.equal(coordinator.snapshot.dispatchBlocked, true);

  const blockedAgain = coordinator.dispatch(dispatchContext(4));
  assert.equal(blockedAgain.status, 'blocked');
  assert.equal(blockedAgain.failure.code, 'lifecycle-invalid');
  assert.equal(handlerCalls, 0);
});

test('D09-A2 B02 fixed batch defers new events and rejects recursive dispatch', () => {
  let coordinator;
  let nestedResult;
  const handlerCounts = new Map();
  ({ coordinator } = makeCoordinator({
    dispatchHandler: (event, context) => {
      handlerCounts.set(event.eventId, (handlerCounts.get(event.eventId) ?? 0) + 1);
      if (event.payload.role === 'root') {
        const firstFollowUp = context.create(request(
          'test.follow-up',
          { role: 'follow-up', value: 1 },
        ));
        const secondFollowUp = context.create(request(
          'test.follow-up',
          { role: 'follow-up', value: 2 },
        ));
        assert.equal(firstFollowUp.status, 'created');
        assert.equal(secondFollowUp.status, 'created');
        nestedResult = coordinator.dispatch(dispatchContext(2));
      }
    },
    commandReceiptTestDouble: acceptingReceipt,
  }));
  const root = create(coordinator, { role: 'root' });

  const firstRound = coordinator.dispatch(dispatchContext(1));
  assert.equal(firstRound.status, 'completed');
  assert.equal(
    nestedResult.status === 'rejected' ? nestedResult.reason : nestedResult.status,
    'recursive-dispatch',
  );
  assert.equal(handlerCounts.get(root.eventId), 1);
  assert.equal(handlerCounts.get(2), undefined);
  assert.equal(handlerCounts.get(3), undefined);
  assert.deepEqual(
    coordinator.snapshot.lifecycleRecords.map(record => record.status),
    ['completed', 'pending', 'pending'],
  );
  assert.deepEqual(coordinator.snapshot.inboxEvents.map(event => event.eventId), [2, 3]);
  assert.equal(coordinator.snapshot.lastDispatchTick, 1);

  const repeated = coordinator.dispatch(dispatchContext(1));
  assert.equal(repeated.status === 'rejected' ? repeated.reason : repeated.status, 'phase-order');
  assert.equal(handlerCounts.get(2), undefined);

  const secondRound = coordinator.dispatch(dispatchContext(2));
  assert.equal(secondRound.status, 'completed');
  assert.deepEqual(secondRound.progress.processedEventIds, [2, 3]);
  assert.equal(handlerCounts.get(1), 1);
  assert.equal(handlerCounts.get(2), 1);
  assert.equal(handlerCounts.get(3), 1);
  assert.deepEqual(
    coordinator.snapshot.lifecycleRecords.map(record => record.status),
    ['completed', 'completed', 'completed'],
  );
  assert.deepEqual(coordinator.snapshot.inboxEvents, []);
});

test('D09-A2 B03 redelivery is detected without reprocessing and integrity is checked', () => {
  let coordinator;
  let pendingProbe;
  let processingProbe;
  let calls = 0;
  ({ coordinator } = makeCoordinator({
    dispatchHandler: event => {
      calls += 1;
      if (event.eventId === 1) {
        processingProbe = coordinator.probeRedelivery(createdEvent);
      }
    },
    commandReceiptTestDouble: acceptingReceipt,
  }));
  const createdEvent = create(coordinator, { value: 'stable' });

  pendingProbe = coordinator.probeRedelivery(createdEvent);
  assert.deepEqual(pendingProbe, {
    status: 'duplicate',
    eventId: 1,
    lifecycle: 'pending',
  });
  assert.deepEqual(coordinator.snapshot.inboxEvents.map(event => event.eventId), [1]);
  assert.equal(calls, 0);

  assert.equal(coordinator.dispatch(dispatchContext(1)).status, 'completed');
  assert.deepEqual(processingProbe, {
    status: 'duplicate',
    eventId: 1,
    lifecycle: 'processing',
  });
  assert.deepEqual(coordinator.probeRedelivery(createdEvent), {
    status: 'duplicate',
    eventId: 1,
    lifecycle: 'completed',
  });

  const otherRuntime = coordinator.probeRedelivery({
    ...createdEvent,
    runtimeInstanceId: UUID_B,
  });
  assert.equal(
    otherRuntime.status === 'rejected' ? otherRuntime.reason : otherRuntime.status,
    'runtime-mismatch',
  );
  const tampered = coordinator.probeRedelivery({
    ...createdEvent,
    payload: { value: 'tampered' },
  });
  assert.equal(
    tampered.status === 'rejected' ? tampered.reason : tampered.status,
    'integrity-mismatch',
  );
  const unknown = coordinator.probeRedelivery({
    ...createdEvent,
    eventId: 99,
  });
  assert.equal(
    unknown.status === 'rejected' ? unknown.reason : unknown.status,
    'unknown-event',
  );

  assert.equal(coordinator.dispatch(dispatchContext(2)).status, 'completed');
  assert.equal(calls, 1);
  const newEvent = create(coordinator, { value: 'new' }, 'test.diagnostic');
  assert.equal(newEvent.eventId, 2);
  assert.deepEqual(coordinator.snapshot.inboxEvents.map(event => event.eventId), [2]);
});

test('D09-A2 B04 only an explicit Accepted test receipt completes an event', () => {
  const receiptCases = [
    { label: 'missing', value: () => undefined, code: 'invalid-receipt' },
    {
      label: 'not accepted',
      value: () => ({ status: 'not-accepted', reason: 'test rejection' }),
      code: 'receipt-not-accepted',
    },
    {
      label: 'unknown',
      value: () => ({ status: 'unknown', reason: 'not implemented by test double' }),
      code: 'receipt-unknown',
    },
    {
      label: 'missing reference',
      value: () => ({ status: 'accepted' }),
      code: 'invalid-receipt',
    },
    {
      label: 'event ID reused as command identity',
      value: event => ({
        status: 'accepted',
        testCommandReference: String(event.eventId),
      }),
      code: 'invalid-receipt',
    },
  ];

  for (const receiptCase of receiptCases) {
    let calls = 0;
    const { coordinator } = makeCoordinator({
      dispatchHandler: () => {
        calls += 1;
      },
      commandReceiptTestDouble: receiptCase.value,
    });
    create(coordinator);
    const result = coordinator.dispatch(dispatchContext(1));
    assert.equal(result.status, 'blocked', receiptCase.label);
    assert.equal(result.failure.code, receiptCase.code, receiptCase.label);
    assert.equal(calls, 1, receiptCase.label);
    assert.equal(
      coordinator.snapshot.lifecycleRecords[0].status,
      'processing',
      receiptCase.label,
    );
    assert.deepEqual(coordinator.snapshot.inboxEvents, [], receiptCase.label);
  }
});

test('D09-A2 B04 failures preserve completed and pending work and never retry automatically', () => {
  const handlerCounts = new Map();
  let receiptCalls = 0;
  const { coordinator } = makeCoordinator({
    dispatchHandler: event => {
      handlerCounts.set(event.eventId, (handlerCounts.get(event.eventId) ?? 0) + 1);
    },
    commandReceiptTestDouble: event => {
      receiptCalls += 1;
      if (event.eventId === 2) throw new Error('injected uncertain delivery');
      return acceptingReceipt(event);
    },
  });
  create(coordinator, { value: 'first' });
  create(coordinator, { value: 'second' }, 'test.diagnostic');
  create(coordinator, { value: 'third' }, 'test.follow-up');

  const failed = coordinator.dispatch(dispatchContext(10));
  assert.equal(failed.status, 'blocked');
  assert.equal(failed.failure.code, 'invalid-receipt');
  assert.equal(failed.failure.eventId, 2);
  assert.deepEqual(failed.failure.progress, {
    processedEventIds: [1, 2],
    completedEventIds: [1],
    pendingEventIds: [3],
  });
  assert.deepEqual(
    coordinator.snapshot.lifecycleRecords.map(record => record.status),
    ['completed', 'processing', 'pending'],
  );
  assert.deepEqual(coordinator.snapshot.inboxEvents.map(event => event.eventId), [3]);
  assert.equal(handlerCounts.get(1), 1);
  assert.equal(handlerCounts.get(2), 1);
  assert.equal(handlerCounts.get(3), undefined);
  assert.equal(receiptCalls, 2);

  const blockedAgain = coordinator.dispatch(dispatchContext(11));
  assert.equal(blockedAgain.status, 'blocked');
  assert.equal(blockedAgain.failure.code, 'invalid-receipt');
  assert.equal(handlerCounts.get(1), 1);
  assert.equal(handlerCounts.get(2), 1);
  assert.equal(handlerCounts.get(3), undefined);
  assert.equal(receiptCalls, 2);

  let receiptAfterHandlerFailure = 0;
  const { coordinator: throwingHandlerCoordinator } = makeCoordinator({
    dispatchHandler: () => {
      throw new Error('injected handler failure');
    },
    commandReceiptTestDouble: event => {
      receiptAfterHandlerFailure += 1;
      return acceptingReceipt(event);
    },
  });
  create(throwingHandlerCoordinator);
  const handlerFailed = throwingHandlerCoordinator.dispatch(dispatchContext(1));
  assert.equal(handlerFailed.status, 'blocked');
  assert.equal(handlerFailed.failure.code, 'handler-threw');
  assert.equal(receiptAfterHandlerFailure, 0);
  assert.equal(
    throwingHandlerCoordinator.snapshot.lifecycleRecords[0].status,
    'processing',
  );
});

test('D09-A2 B04 failed completion transition never reports a completed event', () => {
  let handlerCalls = 0;
  let receiptCalls = 0;
  const { coordinator } = makeCoordinator({
    dispatchHandler: () => {
      handlerCalls += 1;
    },
    commandReceiptTestDouble: event => {
      receiptCalls += 1;
      return acceptingReceipt(event);
    },
    dispatchFaultInjector: point => {
      if (point === 'before-completion-transition') {
        throw new Error('injected completion transition failure');
      }
    },
  });
  create(coordinator);

  const failed = coordinator.dispatch(dispatchContext(1));
  assert.equal(failed.status, 'blocked');
  assert.equal(failed.failure.code, 'lifecycle-invalid');
  assert.deepEqual(failed.failure.progress, {
    processedEventIds: [1],
    completedEventIds: [],
    pendingEventIds: [],
  });
  assert.equal(handlerCalls, 1);
  assert.equal(receiptCalls, 1);
  assert.deepEqual(coordinator.snapshot.lifecycleRecords, [{
    eventId: 1,
    runtimeInstanceId: UUID_A,
    status: 'processing',
    simulationTick: 1,
  }]);

  const blockedAgain = coordinator.dispatch(dispatchContext(2));
  assert.equal(blockedAgain.status, 'blocked');
  assert.equal(handlerCalls, 1);
  assert.equal(receiptCalls, 1);
});

test('D09-A2 B05 creation during dispatch stays atomic under failure and capacity limits', () => {
  let coordinator;
  let armed = false;
  let faultedCreation;
  let recoveredCreation;
  let extraCreation;
  let historyBlockedCreation;
  ({ coordinator } = makeCoordinator({
    inboxCapacity: 3,
    historyCapacity: 4,
    dispatchHandler: (event, context) => {
      if (event.eventId !== 1) return;
      faultedCreation = context.create(request('test.follow-up', { value: 'faulted' }));
      recoveredCreation = context.create(request('test.follow-up', { value: 'recovered' }));
      extraCreation = context.create(request('test.follow-up', { value: 'extra' }));
      historyBlockedCreation = context.create(request(
        'test.follow-up',
        { value: 'history-blocked' },
      ));
    },
    commandReceiptTestDouble: acceptingReceipt,
    faultInjector: point => {
      if (armed && point === 'registration-prepared') {
        armed = false;
        throw new Error('injected creation failure');
      }
    },
  }));
  create(coordinator, { role: 'root' });
  create(coordinator, { role: 'peer' }, 'test.diagnostic');
  armed = true;

  const result = coordinator.dispatch(dispatchContext(4));
  assert.equal(result.status, 'completed');
  assert.equal(faultedCreation.status, 'rejected');
  assert.equal(faultedCreation.reason, 'transaction-aborted');
  assert.equal(recoveredCreation.status, 'created');
  assert.equal(recoveredCreation.event.eventId, 3);
  assert.equal(extraCreation.status, 'created');
  assert.equal(extraCreation.event.eventId, 4);
  assert.equal(historyBlockedCreation.status, 'rejected');
  assert.equal(historyBlockedCreation.reason, 'history-capacity');

  assert.deepEqual(result.progress, {
    processedEventIds: [1, 2],
    completedEventIds: [1, 2],
    pendingEventIds: [3, 4],
  });
  const snapshot = coordinator.snapshot;
  assert.equal(snapshot.nextEventId, 5);
  assert.deepEqual(
    snapshot.lifecycleRecords.map(record => record.status),
    ['completed', 'completed', 'pending', 'pending'],
  );
  assert.deepEqual(snapshot.inboxEvents.map(event => event.eventId), [3, 4]);
  assert.deepEqual(snapshot.counts, { lifecycleRecords: 4, inboxEvents: 2 });
  assert.equal(Object.isFrozen(snapshot.lifecycleRecords), true);
  assert.equal(Object.isFrozen(snapshot.lifecycleRecords[0]), true);
  assert.equal(Object.isFrozen(snapshot.inboxEvents), true);
  assert.equal(Object.isFrozen(snapshot.inboxEvents[0].payload), true);
  assert.throws(() => snapshot.inboxEvents.push({}), TypeError);
  assert.equal(coordinator.snapshot.lifecycleRecords.length, 4,
    'Completed records remain retained; there is no automatic history cleanup.');

  const { coordinator: inboxLimited } = makeCoordinator({
    inboxCapacity: 1,
    historyCapacity: 8,
    dispatchHandler: (event, context) => {
      if (event.eventId !== 1) return;
      const accepted = context.create(request('test.follow-up', { value: 'inbox-slot' }));
      const overflow = context.create(request('test.follow-up', { value: 'overflow' }));
      assert.equal(accepted.status, 'created');
      assert.equal(overflow.status, 'rejected');
      assert.equal(overflow.reason, 'inbox-capacity');
    },
    commandReceiptTestDouble: acceptingReceipt,
  });
  create(inboxLimited);
  assert.equal(inboxLimited.dispatch(dispatchContext(1)).status, 'completed');
  assert.equal(inboxLimited.snapshot.nextEventId, 3);
  assert.deepEqual(inboxLimited.snapshot.inboxEvents.map(event => event.eventId), [2]);
});
