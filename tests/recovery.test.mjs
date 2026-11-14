import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { createGrayboxCore } from '../src/core/graybox.ts';
import {
  InMemoryRunProgress,
  PROTOTYPE_PROGRESS_CONTENT,
} from '../src/core/progress.ts';
import { PLAYER_RECOVERY_PROTOTYPE } from '../src/core/recovery.ts';
import {
  GRAYBOX_CHECKPOINT_ID,
  GRAYBOX_TEST_CAPTURE_CHECKPOINT_A_ID,
  validateTemporarySnapshot,
} from '../src/core/snapshot.ts';
import { MatterGrayboxWorld } from '../src/physics/matter/graybox-world.ts';

const M = createRequire(import.meta.url)(
  '../node_modules/phaser/src/physics/matter-js/CustomMain.js',
);
let runtimeNumber = 0;

function fixture(options = {}) {
  runtimeNumber++;
  const runtimeInstanceId =
    `d1100000-0000-4000-8000-${String(runtimeNumber).padStart(12, '0')}`;
  const engine = M.Engine.create();
  const world = new MatterGrayboxWorld(
    M,
    engine,
    deltaMs => M.Engine.update(engine, deltaMs),
  );
  const progress = options.progress ?? new InMemoryRunProgress();
  const core = createGrayboxCore(world, {
    uuidProvider: { generate: () => runtimeInstanceId },
    progress,
    checkpointCaptureOptions: options.checkpointCaptureOptions,
    recoveryOptions: options.recoveryOptions,
  });
  let sampleMs = 0;
  const step = (count = 1) => {
    for (let index = 0; index < count; index++) {
      sampleMs += core.config.fixedDeltaMs;
      core.frame(sampleMs);
    }
  };
  const stepUntil = (condition, maximum = 300) => {
    for (let index = 0; index < maximum; index++) {
      if (condition(core.snapshot)) return index;
      step();
    }
    assert.fail(
      'Condition was not reached: ' +
        JSON.stringify({
          recovery: core.snapshot.recovery,
          player: core.snapshot.player,
          capture: core.snapshot.checkpointCapture,
        }),
    );
  };
  const placeAtFailure = () => {
    M.Body.setPosition(world.player, { x: 560, y: 610 });
    M.Body.setVelocity(world.player, { x: 0, y: 160 });
  };
  const triggerFailure = () => {
    placeAtFailure();
    stepUntil(snapshot => snapshot.recovery.phase === 'fading-out');
  };
  step(2);
  return {
    core,
    world,
    progress,
    runtimeInstanceId,
    step,
    stepUntil,
    triggerFailure,
  };
}

function waitForRecovery(instance, count = 1) {
  instance.stepUntil(snapshot =>
    snapshot.recovery.phase === 'succeeded' &&
    snapshot.recovery.recoveryCount === count,
  600);
  return instance.core.snapshot;
}

function captureAuthorization(instance, checkpointId) {
  return {
    runtimeInstanceId: instance.runtimeInstanceId,
    levelId: 'graybox-platform-lab',
    checkpointId,
    requestId: `${instance.runtimeInstanceId}:test-capture:${checkpointId}`,
    granted: true,
  };
}

