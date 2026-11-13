import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import {
  RuntimeEventContext,
} from '../src/core/events.ts';

const EVENT_TYPES = Object.freeze(['test.progress', 'test.diagnostic']);
const UUID_A = '00000000-0000-4000-8000-000000000001';
const UUID_B = '00000000-0000-4000-8000-000000000002';

function contextWithUuid(uuid, initialNextEventId = 1) {
  return new RuntimeEventContext({ generate: () => uuid }, { initialNextEventId });
}

function coordinatorWithUuid(uuid, options = {}) {
  const context = contextWithUuid(uuid, options.initialNextEventId);
  return {
    context,
    coordinator: context.createCoordinator({
      inboxCapacity: options.inboxCapacity ?? 8,
      allowedEventTypes: EVENT_TYPES,
      faultInjector: options.faultInjector,
    }),
  };
}

function request(type = EVENT_TYPES[0], payload = { value: 1 }) {
  return { type, payload };
}

test('D09-A1 A01 runtime context shares UUID and monotonic Event IDs across producers', () => {
  const context = contextWithUuid(UUID_A);
  const coordinator = context.createCoordinator({
    inboxCapacity: 8,
    allowedEventTypes: EVENT_TYPES,
  });
  const producerA = { submit: value => coordinator.create(request('test.progress', { value })) };
  const producerB = { submit: value => coordinator.create(request('test.diagnostic', { value })) };

  const first = producerA.submit(1);
  const second = producerB.submit(2);
  const rebuiltProducer = { submit: value => coordinator.create(request(undefined, { value })) };
  const third = rebuiltProducer.submit(3);

  assert.deepEqual(
    [first.event.eventId, second.event.eventId, third.event.eventId],
    [1, 2, 3],
  );
  assert.equal(new Set([first.event.eventId, second.event.eventId, third.event.eventId]).size, 3);
  for (const event of [first.event, second.event, third.event]) {
    assert.equal(event.runtimeInstanceId, UUID_A);
  }
  assert.equal(coordinator.snapshot.runtimeInstanceId, UUID_A);
  assert.equal(coordinator.snapshot.nextEventId, 4);
  assert.throws(() => context.createCoordinator({
    inboxCapacity: 1,
    allowedEventTypes: EVENT_TYPES,
  }), /only own one event coordinator/,
  'Splitting a runtime across coordinators must require an explicit new context.');

  const otherContext = contextWithUuid(UUID_B);
  const otherCoordinator = otherContext.createCoordinator({
    inboxCapacity: 2,
    allowedEventTypes: EVENT_TYPES,
  });
  const other = otherCoordinator.create(request());
  assert.equal(other.event.eventId, 1, 'A new runtime sequence starts independently.');
  assert.equal(other.event.runtimeInstanceId, UUID_B);
  assert.notEqual(other.event.runtimeInstanceId, first.event.runtimeInstanceId);
});

test('D09-A1 A02 success atomically exposes one Pending event and one Inbox entry', () => {
  const context = contextWithUuid(UUID_A);
  const coordinator = context.createCoordinator({
    inboxCapacity: 4,
    allowedEventTypes: EVENT_TYPES,
  });
  const source = { nested: { value: 7 }, enabled: true };
  const result = coordinator.create(request('test.progress', source));

  assert.equal(result.status, 'created');
  assert.equal(result.event.eventId, 1);
  assert.equal(result.event.runtimeInstanceId, context.runtimeInstanceId);
  assert.equal(result.event.type, 'test.progress');
  assert.equal(result.event.status, 'pending');
  assert.deepEqual(result.event.payload, { nested: { value: 7 }, enabled: true });

  source.nested.value = 99;
  assert.equal(result.event.payload.nested.value, 7, 'Creation copies producer-owned payload data.');
  const snapshot = coordinator.snapshot;
  assert.deepEqual(snapshot.lifecycleRecords, [{
    eventId: 1,
    runtimeInstanceId: UUID_A,
    status: 'pending',
  }]);
  assert.deepEqual(snapshot.inboxEvents, [result.event]);
  assert.deepEqual(snapshot.counts, { lifecycleRecords: 1, inboxEvents: 1 });
  assert.equal(snapshot.nextEventId, 2);
  assert.equal(snapshot.blocked, false);

  assert.equal(Object.isFrozen(result.event), true);
  assert.equal(Object.isFrozen(result.event.payload), true);
  assert.equal(Object.isFrozen(snapshot.inboxEvents), true);
  assert.throws(() => {
    result.event.payload.nested.value = 8;
  }, TypeError);
  assert.throws(() => {
    snapshot.inboxEvents.push({});
  }, TypeError);
  assert.equal(coordinator.snapshot.inboxEvents[0].payload.nested.value, 7);
});

