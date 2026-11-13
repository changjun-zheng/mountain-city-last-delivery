import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { RuntimeEventContext } from '../src/core/events.ts';
import {
  InMemoryRunProgress,
  PROTOTYPE_PROGRESS_CONTENT,
} from '../src/core/progress.ts';
import {
  PrototypeProgressTransactionExecutor,
  RuntimeTransactionExecutionManager,
} from '../src/core/transactions.ts';
import {
  TRANSACTION_RESULT_EVENT_TYPE,
} from '../src/core/transaction-results.ts';

const UUID = '91000000-0000-4000-8000-000000000001';
const TARGET = 'prototype.progress-transaction';
const GOAL = PROTOTYPE_PROGRESS_CONTENT.goal;

function makeRuntime(options = {}) {
  let target;
  let deliveryFaultPoint;
  const handlerCounts = new Map();
  const context = new RuntimeEventContext(
    { generate: () => options.runtimeInstanceId ?? UUID },
    {
      initialNextEventId: options.initialNextEventId ?? 1,
      initialNextCommandId: 1,
      initialNextTransactionId: 1,
    },
  );
  const events = context.createCoordinator({
    inboxCapacity: options.inboxCapacity ?? 32,
    historyCapacity: options.historyCapacity ?? 64,
    transactionResultCapacity: options.transactionResultCapacity ?? 32,
    allowedEventTypes: ['test.progress', TRANSACTION_RESULT_EVENT_TYPE],
    faultInjector: options.faultInjector,
    dispatchFaultInjector: options.dispatchFaultInjector,
    retirementFaultInjector: options.retirementFaultInjector,
    transactionResultConsumer: options.transactionResultConsumer,
    realCommandDelivery: {
      capacity: 32,
      faultInjector: point => {
        if (point === deliveryFaultPoint) {
          deliveryFaultPoint = undefined;
          throw new Error(`injected delivery fault at ${point}`);
        }
      },
      handler: event => {
        handlerCounts.set(
          event.eventId,
          (handlerCounts.get(event.eventId) ?? 0) + 1,
        );
        return {
          sourceEvent: event,
          targetId: TARGET,
          commandType: 'test.complete-goal',
          payload: { goalId: GOAL.businessId },
        };
      },
      targetFor: targetId => targetId === TARGET ? target : undefined,
    },
  });
  const commands = events.createCommandCoordinator({ capacity: 32 });
  target = commands.createTargetTransactionModule(TARGET, { capacity: 32 });
  const resultSource = events.createTransactionResultSource(TARGET);
  return {
    context,
    events,
    commands,
    target,
    resultSource,
    handlerCounts,
    armDeliveryFault(point) {
      deliveryFaultPoint = point;
    },
  };
}

function dispatch(runtime, simulationTick) {
  return runtime.events.dispatch({
    runtimeInstanceId: runtime.context.runtimeInstanceId,
    simulationTick,
    phase: 'coordination',
  });
}

function createEvent(runtime, payload = { value: 'result' }, producer) {
  const created = runtime.events.create(
    { type: 'test.progress', payload },
    producer,
  );
  assert.equal(created.status, 'created');
  return created.event;
}

function acceptEvent(runtime, payload = { value: 'result' }, producer) {
  const event = createEvent(runtime, payload, producer);
  const result = dispatch(runtime, 1);
  assert.equal(result.status, 'completed');
  const command = runtime.commands.snapshot.commands.at(-1);
  assert.ok(command);
  const query = runtime.target.query(command.commandId);
  assert.equal(query.status, 'found');
  return { event, command, query };
}

function makeManager(runtime, options = {}) {
  const progress = options.progress ?? new InMemoryRunProgress();
  const executor = options.executor ?? new PrototypeProgressTransactionExecutor(
    progress,
    options.executorOptions,
  );
  const manager = new RuntimeTransactionExecutionManager(
    runtime.target,
    runtime.context.runtimeInstanceId,
    progress,
    executor,
    {
      retryBudget: options.retryBudget ?? 0,
      recoveryBudget: options.recoveryBudget ?? 0,
      faultInjector: options.faultInjector,
      transactionResults: {
        port: runtime.events,
        source: runtime.resultSource,
      },
    },
  );
  return { manager, progress, executor };
}

function transactionContext(simulationTick) {
  return {
    runtimeInstanceId: UUID,
    simulationTick,
    phase: 'transaction',
  };
}

function resultContext(simulationTick) {
  return {
    runtimeInstanceId: UUID,
    simulationTick,
    phase: 'result',
  };
}