test('D11-A1 RF01 real initial fallback uses one coordinated recovery and finishes unlocked', () => {
  const instance = fixture();
  const initial = instance.core.snapshot;
  instance.triggerFailure();
  const admitted = instance.core.snapshot;
  assert.equal(admitted.recovery.phase, 'fading-out');
  assert.equal(admitted.recovery.controlLockHeld, true);
  assert.equal(admitted.recovery.triggersShielded, true);
  assert.equal(admitted.recovery.failureEventAcknowledged, true);
  assert.equal(admitted.recovery.failureEventRetired, true);
  assert.equal(admitted.checkpointTriggers.enabled, false);
  assert.deepEqual(instance.core.reset(), {
    status: 'blocked',
    message: 'Debug reset is unavailable while fall recovery owns the control lock.',
  });

  const completed = waitForRecovery(instance);
  assert.equal(completed.recovery.sourceCheckpointId, GRAYBOX_CHECKPOINT_ID);
  assert.deepEqual(completed.recovery.sourceAnchor, {
    x: 80,
    y: 472,
    facing: 1,
  });
  assert.equal(completed.recovery.controlLockHeld, false);
  assert.equal(completed.recovery.triggersShielded, false);
  assert.equal(completed.recovery.recoveryCount, 1);
  assert.equal(completed.checkpointSnapshot.captureAttempts, 1);
  assert.equal(completed.checkpointCapture.successfulCommits, 0);
  assert.equal(completed.goalRoute.runtimeInstanceId, instance.runtimeInstanceId);
  assert.ok(completed.tick > initial.tick);
  assert.ok(completed.physicsSteps > initial.physicsSteps);
  assert.ok(completed.recovery.fadeInCompletedTick !== null);
  assert.equal(
    completed.recovery.phaseHistory.map(record => record.phase).join('>'),
    'fading-out>waiting-for-capture>restoring>validating>fading-in>succeeded',
  );
  assert.equal(
    instance.core.reset().status,
    'reset',
    'R remains an independent debug reset after recovery',
  );
});

test('D11-A1 RF02 active A snapshot rolls back platforms and keeps one checkpoint', () => {
  const progress = new InMemoryRunProgress();
  progress.completeGoal(PROTOTYPE_PROGRESS_CONTENT.goal.businessId);
  const instance = fixture({ progress });
  const requested = instance.core.requestCheckpointCapture(
    GRAYBOX_TEST_CAPTURE_CHECKPOINT_A_ID,
    captureAuthorization(instance, GRAYBOX_TEST_CAPTURE_CHECKPOINT_A_ID),
  );
  assert.ok(requested.status === 'created');
  instance.stepUntil(snapshot =>
    snapshot.checkpointCapture.phase === 'succeeded' &&
    snapshot.checkpointCapture.successfulCommits === 1);
  const captured = instance.core.snapshot.checkpointSnapshot.current;
  assert.ok(captured);
  const capturedPlatformClock = captured.objects[0].state.clockMs;
  instance.step(90);
  assert.ok(instance.core.snapshot.physicsTimestamp > 0);
  assert.notEqual(instance.world.platformClockMs, capturedPlatformClock);

  instance.triggerFailure();
  instance.stepUntil(snapshot => snapshot.recovery.phase === 'fading-in');
  const restored = instance.core.snapshot;
  assert.equal(restored.recovery.sourceCheckpointId, GRAYBOX_TEST_CAPTURE_CHECKPOINT_A_ID);
  assert.deepEqual(restored.recovery.sourceAnchor, {
    x: 1200,
    y: 472,
    facing: 1,
  });
  assert.equal(restored.checkpointSnapshot.current, captured);
  assert.equal(instance.world.platformClockMs, capturedPlatformClock);
  assert.deepEqual(
    instance.world.movingPlatforms.map(platform => ({
      label: platform.label,
      x: platform.x,
      y: platform.y,
      direction: platform.direction,
      phase: platform.phase,
      cycle: platform.cycle,
    })),
    captured.objects.map(object => ({
      label: object.objectId,
      x: object.state.position.x,
      y: object.state.position.y,
      direction: object.state.direction,
      phase: object.state.phase,
      cycle: object.state.cycle,
    })),
  );
  assert.equal(restored.progress.counts.goals, 1);
  assert.equal(restored.progress.counts.rewards, 1);
  assert.equal(restored.progress.counts.effects, 1);
  assert.equal(instance.world.progressRouteOpen, true);
  const final = waitForRecovery(instance);
  assert.equal(final.checkpointCapture.successfulCommits, 1);
  assert.equal(final.checkpointSnapshot.current, captured);
  assert.equal(final.goalRoute.runtimeInstanceId, instance.runtimeInstanceId);
});

