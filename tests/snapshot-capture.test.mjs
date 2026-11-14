import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { createGrayboxCore } from '../src/core/graybox.ts';
import { PROTOTYPE_PROGRESS_CONTENT } from '../src/core/progress.ts';
import {
  GRAYBOX_CHECKPOINT_ID,
  GRAYBOX_SNAPSHOT_REGISTRY,
  GRAYBOX_TEST_CAPTURE_CHECKPOINT_ID,
} from '../src/core/snapshot.ts';
import {
  CHECKPOINT_CAPTURE_COMMAND_TYPE,
  CHECKPOINT_CAPTURE_EVENT_TYPE,
  CHECKPOINT_CAPTURE_TARGET_ID,
} from '../src/core/snapshot-capture-runtime.ts';
import { MatterGrayboxWorld } from '../src/physics/matter/graybox-world.ts';

// Use the Matter implementation bundled by Phaser. No alternate physics model
// or fake contact result participates in these capture tests.
const M = createRequire(import.meta.url)(
  '../node_modules/phaser/src/physics/matter-js/CustomMain.js',
);
let runtimeNumber = 0;

function fixture(captureOptions = {}, x = 80) {
  runtimeNumber++;
  const runtimeInstanceId =
    `a0000000-0000-4000-8000-${String(runtimeNumber).padStart(12, '0')}`;
  const engine = M.Engine.create();
  const world = new MatterGrayboxWorld(
    M,
    engine,
    deltaMs => M.Engine.update(engine, deltaMs),
  );
  M.Body.setPosition(world.player, { x, y: 472 });
  const core = createGrayboxCore(world, {
    uuidProvider: { generate: () => runtimeInstanceId },
    checkpointCaptureOptions: captureOptions,
  });
  let sample = 0;
  const step = (count = 1) => {
    for (let index = 0; index < count; index++) {
      core.frame(sample * core.config.fixedDeltaMs);
      sample++;
    }
  };
  step(30);
  return { core, world, runtimeInstanceId, step };
}

function authorization(instance, checkpointId, requestId = `request-${checkpointId}`) {
  return {
    runtimeInstanceId: instance.runtimeInstanceId,
    levelId: 'graybox-platform-lab',
    checkpointId,
    requestId,
    granted: true,
  };
}

function request(instance, checkpointId) {
  return instance.core.requestCheckpointCapture(
    checkpointId,
    authorization(instance, checkpointId),
  );
}

function advanceToTerminal(instance, maximum = 8) {
  for (let index = 0; index < maximum; index++) {
    if (instance.core.snapshot.checkpointCapture.phase === 'succeeded' ||
        instance.core.snapshot.checkpointCapture.phase === 'failed') {
      return;
    }
    instance.step();
  }
  assert.fail(
    `Capture did not become terminal: ` +
    JSON.stringify(instance.core.snapshot.checkpointCapture),
  );
}