function succeedTransaction(runtime) {
  const accepted = acceptEvent(runtime);
  const { manager, progress } = makeManager(runtime);
  const started = manager.start(accepted.command.commandId);
  assert.equal(started.status, 'started');
  assert.equal(
    manager.advance(started.record.transactionId, transactionContext(2)).status,
    'progressed',
  );
  const terminal = manager.advance(
    started.record.transactionId,
    transactionContext(3),
  );
  assert.equal(terminal.status, 'succeeded');
  return { accepted, manager, progress, terminal: terminal.record };
}

function assertOneBusinessApplication(progress) {
  assert.deepEqual(progress.snapshot.counts, {
    collections: 0,
    goals: 1,
    rewards: 1,
    effects: 1,
  });
}

function forgedResultPayload(runtimeInstanceId, suffix = 'forged') {
  return Object.freeze({
    runtimeInstanceId,
    sourceEventId: 1,
    commandId: 1,
    transactionId: 1,
    targetId: TARGET,
    terminal: {
      status: 'succeeded',
      simulationTick: 3,
    },
    resultEventId: 2,
    diagnostic: suffix,
  });
}

test('D09-C2-R1 R01 public create rejects the reserved result type before allocation', () => {
  const configurations = [
    { label: 'no whitelist, no producer', allowedEventTypes: undefined, producer: false },
    { label: 'no whitelist, owned producer', allowedEventTypes: undefined, producer: true },
    {
      label: 'result type allowed, no producer',
      allowedEventTypes: ['test.progress', TRANSACTION_RESULT_EVENT_TYPE],
      producer: false,
    },
    {
      label: 'result type allowed, owned producer',
      allowedEventTypes: ['test.progress', TRANSACTION_RESULT_EVENT_TYPE],
      producer: true,
    },
  ];
  const payloads = [
    { terminal: { status: 'succeeded' }, transactionId: 999 },
    forgedResultPayload(UUID, 'copied-shape'),
  ];

  for (const configuration of configurations) {
    const context = new RuntimeEventContext(
      { generate: () => UUID },
      { initialNextEventId: 1 },
    );
    const faultPoints = [];
    const events = context.createCoordinator({
      inboxCapacity: 8,
      historyCapacity: 16,
      ...(configuration.allowedEventTypes
        ? { allowedEventTypes: configuration.allowedEventTypes }
        : {}),
      faultInjector: point => faultPoints.push(point),
    });
    const producer = configuration.producer ? events.createProducer() : undefined;
    const outcomes = payloads.map(payload => {
      const result = events.create(
        { type: TRANSACTION_RESULT_EVENT_TYPE, payload },
        producer,
      );
      return Object.freeze({
        status: result.status,
        reason: result.status === 'rejected' ? result.reason : undefined,
      });
    });

    assert.deepEqual(
      outcomes,
      payloads.map(() => ({ status: 'rejected', reason: 'reserved-event-type' })),
      configuration.label,
    );
    assert.deepEqual(faultPoints, [], configuration.label);
    assert.equal(events.snapshot.nextEventId, 1, configuration.label);
    assert.deepEqual(events.snapshot.lifecycleRecords, [], configuration.label);
    assert.deepEqual(events.snapshot.inboxEvents, [], configuration.label);
    assert.deepEqual(
      events.snapshot.transactionResults.bindings,
      [],
      configuration.label,
    );
    assert.deepEqual(
      events.snapshot.counts,
      { lifecycleRecords: 0, inboxEvents: 0 },
      configuration.label,
    );

    const normal = events.create({
      type: 'test.progress',
      payload: { value: configuration.label },
    }, producer);
    assert.equal(normal.status, 'created', configuration.label);
    assert.equal(normal.event.eventId, 1, configuration.label);
  }
});

