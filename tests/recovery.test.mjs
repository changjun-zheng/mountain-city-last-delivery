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
    engine,
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

function addSolidBlocker(instance, label, x, y, width = 40, height = 40) {
  const blocker = M.Bodies.rectangle(x, y, width, height, {
    isStatic: true,
    label,
  });
  M.Composite.add(instance.engine.world, blocker);
  return blocker;
}

function findWorldBody(instance, label) {
  const body = M.Composite.allBodies(instance.engine.world)
    .find(candidate => candidate.label === label);
  assert.ok(body, `Expected real Matter body ${label}`);
  return body;
}

function recoveryFaultAfterRebuild(instance, callback) {
  return {
    faultInjector(point) {
      if (point === 'after-rebuild') callback(instance);
    },
  };
}

function freezeRegisteredPlatforms(instance, owner) {
  const objectIds = instance.world.movingPlatforms.map(platform => platform.label);
  const result = instance.world.freezeTemporaryObjects(objectIds, owner);
  assert.equal(result.status, 'frozen');
  return objectIds;
}

function trackRecoveryWorldWrites(instance) {
  let count = 0;
  for (const method of [
    'applyTemporarySnapshot',
    'rebuildRecoveryWorld',
    'placePlayerAtAnchor',
    'setPermanentEffect',
  ]) {
    const original = instance.world[method].bind(instance.world);
    instance.world[method] = (...args) => {
      count++;
      return original(...args);
    };
  }
  return {
    get count() {
      return count;
    },
    reset() {
      count = 0;
    },
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
  assert.deepEqual(completed.recovery.selectedAnchor, {
    x: 80,
    y: 472,
    facing: 1,
  });
  assert.equal(completed.recovery.selectedAnchorRole, 'primary');
  assert.equal(completed.recovery.selectedFallbackIndex, null);
  assert.equal(completed.recovery.anchorAttempts.length, 1);
  assert.equal(completed.recovery.worldValidation?.status, 'valid');
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
  addSolidBlocker(unsafeAnchor, 'injected-primary-anchor-blocker', 80, 472);
  addSolidBlocker(unsafeAnchor, 'injected-fallback-1-anchor-blocker', 160, 472);
  addSolidBlocker(unsafeAnchor, 'injected-fallback-2-anchor-blocker', 700, 472);
  unsafeAnchor.triggerFailure();
  unsafeAnchor.stepUntil(snapshot => snapshot.recovery.phase === 'failed');
  assert.equal(unsafeAnchor.core.snapshot.recovery.controlLockHeld, true);
  assert.match(
    unsafeAnchor.core.snapshot.recovery.lastError ?? '',
    /锚点验证失败/,
  );
});

test('D11-A2 AV01 recovery uses the first safe configured fallback without unordered search', () => {
  const primaryBlocked = fixture();
  addSolidBlocker(primaryBlocked, 'test-primary-blocker', 80, 472);
  primaryBlocked.triggerFailure();
  const firstFallback = waitForRecovery(primaryBlocked);
  assert.deepEqual(firstFallback.recovery.sourceAnchor, {
    x: 80,
    y: 472,
    facing: 1,
  });
  assert.deepEqual(firstFallback.recovery.selectedAnchor, {
    x: 160,
    y: 472,
    facing: 1,
  });
  assert.equal(firstFallback.recovery.selectedAnchorRole, 'fallback');
  assert.equal(firstFallback.recovery.selectedFallbackIndex, 0);
  assert.deepEqual(
    firstFallback.recovery.anchorAttempts.map(attempt => ({
      role: attempt.role,
      fallbackIndex: attempt.fallbackIndex,
      status: attempt.status,
    })),
    [
      { role: 'primary', fallbackIndex: null, status: 'invalid' },
      { role: 'fallback', fallbackIndex: 0, status: 'valid' },
    ],
  );
  assert.equal(firstFallback.recovery.anchorValidation?.status, 'valid');
  assert.equal(firstFallback.recovery.anchorAttempts.at(-1)?.support, 'ground-a');
  assert.equal(firstFallback.interaction.facing, 1);

  const secondFallback = fixture();
  addSolidBlocker(secondFallback, 'test-primary-blocker', 80, 472);
  addSolidBlocker(secondFallback, 'test-first-fallback-blocker', 160, 472);
  secondFallback.triggerFailure();
  const completed = waitForRecovery(secondFallback);
  assert.deepEqual(completed.recovery.selectedAnchor, {
    x: 700,
    y: 472,
    facing: -1,
  });
  assert.equal(completed.recovery.selectedFallbackIndex, 1);
  assert.equal(completed.recovery.anchorAttempts.length, 3);
  assert.equal(completed.interaction.facing, -1);

  const firstSafeWins = fixture();
  addSolidBlocker(firstSafeWins, 'test-primary-blocker', 80, 472);
  firstSafeWins.triggerFailure();
  const stoppedAtFirst = waitForRecovery(firstSafeWins);
  assert.equal(stoppedAtFirst.recovery.selectedFallbackIndex, 0);
  assert.equal(
    stoppedAtFirst.recovery.anchorAttempts.length,
    2,
    'Recovery must stop at the first safe fallback instead of probing later points',
  );
});