test('D10-A2 CT01 real command and transaction capture replaces one checkpoint across Ticks', () => {
  const instance = fixture();
  const before = instance.core.snapshot;
  assert.equal(before.checkpointSnapshot.current.checkpointId, GRAYBOX_CHECKPOINT_ID);

  const requested = request(instance, GRAYBOX_TEST_CAPTURE_CHECKPOINT_ID);
  assert.equal(requested.status, 'created');
  let capture = instance.core.snapshot.checkpointCapture;
  assert.equal(capture.phase, 'request-pending');
  assert.equal(capture.eventId, 1);
  assert.equal(capture.lock.held, true);
  assert.deepEqual(capture.frozenObjectIds, []);
  assert.equal(
    instance.core.snapshot.checkpointSnapshot.current.checkpointId,
    GRAYBOX_CHECKPOINT_ID,
  );

  instance.step();
  capture = instance.core.snapshot.checkpointCapture;
  assert.equal(capture.phase, 'verifying');
  assert.equal(capture.deliveryStatus, 'accepted');
  assert.equal(capture.commandId, 1);
  assert.equal(capture.transactionId, 1);
  assert.equal(capture.candidateCheckpointId, GRAYBOX_TEST_CAPTURE_CHECKPOINT_ID);
  assert.equal(capture.currentCheckpointId, GRAYBOX_CHECKPOINT_ID);
  assert.equal(capture.captureAttempts, 1);
  assert.equal(capture.commitAttempts, 0);
  assert.equal(capture.lock.held, true);
  assert.deepEqual(
    capture.frozenObjectIds,
    GRAYBOX_SNAPSHOT_REGISTRY.map(entry => entry.objectId),
  );
  assert.equal(
    instance.core.snapshot.checkpointSnapshot.current.checkpointId,
    GRAYBOX_CHECKPOINT_ID,
    'Applying capture must not expose a half-committed checkpoint',
  );

  instance.step();
  capture = instance.core.snapshot.checkpointCapture;
  assert.equal(capture.phase, 'result-pending');
  assert.equal(capture.transactionStatus, 'succeeded');
  assert.equal(capture.commitAttempts, 1);
  assert.equal(capture.successfulCommits, 1);
  assert.equal(capture.lock.held, false);
  assert.deepEqual(capture.frozenObjectIds, []);
  assert.equal(
    instance.core.snapshot.checkpointSnapshot.current.checkpointId,
    GRAYBOX_TEST_CAPTURE_CHECKPOINT_ID,
  );
  assert.deepEqual(
    instance.core.snapshot.checkpointSnapshot.current.anchor,
    { x: 640, y: 472, facing: 1 },
  );

  advanceToTerminal(instance);
  capture = instance.core.snapshot.checkpointCapture;
  assert.equal(capture.terminal?.status, 'succeeded');
  assert.equal(capture.originalRetired, true);
  assert.equal(capture.resultRetired, true);
  assert.equal(capture.resultConsumptionCount, 1);
  assert.equal(capture.resultEventId, capture.eventId + 1);
  assert.equal(capture.counts.commands, 1);
  assert.equal(capture.counts.transactions, 1);
  assert.equal(capture.counts.resultEvents, 1);
  assert.equal(
    capture.resultLifecycle,
    'retired',
  );
});

test('D10-A2 CT02 real Matter freezes only capture objects and resumes without catch-up', () => {
  const instance = fixture();
  M.Body.setPosition(instance.world.player, {
    x: 1710,
    y: 300 - 9 - 22,
  });
  M.Body.setVelocity(instance.world.player, { x: 0, y: 0 });
  instance.step(3);
  assert.equal(
    instance.core.snapshot.player.support,
    'moving-horizontal-a',
  );

  assert.equal(request(instance, GRAYBOX_TEST_CAPTURE_CHECKPOINT_ID).status, 'created');
  instance.step();
  const frozen = instance.core.snapshot;
  const frozenClock = instance.world.platformClockMs;
  const frozenPlatforms = JSON.stringify(instance.world.movingPlatforms);
  const playerBeforeMove = frozen.player.x;
  const physicsStepsBefore = frozen.physicsSteps;
  const tickBefore = frozen.tick;

  assert.throws(() => instance.core.reset(), /frozen/i);
  assert.equal(instance.world.platformClockMs, frozenClock);
  assert.equal(JSON.stringify(instance.world.movingPlatforms), frozenPlatforms);

  instance.core.key('KeyD', true);
  instance.core.key('Space', true);
  instance.step();
  instance.core.key('KeyD', false);
  instance.core.key('Space', false);

  const whileFrozen = instance.core.snapshot;
  assert.ok(whileFrozen.tick > tickBefore);
  assert.equal(
    whileFrozen.physicsSteps - physicsStepsBefore,
    whileFrozen.tick - tickBefore,
    'Matter still performs one solve for every actual Tick',
  );
  assert.equal(instance.world.platformClockMs, frozenClock);
  assert.equal(JSON.stringify(instance.world.movingPlatforms), frozenPlatforms);
  assert.ok(whileFrozen.player.x > playerBeforeMove);
  assert.ok(whileFrozen.player.jumps >= 1);
  const released = instance.core.snapshot;
  assert.equal(released.checkpointCapture.phase, 'result-pending');
  assert.equal(released.checkpointCapture.transactionStatus, 'succeeded');
  assert.equal(released.checkpointCapture.lock.held, false);
  assert.deepEqual(released.checkpointCapture.frozenObjectIds, []);
  assert.equal(instance.world.platformClockMs, frozenClock);

  instance.step(2);
  const resumed = instance.core.snapshot;
  assert.ok(
    Math.abs(
      instance.world.platformClockMs -
      (frozenClock + 2 * instance.core.config.fixedDeltaMs),
    ) < 1e-6,
    'Frozen Ticks must not be replayed after release',
  );
  assert.doesNotThrow(() => instance.core.reset());
});