test('D09-C2-R1 R02 unassociated result-shaped events never reach command paths', () => {
  const observations = [];

  const realRuntime = makeRuntime({
    transactionResultConsumer: () => {
      observations.push({ kind: 'real-consumer' });
      return { status: 'consumed' };
    },
  });
  const realCreate = realRuntime.events.create({
    type: TRANSACTION_RESULT_EVENT_TYPE,
    payload: forgedResultPayload(UUID, 'real-delivery'),
  });
  if (realCreate.status === 'created') {
    dispatch(realRuntime, 1);
  }
  const realNormal = realRuntime.events.create({
    type: 'test.progress',
    payload: { value: 'after-real-rejection' },
  });
  observations.push({
    kind: 'real-delivery',
    createStatus: realCreate.status,
    createReason: realCreate.status === 'rejected' ? realCreate.reason : undefined,
    handlerCalls: realRuntime.handlerCounts.size,
    commandCount: realRuntime.commands.snapshot.counts.commands,
    intentCount: realRuntime.target.snapshot.counts.intents,
    resultBindings: realRuntime.events.snapshot.transactionResults.bindings.length,
    nextEventId: realRuntime.events.snapshot.nextEventId,
    normalStatus: realNormal.status,
    normalEventId: realNormal.status === 'created' ? realNormal.event.eventId : undefined,
    inboxEventIds: realRuntime.events.snapshot.inboxEvents.map(event => event.eventId),
  });

  let testHandlerCalls = 0;
  let testReceiptCalls = 0;
  let testConsumerCalls = 0;
  const testContext = new RuntimeEventContext(
    { generate: () => UUID },
    { initialNextEventId: 1 },
  );
  const testEvents = testContext.createCoordinator({
    inboxCapacity: 8,
    historyCapacity: 16,
    allowedEventTypes: ['test.progress', TRANSACTION_RESULT_EVENT_TYPE],
    dispatchHandler: () => {
      testHandlerCalls += 1;
    },
    commandReceiptTestDouble: () => {
      testReceiptCalls += 1;
      return { status: 'accepted', testCommandReference: 'test-only-command' };
    },
    transactionResultConsumer: () => {
      testConsumerCalls += 1;
      return { status: 'consumed' };
    },
  });
  const testCreate = testEvents.create({
    type: TRANSACTION_RESULT_EVENT_TYPE,
    payload: forgedResultPayload(UUID, 'test-double'),
  });
  if (testCreate.status === 'created') {
    testEvents.dispatch({
      runtimeInstanceId: UUID,
      simulationTick: 1,
      phase: 'coordination',
    });
  }
  const testNormal = testEvents.create({
    type: 'test.progress',
    payload: { value: 'after-test-double-rejection' },
  });
  observations.push({
    kind: 'test-double',
    createStatus: testCreate.status,
    createReason: testCreate.status === 'rejected' ? testCreate.reason : undefined,
    handlerCalls: testHandlerCalls,
    receiptCalls: testReceiptCalls,
    consumerCalls: testConsumerCalls,
    resultBindings: testEvents.snapshot.transactionResults.bindings.length,
    nextEventId: testEvents.snapshot.nextEventId,
    normalStatus: testNormal.status,
    normalEventId: testNormal.status === 'created' ? testNormal.event.eventId : undefined,
    inboxEventIds: testEvents.snapshot.inboxEvents.map(event => event.eventId),
  });

  let resultOnlyConsumerCalls = 0;
  const resultOnlyContext = new RuntimeEventContext(
    { generate: () => UUID },
    { initialNextEventId: 1 },
  );
  const resultOnlyEvents = resultOnlyContext.createCoordinator({
    inboxCapacity: 8,
    historyCapacity: 16,
    allowedEventTypes: ['test.progress', TRANSACTION_RESULT_EVENT_TYPE],
    transactionResultConsumer: () => {
      resultOnlyConsumerCalls += 1;
      return { status: 'consumed' };
    },
  });
  const resultOnlyCreate = resultOnlyEvents.create({
    type: TRANSACTION_RESULT_EVENT_TYPE,
    payload: forgedResultPayload(UUID, 'result-only'),
  });
  if (resultOnlyCreate.status === 'created') {
    resultOnlyEvents.dispatch({
      runtimeInstanceId: UUID,
      simulationTick: 1,
      phase: 'coordination',
    });
  }
  const resultOnlyNormal = resultOnlyEvents.create({
    type: 'test.progress',
    payload: { value: 'after-result-only-rejection' },
  });
  observations.push({
    kind: 'result-only',
    createStatus: resultOnlyCreate.status,
    createReason: resultOnlyCreate.status === 'rejected'
      ? resultOnlyCreate.reason
      : undefined,
    consumerCalls: resultOnlyConsumerCalls,
    resultBindings: resultOnlyEvents.snapshot.transactionResults.bindings.length,
    nextEventId: resultOnlyEvents.snapshot.nextEventId,
    normalStatus: resultOnlyNormal.status,
    normalEventId: resultOnlyNormal.status === 'created'
      ? resultOnlyNormal.event.eventId
      : undefined,
    inboxEventIds: resultOnlyEvents.snapshot.inboxEvents.map(event => event.eventId),
  });

  assert.deepEqual(
    observations.map(({ kind, createStatus, createReason, nextEventId, normalEventId }) => ({
      kind,
      createStatus,
      createReason,
      nextEventId,
      normalEventId,
    })),
    ['real-delivery', 'test-double', 'result-only'].map(kind => ({
      kind,
      createStatus: 'rejected',
      createReason: 'reserved-event-type',
      nextEventId: 2,
      normalEventId: 1,
    })),
  );
  assert.deepEqual(
    observations.map(({ handlerCalls = 0, receiptCalls = 0, consumerCalls = 0 }) => ({
      handlerCalls,
      receiptCalls,
      consumerCalls,
    })),
    [
      { handlerCalls: 0, receiptCalls: 0, consumerCalls: 0 },
      { handlerCalls: 0, receiptCalls: 0, consumerCalls: 0 },
      { handlerCalls: 0, receiptCalls: 0, consumerCalls: 0 },
    ],
  );
  assert.equal(observations[0].commandCount, 0);
  assert.equal(observations[0].intentCount, 0);
  assert.deepEqual(
    observations.map(observation => observation.resultBindings),
    [0, 0, 0],
  );
  assert.deepEqual(
    observations.map(observation => observation.inboxEventIds),
    [[1], [1], [1]],
    'The only queued event in each mode is the subsequent legal ordinary event.',
  );
});