test('D11-A2 AV02 collision space, real support and failure exclusion reject every unsafe anchor', () => {
  const instance = fixture();
  const ghostGrounds = instance.engine
    ? M.Composite.allBodies(instance.engine.world)
      .filter(body => body.label === 'ground-a')
    : [];
  assert.equal(ghostGrounds.length, 2);
  for (const ground of ghostGrounds) {
    M.Composite.remove(instance.engine.world, ground);
  }
  assert.equal(
    instance.world.terrain.filter(body => body.label === 'ground-a').length,
    2,
    'The stale terrain list deliberately retains both removed bodies',
  );
  const sensorOnlySupport = M.Bodies.rectangle(400, 535, 900, 70, {
    isStatic: true,
    isSensor: true,
    label: 'sensor-only-support',
  });
  M.Composite.add(instance.engine.world, sensorOnlySupport);

  const failureOverlap = instance.world.validateRecoveryAnchor(
    { x: 560, y: 620, facing: 1 },
    GRAYBOX_CHECKPOINT_ID,
  );
  assert.equal(failureOverlap.status, 'invalid');
  assert.match(failureOverlap.reason, /failure region/);

  instance.triggerFailure();
  instance.stepUntil(snapshot => snapshot.recovery.phase === 'failed');
  const failed = instance.core.snapshot;
  assert.equal(failed.recovery.anchorAttempts.length, 3);
  assert.ok(failed.recovery.anchorAttempts.every(attempt =>
    attempt.status === 'invalid' &&
    /no effective non-sensor support/.test(attempt.reason ?? '')));
  assert.equal(failed.recovery.selectedAnchor, null);
  assert.equal(failed.recovery.placedTick, null);
  assert.equal(failed.recovery.controlLockHeld, true);
  assert.equal(failed.recovery.triggersShielded, true);
  assert.equal(failed.checkpointTriggers.enabled, false);
  assert.equal(instance.core.reset().status, 'blocked');
});

test('D11-A2 AV03 world consistency errors are critical and never enter the fallback loop', () => {
  const runWorldFault = (mutate, options = {}) => {
    let instance;
    let injected = false;
    const recoveryOptions = {
      ...options,
      faultInjector(point) {
        if (point !== 'after-rebuild') return;
        injected = true;
        mutate(instance);
      },
    };
    instance = fixture({
      progress: options.progress,
      recoveryOptions,
    });
    const originalRecord = instance.core.snapshot.checkpointSnapshot.current;
    instance.triggerFailure();
    instance.stepUntil(snapshot => snapshot.recovery.phase === 'failed');
    const failed = instance.core.snapshot;
    assert.equal(injected, true);
    assert.equal(failed.recovery.worldValidation?.status, 'invalid');
    assert.ok(
      (failed.recovery.worldValidation?.critical.length ?? 0) >= 1,
    );
    assert.equal(failed.recovery.anchorAttempts.length, 0);
    assert.equal(failed.recovery.selectedAnchor, null);
    assert.equal(failed.recovery.placedTick, null);
    assert.equal(failed.recovery.controlLockHeld, true);
    assert.equal(failed.recovery.triggersShielded, true);
    assert.equal(failed.checkpointSnapshot.current, originalRecord);
    assert.equal(instance.core.reset().status, 'blocked');
    return failed.recovery.worldValidation;
  };

  const missingPlatform = runWorldFault(instance => {
    M.Composite.remove(
      instance.engine.world,
      findWorldBody(instance, 'moving-horizontal-a'),
    );
  });
  assert.ok(missingPlatform?.critical.some(issue =>
    issue.code === 'required-platform-body-missing'));

  const wrongPosition = runWorldFault(instance => {
    const body = findWorldBody(instance, 'moving-horizontal-a');
    M.Body.setPosition(body, { x: body.position.x + 5, y: body.position.y });
  });
  assert.ok(wrongPosition?.critical.some(issue =>
    issue.code === 'platform-body-position-mismatch'));

  const progress = new InMemoryRunProgress();
  progress.completeGoal(PROTOTYPE_PROGRESS_CONTENT.goal.businessId);
  const route = runWorldFault(instance => {
    instance.world.progressRouteGate.collisionFilter.mask = 0x0002;
  }, { progress });
  assert.ok(route?.critical.some(issue =>
    issue.code === 'permanent-route-collision-mismatch'));

  const routeEffect = runWorldFault(instance => {
    instance.world.setPermanentEffect(
      PROTOTYPE_PROGRESS_CONTENT.goal.effectId,
      false,
    );
  }, { progress });
  assert.ok(routeEffect?.critical.some(issue =>
    issue.code === 'permanent-route-effect-mismatch'));
});