test('D10-A2 CT03 one level lock admits one capture and never queues a competitor', () => {
  const instance = fixture();
  const first = request(instance, GRAYBOX_TEST_CAPTURE_CHECKPOINT_ID);
  assert.equal(first.status, 'created');
  const firstCapture = instance.core.snapshot.checkpointCapture;
  assert.equal(firstCapture.eventId, 1);
  assert.equal(firstCapture.lock.held, true);

  const duplicate = request(instance, GRAYBOX_TEST_CAPTURE_CHECKPOINT_ID);
  assert.equal(duplicate.status, 'existing');
  assert.equal(instance.core.snapshot.checkpointCapture.eventId, 1);

  const blocked = instance.core.requestCheckpointCapture(
    GRAYBOX_CHECKPOINT_ID,
    authorization(instance, GRAYBOX_CHECKPOINT_ID, 'competing-lock-request'),
  );
  assert.equal(blocked.status, 'rejected');
  assert.equal(blocked.reason, 'lock-busy');
  assert.equal(instance.core.snapshot.checkpointCapture.eventId, 1);

  instance.step();
  assert.equal(instance.core.snapshot.checkpointCapture.phase, 'verifying');
  assert.equal(
    request(instance, GRAYBOX_TEST_CAPTURE_CHECKPOINT_ID).status,
    'existing',
  );

  instance.step();
  const resultPending = instance.core.snapshot.checkpointCapture;
  assert.equal(resultPending.phase, 'result-pending');
  assert.equal(resultPending.lock.held, false);
  assert.equal(resultPending.counts.commands, 1);

  // The object lock has been released, but the same capture lifecycle still
  // owns terminal-result confirmation/retirement. A duplicate request must not
  // create a second capture or a second transaction.
  const duplicateAfterCommit = request(
    instance,
    GRAYBOX_TEST_CAPTURE_CHECKPOINT_ID,
  );
  assert.equal(duplicateAfterCommit.status, 'existing');
  assert.equal(
    instance.core.snapshot.checkpointCapture.eventId,
    resultPending.eventId,
  );
  assert.equal(instance.core.snapshot.checkpointCapture.counts.commands, 1);
  assert.equal(instance.core.snapshot.checkpointCapture.commitAttempts, 1);

  advanceToTerminal(instance);
  const completed = instance.core.snapshot.checkpointCapture;
  assert.equal(completed.phase, 'succeeded');
  assert.equal(completed.lock.held, false);
  assert.equal(completed.counts.commands, 1);

  const duplicateAfterTerminal = request(
    instance,
    GRAYBOX_TEST_CAPTURE_CHECKPOINT_ID,
  );
  assert.equal(duplicateAfterTerminal.status, 'existing');
  assert.equal(instance.core.snapshot.checkpointCapture.counts.commands, 1);

  const completedBeforeIdleTicks = instance.core.snapshot.checkpointCapture;
  instance.step(2);
  assert.equal(
    instance.core.snapshot.checkpointCapture.counts.commands,
    completedBeforeIdleTicks.counts.commands,
  );
  const commandsAfterFirst = completed.counts.commands;

  instance.step(2);
  assert.equal(
    instance.core.snapshot.checkpointCapture.counts.commands,
    commandsAfterFirst,
    'Lock waiters must not be replayed automatically',
  );

  const explicit = request(instance, GRAYBOX_CHECKPOINT_ID);
  assert.equal(explicit.status, 'created', JSON.stringify(explicit));
  assert.equal(instance.core.snapshot.checkpointCapture.eventId, 3);
  assert.equal(instance.core.snapshot.checkpointCapture.lock.held, true);
});