test('D09-C2 G01 only registered terminals create one associated result event', () => {
  const successRuntime = makeRuntime();
  const success = succeedTransaction(successRuntime);
  const succeededResult = success.manager.requestResultEvent(
    success.terminal.transactionId,
    resultContext(4),
  );
  assert.equal(succeededResult.status, 'created');
  assert.equal(succeededResult.association.resultEventId, 2);
  assert.equal(succeededResult.association.sourceEventId, success.accepted.event.eventId);
  assert.equal(succeededResult.association.commandId, success.accepted.command.commandId);
  assert.equal(
    succeededResult.association.transactionId,
    success.accepted.query.intent.transactionId,
  );
  assert.equal(succeededResult.association.runtimeInstanceId, UUID);
  assert.deepEqual(succeededResult.association.terminal, {
    status: 'succeeded',
    simulationTick: 3,
  });
  assertOneBusinessApplication(success.progress);

  const failedRuntime = makeRuntime();
  const failedAccepted = acceptEvent(failedRuntime, { value: 'failed' });
  const failedProgress = new InMemoryRunProgress();
  const { manager: failedManager } = makeManager(failedRuntime, {
    progress: failedProgress,
    executor: new PrototypeProgressTransactionExecutor(failedProgress, {
      goalId: 'goal.prototype.not-configured',
    }),
  });
  const failedStart = failedManager.start(failedAccepted.command.commandId);
  assert.equal(failedStart.status, 'started');
  const failed = failedManager.advance(
    failedStart.record.transactionId,
    transactionContext(2),
  );
  assert.equal(failed.status, 'failed');
  const failedResult = failedManager.requestResultEvent(
    failed.record.transactionId,
    resultContext(3),
  );
  assert.equal(failedResult.status, 'created');
  assert.equal(failedResult.association.resultEventId, 2);
  assert.deepEqual(failedResult.association.terminal, {
    status: 'failed',
    simulationTick: 2,
    reasonCode: 'prototype.invalid-completion-request',
    message: 'Command payload does not contain the configured prototype goal ID.',
  });
  assert.deepEqual(failedProgress.snapshot.counts, {
    collections: 0,
    goals: 0,
    rewards: 0,
    effects: 0,
  });

  const pendingRuntime = makeRuntime();
  const pendingAccepted = acceptEvent(pendingRuntime, { value: 'pending' });
  let failTerminal = true;
  const pendingProgress = new InMemoryRunProgress();
  const { manager: pendingManager } = makeManager(pendingRuntime, {
    progress: pendingProgress,
    faultInjector: point => {
      if (point === 'before-terminal-commit' && failTerminal) {
        failTerminal = false;
        throw new Error('keep terminal metadata pending');
      }
    },
  });
  const pendingStart = pendingManager.start(pendingAccepted.command.commandId);
  assert.equal(pendingStart.status, 'started');
  const runningResult = pendingManager.requestResultEvent(
    pendingStart.record.transactionId,
    resultContext(2),
  );
  assert.equal(
    runningResult.status === 'rejected' ? runningResult.reason : runningResult.status,
    'not-terminal',
  );
  assert.equal(
    pendingManager.advance(
      pendingStart.record.transactionId,
      transactionContext(2),
    ).status,
    'progressed',
  );
  const terminalPending = pendingManager.advance(
    pendingStart.record.transactionId,
    transactionContext(3),
  );
  assert.equal(terminalPending.status, 'terminal-pending');
  const blockedResult = pendingManager.requestResultEvent(
    pendingStart.record.transactionId,
    resultContext(4),
  );
  assert.equal(
    blockedResult.status === 'rejected' ? blockedResult.reason : blockedResult.status,
    'not-terminal',
  );
  assert.equal(pendingRuntime.events.snapshot.nextEventId, 2);
  assert.equal(pendingRuntime.events.snapshot.transactionResults.bindings.length, 0);
  assertOneBusinessApplication(pendingProgress);
});