test('D09-A1 A03 injected preparation and commit faults roll back every kernel role', () => {
  const faultPoints = [
    'validation',
    'candidate-prepared',
    'registration-prepared',
    'inbox-prepared',
    'event-id-committed',
    'registration-committed',
    'inbox-committed',
  ];

  for (const [index, faultPoint] of faultPoints.entries()) {
    const uuid = `00000000-0000-4000-8000-${String(index + 10).padStart(12, '0')}`;
    let injected = false;
    const { coordinator } = coordinatorWithUuid(uuid, {
      faultInjector: point => {
        if (!injected && point === faultPoint) {
          injected = true;
          throw new Error(`injected ${point}`);
        }
      },
    });

    const failed = coordinator.create(request());
    assert.equal(failed.status, 'rejected', faultPoint);
    assert.equal(failed.reason, 'transaction-aborted', faultPoint);
    assert.equal(failed.failure.point, faultPoint);
    assert.equal(failed.failure.rollback, 'complete');
    assert.deepEqual(coordinator.snapshot.lifecycleRecords, [], faultPoint);
    assert.deepEqual(coordinator.snapshot.inboxEvents, [], faultPoint);
    assert.equal(coordinator.snapshot.nextEventId, 1, faultPoint);
    assert.equal(coordinator.snapshot.blocked, false, faultPoint);

    const recovered = coordinator.create(request());
    assert.equal(recovered.status, 'created', faultPoint);
    assert.equal(recovered.event.eventId, 1, 'A rolled-back candidate is not consumed.');
  }

  let armed = false;
  const { coordinator: nonEmptyCoordinator } = coordinatorWithUuid(
    '00000000-0000-4000-8000-000000000099',
    {
      faultInjector: point => {
        if (armed && point === 'registration-committed') {
          throw new Error('injected second-event failure');
        }
      },
    },
  );
  const retained = nonEmptyCoordinator.create(request('test.progress', { value: 'retained' }));
  assert.equal(retained.status, 'created');
  armed = true;
  const abortedSecond = nonEmptyCoordinator.create(request('test.diagnostic', { value: 'candidate' }));
  assert.equal(abortedSecond.status, 'rejected');
  assert.deepEqual(nonEmptyCoordinator.snapshot.inboxEvents, [retained.event],
    'Rollback must not remove an earlier committed event.');
  assert.equal(nonEmptyCoordinator.snapshot.nextEventId, 2);
  armed = false;
  const retriedSecond = nonEmptyCoordinator.create(request('test.diagnostic', { value: 'retried' }));
  assert.equal(retriedSecond.status, 'created');
  assert.equal(retriedSecond.event.eventId, 2);
});

test('D09-A1 A03 unconfirmed rollback blocks all later creation with inspectable failure', () => {
  let failDuringCommit = false;
  const { coordinator } = coordinatorWithUuid(UUID_A, {
    faultInjector: point => {
      if (point === 'registration-committed') {
        failDuringCommit = true;
        throw new Error('injected commit failure');
      }
      if (point === 'rollback' && failDuringCommit) {
        throw new Error('injected rollback failure');
      }
    },
  });

  const failed = coordinator.create(request());
  assert.equal(failed.status, 'blocked');
  assert.equal(failed.failure.code, 'rollback-unconfirmed');
  assert.equal(failed.failure.rollback, 'unconfirmed');
  assert.equal(coordinator.snapshot.blocked, true);
  assert.equal(coordinator.snapshot.lastFailure.code, 'rollback-unconfirmed');

  const rejectedAfterBlock = coordinator.create(request());
  assert.equal(rejectedAfterBlock.status, 'blocked');
  assert.equal(rejectedAfterBlock.failure.code, 'rollback-unconfirmed');
  assert.deepEqual(coordinator.snapshot.counts, { lifecycleRecords: 0, inboxEvents: 0 });
});