test('D10-A2 CT04 pre-commit capture failure preserves old checkpoint and releases resources', () => {
  const instance = fixture({
    captureFaultInjector: (phase, details) => {
      if (phase === 'capture' && details.objectId === 'moving-vertical-a') {
        throw new Error('injected second-object capture failure');
      }
    },
  });
  const oldRecord = JSON.stringify(instance.core.snapshot.checkpointSnapshot.current);
  const oldProgress = JSON.stringify(instance.core.snapshot.progress);
  assert.equal(request(instance, GRAYBOX_TEST_CAPTURE_CHECKPOINT_ID).status, 'created');
  advanceToTerminal(instance);

  const capture = instance.core.snapshot.checkpointCapture;
  assert.equal(capture.phase, 'failed');
  assert.equal(capture.terminal?.status, 'failed');
  assert.equal(capture.captureAttempts, 1);
  assert.equal(capture.commitAttempts, 0);
  assert.equal(capture.successfulCommits, 0);
  assert.equal(capture.lock.held, false);
  assert.deepEqual(capture.frozenObjectIds, []);
  assert.equal(JSON.stringify(instance.core.snapshot.checkpointSnapshot.current), oldRecord);
  assert.equal(JSON.stringify(instance.core.snapshot.progress), oldProgress);
});

test('D10-A2 CT04 foreign freeze, validation and pre-commit faults cannot replace the old checkpoint', () => {
  const foreignFreeze = fixture();
  const foreignOwner = {};
  const objectIds = GRAYBOX_SNAPSHOT_REGISTRY.map(entry => entry.objectId);
  assert.equal(
    foreignFreeze.world.freezeTemporaryObjects(objectIds, foreignOwner).status,
    'frozen',
  );
  const old = JSON.stringify(foreignFreeze.core.snapshot.checkpointSnapshot.current);
  assert.equal(
    request(foreignFreeze, GRAYBOX_TEST_CAPTURE_CHECKPOINT_ID).status,
    'created',
  );
  advanceToTerminal(foreignFreeze);
  let capture = foreignFreeze.core.snapshot.checkpointCapture;
  assert.equal(capture.phase, 'failed');
  assert.equal(capture.lock.held, false);
  assert.equal(JSON.stringify(foreignFreeze.core.snapshot.checkpointSnapshot.current), old);
  assert.deepEqual(foreignFreeze.world.frozenTemporaryObjectIds, objectIds);
  assert.equal(foreignFreeze.world.releaseTemporaryObjects({}).status, 'owner-mismatch');
  assert.equal(
    foreignFreeze.world.releaseTemporaryObjects(foreignOwner).status,
    'released',
  );

  const validationFailure = fixture({
    captureFaultInjector: phase => {
      if (phase === 'validate') throw new Error('injected validation failure');
    },
  });
  const validationOld =
    JSON.stringify(validationFailure.core.snapshot.checkpointSnapshot.current);
  assert.equal(
    request(validationFailure, GRAYBOX_TEST_CAPTURE_CHECKPOINT_ID).status,
    'created',
  );
  advanceToTerminal(validationFailure);
  capture = validationFailure.core.snapshot.checkpointCapture;
  assert.equal(capture.phase, 'failed');
  assert.equal(capture.commitAttempts, 0);
  assert.equal(capture.lock.held, false);
  assert.deepEqual(capture.frozenObjectIds, []);
  assert.equal(
    JSON.stringify(validationFailure.core.snapshot.checkpointSnapshot.current),
    validationOld,
  );

  const commitFailure = fixture({
    captureFaultInjector: phase => {
      if (phase === 'commit') throw new Error('injected pre-commit failure');
    },
  });
  const commitOld = JSON.stringify(commitFailure.core.snapshot.checkpointSnapshot.current);
  assert.equal(request(commitFailure, GRAYBOX_TEST_CAPTURE_CHECKPOINT_ID).status, 'created');
  advanceToTerminal(commitFailure);
  capture = commitFailure.core.snapshot.checkpointCapture;
  assert.equal(capture.phase, 'failed');
  assert.equal(capture.captureAttempts, 1);
  assert.equal(capture.commitAttempts, 1);
  assert.equal(capture.successfulCommits, 0);
  assert.equal(capture.lock.held, false);
  assert.deepEqual(capture.frozenObjectIds, []);
  assert.equal(JSON.stringify(commitFailure.core.snapshot.checkpointSnapshot.current), commitOld);
});