test('D09-C2 G02 creation faults and capacity do not duplicate or consume result IDs', () => {
  let faultPoint = 'before-result-binding-commit';
  const runtime = makeRuntime({
    faultInjector: point => {
      if (point === faultPoint) {
        const injected = faultPoint;
        faultPoint = 'after-result-commit';
        throw new Error(`injected ${injected}`);
      }
      if (point === faultPoint) {
        faultPoint = undefined;
        throw new Error('injected after-result-commit');
      }
    },
  });
  const success = succeedTransaction(runtime);

  const rolledBack = success.manager.requestResultEvent(
    success.terminal.transactionId,
    resultContext(4),
  );
  assert.equal(
    rolledBack.status === 'rejected' ? rolledBack.reason : rolledBack.status,
    'transaction-aborted',
  );
  assert.equal(runtime.events.snapshot.nextEventId, 2);
  assert.equal(runtime.events.snapshot.inboxEvents.length, 0);

  const unknown = success.manager.requestResultEvent(
    success.terminal.transactionId,
    resultContext(5),
  );
  assert.equal(unknown.status, 'unknown');
  assert.equal(unknown.record.resultEventId, 2);

  const existing = success.manager.requestResultEvent(
    success.terminal.transactionId,
    resultContext(6),
  );
  assert.equal(existing.status, 'existing');
  assert.equal(existing.association.resultEventId, 2);
  assert.equal(runtime.events.snapshot.nextEventId, 3);
  assert.equal(runtime.events.snapshot.inboxEvents.length, 1);
  assert.equal(runtime.events.snapshot.transactionResults.bindings.length, 1);
  assert.equal(runtime.commands.snapshot.counts.commands, 1);
  assert.equal(runtime.commands.snapshot.transactionIds.nextId, 2);
  assertOneBusinessApplication(success.progress);

  for (const point of [
    'candidate-prepared',
    'registration-prepared',
    'inbox-prepared',
    'event-id-committed',
    'registration-committed',
    'inbox-committed',
    'before-result-binding-commit',
  ]) {
    let armed = false;
    const faultRuntime = makeRuntime({
      faultInjector: current => {
        if (armed && current === point) {
          armed = false;
          throw new Error(`injected ${point}`);
        }
      },
    });
    const faultSuccess = succeedTransaction(faultRuntime);
    armed = true;
    const failed = faultSuccess.manager.requestResultEvent(
      faultSuccess.terminal.transactionId,
      resultContext(4),
    );
    assert.equal(
      failed.status === 'rejected' ? failed.reason : failed.status,
      'transaction-aborted',
      point,
    );
    assert.equal(faultRuntime.events.snapshot.nextEventId, 2, point);
    assert.equal(faultRuntime.events.snapshot.lifecycleRecords.length, 1, point);
    assert.equal(faultRuntime.events.snapshot.inboxEvents.length, 0, point);
    assert.equal(
      faultRuntime.events.snapshot.transactionResults.bindings.length,
      0,
      point,
    );
    assertOneBusinessApplication(faultSuccess.progress);
  }

  const fullRuntime = makeRuntime({ inboxCapacity: 1 });
  const fullSuccess = succeedTransaction(fullRuntime);
  createEvent(fullRuntime, { value: 'occupy-inbox' });
  const nextEventIdBefore = fullRuntime.events.snapshot.nextEventId;
  const capacity = fullSuccess.manager.requestResultEvent(
    fullSuccess.terminal.transactionId,
    resultContext(4),
  );
  assert.equal(
    capacity.status === 'rejected' ? capacity.reason : capacity.status,
    'inbox-capacity',
  );
  assert.equal(fullRuntime.events.snapshot.nextEventId, nextEventIdBefore);
  assert.equal(fullRuntime.events.snapshot.transactionResults.bindings.length, 0);
  assertOneBusinessApplication(fullSuccess.progress);
});

