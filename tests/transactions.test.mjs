import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import {
  InMemoryRunProgress,
  PROTOTYPE_PROGRESS_CONTENT,
} from '../src/core/progress.ts';
import { RuntimeEventContext } from '../src/core/events.ts';
import {
  PrototypeProgressTransactionExecutor,
  PrototypeTransactionExecutorError,
  RuntimeTransactionExecutionManager,
} from '../src/core/transactions.ts';

const UUID = '90000000-0000-4000-8000-000000000001';
const OTHER_UUID = '90000000-0000-4000-8000-000000000002';
const TARGET = 'prototype.progress-transaction';
const GOAL = PROTOTYPE_PROGRESS_CONTENT.goal;

function makeRuntime(options = {}) {
  let target;
  let deliveryFaultPoint;
  const handlerCounts = new Map();
  const context = new RuntimeEventContext(
    { generate: () => options.runtimeInstanceId ?? UUID },
    {
      initialNextEventId: 1,
      initialNextCommandId: 1,
      initialNextTransactionId: 1,
    },
  );
  const events = context.createCoordinator({
    inboxCapacity: 32,
    historyCapacity: 64,
    allowedEventTypes: ['test.progress'],
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
  target = commands.createTargetTransactionModule(TARGET, {
    capacity: options.targetCapacity ?? 32,
  });
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

function createEvent(events, payload = { value: 'prototype' }, producer) {
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
    ...(retryDeliveryEventIds ? { retryDeliveryEventIds } : {}),
  });
}

function acceptEvent(runtime, payload = { value: 'prototype' }, producer) {
  const event = createEvent(runtime.events, payload, producer);
  const result = dispatch(runtime.events, 1);
  assert.equal(result.status, 'completed');
  const command = runtime.commands.snapshot.commands.at(-1);
  assert.ok(command);
  const query = runtime.target.query(command.commandId);
  assert.equal(query.status, 'found');
  return { event, command, query };
}

function executionContext(simulationTick, runtimeInstanceId = UUID) {
  return {
    runtimeInstanceId,
    simulationTick,
    phase: 'transaction',
  };
}

function makeManager(runtime, options = {}) {
  const progress = options.progress ?? new InMemoryRunProgress();
  const executor = options.executor ?? new PrototypeProgressTransactionExecutor(
    progress,
    options.executorOptions,
  );
  const manager = new RuntimeTransactionExecutionManager(
    runtime.target,
    options.runtimeInstanceId ?? UUID,
    progress,
    executor,
    {
      ...(options.capacity === undefined ? {} : { capacity: options.capacity }),
      ...(options.retryBudget === undefined
        ? {}
        : { retryBudget: options.retryBudget }),
      ...(options.recoveryBudget === undefined
        ? {}
        : { recoveryBudget: options.recoveryBudget }),
      ...(options.faultInjector === undefined
        ? {}
        : { faultInjector: options.faultInjector }),
    },
  );
  return { manager, progress, executor };
}

function makeFaultInjector(rules) {
  const consumed = new Set();
  return (point, request) => {
    const rule = rules.find(candidate =>
      !consumed.has(candidate) &&
      candidate.point === point &&
      (candidate.simulationTick === undefined ||
        candidate.simulationTick === request.simulationTick) &&
      (candidate.phase === undefined || candidate.phase === request.phase));
    if (!rule) return;
    consumed.add(rule);
    throw new PrototypeTransactionExecutorError(
      rule.code,
      `injected ${rule.code}`,
    );
  };
}

function assertOneBusinessApplication(progress) {
  const snapshot = progress.snapshot;
  assert.deepEqual(snapshot.goals, [GOAL.businessId]);
  assert.deepEqual(snapshot.rewards, [GOAL.rewardId]);
  assert.deepEqual(snapshot.effects, [{
    id: GOAL.effectId,
    expectedActive: true,
  }]);
  assert.deepEqual(snapshot.counts, {
    collections: 0,
    goals: 1,
    rewards: 1,
    effects: 1,
  });
}

function assertIdentity(runtime, accepted, record) {
  assert.equal(record.runtimeInstanceId, accepted.query.record.runtimeInstanceId);
  assert.equal(record.eventId, accepted.event.eventId);
  assert.equal(record.commandId, accepted.command.commandId);
  assert.equal(record.transactionId, accepted.query.intent.transactionId);
  assert.equal(record.targetId, TARGET);
  assert.equal(record.commandType, accepted.command.type);
  assert.deepEqual(record.payload, accepted.command.payload);
  const current = runtime.target.query(record.commandId);
  assert.equal(current.status, 'found');
  assert.deepEqual(current.record, accepted.query.record);
  assert.deepEqual(current.intent, accepted.query.intent);
}

test('D09-C1 F01 a real Accepted intent crosses two Ticks into Succeeded once', () => {
  const runtime = makeRuntime();
  const accepted = acceptEvent(runtime);
  const { manager, progress } = makeManager(runtime);

  assert.deepEqual(progress.snapshot.counts, {
    collections: 0,
    goals: 0,
    rewards: 0,
    effects: 0,
  });
  assert.equal(
    runtime.events.snapshot.lifecycleRecords[0].status,
    'completed',
  );
  assert.equal(runtime.target.snapshot.counts.businessExecutions, 0);

  const started = manager.start(accepted.command.commandId);
  assert.equal(started.status, 'started');
  assert.equal(started.record.status, 'not-started');
  assert.equal(started.record.phase, 'apply');
  assertIdentity(runtime, accepted, started.record);
  assert.equal(manager.snapshot.counts.notStarted, 1);

  const applied = manager.advance(
    started.record.transactionId,
    executionContext(2),
  );
  assert.equal(applied.status, 'progressed');
  assert.equal(applied.record.status, 'running');
  assert.equal(applied.record.phase, 'verify');
  assert.equal(applied.record.executionAttempts, 1);
  assert.deepEqual(applied.record.businessAdditions, {
    goals: 1,
    rewards: 1,
    effects: 1,
  });
  assertOneBusinessApplication(progress);

  const succeeded = manager.advance(
    started.record.transactionId,
    executionContext(3),
  );
  assert.equal(succeeded.status, 'succeeded');
  assert.equal(succeeded.record.status, 'succeeded');
  assert.equal(succeeded.record.phase, 'verify');
  assert.equal(succeeded.record.executionAttempts, 2);
  assert.deepEqual(succeeded.record.terminal, {
    status: 'succeeded',
    simulationTick: 3,
  });
  assertIdentity(runtime, accepted, succeeded.record);
  assertOneBusinessApplication(progress);
  assert.equal(runtime.handlerCounts.get(accepted.event.eventId), 1);
  assert.equal(runtime.target.snapshot.counts.intents, 1);
  assert.equal(runtime.commands.snapshot.transactionIds.nextId, 2);
});

test('D09-C1 F02 repeated starts, tick abuse and retirement cannot duplicate execution', () => {
  const runtime = makeRuntime();
  const producer = runtime.events.createProducer();
  const accepted = acceptEvent(runtime, { value: 'retire-before-run' }, producer);
  const finalResult = runtime.events.readFinalResult(
    producer,
    accepted.event.eventId,
  );
  assert.equal(finalResult.status, 'available');
  assert.equal(
    runtime.events.acknowledge(producer, finalResult.result).status,
    'acknowledged',
  );
  assert.equal(runtime.events.retire(producer, finalResult.result).status, 'retired');

  const { manager, progress } = makeManager(runtime);
  const first = manager.start(accepted.command.commandId);
  assert.equal(first.status, 'started');
  const repeatedStart = manager.start(accepted.command.commandId);
  assert.equal(repeatedStart.status, 'existing');
  assert.equal(repeatedStart.record.transactionId, first.record.transactionId);

  const applied = manager.advance(first.record.transactionId, executionContext(2));
  assert.equal(applied.status, 'progressed');
  assert.equal(
    manager.advance(first.record.transactionId, executionContext(2)).status,
    'rejected',
  );
  assert.equal(
    manager.advance(first.record.transactionId, executionContext(1)).status,
    'rejected',
  );
  assertOneBusinessApplication(progress);

  const succeeded = manager.advance(first.record.transactionId, executionContext(3));
  assert.equal(succeeded.status, 'succeeded');
  const countsAtTerminal = progress.snapshot.counts;
  const afterTerminal = manager.advance(
    first.record.transactionId,
    executionContext(4),
  );
  assert.equal(
    afterTerminal.status === 'rejected' ? afterTerminal.reason : afterTerminal.status,
    'terminal',
  );
  assert.deepEqual(progress.snapshot.counts, countsAtTerminal);

  const duplicateAcceptance = runtime.target.accept(accepted.command);
  assert.equal(duplicateAcceptance.status, 'accepted');
  assert.equal(duplicateAcceptance.disposition, 'duplicate');
  assert.equal(
    duplicateAcceptance.intent.transactionId,
    accepted.query.intent.transactionId,
  );
  assert.equal(runtime.commands.snapshot.transactionIds.nextId, 2);
  assert.equal(runtime.target.snapshot.counts.intents, 1);
  assert.equal(runtime.target.query(accepted.command.commandId).status, 'found');
  assert.equal(runtime.events.snapshot.lifecycleRecords.length, 0);

  const recursiveRuntime = makeRuntime();
  const recursiveAccepted = acceptEvent(
    recursiveRuntime,
    { value: 'recursive' },
  );
  const recursiveProgress = new InMemoryRunProgress();
  let recursiveManager;
  let recursiveResult;
  const recursiveExecutor = {
    execute(request) {
      if (request.phase === 'apply') {
        recursiveResult = recursiveManager.advance(
          request.transactionId,
          executionContext(request.simulationTick),
        );
        recursiveProgress.completeGoal(GOAL.businessId);
      }
      return { status: 'completed' };
    },
  };
  recursiveManager = new RuntimeTransactionExecutionManager(
    recursiveRuntime.target,
    UUID,
    recursiveProgress,
    recursiveExecutor,
  );
  const recursiveStarted = recursiveManager.start(
    recursiveAccepted.command.commandId,
  );
  assert.equal(recursiveStarted.status, 'started');
  assert.equal(
    recursiveManager.advance(
      recursiveStarted.record.transactionId,
      executionContext(2),
    ).status,
    'progressed',
  );
  assert.equal(
    recursiveResult.status === 'rejected'
      ? recursiveResult.reason
      : recursiveResult.status,
    'recursive-operation',
  );
  assertOneBusinessApplication(recursiveProgress);
  assert.equal(
    recursiveManager.advance(
      recursiveStarted.record.transactionId,
      executionContext(3),
    ).status,
    'succeeded',
  );
});

test('D09-C1 F03 retry and safe recovery remain nonterminal until paths are exhausted', () => {
  const retryRuntime = makeRuntime();
  const retryAccepted = acceptEvent(retryRuntime, { value: 'retry' });
  const retryProgress = new InMemoryRunProgress();
  const retryManager = new RuntimeTransactionExecutionManager(
    retryRuntime.target,
    UUID,
    retryProgress,
    new PrototypeProgressTransactionExecutor(retryProgress, {
      faultInjector: makeFaultInjector([{
        point: 'before-apply',
        simulationTick: 2,
        code: 'prototype.temporary-apply',
      }]),
    }),
    { retryBudget: 1, recoveryBudget: 1 },
  );
  const retryStart = retryManager.start(retryAccepted.command.commandId);
  assert.equal(retryStart.status, 'started');
  const pendingRetry = retryManager.advance(
    retryStart.record.transactionId,
    executionContext(2),
  );
  assert.equal(pendingRetry.status, 'retry-pending');
  assert.equal(pendingRetry.record.status, 'retry-pending');
  assert.equal(pendingRetry.record.errors[0].classification, 'temporary');
  assert.deepEqual(pendingRetry.record.remainingPaths, {
    retries: 1,
    recoveries: 1,
  });
  assert.equal(retryProgress.snapshot.counts.goals, 0);

  const retried = retryManager.retry(
    retryStart.record.transactionId,
    executionContext(3),
  );
  assert.equal(retried.status, 'progressed');
  assert.equal(retried.record.transactionId, retryStart.record.transactionId);
  assertOneBusinessApplication(retryProgress);
  assert.equal(
    retryManager.advance(
      retryStart.record.transactionId,
      executionContext(4),
    ).status,
    'succeeded',
  );
  assertOneBusinessApplication(retryProgress);

  const recoveryRuntime = makeRuntime();
  const recoveryAccepted = acceptEvent(recoveryRuntime, { value: 'recovery' });
  const recoveryProgress = new InMemoryRunProgress();
  const recoveryManager = new RuntimeTransactionExecutionManager(
    recoveryRuntime.target,
    UUID,
    recoveryProgress,
    new PrototypeProgressTransactionExecutor(recoveryProgress, {
      faultInjector: makeFaultInjector([
        {
          point: 'after-progress-mutation',
          simulationTick: 2,
          code: 'prototype.ambiguous-apply',
        },
        {
          point: 'before-verify',
          simulationTick: 3,
          code: 'prototype.progress-incomplete',
        },
      ]),
    }),
    { retryBudget: 1, recoveryBudget: 2 },
  );
  const recoveryStart = recoveryManager.start(recoveryAccepted.command.commandId);
  assert.equal(recoveryStart.status, 'started');
  const firstRecovery = recoveryManager.advance(
    recoveryStart.record.transactionId,
    executionContext(2),
  );
  assert.equal(firstRecovery.status, 'recovery-pending');
  assert.equal(firstRecovery.record.businessAdditions.goals, 1);
  assertOneBusinessApplication(recoveryProgress);

  const failedRecovery = recoveryManager.recover(
    recoveryStart.record.transactionId,
    executionContext(3),
  );
  assert.equal(failedRecovery.status, 'recovery-pending');
  assert.equal(failedRecovery.record.remainingPaths.recoveries, 1);
  assert.equal(failedRecovery.record.status, 'recovery-pending');
  assert.equal(failedRecovery.record.terminal, undefined);
  assertOneBusinessApplication(recoveryProgress);

  const recovered = recoveryManager.recover(
    recoveryStart.record.transactionId,
    executionContext(4),
  );
  assert.equal(recovered.status, 'succeeded');
  assertOneBusinessApplication(recoveryProgress);

  const exhaustedRuntime = makeRuntime();
  const exhaustedAccepted = acceptEvent(exhaustedRuntime, { value: 'exhausted' });
  const exhaustedProgress = new InMemoryRunProgress();
  const exhaustedManager = new RuntimeTransactionExecutionManager(
    exhaustedRuntime.target,
    UUID,
    exhaustedProgress,
    new PrototypeProgressTransactionExecutor(exhaustedProgress, {
      faultInjector: makeFaultInjector([{
        point: 'before-apply',
        simulationTick: 2,
        code: 'prototype.temporary-apply',
      }]),
    }),
    { retryBudget: 0, recoveryBudget: 0 },
  );
  const exhaustedStart = exhaustedManager.start(exhaustedAccepted.command.commandId);
  assert.equal(exhaustedStart.status, 'started');
  const failed = exhaustedManager.advance(
    exhaustedStart.record.transactionId,
    executionContext(2),
  );
  assert.equal(failed.status, 'failed');
  assert.equal(failed.record.status, 'failed');
  assert.equal(
    failed.record.terminal?.status === 'failed'
      ? failed.record.terminal.reasonCode
      : undefined,
    'prototype.paths-exhausted',
  );
  assert.deepEqual(exhaustedProgress.snapshot.counts, {
    collections: 0,
    goals: 0,
    rewards: 0,
    effects: 0,
  });

  const unsafeRetryRuntime = makeRuntime();
  const unsafeRetryAccepted = acceptEvent(
    unsafeRetryRuntime,
    { value: 'unsafe-retry' },
  );
  const unsafeRetryProgress = new InMemoryRunProgress();
  const unsafeRetryManager = new RuntimeTransactionExecutionManager(
    unsafeRetryRuntime.target,
    UUID,
    unsafeRetryProgress,
    new PrototypeProgressTransactionExecutor(unsafeRetryProgress, {
      faultInjector: makeFaultInjector([{
        point: 'after-progress-mutation',
        simulationTick: 2,
        code: 'prototype.ambiguous-apply',
      }]),
    }),
    { retryBudget: 1, recoveryBudget: 0 },
  );
  const unsafeRetryStart = unsafeRetryManager.start(
    unsafeRetryAccepted.command.commandId,
  );
  assert.equal(unsafeRetryStart.status, 'started');
  const safeRecoveryUnavailable = unsafeRetryManager.advance(
    unsafeRetryStart.record.transactionId,
    executionContext(2),
  );
  assert.equal(safeRecoveryUnavailable.status, 'failed');
  assert.equal(
    safeRecoveryUnavailable.record.terminal?.status === 'failed'
      ? safeRecoveryUnavailable.record.terminal.reasonCode
      : undefined,
    'prototype.safe-recovery-unavailable',
  );
  assertOneBusinessApplication(unsafeRetryProgress);
});

test('D09-C1 F04 apply and terminal-commit interruptions reuse one effect and one intent', () => {
  const beforeApplyRuntime = makeRuntime();
  const beforeApplyAccepted = acceptEvent(
    beforeApplyRuntime,
    { value: 'before-apply' },
  );
  const beforeApplyProgress = new InMemoryRunProgress();
  const beforeApplyManager = new RuntimeTransactionExecutionManager(
    beforeApplyRuntime.target,
    UUID,
    beforeApplyProgress,
    new PrototypeProgressTransactionExecutor(beforeApplyProgress, {
      faultInjector: makeFaultInjector([{
        point: 'before-apply',
        simulationTick: 2,
        code: 'prototype.temporary-apply',
      }]),
    }),
    { retryBudget: 1, recoveryBudget: 1 },
  );
  const beforeApplyStart = beforeApplyManager.start(
    beforeApplyAccepted.command.commandId,
  );
  assert.equal(beforeApplyStart.status, 'started');
  assert.equal(
    beforeApplyManager.advance(
      beforeApplyStart.record.transactionId,
      executionContext(2),
    ).status,
    'retry-pending',
  );
  assert.equal(
    beforeApplyManager.retry(
      beforeApplyStart.record.transactionId,
      executionContext(3),
    ).status,
    'progressed',
  );
  assertOneBusinessApplication(beforeApplyProgress);
  assert.equal(
    beforeApplyManager.advance(
      beforeApplyStart.record.transactionId,
      executionContext(4),
    ).status,
    'succeeded',
  );
  assertOneBusinessApplication(beforeApplyProgress);

  const terminalRuntime = makeRuntime();
  const terminalAccepted = acceptEvent(
    terminalRuntime,
    { value: 'terminal-commit' },
  );
  const terminalProgress = new InMemoryRunProgress();
  let failTerminalCommit = true;
  const terminalManager = new RuntimeTransactionExecutionManager(
    terminalRuntime.target,
    UUID,
    terminalProgress,
    new PrototypeProgressTransactionExecutor(terminalProgress, {
      faultInjector: makeFaultInjector([{
        point: 'after-progress-mutation',
        simulationTick: 2,
        code: 'prototype.ambiguous-apply',
      }]),
    }),
    {
      retryBudget: 1,
      recoveryBudget: 2,
      faultInjector: point => {
        if (failTerminalCommit && point === 'before-terminal-commit') {
          failTerminalCommit = false;
          throw new Error('injected terminal commit interruption');
        }
      },
    },
  );
  const terminalStart = terminalManager.start(terminalAccepted.command.commandId);
  assert.equal(terminalStart.status, 'started');
  assert.equal(
    terminalManager.advance(
      terminalStart.record.transactionId,
      executionContext(2),
    ).status,
    'recovery-pending',
  );
  assertOneBusinessApplication(terminalProgress);
  const interruptedTerminal = terminalManager.recover(
    terminalStart.record.transactionId,
    executionContext(3),
  );
  assert.equal(interruptedTerminal.status, 'recovery-pending');
  assert.equal(interruptedTerminal.record.terminal, undefined);
  assert.equal(interruptedTerminal.record.remainingPaths.recoveries, 1);
  assertOneBusinessApplication(terminalProgress);
  assert.equal(
    terminalManager.recover(
      terminalStart.record.transactionId,
      executionContext(4),
    ).status,
    'succeeded',
  );
  assertOneBusinessApplication(terminalProgress);
  assert.equal(
    terminalManager.retry(
      terminalStart.record.transactionId,
      executionContext(5),
    ).status,
    'rejected',
  );
  assertOneBusinessApplication(terminalProgress);
  const targetSnapshot = terminalRuntime.target.snapshot;
  assert.equal(targetSnapshot.counts.acceptedRecords, 1);
  assert.equal(targetSnapshot.counts.intents, 1);
  assert.equal(terminalRuntime.commands.snapshot.transactionIds.nextId, 2);
});

test('D09-C1 F05 lost command receipt stays independent from transaction execution', () => {
  const runtime = makeRuntime();
  const producer = runtime.events.createProducer();
  const event = createEvent(
    runtime.events,
    { value: 'lost-receipt' },
    producer,
  );
  runtime.armDeliveryFault('after-target-accept-returned');
  const unknownDispatch = dispatch(runtime.events, 1);
  assert.equal(unknownDispatch.status, 'completed');
  assert.deepEqual(unknownDispatch.progress.delivery.unknownEventIds, [event.eventId]);
  assert.equal(runtime.events.snapshot.lifecycleRecords[0].status, 'processing');
  const acceptedQuery = runtime.target.query(1);
  assert.equal(acceptedQuery.status, 'found');
  const command = runtime.commands.snapshot.commands[0];
  assert.ok(command);

  const progress = new InMemoryRunProgress();
  const manager = new RuntimeTransactionExecutionManager(
    runtime.target,
    UUID,
    progress,
    new PrototypeProgressTransactionExecutor(progress),
  );
  const started = manager.start(command.commandId);
  assert.equal(started.status, 'started');
  assert.equal(
    manager.advance(started.record.transactionId, executionContext(2)).status,
    'progressed',
  );
  assert.equal(
    manager.advance(started.record.transactionId, executionContext(3)).status,
    'succeeded',
  );
  assertOneBusinessApplication(progress);

  const reconciled = dispatch(runtime.events, 4);
  assert.equal(reconciled.status, 'completed');
  assert.deepEqual(reconciled.progress.delivery.reconciledEventIds, [event.eventId]);
  assert.deepEqual(reconciled.progress.delivery.acceptedEventIds, [event.eventId]);
  assert.equal(runtime.events.snapshot.lifecycleRecords[0].status, 'completed');
  assert.equal(runtime.handlerCounts.get(event.eventId), 1);
  assert.equal(runtime.events.snapshot.delivery.records[0].acceptanceAttempts, 1);
  assert.equal(runtime.target.snapshot.counts.intents, 1);
  assert.equal(runtime.commands.snapshot.commandIds.nextId, 2);
  assert.equal(runtime.commands.snapshot.transactionIds.nextId, 2);
  const finalQuery = runtime.target.query(command.commandId);
  assert.equal(finalQuery.status, 'found');
  assert.deepEqual(finalQuery.record, acceptedQuery.record);
  assert.deepEqual(finalQuery.intent, acceptedQuery.intent);
  assert.equal(finalQuery.intent.executionState, 'not-started');
  assertOneBusinessApplication(progress);
});

test('D09-C1 F06 identity, capacity, read-only and no-push boundaries stay isolated', async () => {
  const runtime = makeRuntime();
  const firstAccepted = acceptEvent(runtime, { value: 'first' });
  const secondEvent = createEvent(runtime.events, { value: 'second' });
  const secondDispatch = dispatch(runtime.events, 2);
  assert.equal(secondDispatch.status, 'completed');
  const secondCommand = runtime.commands.snapshot.commands.find(
    command => command.eventId === secondEvent.eventId,
  );
  assert.ok(secondCommand);
  const secondAccepted = runtime.target.query(secondCommand.commandId);
  assert.equal(secondAccepted.status, 'found');

  const progress = new InMemoryRunProgress();
  const manager = new RuntimeTransactionExecutionManager(
    runtime.target,
    UUID,
    progress,
    new PrototypeProgressTransactionExecutor(progress),
    { capacity: 1 },
  );
  assert.equal(
    manager.start(0).status === 'rejected'
      ? manager.start(0).reason
      : undefined,
    'invalid-input',
  );
  assert.equal(
    manager.start(999).status === 'rejected'
      ? manager.start(999).reason
      : undefined,
    'command-not-found',
  );
  const started = manager.start(firstAccepted.command.commandId);
  assert.equal(started.status, 'started');
  const capacity = manager.start(secondCommand.commandId);
  assert.equal(
    capacity.status === 'rejected' ? capacity.reason : capacity.status,
    'capacity',
  );
  assert.equal(manager.snapshot.counts.records, 1);
  assert.equal(progress.snapshot.counts.goals, 0);
  assert.equal(runtime.target.snapshot.counts.businessExecutions, 0);
  assert.equal(Object.isFrozen(manager.snapshot), true);
  assert.equal(Object.isFrozen(manager.snapshot.records), true);
  assert.equal(Object.isFrozen(started.record), true);
  assert.throws(() => {
    manager.snapshot.records[0].status = 'failed';
  }, TypeError);

  assert.throws(
    () => new RuntimeTransactionExecutionManager(
      runtime.target,
      UUID,
      progress,
      new PrototypeProgressTransactionExecutor(progress),
    ),
    /already has an execution manager/,
  );

  const foreignRuntime = makeRuntime();
  const foreignAccepted = acceptEvent(foreignRuntime, { value: 'foreign' });
  const foreignProgress = new InMemoryRunProgress();
  const wrongRuntimeManager = new RuntimeTransactionExecutionManager(
    foreignRuntime.target,
    OTHER_UUID,
    foreignProgress,
    new PrototypeProgressTransactionExecutor(foreignProgress),
  );
  const wrongRuntime = wrongRuntimeManager.start(
    foreignAccepted.command.commandId,
  );
  assert.equal(
    wrongRuntime.status === 'rejected' ? wrongRuntime.reason : wrongRuntime.status,
    'association-mismatch',
  );
  assert.equal(
    foreignRuntime.target.query(foreignAccepted.command.commandId).status,
    'found',
  );

  const source = await readFile(
    new URL('../src/core/transactions.ts', import.meta.url),
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
  assert.deepEqual(secondAccepted.intent.executionState, 'not-started');
});
