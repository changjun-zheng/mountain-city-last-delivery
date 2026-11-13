import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  InMemoryRunProgress,
  PROTOTYPE_PROGRESS_CONTENT,
} from '../src/core/progress.ts';

const collectionId = PROTOTYPE_PROGRESS_CONTENT.collection.businessId;
const goalId = PROTOTYPE_PROGRESS_CONTENT.goal.businessId;
const rewardId = PROTOTYPE_PROGRESS_CONTENT.goal.rewardId;
const effectId = PROTOTYPE_PROGRESS_CONTENT.goal.effectId;

test('D08 P01 initial progress is empty; four ID categories are independent and invalid requests are rejected', () => {
  const progress = new InMemoryRunProgress();
  assert.deepEqual(progress.snapshot, {
    collections: [],
    goals: [],
    rewards: [],
    effects: [],
    counts: { collections: 0, goals: 0, rewards: 0, effects: 0 },
  });

  assert.equal(progress.recordCollection(collectionId).status, 'added');
  assert.equal(progress.recordCollection(collectionId).status, 'existing');
  assert.equal(progress.recordCollection('collection.prototype.unknown').status, 'rejected');
  assert.equal(progress.recordCollection(goalId).status, 'rejected',
    'A goal ID cannot be registered as a collection');

  const completed = progress.completeGoal(goalId);
  assert.equal(completed.status, 'added');
  assert.equal(completed.goal.status, 'added');
  assert.equal(completed.reward.status, 'added');
  assert.equal(completed.effect.status, 'added');
  assert.equal(progress.completeGoal('goal.prototype.unknown').status, 'rejected');

  const snapshot = progress.snapshot;
  assert.deepEqual(snapshot.collections, [collectionId]);
  assert.deepEqual(snapshot.goals, [goalId]);
  assert.deepEqual(snapshot.rewards, [rewardId]);
  assert.deepEqual(snapshot.effects, [{ id: effectId, expectedActive: true }]);
  assert.deepEqual(snapshot.counts, { collections: 1, goals: 1, rewards: 1, effects: 1 });
  assert.equal(new Set([collectionId, goalId, rewardId, effectId]).size, 4);
  assert.notEqual(collectionId, goalId);
  assert.notEqual(goalId, rewardId);
  assert.notEqual(rewardId, effectId);

  assert.throws(() => snapshot.collections.push('mutated'), TypeError);
  assert.equal(progress.snapshot.counts.collections, 1,
    'Read-only snapshots must not expose the internal collection set');
});

test('D08 P03 repeated goal completion and reward reconciliation never issue a second reward', () => {
  const progress = new InMemoryRunProgress();
  const first = progress.completeGoal(goalId);
  const afterFirst = progress.snapshot;
  assert.equal(first.reward.status, 'added');
  assert.deepEqual(afterFirst.counts, { collections: 0, goals: 1, rewards: 1, effects: 1 });

  const repeated = progress.completeGoal(goalId);
  assert.equal(repeated.status, 'existing');
  assert.equal(repeated.goal.status, 'existing');
  assert.equal(repeated.reward.status, 'existing');
  assert.equal(repeated.effect.status, 'existing');

  const applied = [];
  progress.reconcileEffects((id, active) => applied.push({ id, active }));
  progress.reconcileEffects((id, active) => applied.push({ id, active }));
  assert.deepEqual(applied, [
    { id: effectId, active: true },
    { id: effectId, active: true },
  ]);
  assert.deepEqual(progress.snapshot.counts, afterFirst.counts);
});

test('D08 P04 permanent effect uses an explicit expected state instead of toggling', () => {
  const progress = new InMemoryRunProgress();
  progress.completeGoal(goalId);
  assert.equal(progress.setPermanentEffect(effectId, true).status, 'existing');
  assert.equal(progress.setPermanentEffect(effectId, true).status, 'existing');
  assert.deepEqual(progress.snapshot.effects, [{ id: effectId, expectedActive: true }]);
  assert.equal(progress.snapshot.counts.rewards, 1);

  const restricted = new InMemoryRunProgress();
  assert.equal(restricted.claimReward(rewardId, goalId).status, 'rejected',
    'Reward cannot be claimed before its associated goal');
  assert.equal(restricted.setPermanentEffect(effectId, true).status, 'rejected',
    'Permanent effect cannot activate before its associated reward');
  assert.deepEqual(restricted.snapshot.counts, {
    collections: 0, goals: 0, rewards: 0, effects: 0,
  });
});