test('D11-A2 AV04 warnings do not block recovery while preflight writes remain at zero', () => {
  const warned = fixture({
    recoveryOptions: {
      worldValidationWarningInjector: () => [
        'synthetic decoration warning: no production decoration system exists',
      ],
    },
  });
  warned.triggerFailure();
  const recovered = waitForRecovery(warned);
  assert.equal(recovered.recovery.worldValidation?.status, 'valid');
  assert.equal(recovered.recovery.worldValidation?.warnings.length, 1);
  assert.equal(recovered.recovery.selectedAnchorRole, 'primary');

  const progress = new InMemoryRunProgress();
  progress.completeGoal(PROTOTYPE_PROGRESS_CONTENT.goal.businessId);
  let mixed;
  mixed = fixture({
    progress,
    recoveryOptions: {
      worldValidationWarningInjector: () => ['synthetic non-critical warning'],
      faultInjector(point) {
        if (point === 'after-rebuild') {
          mixed.world.progressRouteGate.collisionFilter.mask = 0x0002;
        }
      },
    },
  });
  mixed.triggerFailure();
  mixed.stepUntil(snapshot => snapshot.recovery.phase === 'failed');
  assert.equal(mixed.core.snapshot.recovery.worldValidation?.status, 'invalid');
  assert.equal(mixed.core.snapshot.recovery.worldValidation?.warnings.length, 1);
  assert.ok(
    (mixed.core.snapshot.recovery.worldValidation?.critical.length ?? 0) >= 1,
  );

  const corruptions = [
    {
      name: 'runtime identity',
      mutate: record => ({
        ...record,
        runtimeInstanceId: '00000000-0000-4000-8000-000000000000',
      }),
    },
    {
      name: 'level identity',
      mutate: record => ({ ...record, levelId: 'wrong-level' }),
    },
    {
      name: 'checkpoint identity',
      mutate: record => ({
        ...record,
        checkpointId: 'graybox-test-capture-b',
      }),
    },
    {
      name: 'schema version',
      mutate: record => ({ ...record, schemaVersion: 999 }),
    },
    {
      name: 'state version',
      mutate: record => ({
        ...record,
        objects: record.objects.map((object, index) =>
          index === 0 ? { ...object, stateVersion: 999 } : object),
      }),
    },
    {
      name: 'missing object',
      mutate: record => ({
        ...record,
        objects: record.objects.slice(1),
      }),
    },
    {
      name: 'non-finite payload',
      mutate: record => ({
        ...record,
        objects: record.objects.map((object, index) =>
          index === 0
            ? {
              ...object,
              state: {
                ...object.state,
                position: { ...object.state.position, x: Number.NaN },
              },
            }
            : object),
      }),
    },
  ];

  for (const corruption of corruptions) {
    let injectedSource;
    const instance = fixture({
      recoveryOptions: {
        sourceOverride: () => injectedSource,
      },
    });
    const original = instance.core.snapshot.checkpointSnapshot.current;
    assert.ok(original);
    injectedSource = corruption.mutate(original);
    let worldWrites = 0;
    const apply = instance.world.applyTemporarySnapshot.bind(instance.world);
    const rebuild = instance.world.rebuildRecoveryWorld.bind(instance.world);
    const place = instance.world.placePlayerAtAnchor.bind(instance.world);
    const effect = instance.world.setPermanentEffect.bind(instance.world);
    instance.world.applyTemporarySnapshot = (...args) => {
      worldWrites++;
      return apply(...args);
    };
    instance.world.rebuildRecoveryWorld = () => {
      worldWrites++;
      return rebuild();
    };
    instance.world.placePlayerAtAnchor = (...args) => {
      worldWrites++;
      return place(...args);
    };
    instance.world.setPermanentEffect = (...args) => {
      worldWrites++;
      return effect(...args);
    };

    instance.triggerFailure();
    instance.stepUntil(snapshot => snapshot.recovery.phase === 'failed');
    const failed = instance.core.snapshot;
    assert.equal(
      worldWrites,
      0,
      `${corruption.name} must be rejected before recovery world writes`,
    );
    assert.equal(failed.checkpointSnapshot.current, original);
    assert.equal(failed.recovery.sourceSnapshot, null);
    assert.equal(failed.recovery.worldValidation, null);
    assert.equal(failed.recovery.anchorAttempts.length, 0);
    assert.equal(failed.recovery.placedTick, null);
    assert.equal(failed.recovery.controlLockHeld, true);
    assert.equal(failed.recovery.triggersShielded, true);
    assert.equal(instance.core.reset().status, 'blocked');
  }
});