test('D09-C2 G03 fixed-phase result consumption is idempotent and never creates commands', () => {
  const appliedResults = new Set();
  let consumerCalls = 0;
  let failCompletion = false;
  const runtime = makeRuntime({
    transactionResultConsumer: ({ association }) => {
      consumerCalls += 1;
      appliedResults.add(association.transactionId);
      return consumerCalls === 1
        ? { status: 'consumed' }
        : { status: 'already-consumed' };
    },
    dispatchFaultInjector: point => {
      if (point === 'before-completion-transition' && failCompletion) {
        failCompletion = false;
        throw new Error('result completion interruption');
      }
    },
  });
  const success = succeedTransaction(runtime);
  const created = success.manager.requestResultEvent(
    success.terminal.transactionId,
    resultContext(4),
  );
  assert.equal(created.status, 'created');
  const resultEventId = created.association.resultEventId;
  assert.equal(runtime.events.snapshot.lifecycleRecords[1].status, 'pending');
  assert.equal(runtime.events.snapshot.lifecycleRecords[1].status === 'completed', false);
  assert.equal(consumerCalls, 0);
  failCompletion = true;

  const commandCount = runtime.commands.snapshot.counts.commands;
  const transactionCount = runtime.target.snapshot.counts.intents;
  const interrupted = dispatch(runtime, 5);
  assert.equal(interrupted.status, 'blocked');
  assert.equal(
    interrupted.status === 'blocked' ? interrupted.failure.code : undefined,
    'result-lifecycle-invalid',
  );
  assert.equal(consumerCalls, 1);
  assert.equal(appliedResults.size, 1);
  assert.equal(runtime.events.snapshot.lifecycleRecords[1].status, 'pending');
  assert.equal(runtime.events.snapshot.dispatchBlocked, false);

  const recovered = dispatch(runtime, 6);
  assert.equal(recovered.status, 'completed');
  assert.deepEqual(recovered.progress.completedEventIds, [resultEventId]);
  assert.equal(consumerCalls, 2);
  assert.equal(appliedResults.size, 1);
  assert.equal(runtime.events.snapshot.lifecycleRecords[1].status, 'completed');
  assert.equal(
    runtime.events.snapshot.lifecycleRecords[1].transactionResultConsumed,
    true,
  );
  assert.equal(runtime.commands.snapshot.counts.commands, commandCount);
  assert.equal(runtime.target.snapshot.counts.intents, transactionCount);
  assert.equal(runtime.commands.snapshot.transactionIds.nextId, 2);
  assertOneBusinessApplication(success.progress);

  const replayed = dispatch(runtime, 7);
  assert.equal(replayed.status, 'completed');
  assert.deepEqual(replayed.progress.processedEventIds, []);
  assert.equal(consumerCalls, 2);
});