test('D09-A1 A04 inbox capacity and invalid requests reject without consuming an ID', () => {
  const { coordinator: capacityCoordinator } = coordinatorWithUuid(UUID_A, {
    inboxCapacity: 1,
  });
  const first = capacityCoordinator.create(request());
  assert.equal(first.status, 'created');
  assert.equal(first.event.eventId, 1);
  const full = capacityCoordinator.create(request());
  assert.equal(full.status, 'rejected');
  assert.equal(full.reason, 'inbox-capacity');
  assert.deepEqual(capacityCoordinator.snapshot.counts, { lifecycleRecords: 1, inboxEvents: 1 });
  assert.equal(capacityCoordinator.snapshot.nextEventId, 2);

  const { coordinator: validationCoordinator } = coordinatorWithUuid(UUID_B);
  const invalidRequests = [
    {},
    { type: '', payload: {} },
    { type: 'test.progress', payload: undefined },
    { type: 'test.progress', payload: { invalid: Number.NaN } },
    { type: 'test.progress', payload: { invalid: () => {} } },
    request('test.unsupported'),
  ];
  for (const invalid of invalidRequests) {
    const result = validationCoordinator.create(invalid);
    assert.equal(result.status, 'rejected');
  }
  assert.deepEqual(validationCoordinator.snapshot.counts, { lifecycleRecords: 0, inboxEvents: 0 });
  assert.equal(validationCoordinator.snapshot.nextEventId, 1);
  const validAfterRejections = validationCoordinator.create(request());
  assert.equal(validAfterRejections.status, 'created');
  assert.equal(validAfterRejections.event.eventId, 1);

  assert.throws(() => new RuntimeEventContext(
    { generate: () => UUID_A },
    { initialNextEventId: 0 },
  ), RangeError);
  assert.throws(() => contextWithUuid(UUID_A).createCoordinator({
    inboxCapacity: 0,
    allowedEventTypes: EVENT_TYPES,
  }), RangeError);
});

test('D09-A1 A04 safe integer boundary rejects exhaustion without wrapping or reusing IDs', () => {
  const max = Number.MAX_SAFE_INTEGER;
  const { coordinator } = coordinatorWithUuid(UUID_A, {
    initialNextEventId: max,
  });
  const last = coordinator.create(request());
  assert.equal(last.status, 'created');
  assert.equal(last.event.eventId, max);
  assert.equal(coordinator.snapshot.nextEventId, null);

  const exhausted = coordinator.create(request());
  assert.equal(exhausted.status, 'rejected');
  assert.equal(exhausted.reason, 'event-id-exhausted');
  assert.deepEqual(coordinator.snapshot.counts, { lifecycleRecords: 1, inboxEvents: 1 });
  assert.equal(coordinator.snapshot.inboxEvents[0].eventId, max);

  const fresh = coordinatorWithUuid(UUID_B).coordinator.create(request());
  assert.equal(fresh.status, 'created');
  assert.equal(fresh.event.eventId, 1, 'A new runtime context starts a separate sequence.');
  assert.throws(() => contextWithUuid(UUID_A, max + 1), RangeError);
});

test('D09-A1 A05 created events remain Pending; later lifecycle and processing stay absent', () => {
  const { coordinator } = coordinatorWithUuid(UUID_A);
  const created = coordinator.create(request());
  assert.equal(created.status, 'created');

  const snapshot = coordinator.snapshot;
  assert.deepEqual(snapshot.lifecycleRecords.map(record => record.status), ['pending']);
  assert.deepEqual(snapshot.inboxEvents.map(event => event.status), ['pending']);
  assert.equal(snapshot.lastFailure, undefined);
  assert.equal('process' in coordinator, false);
  assert.equal('dispatch' in coordinator, false);
  assert.equal('acknowledge' in coordinator, false);
});
