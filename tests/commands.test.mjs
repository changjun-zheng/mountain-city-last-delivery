import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { RuntimeEventContext } from '../src/core/events.ts';

const UUID_A = '30000000-0000-4000-8000-000000000001';
const UUID_B = '30000000-0000-4000-8000-000000000002';

function acceptingReceipt(event) {
  return Object.freeze({
    status: 'accepted',
    testCommandReference: `test-command-${event.eventId}`,
  });
}

function makeRuntime(options = {}) {
  const context = new RuntimeEventContext(
    { generate: () => options.runtimeInstanceId ?? UUID_A },
    {
      initialNextEventId: options.initialNextEventId,
      initialNextCommandId: options.initialNextCommandId,
      initialNextTransactionId: options.initialNextTransactionId,
    },
  );
  const events = context.createCoordinator({
    inboxCapacity: options.inboxCapacity ?? 16,
    historyCapacity: options.historyCapacity ?? 16,
    allowedEventTypes: ['test.progress', 'test.diagnostic'],
    dispatchHandler: options.dispatchHandler ?? (() => {}),
    commandReceiptTestDouble:
      options.commandReceiptTestDouble ?? acceptingReceipt,
  });
  const commands = events.createCommandCoordinator({
    capacity: options.commandCapacity ?? 16,
  });
  return { context, events, commands };
}

function createEvent(events, payload = { value: 1 }, producer) {
  const created = events.create(
    { type: 'test.progress', payload },
    producer,
  );
  assert.equal(created.status, 'created');
  return created.event;
}

function createCommand(commands, sourceEvent, options = {}) {
  return commands.createCommand({
    sourceEvent,
    targetId: options.targetId ?? 'door.transaction',
    commandType: options.commandType ?? 'test.open-door',
    payload: options.payload ?? { amount: 1 },
  });
}

function accept(target, command) {
  return target.accept(command);
}

function dispatch(events, simulationTick = 1) {
  const result = events.dispatch({
    runtimeInstanceId: UUID_A,
    simulationTick,
    phase: 'coordination',
  });
  assert.equal(result.status, 'completed');
  return result;
}

test('D09-B1 D01 runtime IDs are independent and commands are stable per event', () => {
  const { commands, events } = makeRuntime({
    initialNextEventId: 10,
    initialNextCommandId: 20,
    initialNextTransactionId: 30,
  });
  const producerA = events.createProducer();
  const producerB = events.createProducer();
  const firstEvent = createEvent(events, { value: 'first' }, producerA);
  const secondEvent = createEvent(events, { value: 'second' }, producerB);
  assert.equal(firstEvent.eventId, 10);
  assert.equal(secondEvent.eventId, 11);
  assert.equal(commands.snapshot.transactionIds.nextId, 30);

  const first = createCommand(commands, firstEvent, {
    payload: { action: 'open', target: 'north' },
  });
  assert.equal(first.status, 'created');
  assert.equal(first.disposition, 'created');
  assert.equal(first.command.commandId, 20);
  assert.equal(first.command.runtimeInstanceId, UUID_A);
  assert.equal(first.command.eventId, firstEvent.eventId);
  assert.equal(Object.isFrozen(first.command), true);
  assert.equal(Object.isFrozen(first.command.payload), true);

  const repeated = createCommand(commands, firstEvent, {
    payload: { target: 'north', action: 'open' },
  });
  assert.equal(repeated.status, 'created');
  assert.equal(repeated.disposition, 'existing');
  assert.equal(repeated.command, first.command);
  assert.equal(commands.snapshot.commandIds.nextId, 21);

  const second = createCommand(commands, secondEvent);
  assert.equal(second.status, 'created');
  assert.equal(second.command.commandId, 21);
  assert.deepEqual(
    {
      eventIds: events.snapshot.nextEventId,
      commandIds: commands.snapshot.commandIds.nextId,
      transactionIds: commands.snapshot.transactionIds.nextId,
    },
    { eventIds: 12, commandIds: 22, transactionIds: 30 },
  );

  const secondCommandForSameEvent = createCommand(commands, firstEvent, {
    targetId: 'quest.transaction',
    commandType: 'test.grant-reward',
    payload: { amount: 2 },
  });
  assert.equal(
    secondCommandForSameEvent.status === 'rejected'
      ? secondCommandForSameEvent.reason
      : secondCommandForSameEvent.status,
    'second-command',
  );
  assert.equal(commands.snapshot.commandIds.nextId, 22);

  const otherRuntime = makeRuntime({ runtimeInstanceId: UUID_B });
  const foreignEvent = createEvent(otherRuntime.events);
  const foreignSource = createCommand(commands, foreignEvent);
  assert.equal(
    foreignSource.status === 'rejected'
      ? foreignSource.reason
      : foreignSource.status,
    'runtime-mismatch',
  );
  const invalidTarget = createCommand(commands, secondEvent, {
    targetId: 'Invalid Target',
  });
  assert.equal(
    invalidTarget.status === 'rejected'
      ? invalidTarget.reason
      : invalidTarget.status,
    'invalid-target',
  );
  assert.equal(commands.snapshot.commandIds.nextId, 22);
});