test('D11-A2 AV05 fallback success preserves the source record, IDs, progress and route', () => {
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
  const before = instance.core.snapshot;
  const sourceRecord = before.checkpointSnapshot.current;
  assert.ok(sourceRecord);
  const identityBefore = {
    runtime: before.goalRoute.runtimeInstanceId,
    event: before.goalRoute.eventId,
    command: before.goalRoute.commandId,
    transaction: before.goalRoute.transactionId,
    result: before.goalRoute.resultEventId,
  };
  const countersBefore = {
    goals: before.progress.counts.goals,
    rewards: before.progress.counts.rewards,
    effects: before.progress.counts.effects,
    saves: before.checkpointCapture.successfulCommits,
    entries: before.checkpointTriggers.entryEventCount,
  };

  addSolidBlocker(instance, 'test-active-A-primary-blocker', 1200, 472);
  instance.triggerFailure();
  const completed = waitForRecovery(instance);
  assert.deepEqual(completed.recovery.sourceAnchor, {
    x: 1200,
    y: 472,
    facing: 1,
  });
  assert.deepEqual(completed.recovery.selectedAnchor, {
    x: 1160,
    y: 472,
    facing: 1,
  });
  assert.equal(completed.recovery.selectedAnchorRole, 'fallback');
  assert.equal(completed.recovery.selectedFallbackIndex, 0);
  assert.equal(completed.checkpointSnapshot.current, sourceRecord);
  assert.deepEqual(
    {
      runtime: completed.goalRoute.runtimeInstanceId,
      event: completed.goalRoute.eventId,
      command: completed.goalRoute.commandId,
      transaction: completed.goalRoute.transactionId,
      result: completed.goalRoute.resultEventId,
    },
    identityBefore,
  );
  assert.deepEqual(
    {
      goals: completed.progress.counts.goals,
      rewards: completed.progress.counts.rewards,
      effects: completed.progress.counts.effects,
      saves: completed.checkpointCapture.successfulCommits,
      entries: completed.checkpointTriggers.entryEventCount,
    },
    countersBefore,
  );
  assert.equal(instance.world.progressRouteOpen, true);
  assert.equal(completed.player.controlAllowed, true);
});

test('D11-A3 ER01 one missing-body failure triggers one full managed rebuild', () => {
  const progress = new InMemoryRunProgress();
  progress.completeGoal(PROTOTYPE_PROGRESS_CONTENT.goal.businessId);
  let installedFault = false;
  const instance = fixture({
    progress,
    recoveryOptions: {
      faultInjector(point) {
        if (point !== 'after-rebuild' || installedFault) return;
        installedFault = true;
        M.Composite.remove(
          instance.engine.world,
          findWorldBody(instance, 'moving-horizontal-a'),
        );
      },
    },
  });
  const originalRecord = instance.core.snapshot.checkpointSnapshot.current;
  const originalBodies = [
    findWorldBody(instance, 'moving-horizontal-a'),
    findWorldBody(instance, 'moving-vertical-a'),
  ];
  instance.triggerFailure();
  const completed = waitForRecovery(instance);
  const actualBodies = M.Composite.allBodies(instance.engine.world);
  const rebuiltBodies = [
    findWorldBody(instance, 'moving-horizontal-a'),
    findWorldBody(instance, 'moving-vertical-a'),
  ];

  assert.equal(installedFault, true);
  assert.equal(completed.recovery.automaticRebuildAttempts, 1);
  assert.equal(completed.recovery.automaticRebuildCount, 1);
  assert.equal(completed.recovery.managedWorldRebuildCount, 2);
  assert.equal(completed.recovery.lastFailureStage, null);
  assert.equal(completed.recovery.worldValidation?.status, 'valid');
  assert.equal(completed.recovery.selectedAnchorRole, 'primary');
  assert.equal(completed.checkpointSnapshot.current, originalRecord);
  assert.equal(completed.goalRoute.runtimeInstanceId, instance.runtimeInstanceId);
  assert.deepEqual(
    [
      completed.progress.counts.goals,
      completed.progress.counts.rewards,
      completed.progress.counts.effects,
    ],
    [1, 1, 1],
  );
  assert.equal(instance.world.progressRouteOpen, true);
  for (const oldBody of originalBodies) {
    assert.equal(actualBodies.includes(oldBody), false,
      `Old ${oldBody.label} body must no longer participate in Matter`);
  }
  for (const rebuiltBody of rebuiltBodies) {
    assert.equal(actualBodies.includes(rebuiltBody), true);
  }
  assert.notEqual(rebuiltBodies[0], originalBodies[0]);
  assert.notEqual(rebuiltBodies[1], originalBodies[1]);
  assert.equal(instance.world.movingPlatforms.length, 2);
});

