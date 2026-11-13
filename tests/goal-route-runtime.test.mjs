import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  PrototypeGoalRouteRuntime,
} from '../src/core/goal-route-runtime.ts';
import {
  InMemoryRunProgress,
  PROTOTYPE_PROGRESS_CONTENT,
} from '../src/core/progress.ts';

const RUNTIME_UUID = '92000000-0000-4000-8000-000000000001';
const GOAL = PROTOTYPE_PROGRESS_CONTENT.goal;

function makeRuntime(options = {}) {
  const progress = options.progress ?? new InMemoryRunProgress();
  const runtime = new PrototypeGoalRouteRuntime(
    progress,
    { generate: () => options.runtimeInstanceId ?? RUNTIME_UUID },
    options.runtimeOptions,
  );
  return { runtime, progress };
}

function assertNoBusinessProgress(progress) {
  assert.deepEqual(progress.snapshot.counts, {
    collections: 0,
    goals: 0,
    rewards: 0,
    effects: 0,
  });
}

function assertOneBusinessApplication(progress) {
  assert.deepEqual(progress.snapshot.goals, [GOAL.businessId]);
  assert.deepEqual(progress.snapshot.rewards, [GOAL.rewardId]);
  assert.deepEqual(progress.snapshot.effects, [{
    id: GOAL.effectId,
    expectedActive: true,
  }]);
  assert.deepEqual(progress.snapshot.counts, {
    collections: 0,
    goals: 1,
    rewards: 1,
    effects: 1,
  });
}

test('D09-D1 H01 input creates one Pending Event, then separate Command and Result identities complete once', () => {
  const { runtime, progress } = makeRuntime();
  assert.equal(runtime.snapshot.phase, 'idle');
  assertNoBusinessProgress(progress);

  const requested = runtime.requestGoal();
  assert.equal(requested.status, 'created');
  assert.equal(runtime.snapshot.phase, 'request-pending');
  assert.equal(runtime.snapshot.eventId, 1);
  assert.equal(runtime.snapshot.commandId, null);
  assert.equal(runtime.snapshot.transactionId, null);
  assert.equal(runtime.snapshot.resultEventId, null);
  assert.equal(runtime.snapshot.counts.inboxEvents, 1);
  assertNoBusinessProgress(progress);

  const duplicate = runtime.requestGoal();
  assert.equal(duplicate.status, 'existing');
  assert.equal(runtime.snapshot.eventId, 1);
  assert.equal(runtime.snapshot.counts.inboxEvents, 1);

  runtime.step(1);
  let snapshot = runtime.snapshot;
  assert.equal(snapshot.phase, 'verifying');
  assert.equal(snapshot.deliveryStatus, 'accepted');
  assert.equal(snapshot.originalCompletedTick, 1);
  assert.equal(snapshot.acceptedTick, 1);
  assert.equal(snapshot.commandId, 1);
  assert.equal(snapshot.transactionId, 1);
  assert.equal(snapshot.applyTick, 1);
  assert.equal(snapshot.verifyTick, null);
  assert.equal(snapshot.resultEventId, null);
  assert.equal(snapshot.originalAcknowledged, true);
  assert.equal(snapshot.originalRetired, true);
  assertOneBusinessApplication(progress);

  runtime.step(2);
  snapshot = runtime.snapshot;
  assert.equal(snapshot.phase, 'result-pending');
  assert.equal(snapshot.verifyTick, 2);
  assert.equal(snapshot.terminalTick, 2);
  assert.equal(snapshot.transactionStatus, 'succeeded');
  assert.equal(snapshot.terminal?.status, 'succeeded');
  assert.equal(snapshot.resultEventId, 2);
  assert.equal(snapshot.resultCreatedTick, 2);
  assert.equal(snapshot.resultConsumptionCount, 0);
  assertOneBusinessApplication(progress);

  runtime.step(3);
  snapshot = runtime.snapshot;
  assert.equal(snapshot.phase, 'succeeded');
  assert.equal(snapshot.resultLifecycle, 'retired');
  assert.equal(snapshot.resultConsumedTick, 3);
  assert.equal(snapshot.resultConsumerAttempts, 1);
  assert.equal(snapshot.resultConsumptionCount, 1);
  assert.equal(snapshot.resultAcknowledged, true);
  assert.equal(snapshot.resultRetired, true);
  assert.deepEqual(snapshot.acceptedBusinessCounts, {
    collections: 0,
    goals: 0,
    rewards: 0,
    effects: 0,
  });
  assert.deepEqual(snapshot.terminalBusinessCounts, {
    collections: 0,
    goals: 1,
    rewards: 1,
    effects: 1,
  });
  assert.deepEqual(snapshot.counts, {
    nextEventId: 3,
    events: 0,
    inboxEvents: 0,
    commands: 1,
    acceptedCommands: 1,
    transactionIntents: 1,
    transactions: 1,
    resultEvents: 1,
  });
  assertOneBusinessApplication(progress);

  runtime.step(4);
  assert.equal(runtime.snapshot.phase, 'succeeded');
  assert.equal(runtime.snapshot.resultConsumptionCount, 1);
  const completed = runtime.requestGoal();
  assert.equal(completed.status, 'completed');
  assert.equal(runtime.snapshot.counts.commands, 1);
  assert.equal(runtime.snapshot.counts.transactions, 1);
  assert.equal(runtime.snapshot.counts.resultEvents, 1);
  assertOneBusinessApplication(progress);
});

test('D09-D1 H05 event creation failure rolls back before allocation and leaves business untouched', () => {
  const { runtime, progress } = makeRuntime({
    runtimeOptions: {
      eventFaultInjector: point => {
        if (point === 'candidate-prepared') throw new Error('injected create failure');
      },
    },
  });

  const result = runtime.requestGoal();
  assert.equal(result.status, 'rejected');
  assert.equal(runtime.snapshot.phase, 'rejected');
  assert.equal(runtime.snapshot.eventId, null);
  assert.match(runtime.snapshot.lastError, /injected create failure/);
  assert.deepEqual(runtime.snapshot.counts, {
    nextEventId: 1,
    events: 0,
    inboxEvents: 0,
    commands: 0,
    acceptedCommands: 0,
    transactionIntents: 0,
    transactions: 0,
    resultEvents: 0,
  });
  assertNoBusinessProgress(progress);
});

test('D09-D1 H05 result consumer failure remains bounded and never repeats successful business apply', () => {
  const { runtime, progress } = makeRuntime({
    runtimeOptions: {
      resultConsumerFaultInjector: () => {
        throw new Error('injected result consumption failure');
      },
    },
  });
  assert.equal(runtime.requestGoal().status, 'created');
  runtime.step(1);
  runtime.step(2);
  assert.equal(runtime.snapshot.resultEventId, 2);
  assertOneBusinessApplication(progress);

  runtime.step(3);
  let snapshot = runtime.snapshot;
  assert.equal(snapshot.phase, 'blocked');
  assert.equal(snapshot.resultConsumerAttempts, 1);
  assert.equal(snapshot.resultConsumptionCount, 0);
  assert.equal(snapshot.resultEventId, 2);
  assert.match(snapshot.lastError, /injected result consumption failure/);
  assertOneBusinessApplication(progress);

  runtime.step(4);
  snapshot = runtime.snapshot;
  assert.equal(snapshot.resultConsumerAttempts, 2,
    'Each legal coordination Tick performs at most one bounded notification attempt');
  assert.equal(snapshot.resultConsumptionCount, 0);
  assert.equal(snapshot.counts.transactions, 1);
  assert.equal(snapshot.counts.resultEvents, 1);
  assertOneBusinessApplication(progress);
});