test('D10-A2 CT05a lost commit receipt recovers the original candidate without recapture', () => {
  const instance = fixture({
    captureFaultInjector: phase => {
      if (phase === 'after-commit') throw new Error('injected lost commit receipt');
    },
  });
  assert.equal(request(instance, GRAYBOX_TEST_CAPTURE_CHECKPOINT_ID).status, 'created');
  instance.step();
  instance.step();

  let capture = instance.core.snapshot.checkpointCapture;
  assert.equal(capture.phase, 'recovery-pending');
  assert.equal(capture.transactionStatus, 'recovery-pending');
  assert.equal(capture.captureAttempts, 1);
  assert.equal(capture.commitAttempts, 1);
  assert.equal(capture.successfulCommits, 1);
  assert.equal(
    instance.core.snapshot.checkpointSnapshot.current.checkpointId,
    GRAYBOX_TEST_CAPTURE_CHECKPOINT_ID,
  );
  const transactionId = capture.transactionId;
  const commandId = capture.commandId;

  instance.step();
  instance.core.recoverCheckpointCapture();
  capture = instance.core.snapshot.checkpointCapture;
  assert.equal(capture.transactionId, transactionId);
  assert.equal(capture.commandId, commandId);
  assert.equal(capture.captureAttempts, 1);
  assert.equal(capture.commitAttempts, 1);
  assert.equal(capture.successfulCommits, 1);
  assert.equal(capture.transactionStatus, 'succeeded');
  assert.equal(
    instance.core.snapshot.checkpointSnapshot.current.checkpointId,
    GRAYBOX_TEST_CAPTURE_CHECKPOINT_ID,
  );
});

test('D10-A2 CT05c resource-release fault remains inspectable and recovers the committed candidate', () => {
  let interruptLockRelease = true;
  const instance = fixture({
    resourceFaultInjector: point => {
      if (point === 'before-release-lock' && interruptLockRelease) {
        interruptLockRelease = false;
        throw new Error('injected lock release interruption');
      }
    },
  });
  assert.equal(request(instance, GRAYBOX_TEST_CAPTURE_CHECKPOINT_ID).status, 'created');
  instance.step();
  instance.step();

  let capture = instance.core.snapshot.checkpointCapture;
  assert.equal(capture.phase, 'recovery-pending');
  assert.equal(capture.transactionStatus, 'recovery-pending');
  assert.equal(capture.captureAttempts, 1);
  assert.equal(capture.commitAttempts, 1);
  assert.equal(capture.successfulCommits, 1);
  assert.equal(capture.lock.held, true);
  assert.deepEqual(capture.frozenObjectIds, []);
  assert.equal(
    instance.core.snapshot.checkpointSnapshot.current.checkpointId,
    GRAYBOX_TEST_CAPTURE_CHECKPOINT_ID,
  );

  instance.step();
  instance.core.recoverCheckpointCapture();
  capture = instance.core.snapshot.checkpointCapture;
  assert.equal(capture.transactionStatus, 'succeeded');
  assert.equal(capture.lock.held, false);
  assert.equal(capture.captureAttempts, 1);
  assert.equal(capture.commitAttempts, 1);
  assert.equal(capture.successfulCommits, 1);
});