test('D11-A3 ER02 incompatible source enters Error without rebuild and retries same source', () => {
  let sourceReads = 0;
  let injected;
  const instance = fixture({
    recoveryOptions: {
      sourceOverride() {
        sourceReads++;
        const current = instance.core.snapshot.checkpointSnapshot.current;
        injected = { ...current, schemaVersion: 999 };
        return injected;
      },
    },
  });
  const originalRecord = instance.core.snapshot.checkpointSnapshot.current;
  let worldWrites = 0;
  for (const method of [
    'applyTemporarySnapshot',
    'rebuildRecoveryWorld',
    'placePlayerAtAnchor',
    'setPermanentEffect',
  ]) {
    const original = instance.world[method].bind(instance.world);
    instance.world[method] = (...args) => {
      worldWrites++;
      return original(...args);
    };
  }

  instance.triggerFailure();
  instance.stepUntil(snapshot => snapshot.recovery.phase === 'failed');
  const firstError = instance.core.snapshot;
  assert.equal(sourceReads, 1);
  assert.equal(firstError.recovery.automaticRebuildAttempts, 0);
  assert.equal(firstError.recovery.automaticRebuildCount, 0);
  assert.equal(firstError.recovery.managedWorldRebuildCount, 0);
  assert.equal(firstError.recovery.lastFailureStage, 'preflight');
  assert.equal(
    firstError.recovery.lastFailureCode,
    'snapshot-version-incompatible',
  );
  assert.equal(firstError.recovery.errorPauseHeld, true);
  assert.equal(firstError.recovery.view, 'recovery-error');
  assert.equal(firstError.paused, true);
  assert.equal(worldWrites, 0);
  assert.equal(instance.core.snapshot.checkpointSnapshot.current, originalRecord);

  assert.equal(instance.core.requestRecoveryRetry().status, 'started');
  instance.stepUntil(snapshot =>
    snapshot.recovery.phase === 'failed' &&
    snapshot.recovery.manualRetryCount === 1);
  const retriedError = instance.core.snapshot;
  assert.equal(sourceReads, 1, 'Manual retry must reuse the retained raw source');
  assert.equal(retriedError.recovery.automaticRebuildAttempts, 0);
  assert.equal(retriedError.recovery.managedWorldRebuildCount, 0);
  assert.equal(retriedError.recovery.lastFailureCode,
    'snapshot-version-incompatible');
  assert.equal(worldWrites, 0);
  assert.equal(retriedError.checkpointSnapshot.current, originalRecord);
});