test('D11-A1 RF03 repeated falls do not add rewards, reset IDs or consume full histories', () => {
  const progress = new InMemoryRunProgress();
  progress.completeGoal(PROTOTYPE_PROGRESS_CONTENT.goal.businessId);
  const instance = fixture({ progress });
  const runtime = instance.core.snapshot.goalRoute.runtimeInstanceId;
  const goalCount = instance.core.snapshot.progress.counts.goals;
  const rewardCount = instance.core.snapshot.progress.counts.rewards;
  const effectCount = instance.core.snapshot.progress.counts.effects;
  let priorFailureEventId = 0;
  let priorTick = instance.core.snapshot.tick;
  for (let count = 1; count <= 17; count++) {
    instance.triggerFailure();
    const seenEventId = instance.core.snapshot.recovery.failureEventId;
    assert.ok(seenEventId > priorFailureEventId);
    priorFailureEventId = seenEventId;
    const completed = waitForRecovery(instance, count);
    assert.ok(completed.tick > priorTick);
    priorTick = completed.tick;
    assert.equal(completed.goalRoute.runtimeInstanceId, runtime);
    assert.equal(completed.progress.counts.goals, goalCount);
    assert.equal(completed.progress.counts.rewards, rewardCount);
    assert.equal(completed.progress.counts.effects, effectCount);
    assert.equal(completed.checkpointCapture.successfulCommits, 0);
    assert.equal(completed.goalRoute.eventId, null);
    assert.ok(completed.goalRoute.counts.inboxEvents <= 16);
    assert.ok(completed.goalRoute.counts.events <= 64);
  }
});

test('D11-A1 RF04 held input, investigation, duplicate falls and in-flight capture are bounded', () => {
  const progress = new InMemoryRunProgress();
  progress.completeGoal(PROTOTYPE_PROGRESS_CONTENT.goal.businessId);
  const instance = fixture({ progress });
  M.Body.setPosition(instance.world.player, { x: 200, y: 478 });
  M.Body.setVelocity(instance.world.player, { x: 0, y: 0 });
  instance.step(3);
  instance.core.key('Space', true);
  instance.core.key('KeyE', true);
  assert.equal(instance.core.snapshot.interaction.mode, 'investigation');
  const jumps = instance.core.snapshot.player.jumps;
  instance.triggerFailure();
  assert.equal(instance.core.snapshot.interaction.activeId, null);
  assert.equal(instance.core.snapshot.player.needsRelease, true);
  assert.equal(instance.core.snapshot.interaction.needsRelease, true);
  const failureEvent = instance.core.snapshot.recovery.failureEventId;

  // A second real sensor entry during the active flow is absorbed without
  // creating a second failure Event or releasing the existing lock.
  M.Body.setPosition(instance.world.player, { x: 200, y: 478 });
  instance.step();
  M.Body.setPosition(instance.world.player, { x: 560, y: 610 });
  instance.step();
  assert.equal(instance.core.snapshot.recovery.failureEventId, failureEvent);
  assert.equal(instance.core.snapshot.recovery.ignoredSignalCount, 1);

  const completed = waitForRecovery(instance);
  assert.equal(completed.recovery.recoveryCount, 1);
  assert.equal(completed.player.jumps, jumps);
  assert.equal(completed.player.needsRelease, true);
  assert.equal(completed.interaction.needsRelease, true);
  const consumed = completed.interaction.consumedCount;
  instance.core.key('Space', true);
  instance.core.key('Space', true, true);
  instance.core.key('KeyE', true);
  instance.step(3);
  assert.equal(instance.core.snapshot.player.jumps, jumps);
  assert.equal(instance.core.snapshot.interaction.consumedCount, consumed);
  instance.core.key('Space', false);
  instance.core.key('KeyE', false);
  instance.step();
  assert.equal(instance.core.snapshot.player.needsRelease, false);
  assert.equal(instance.core.snapshot.interaction.needsRelease, false);

  const waiting = fixture({ progress });
  const request = waiting.core.requestCheckpointCapture(
    GRAYBOX_TEST_CAPTURE_CHECKPOINT_A_ID,
    captureAuthorization(waiting, GRAYBOX_TEST_CAPTURE_CHECKPOINT_A_ID),
  );
  assert.ok(request.status === 'created');
  waiting.triggerFailure();
  const done = waitForRecovery(waiting);
  assert.equal(done.checkpointCapture.successfulCommits, 1);
  assert.equal(done.recovery.sourceCheckpointId, GRAYBOX_TEST_CAPTURE_CHECKPOINT_A_ID);
  assert.equal(done.checkpointCapture.lock.held, false);
  assert.equal(done.checkpointCapture.resourceOwnership.resourcesReleased, true);
});