test('D09-C2 G04 result creation is independent from original-event lifecycle and identity is enforced', () => {
  const runtime = makeRuntime();
  const originalProducer = runtime.events.createProducer();
  const accepted = acceptEvent(runtime, { value: 'retire-first' }, originalProducer);
  const originalResult = runtime.events.readFinalResult(
    originalProducer,
    accepted.event.eventId,
  );
  assert.equal(originalResult.status, 'available');
  assert.equal(
    runtime.events.acknowledge(originalProducer, originalResult.result).status,
    'acknowledged',
  );
  assert.equal(
    runtime.events.retire(originalProducer, originalResult.result).status,
    'retired',
  );

  const { manager } = makeManager(runtime);
  const started = manager.start(accepted.command.commandId);
  assert.equal(started.status, 'started');
  assert.equal(
    manager.advance(started.record.transactionId, transactionContext(2)).status,
    'progressed',
  );
  assert.equal(
    manager.advance(started.record.transactionId, transactionContext(3)).status,
    'succeeded',
  );
  const created = manager.requestResultEvent(
    started.record.transactionId,
    resultContext(4),
  );
  assert.equal(created.status, 'created');
  assert.equal(created.association.sourceEventId, accepted.event.eventId);

  const forgedSource = { ...runtime.resultSource };
  const forgedRequest = runtime.events.requestTransactionResult(
    forgedSource,
    started.record.transactionId,
  );
  assert.equal(
    forgedRequest.status === 'rejected' ? forgedRequest.reason : forgedRequest.status,
    'invalid-source',
  );

  const invalidSource = runtime.events.createTransactionResultSource(TARGET);
  assert.equal(
    runtime.events.registerTransactionResultAuthority(
      invalidSource,
      () => ({
        status: 'found',
        request: {
          runtimeInstanceId: UUID,
          sourceEventId: accepted.event.eventId,
          commandId: accepted.command.commandId,
          transactionId: started.record.transactionId,
          targetId: TARGET,
          terminal: {
            status: 'terminal-pending',
            simulationTick: 3,
          },
        },
      }),
    ).status,
    'registered',
  );
  const tampered = runtime.events.requestTransactionResult(
    invalidSource,
    started.record.transactionId,
  );
  assert.equal(
    tampered.status === 'rejected' ? tampered.reason : tampered.status,
    'invalid-request',
  );

  const wrongTargetSource = runtime.events.createTransactionResultSource('other.target');
  runtime.events.registerTransactionResultAuthority(
    wrongTargetSource,
    () => ({
      status: 'found',
      request: {
        runtimeInstanceId: UUID,
        sourceEventId: accepted.event.eventId,
        commandId: accepted.command.commandId,
        transactionId: started.record.transactionId,
        targetId: TARGET,
        terminal: { status: 'succeeded', simulationTick: 3 },
      },
    }),
  );
  const crossTarget = runtime.events.requestTransactionResult(
    wrongTargetSource,
    started.record.transactionId,
  );
  assert.equal(
    crossTarget.status === 'rejected' ? crossTarget.reason : crossTarget.status,
    'target-mismatch',
  );

  const unknownRuntime = makeRuntime();
  const unknownAccepted = acceptEvent(unknownRuntime, { value: 'unknown-command' });
  unknownRuntime.armDeliveryFault('after-target-accept-returned');
  const unknownEvent = createEvent(unknownRuntime, { value: 'unknown-command' });
  const unknownDispatch = dispatch(unknownRuntime, 2);
  assert.equal(unknownDispatch.status, 'completed');
  const unknownCommand = unknownRuntime.commands.snapshot.commands.find(
    command => command.eventId === unknownEvent.eventId,
  );
  assert.ok(unknownCommand);
  const unknownProgress = new InMemoryRunProgress();
  const { manager: unknownManager } = makeManager(unknownRuntime, {
    progress: unknownProgress,
  });
  const unknownStart = unknownManager.start(unknownCommand.commandId);
  assert.equal(unknownStart.status, 'started');
  assert.equal(
    unknownManager.advance(
      unknownStart.record.transactionId,
      transactionContext(2),
    ).status,
    'progressed',
  );
  assert.equal(
    unknownManager.advance(
      unknownStart.record.transactionId,
      transactionContext(3),
    ).status,
    'succeeded',
  );
  const unknownResult = unknownManager.requestResultEvent(
    unknownStart.record.transactionId,
    resultContext(4),
  );
  assert.equal(unknownResult.status, 'created');
  assert.equal(unknownRuntime.target.query(unknownCommand.commandId).status, 'found');
  assertOneBusinessApplication(unknownProgress);
});