test('D11-A3 ER03 manual retry, title pause and persistent error stay bounded', () => {
  let rebuildOrdinal = 0;
  const instance = fixture({
    recoveryOptions: {
      faultInjector(point) {
        if (point !== 'after-rebuild') return;
        rebuildOrdinal++;
        if (rebuildOrdinal <= 3) {
          M.Composite.remove(
            instance.engine.world,
            findWorldBody(instance, 'moving-horizontal-a'),
          );
        }
      },
    },
  });
  instance.triggerFailure();
  instance.stepUntil(snapshot => snapshot.recovery.phase === 'failed');
  const initialError = instance.core.snapshot;
  assert.equal(initialError.recovery.automaticRebuildAttempts, 1);
  assert.equal(initialError.recovery.automaticRebuildCount, 1);
  assert.equal(initialError.recovery.managedWorldRebuildCount, 2);
  assert.equal(initialError.recovery.errorPauseHeld, true);
  assert.equal(initialError.recovery.errorPauseRequestCount, 1);
  assert.equal(initialError.recovery.controlLockHeld, true);
  assert.equal(initialError.recovery.triggersShielded, true);
  assert.equal(instance.core.reset().status, 'blocked');

  const errorTick = initialError.tick;
  assert.equal(instance.core.showRecoveryTitle().status, 'changed');
  assert.equal(instance.core.snapshot.recovery.view, 'title');
  assert.equal(instance.core.snapshot.tick, errorTick);
  instance.step(4);
  assert.equal(instance.core.snapshot.tick, errorTick,
    'Title view must keep the simulation paused');
  assert.equal(instance.core.returnToRecoveryError().status, 'changed');
  assert.equal(instance.core.snapshot.recovery.titleRoundTrips, 1);

  const externalOwner = Symbol('d11-a3-external-pause-owner');
  const externalKey = Symbol('d11-a3-external-pause-key');
  const externalToken = instance.core.lifecycle.acquire(externalOwner, externalKey);
  assert.ok(externalToken);
  assert.equal(instance.core.lifecycle.pauseCount, 2);
  assert.equal(instance.core.requestRecoveryRetry().status, 'started');
  assert.equal(instance.core.requestRecoveryRetry().status, 'ignored');
  assert.equal(instance.core.snapshot.recovery.phase, 'manual-retry-pending');
  assert.equal(instance.core.lifecycle.pauseCount, 1,
    'Retry releases only the recovery owner pause token');
  const pendingTick = instance.core.snapshot.tick;
  instance.step(3);
  assert.equal(instance.core.snapshot.tick, pendingTick,
    'Another pause owner must continue to suspend the manual retry');
  assert.equal(
    instance.core.lifecycle.release(externalOwner, externalToken),
    'released',
  );
  instance.stepUntil(snapshot =>
    snapshot.recovery.phase === 'failed' &&
    snapshot.recovery.manualRetryCount === 1);
  const manualFailure = instance.core.snapshot;
  assert.equal(manualFailure.recovery.automaticRebuildAttempts, 1);
  assert.equal(manualFailure.recovery.automaticRebuildCount, 1);
  assert.equal(manualFailure.recovery.errorPauseHeld, true);
  assert.equal(manualFailure.recovery.errorPauseRequestCount, 2);

  assert.equal(instance.core.requestRecoveryRetry().status, 'started');
  const completed = waitForRecovery(instance);
  assert.equal(completed.recovery.phase, 'succeeded');
  assert.equal(completed.recovery.view, 'game');
  assert.equal(completed.recovery.manualRetryCount, 2);
  assert.equal(completed.recovery.automaticRebuildAttempts, 1);
  assert.equal(completed.recovery.automaticRebuildCount, 1);
  assert.equal(completed.recovery.managedWorldRebuildCount, 4);
  assert.equal(completed.recovery.errorPauseHeld, false);
  assert.equal(instance.core.lifecycle.pauseCount, 0);
  assert.equal(completed.recovery.controlLockHeld, false);
  assert.equal(completed.recovery.triggersShielded, false);
  assert.equal(rebuildOrdinal, 4);
});

test('D11-A3-R1 R01 initial recovery waits for foreign temporary-object freeze', () => {
  const instance = fixture();
  const externalOwner = Object.freeze({ label: 'external-resource-owner' });
  const objectIds = freezeRegisteredPlatforms(instance, externalOwner);
  const originalRecord = instance.core.snapshot.checkpointSnapshot.current;
  const currentBodies = objectIds.map(label => findWorldBody(instance, label));
  const writes = trackRecoveryWorldWrites(instance);

  instance.triggerFailure();
  instance.stepUntil(snapshot => snapshot.recovery.phase !== 'fading-out');
  const waiting = instance.core.snapshot;
  const actualBodies = M.Composite.allBodies(instance.engine.world);

  assert.equal(waiting.recovery.phase, 'waiting-for-capture');
  assert.ok(waiting.recovery.captureWaitTicks > 0);
  assert.equal(writes.count, 0);
  assert.equal(waiting.checkpointSnapshot.current, originalRecord);
  assert.deepEqual(waiting.frozenTemporaryObjectIds, objectIds);
  assert.equal(waiting.recovery.controlLockHeld, true);
  assert.equal(waiting.recovery.triggersShielded, true);
  assert.equal(waiting.recovery.placedTick, null);
  for (const body of currentBodies) {
    assert.ok(
      actualBodies.includes(body),
      `${body.label} must remain untouched while another owner freezes it`,
    );
  }

  assert.equal(
    instance.world.releaseTemporaryObjects(externalOwner).status,
    'released',
  );
  const completed = waitForRecovery(instance);
  assert.equal(completed.recovery.phase, 'succeeded');
  assert.equal(completed.checkpointSnapshot.current, originalRecord);
  assert.equal(completed.recovery.controlLockHeld, false);
  assert.equal(completed.recovery.triggersShielded, false);
  assert.equal(completed.goalRoute.runtimeInstanceId, instance.runtimeInstanceId);
});