test('D11-A1 RF05 lifecycle pauses recovery time and every invalid boundary remains fail-closed', () => {
  const paused = fixture();
  paused.triggerFailure();
  paused.step();
  const beforePause = paused.core.snapshot;
  const pauseOwner = Symbol('test-pause-owner');
  const pauseKey = Symbol('test-pause-key');
  const token = paused.core.lifecycle.acquire(pauseOwner, pauseKey);
  assert.ok(token);
  const recoveryBeforePause = JSON.stringify(beforePause.recovery);
  const tickBeforePause = beforePause.tick;
  const physicsBeforePause = beforePause.physicsSteps;
  paused.step(20);
  assert.equal(paused.core.snapshot.tick, tickBeforePause);
  assert.equal(paused.core.snapshot.physicsSteps, physicsBeforePause);
  assert.equal(JSON.stringify(paused.core.snapshot.recovery), recoveryBeforePause);
  assert.equal(
    paused.core.lifecycle.release(pauseOwner, token),
    'released',
  );
  paused.step();
  paused.step();
  assert.ok(paused.core.snapshot.recovery.fadeElapsedMs > 0);
  waitForRecovery(paused);

  const source = fixture();
  const record = source.core.snapshot.checkpointSnapshot.current;
  assert.ok(record);
  assert.throws(
    () => validateTemporarySnapshot({ ...record, schemaVersion: 999 }, record.checkpointId),
    /Unsupported snapshot schemaVersion/,
  );
  assert.throws(
    () => validateTemporarySnapshot({
      ...record,
      objects: record.objects.slice(1),
    }, record.checkpointId),
    /required-object set is incomplete/,
  );

  const rebuildFailure = fixture({
    recoveryOptions: {
      faultInjector(point) {
        if (point === 'after-rebuild') {
          throw new Error('injected recovery rebuild verification fault');
        }
      },
    },
  });
  const rebuildRecord = rebuildFailure.core.snapshot.checkpointSnapshot.current;
  rebuildFailure.triggerFailure();
  rebuildFailure.stepUntil(snapshot => snapshot.recovery.phase === 'failed');
  assert.equal(rebuildFailure.core.snapshot.recovery.controlLockHeld, true);
  assert.equal(rebuildFailure.core.snapshot.recovery.triggersShielded, true);
  assert.equal(rebuildFailure.core.snapshot.checkpointSnapshot.current, rebuildRecord);
  assert.equal(rebuildFailure.core.reset().status, 'blocked');

  const unsafeAnchor = fixture();
  const blocker = M.Bodies.rectangle(80, 472, 40, 40, {
    isStatic: true,
    label: 'injected-anchor-blocker',
  });
  unsafeAnchor.world.terrain.push(blocker);
  // Query-based validation uses the live terrain array; the test blocker is
  // intentionally not registered as a snapshot object.
  unsafeAnchor.triggerFailure();
  unsafeAnchor.stepUntil(snapshot => snapshot.recovery.phase === 'failed');
  assert.equal(unsafeAnchor.core.snapshot.recovery.controlLockHeld, true);
  assert.match(
    unsafeAnchor.core.snapshot.recovery.lastError ?? '',
    /锚点验证失败/,
  );
});