test('D09-C2 G05 confirmation, retirement and repeated feedback preserve one result identity', () => {
  const runtime = makeRuntime({
    transactionResultConsumer: () => ({ status: 'consumed' }),
  });
  const success = succeedTransaction(runtime);
  const created = success.manager.requestResultEvent(
    success.terminal.transactionId,
    resultContext(4),
  );
  assert.equal(created.status, 'created');
  const resultEvent = created.association.resultEventId;
  const pendingResultEnvelope = runtime.events.snapshot.inboxEvents.find(
    event => event.eventId === resultEvent,
  );
  assert.ok(pendingResultEnvelope);
  assert.equal(dispatch(runtime, 5).status, 'completed');

  const resultProducer = success.manager.resultProducer;
  assert.ok(resultProducer);
  const read = runtime.events.readFinalResult(resultProducer, resultEvent);
  assert.equal(read.status, 'available');
  assert.deepEqual(read.result.transactionResult, created.association);

  const wrongProducer = runtime.events.createProducer();
  const wrongRead = runtime.events.readFinalResult(wrongProducer, resultEvent);
  assert.equal(
    wrongRead.status === 'rejected' ? wrongRead.reason : wrongRead.status,
    'producer-mismatch',
  );
  const earlyRetirement = runtime.events.retire(resultProducer, read.result);
  assert.equal(
    earlyRetirement.status === 'rejected'
      ? earlyRetirement.reason
      : earlyRetirement.status,
    'not-acknowledged',
  );
  assert.equal(
    runtime.events.acknowledge(wrongProducer, read.result).status,
    'rejected',
  );
  assert.equal(
    runtime.events.acknowledge(resultProducer, read.result).status,
    'acknowledged',
  );
  const retired = runtime.events.retire(resultProducer, read.result);
  assert.equal(retired.status, 'retired');
  assert.equal(resultEvent, 2);
  assert.equal(retired.watermark, 0);
  assert.deepEqual(runtime.events.snapshot.retirement.lightweightEventIds, [2]);

  const repeated = success.manager.requestResultEvent(
    success.terminal.transactionId,
    resultContext(6),
  );
  assert.equal(repeated.status, 'existing');
  assert.equal(repeated.association.resultEventId, resultEvent);
  assert.equal(runtime.events.snapshot.nextEventId, 3);

  const redelivery = runtime.events.probeRedelivery(pendingResultEnvelope);
  assert.equal(
    redelivery.status === 'rejected' ? redelivery.reason : redelivery.status,
    'retired-event',
  );
  assertOneBusinessApplication(success.progress);

  const capacityRuntime = makeRuntime({ transactionResultCapacity: 1 });
  const firstSource = capacityRuntime.events.createTransactionResultSource(TARGET);
  const secondSource = capacityRuntime.events.createTransactionResultSource(TARGET);
  const authority = transactionId => ({
    status: 'found',
    request: {
      runtimeInstanceId: UUID,
      sourceEventId: transactionId,
      commandId: transactionId,
      transactionId,
      targetId: TARGET,
      terminal: { status: 'succeeded', simulationTick: 3 },
    },
  });
  assert.equal(
    capacityRuntime.events.registerTransactionResultAuthority(firstSource, authority).status,
    'registered',
  );
  assert.equal(
    capacityRuntime.events.registerTransactionResultAuthority(secondSource, authority).status,
    'registered',
  );
  assert.equal(
    capacityRuntime.events.requestTransactionResult(firstSource, 1).status,
    'created',
  );
  const nextEventId = capacityRuntime.events.snapshot.nextEventId;
  const capacityRejected = capacityRuntime.events.requestTransactionResult(secondSource, 2);
  assert.equal(
    capacityRejected.status === 'rejected'
      ? capacityRejected.reason
      : capacityRejected.status,
    'result-capacity',
  );
  assert.equal(capacityRuntime.events.snapshot.nextEventId, nextEventId);
  assert.equal(capacityRuntime.events.snapshot.transactionResults.bindings.length, 1);
  assert.equal(
    capacityRuntime.events.requestTransactionResult(firstSource, 1).status,
    'existing',
  );
});

test('D09-C2 G06 persistent feedback failures remain bounded and never replay business', async () => {
  let allowCreation = false;
  let consumerAttempts = 0;
  const runtime = makeRuntime({
    faultInjector: point => {
      if (point === 'before-result-binding-commit' && !allowCreation) {
        throw new Error('persistent result binding outage');
      }
    },
    transactionResultConsumer: () => {
      consumerAttempts += 1;
      return { status: 'failed', message: 'persistent notification outage' };
    },
  });
  const success = succeedTransaction(runtime);

  for (const simulationTick of [4, 5]) {
    const failed = success.manager.requestResultEvent(
      success.terminal.transactionId,
      resultContext(simulationTick),
    );
    assert.equal(
      failed.status === 'rejected' ? failed.reason : failed.status,
      'transaction-aborted',
    );
    assert.equal(runtime.events.snapshot.nextEventId, 2);
    assertOneBusinessApplication(success.progress);
  }

  allowCreation = true;
  const created = success.manager.requestResultEvent(
    success.terminal.transactionId,
    resultContext(6),
  );
  assert.equal(created.status, 'created');

  for (const simulationTick of [7, 8]) {
    const failed = dispatch(runtime, simulationTick);
    assert.equal(failed.status, 'blocked');
    assert.equal(
      failed.status === 'blocked' ? failed.failure.code : undefined,
      'result-consumer-threw',
    );
    assert.equal(runtime.events.snapshot.lifecycleRecords[1].status, 'pending');
    assert.equal(runtime.events.snapshot.nextEventId, 3);
    assert.equal(runtime.target.snapshot.counts.intents, 1);
    assert.equal(runtime.commands.snapshot.counts.commands, 1);
    assertOneBusinessApplication(success.progress);
  }
  assert.equal(consumerAttempts, 2);

  const terminalRead = success.manager.read(success.terminal.transactionId);
  assert.equal(terminalRead.status, 'succeeded');
  assert.deepEqual(terminalRead.terminal, {
    status: 'succeeded',
    simulationTick: 3,
  });
  assert.equal(terminalRead.resultRequestAttempts, 3);
  assert.equal(terminalRead.resultEventId, 2);
  assert.equal(success.manager.snapshot.counts.resultEvents, 1);
  assert.equal(success.manager.snapshot.counts.retiredResultEvents, 0);

  const source = await readFile(
    new URL('../src/core/transaction-results.ts', import.meta.url),
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
});