test('D11-A3-R1 R02 committed capture cleanup is a zero-write recovery gate', () => {
  const runCaptureWithLockedRelease = () => {
    let interruptLockRelease = true;
    const instance = fixture({
      checkpointCaptureOptions: {
        resourceFaultInjector(point) {
          if (point === 'before-release-lock' && interruptLockRelease) {
            interruptLockRelease = false;
            throw new Error('injected committed-capture lock release interruption');
          }
        },
      },
    });
    assert.equal(
      instance.core.requestCheckpointCapture(
        GRAYBOX_TEST_CAPTURE_CHECKPOINT_A_ID,
        captureAuthorization(instance, GRAYBOX_TEST_CAPTURE_CHECKPOINT_A_ID),
      ).status,
      'created',
    );
    instance.stepUntil(snapshot =>
      snapshot.checkpointCapture.transactionStatus === 'recovery-pending' &&
      snapshot.checkpointCapture.successfulCommits === 1,
    );
    assert.equal(instance.core.snapshot.checkpointCapture.lock.held, true);
    assert.equal(
      instance.core.snapshot.checkpointCapture.resourceOwnership.resourcesReleased,
      false,
    );
    return instance;
  };

  const waitingRun = runCaptureWithLockedRelease();
  const waitingWrites = trackRecoveryWorldWrites(waitingRun);
  waitingRun.triggerFailure();
  waitingRun.stepUntil(snapshot => snapshot.recovery.phase !== 'fading-out');
  const waiting = waitingRun.core.snapshot;
  assert.equal(waiting.recovery.phase, 'waiting-for-capture');
  assert.ok(waiting.recovery.captureWaitTicks > 0);
  assert.equal(waitingWrites.count, 0);
  assert.equal(waiting.recovery.sourceSnapshot, null);
  assert.equal(waiting.recovery.controlLockHeld, true);
  assert.equal(waiting.checkpointCapture.lock.held, true);
  assert.equal(waiting.checkpointCapture.resourceOwnership.resourcesReleased, false);

  waitingRun.core.recoverCheckpointCapture();
  const releasedCapture = waitingRun.core.snapshot.checkpointCapture;
  assert.equal(releasedCapture.lock.held, false);
  assert.equal(releasedCapture.resourceOwnership.resourcesReleased, true);
  assert.equal(releasedCapture.successfulCommits, 1);

  const completed = waitForRecovery(waitingRun);
  assert.equal(
    completed.recovery.sourceCheckpointId,
    GRAYBOX_TEST_CAPTURE_CHECKPOINT_A_ID,
  );
  assert.equal(completed.checkpointCapture.successfulCommits, 1);
  assert.equal(waitingWrites.count > 0, true);

  const timeoutRun = runCaptureWithLockedRelease();
  const timeoutWrites = trackRecoveryWorldWrites(timeoutRun);
  const successfulCommits = timeoutRun.core.snapshot.checkpointCapture.successfulCommits;
  timeoutRun.triggerFailure();
  timeoutRun.stepUntil(snapshot => snapshot.recovery.phase === 'failed', 220);
  const timedOut = timeoutRun.core.snapshot;
  assert.ok(
    timedOut.recovery.captureWaitTicks >
      PLAYER_RECOVERY_PROTOTYPE.maxCaptureSettleTicks,
  );
  assert.equal(timeoutWrites.count, 0);
  assert.equal(timedOut.recovery.controlLockHeld, true);
  assert.equal(timedOut.recovery.triggersShielded, true);
  assert.equal(timedOut.checkpointCapture.lock.held, true);
  assert.equal(
    timedOut.checkpointCapture.resourceOwnership.resourcesReleased,
    false,
  );
  assert.equal(timeoutRun.core.reset().status, 'blocked');

  timeoutRun.core.recoverCheckpointCapture();
  assert.equal(timeoutRun.core.snapshot.checkpointCapture.lock.held, false);
  assert.equal(timeoutRun.core.requestRecoveryRetry().status, 'started');
  const retried = waitForRecovery(timeoutRun);
  assert.equal(
    retried.recovery.sourceCheckpointId,
    GRAYBOX_TEST_CAPTURE_CHECKPOINT_A_ID,
  );
  assert.equal(
    retried.checkpointCapture.successfulCommits,
    successfulCommits,
    'Retrying after cleanup must not create another capture commit',
  );
});