test('D09-B1 D02 target modules own isolated receipts and one intent per accepted command', () => {
  const { commands, events } = makeRuntime();
  const door = commands.createTargetTransactionModule('door.transaction', {
    capacity: 4,
  });
  const quest = commands.createTargetTransactionModule('quest.transaction', {
    capacity: 4,
  });
  const doorEvent = createEvent(events, { value: 'door' });
  const questEvent = createEvent(events, { value: 'quest' });
  const doorCommand = createCommand(commands, doorEvent, {
    targetId: 'door.transaction',
  });
  const questCommand = createCommand(commands, questEvent, {
    targetId: 'quest.transaction',
    commandType: 'test.record-goal',
  });
  assert.equal(doorCommand.status, 'created');
  assert.equal(questCommand.status, 'created');

  const accepted = accept(door, doorCommand.command);
  assert.equal(accepted.status, 'accepted');
  assert.equal(accepted.disposition, 'committed');
  assert.equal(accepted.record.runtimeInstanceId, UUID_A);
  assert.equal(accepted.record.eventId, doorEvent.eventId);
  assert.equal(accepted.record.commandId, doorCommand.command.commandId);
  assert.equal(accepted.intent.transactionId, 1);
  assert.equal(accepted.intent.executionState, 'not-started');
  assert.equal(accepted.intent.commandId, accepted.record.commandId);
  assert.equal(accepted.intent.eventId, accepted.record.eventId);
  assert.equal(accepted.intent.targetId, accepted.record.targetId);
  assert.equal(accepted.intent.runtimeInstanceId, accepted.record.runtimeInstanceId);

  const doorSnapshot = door.snapshot;
  assert.equal(doorSnapshot.status, 'healthy');
  assert.equal(doorSnapshot.counts.acceptedRecords, 1);
  assert.equal(doorSnapshot.counts.intents, 1);
  assert.equal(doorSnapshot.counts.businessExecutions, 0);
  assert.deepEqual(door.query(doorCommand.command.commandId), {
    status: 'found',
    record: accepted.record,
    intent: accepted.intent,
  });

  const wrongTarget = accept(quest, doorCommand.command);
  assert.equal(
    wrongTarget.status === 'rejected' ? wrongTarget.reason : wrongTarget.status,
    'target-mismatch',
  );
  assert.deepEqual(quest.query(doorCommand.command.commandId), {
    status: 'not-found',
    commandId: doorCommand.command.commandId,
  });
  const questAccepted = accept(quest, questCommand.command);
  assert.equal(questAccepted.status, 'accepted');
  assert.equal(questAccepted.intent.transactionId, 2);
  assert.equal(commands.snapshot.transactionIds.nextId, 3);
});

test('D09-B1 D03 duplicate delivery is idempotent while tampering and event retirement do not duplicate transactions', () => {
  const { commands, events } = makeRuntime();
  const target = commands.createTargetTransactionModule('door.transaction');
  const producer = events.createProducer();
  const sourceEvent = createEvent(events, { value: 'door' }, producer);
  const created = createCommand(commands, sourceEvent, {
    payload: { door: 'north', amount: 1 },
  });
  assert.equal(created.status, 'created');
  const first = accept(target, created.command);
  assert.equal(first.status, 'accepted');

  const duplicate = accept(target, created.command);
  assert.equal(duplicate.status, 'accepted');
  assert.equal(duplicate.disposition, 'duplicate');
  assert.equal(duplicate.record, first.record);
  assert.equal(duplicate.intent, first.intent);
  assert.equal(target.snapshot.counts.acceptedRecords, 1);
  assert.equal(target.snapshot.counts.intents, 1);
  assert.equal(commands.snapshot.transactionIds.nextId, 2);

  const clonedCommand = {
    ...created.command,
    payload: { ...created.command.payload, amount: 99 },
  };
  const tamperedDelivery = accept(target, clonedCommand);
  assert.equal(
    tamperedDelivery.status === 'rejected'
      ? tamperedDelivery.reason
      : tamperedDelivery.status,
    'invalid-command',
  );
  const eventIdentityTampered = accept(target, {
    ...created.command,
    eventId: created.command.eventId + 1,
  });
  assert.equal(
    eventIdentityTampered.status === 'rejected'
      ? eventIdentityTampered.reason
      : eventIdentityTampered.status,
    'invalid-command',
  );
  const targetIdentityTampered = accept(target, {
    ...created.command,
    targetId: 'quest.transaction',
  });
  assert.equal(
    targetIdentityTampered.status === 'rejected'
      ? targetIdentityTampered.reason
      : targetIdentityTampered.status,
    'invalid-command',
  );
  const tamperedRequest = createCommand(commands, sourceEvent, {
    payload: { amount: 99, door: 'north' },
  });
  assert.equal(
    tamperedRequest.status === 'rejected'
      ? tamperedRequest.reason
      : tamperedRequest.status,
    'second-command',
  );

  dispatch(events);
  const finalResult = events.readFinalResult(producer, sourceEvent.eventId);
  assert.equal(finalResult.status, 'available');
  assert.equal(
    events.acknowledge(producer, finalResult.result).status,
    'acknowledged',
  );
  const retired = events.retire(producer, finalResult.result);
  assert.equal(retired.status, 'retired');
  assert.equal(
    events.snapshot.lifecycleRecords.some(
      record => record.eventId === sourceEvent.eventId,
    ),
    false,
  );

  const afterRetirement = accept(target, created.command);
  assert.equal(afterRetirement.status, 'accepted');
  assert.equal(afterRetirement.disposition, 'duplicate');
  assert.equal(afterRetirement.intent.transactionId, first.intent.transactionId);
  assert.equal(commands.snapshot.transactionIds.nextId, 2);
});