test('D10-A2 CT05b terminal-pending recovery is explicit, bounded and never re-captures', () => {
  let failTerminal = true;
  const instance = fixture({
    transactionFaultInjector: point => {
      if (point === 'before-terminal-commit' && failTerminal) {
        throw new Error('injected terminal registration failure');
      }
    },
  });
  assert.equal(request(instance, GRAYBOX_TEST_CAPTURE_CHECKPOINT_ID).status, 'created');
  instance.step();
  instance.step();

  let capture = instance.core.snapshot.checkpointCapture;
  assert.equal(capture.phase, 'recovery-pending');
  assert.equal(capture.transactionStatus, 'terminal-pending');
  assert.equal(capture.captureAttempts, 1);
  assert.equal(capture.commitAttempts, 1);
  assert.equal(
    instance.core.snapshot.checkpointSnapshot.current.checkpointId,
    GRAYBOX_TEST_CAPTURE_CHECKPOINT_ID,
  );

  instance.step();
  instance.core.recoverCheckpointCapture();
  capture = instance.core.snapshot.checkpointCapture;
  assert.equal(capture.transactionStatus, 'terminal-pending');
  assert.equal(capture.captureAttempts, 1);
  assert.equal(capture.commitAttempts, 1);

  failTerminal = false;
  instance.step();
  instance.core.recoverCheckpointCapture();
  capture = instance.core.snapshot.checkpointCapture;
  assert.equal(capture.transactionStatus, 'succeeded');
  assert.equal(capture.captureAttempts, 1);
  assert.equal(capture.commitAttempts, 1);
  assert.equal(
    instance.core.snapshot.checkpointSnapshot.current.checkpointId,
    GRAYBOX_TEST_CAPTURE_CHECKPOINT_ID,
  );
});

test('D10-A2 CT06 target E and capture share one runtime but use distinct command targets', () => {
  const instance = fixture();
  const goal = PROTOTYPE_PROGRESS_CONTENT.goal;
  M.Body.setPosition(instance.world.player, { x: goal.x, y: goal.y });
  M.Body.setVelocity(instance.world.player, { x: 0, y: 0 });
  instance.step(3);
  instance.core.key('KeyE', true);
  instance.core.key('KeyE', false);
  assert.equal(instance.core.snapshot.goalRoute.eventId, 1);
  assert.equal(request(instance, GRAYBOX_TEST_CAPTURE_CHECKPOINT_ID).status, 'created');
  assert.equal(instance.core.snapshot.goalRoute.eventId, 1);
  assert.equal(instance.core.snapshot.checkpointCapture.eventId, 2);
  assert.equal(
    instance.core.snapshot.goalRoute.runtimeInstanceId,
    instance.core.snapshot.checkpointCapture.runtimeInstanceId,
  );

  instance.step();
  const snapshot = instance.core.snapshot;
  assert.equal(snapshot.goalRoute.runtimeInstanceId, instance.runtimeInstanceId);
  assert.equal(snapshot.checkpointCapture.runtimeInstanceId, instance.runtimeInstanceId);
  assert.notEqual(
    snapshot.goalRoute.targetId,
    snapshot.checkpointCapture.targetId,
  );
  assert.equal(snapshot.goalRoute.commandId, 1);
  assert.equal(snapshot.checkpointCapture.commandId, 2);
  assert.equal(snapshot.goalRoute.goalId, PROTOTYPE_PROGRESS_CONTENT.goal.businessId);
  assert.equal(snapshot.checkpointCapture.phase, 'verifying');
  assert.deepEqual(snapshot.goalRoute.progress, {
    collections: 0,
    goals: 1,
    rewards: 1,
    effects: 1,
  });
  assert.equal(CHECKPOINT_CAPTURE_EVENT_TYPE, 'prototype.checkpoint.capture.requested');
  assert.equal(CHECKPOINT_CAPTURE_COMMAND_TYPE, 'prototype.snapshot.capture');
  assert.equal(CHECKPOINT_CAPTURE_TARGET_ID, 'prototype.snapshot.target');
});