test('D11-A3-R1 R03 automatic rebuild waits without consuming a second budget', () => {
  let failInitialAttempt = true;
  const instance = fixture({
    recoveryOptions: {
      faultInjector(point) {
        if (point === 'after-rebuild' && failInitialAttempt) {
          failInitialAttempt = false;
          throw new Error('injected initial-attempt rebuild verification fault');
        }
      },
    },
  });
  const externalOwner = Object.freeze({ label: 'automatic-rebuild-foreign-owner' });
  instance.triggerFailure();
  instance.stepUntil(snapshot => snapshot.recovery.phase === 'auto-rebuilding');
  const autoBeforeWait = instance.core.snapshot;
  const objectIds = freezeRegisteredPlatforms(instance, externalOwner);
  const currentBodies = objectIds.map(label => findWorldBody(instance, label));
  const writes = trackRecoveryWorldWrites(instance);

  instance.step();
  const waiting = instance.core.snapshot;
  const actualBodies = M.Composite.allBodies(instance.engine.world);
  assert.equal(waiting.recovery.phase, 'auto-rebuilding');
  assert.ok(waiting.recovery.captureWaitTicks > 0);
  assert.equal(writes.count, 0);
  assert.equal(waiting.recovery.automaticRebuildAttempts, 1);
  assert.equal(waiting.recovery.automaticRebuildCount, 0);
  assert.equal(
    waiting.recovery.managedWorldRebuildCount,
    autoBeforeWait.recovery.managedWorldRebuildCount,
  );
  for (const body of currentBodies) {
    assert.ok(actualBodies.includes(body));
  }

  assert.equal(
    instance.world.releaseTemporaryObjects(externalOwner).status,
    'released',
  );
  const completed = waitForRecovery(instance);
  assert.equal(completed.recovery.phase, 'succeeded');
  assert.equal(completed.recovery.automaticRebuildAttempts, 1);
  assert.equal(completed.recovery.automaticRebuildCount, 1);
  assert.equal(completed.recovery.managedWorldRebuildCount, 2);
});

test('D11-A3-R1 R03 manual retry obeys the same resource gate', () => {
  let rebuildOrdinal = 0;
  const instance = fixture({
    recoveryOptions: {
      faultInjector(point) {
        if (point !== 'after-rebuild') return;
        rebuildOrdinal++;
        if (rebuildOrdinal <= 2) {
          throw new Error(`injected rebuild failure ${rebuildOrdinal}`);
        }
      },
    },
  });
  instance.triggerFailure();
  instance.stepUntil(snapshot => snapshot.recovery.phase === 'failed');
  const error = instance.core.snapshot;
  assert.equal(error.recovery.automaticRebuildAttempts, 1);
  assert.equal(error.recovery.automaticRebuildCount, 1);

  const externalOwner = Object.freeze({ label: 'manual-retry-foreign-owner' });
  const objectIds = freezeRegisteredPlatforms(instance, externalOwner);
  const currentBodies = objectIds.map(label => findWorldBody(instance, label));
  const writes = trackRecoveryWorldWrites(instance);
  assert.equal(instance.core.requestRecoveryRetry().status, 'started');
  assert.equal(instance.core.requestRecoveryRetry().status, 'ignored');

  instance.stepUntil(snapshot =>
    snapshot.recovery.captureWaitTicks > 0 ||
    snapshot.recovery.phase !== 'manual-retry-pending',
  );
  const waiting = instance.core.snapshot;
  const actualBodies = M.Composite.allBodies(instance.engine.world);
  assert.equal(waiting.recovery.phase, 'manual-retry-pending');
  assert.equal(waiting.recovery.manualRetryPending, true);
  assert.equal(waiting.recovery.manualRetryCount, 1);
  assert.equal(waiting.recovery.captureWaitTicks, 1);
  assert.equal(writes.count, 0);
  for (const body of currentBodies) {
    assert.ok(actualBodies.includes(body));
  }

  assert.equal(
    instance.world.releaseTemporaryObjects(externalOwner).status,
    'released',
  );
  const completed = waitForRecovery(instance);
  assert.equal(completed.recovery.phase, 'succeeded');
  assert.equal(completed.recovery.manualRetryCount, 1);
  assert.equal(completed.recovery.automaticRebuildAttempts, 1);
  assert.equal(completed.recovery.automaticRebuildCount, 1);
  assert.equal(completed.recovery.managedWorldRebuildCount, 3);
  assert.equal(rebuildOrdinal, 3);
});