test('D09-B1 D04 acceptance faults roll back and consume Transaction IDs without reusing holes', () => {
  let armedFault;
  const { commands, events } = makeRuntime();
  const target = commands.createTargetTransactionModule('fault.transaction', {
    capacity: 16,
    faultInjector: point => {
      if (point === armedFault) {
        armedFault = undefined;
        throw new Error(`injected ${point}`);
      }
    },
  });

  const stableEvent = createEvent(events, { value: 'stable' });
  const stableCommand = createCommand(commands, stableEvent, {
    targetId: 'fault.transaction',
  });
  const stableAccepted = accept(target, stableCommand.command);
  assert.equal(stableAccepted.status, 'accepted');
  assert.equal(stableAccepted.intent.transactionId, 1);

  const faultPoints = [
    'transaction-id-allocated',
    'receipt-prepared',
    'before-atomic-commit',
    'after-atomic-commit',
  ];
  const failedCommands = [];
  for (const [index, point] of faultPoints.entries()) {
    const event = createEvent(events, { value: `fault-${index}` });
    const command = createCommand(commands, event, {
      targetId: 'fault.transaction',
    });
    assert.equal(command.status, 'created');
    failedCommands.push(command.command);
    armedFault = point;
    const failed = accept(target, command.command);
    assert.equal(failed.status, 'failed');
    assert.equal(failed.failure.point, point);
    assert.equal(failed.failure.rollback, 'complete');
    assert.equal(failed.failure.transactionId, index + 2);
    assert.deepEqual(target.query(command.command.commandId), {
      status: 'not-found',
      commandId: command.command.commandId,
    });
    assert.equal(target.snapshot.counts.acceptedRecords, 1);
    assert.equal(target.snapshot.counts.intents, 1);
  }
  assert.equal(commands.snapshot.transactionIds.nextId, 6);

  const retried = accept(target, failedCommands[0]);
  assert.equal(retried.status, 'accepted');
  assert.equal(retried.intent.transactionId, 6);
  assert.equal(target.snapshot.counts.acceptedRecords, 2);

  let localDispatchFault = 'after-atomic-commit';
  const rollbackTarget = commands.createTargetTransactionModule(
    'rollback.transaction',
    {
      faultInjector: point => {
        if (point === localDispatchFault) {
          localDispatchFault = undefined;
          throw new Error(`injected ${point}`);
        }
      },
      rollbackFaultInjector: () => {
        throw new Error('injected rollback failure');
      },
    },
  );
  const blockedEvent = createEvent(events, { value: 'blocked' });
  const blockedCommand = createCommand(commands, blockedEvent, {
    targetId: 'rollback.transaction',
  });
  const blocked = accept(rollbackTarget, blockedCommand.command);
  assert.equal(blocked.status, 'blocked');
  assert.equal(blocked.failure.code, 'rollback-unconfirmed');
  assert.equal(rollbackTarget.query(blockedCommand.command.commandId).status, 'blocked');
  const blockedSnapshot = rollbackTarget.snapshot;
  assert.equal(blockedSnapshot.status, 'blocked');
  assert.equal(blockedSnapshot.counts.acceptedRecords, 0);
  assert.equal(blockedSnapshot.counts.intents, 0);
  assert.equal(stableTargetQuery(target, stableCommand.command.commandId), true);
});

function stableTargetQuery(target, commandId) {
  return target.query(commandId).status === 'found';
}

test('D09-B1 D05 capacity and sequence boundaries reject without corrupting accepted intentions', () => {
  const { commands, events } = makeRuntime({
    initialNextEventId: 3,
    initialNextCommandId: 5,
    initialNextTransactionId: 7,
  });
  const target = commands.createTargetTransactionModule('capacity.transaction', {
    capacity: 1,
  });
  const firstEvent = createEvent(events, { value: 1 });
  const secondEvent = createEvent(events, { value: 2 });
  const firstCommand = createCommand(commands, firstEvent, {
    targetId: 'capacity.transaction',
  });
  const secondCommand = createCommand(commands, secondEvent, {
    targetId: 'capacity.transaction',
  });
  const accepted = accept(target, firstCommand.command);
  assert.equal(accepted.status, 'accepted');
  assert.equal(accepted.intent.transactionId, 7);

  const beforeCapacity = commands.snapshot.transactionIds.nextId;
  const capacityRejected = accept(target, secondCommand.command);
  assert.equal(
    capacityRejected.status === 'rejected'
      ? capacityRejected.reason
      : capacityRejected.status,
    'capacity',
  );
  assert.equal(commands.snapshot.transactionIds.nextId, beforeCapacity);
  assert.equal(target.snapshot.counts.acceptedRecords, 1);

  const duplicate = accept(target, firstCommand.command);
  assert.equal(duplicate.status, 'accepted');
  assert.equal(duplicate.intent.transactionId, 7);
  assert.equal(target.query(firstCommand.command.commandId).status, 'found');

  const otherRuntime = makeRuntime({ runtimeInstanceId: UUID_B });
  const otherTarget = otherRuntime.commands.createTargetTransactionModule(
    'capacity.transaction',
  );
  const crossRuntime = accept(otherTarget, firstCommand.command);
  assert.equal(
    crossRuntime.status === 'rejected'
      ? crossRuntime.reason
      : crossRuntime.status,
    'invalid-command',
  );
  assert.equal(otherRuntime.commands.snapshot.transactionIds.nextId, 1);

  const max = Number.MAX_SAFE_INTEGER;
  const commandExhaustion = makeRuntime({
    initialNextCommandId: max,
  });
  const commandEventA = createEvent(commandExhaustion.events, { value: 'a' });
  const commandEventB = createEvent(commandExhaustion.events, { value: 'b' });
  const maxCommand = createCommand(commandExhaustion.commands, commandEventA);
  assert.equal(maxCommand.status, 'created');
  assert.equal(maxCommand.command.commandId, max);
  assert.equal(commandExhaustion.commands.snapshot.commandIds.nextId, null);
  const exhaustedCommand = createCommand(commandExhaustion.commands, commandEventB);
  assert.equal(
    exhaustedCommand.status === 'rejected'
      ? exhaustedCommand.reason
      : exhaustedCommand.status,
    'command-id-exhausted',
  );

  const transactionExhaustion = makeRuntime({
    initialNextTransactionId: max,
  });
  const exhaustedTarget =
    transactionExhaustion.commands.createTargetTransactionModule(
      'boundary.transaction',
      { capacity: 2 },
    );
  const maxTxEvent = createEvent(transactionExhaustion.events, { value: 'max-tx' });
  const nextTxEvent = createEvent(transactionExhaustion.events, { value: 'next-tx' });
  const maxTxCommand = createCommand(
    transactionExhaustion.commands,
    maxTxEvent,
    { targetId: 'boundary.transaction' },
  );
  const nextTxCommand = createCommand(
    transactionExhaustion.commands,
    nextTxEvent,
    { targetId: 'boundary.transaction' },
  );
  const maxTxAccepted = accept(exhaustedTarget, maxTxCommand.command);
  assert.equal(maxTxAccepted.status, 'accepted');
  assert.equal(maxTxAccepted.intent.transactionId, max);
  const noTransactionId = accept(exhaustedTarget, nextTxCommand.command);
  assert.equal(
    noTransactionId.status === 'rejected'
      ? noTransactionId.reason
      : noTransactionId.status,
    'transaction-id-exhausted',
  );
  assert.equal(exhaustedTarget.snapshot.counts.acceptedRecords, 1);
  assert.equal(exhaustedTarget.snapshot.nextTransactionId, null);
});

test('D09-B1 D06 command core remains platform-neutral and runtime capabilities stay singular', async () => {
  const source = await readFile(
    new URL('../src/core/commands.ts', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(
    source,
    /from\s+['"](?:node:|electron|phaser|fs|path|os|crypto)/,
  );
  assert.doesNotMatch(
    source,
    /\b(?:document|window|localStorage|sessionStorage)\b/,
  );

  const { events } = makeRuntime();
  assert.equal(typeof events.createCommandCoordinator, 'function');
  assert.throws(
    () => events.createCommandCoordinator(),
    /only own one command coordinator/,
  );
});
