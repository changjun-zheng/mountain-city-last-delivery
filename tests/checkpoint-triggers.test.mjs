import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import {
  arbitrateCheckpointTriggerEntries,
  GRAYBOX_CHECKPOINT_TRIGGERS,
  validateCheckpointTriggerDefinitions,
} from '../src/core/checkpoint-triggers.ts';
import { createGrayboxCore } from '../src/core/graybox.ts';
import {
  InMemoryRunProgress,
  PROTOTYPE_PROGRESS_CONTENT,
} from '../src/core/progress.ts';
import {
  GRAYBOX_CHECKPOINT_ID,
  GRAYBOX_TEST_CAPTURE_CHECKPOINT_A_ID,
  GRAYBOX_TEST_CAPTURE_CHECKPOINT_B_ID,
} from '../src/core/snapshot.ts';
import { MatterGrayboxWorld } from '../src/physics/matter/graybox-world.ts';

const M = createRequire(import.meta.url)(
  '../node_modules/phaser/src/physics/matter-js/CustomMain.js',
);
let runtimeNumber = 0;

function fixture(captureOptions = {}) {
  runtimeNumber++;
  const runtimeInstanceId =
    `b0000000-0000-4000-8000-${String(runtimeNumber).padStart(12, '0')}`;
  const engine = M.Engine.create();
  const world = new MatterGrayboxWorld(
    M,
    engine,
    deltaMs => M.Engine.update(engine, deltaMs),
  );
  const progress = new InMemoryRunProgress();
  progress.completeGoal(PROTOTYPE_PROGRESS_CONTENT.goal.businessId);
  const core = createGrayboxCore(world, {
    uuidProvider: { generate: () => runtimeInstanceId },
    progress,
    checkpointCaptureOptions: captureOptions,
  });
  let sampleMs = 0;
  core.frame(sampleMs);
  const step = (count = 1) => {
    for (let index = 0; index < count; index++) {
      sampleMs += core.config.fixedDeltaMs;
      core.frame(sampleMs);
    }
  };
  const place = x => {
    M.Body.setPosition(world.player, { x, y: 472 });
    M.Body.setVelocity(world.player, { x: 0, y: 0 });
  };
  return { core, world, progress, step, place, runtimeInstanceId };
}

function advanceToTerminal(instance, maximum = 10) {
  for (let index = 0; index < maximum; index++) {
    const phase = instance.core.snapshot.checkpointCapture.phase;
    if (phase === 'succeeded' || phase === 'failed') return;
    instance.step();
  }
  assert.fail(
    'Triggered capture did not become terminal: ' +
      JSON.stringify(instance.core.snapshot.checkpointCapture),
  );
}

test('D10-A3 TR01 enter is single-shot, overlap selects low priority, and true re-entry renews identity', () => {
  const instance = fixture();
  instance.step(2);
  const initial = instance.core.snapshot;
  assert.equal(initial.checkpointTriggers.currentCheckpointId, GRAYBOX_CHECKPOINT_ID);
  assert.equal(initial.checkpointTriggers.entryEventCount, 0);
  const initialBatchCount = initial.checkpointTriggers.batchCount;

  instance.place(1220);
  instance.step();
  const arbitrated = instance.core.snapshot;
  assert.equal(arbitrated.checkpointTriggers.entryEventCount, 2);
  assert.equal(arbitrated.checkpointTriggers.selectedCount, 1);
  assert.equal(
    arbitrated.checkpointTriggers.batchCount,
    initialBatchCount + 1,
  );
  assert.equal(arbitrated.checkpointTriggers.batchTick, arbitrated.checkpointTriggers.closedTick);
  assert.equal(
    arbitrated.checkpointTriggers.closedTick,
    arbitrated.checkpointTriggers.arbitrationTick,
  );
  const firstArbitration = arbitrated.checkpointTriggers.lastArbitration;
  assert.equal(firstArbitration.winnerCheckpointId, GRAYBOX_TEST_CAPTURE_CHECKPOINT_A_ID);
  assert.deepEqual(
    firstArbitration.entrants.map(entry => entry.priority),
    [10, 20],
  );
  assert.deepEqual(
    firstArbitration.entrants.map(entry => entry.decision),
    ['selected', 'not-selected'],
  );
  assert.ok(firstArbitration.entrants.every(entry => entry.finalized && entry.retired));
  assert.ok(
    arbitrated.checkpointTriggers.latestCaptureEventId >
      arbitrated.checkpointTriggers.latestEntryEventId,
  );
  assert.equal(
    arbitrated.checkpointCapture.sourceEntryEventId,
    firstArbitration.winnerEntryEventId,
  );
  assert.equal(
    arbitrated.checkpointTriggers.currentCheckpointId,
    GRAYBOX_CHECKPOINT_ID,
    'A Pending capture must not become the current checkpoint',
  );

  advanceToTerminal(instance);
  const firstSaved = instance.core.snapshot;
  assert.equal(firstSaved.checkpointTriggers.currentCheckpointId,
    GRAYBOX_TEST_CAPTURE_CHECKPOINT_A_ID);
  const firstIds = {
    entry: firstArbitration.winnerEntryEventId,
    capture: firstSaved.checkpointCapture.eventId,
    command: firstSaved.checkpointCapture.commandId,
    transaction: firstSaved.checkpointCapture.transactionId,
    result: firstSaved.checkpointCapture.resultEventId,
  };
  const entryCount = firstSaved.checkpointTriggers.entryEventCount;
  instance.step(20);
  assert.equal(instance.core.snapshot.checkpointTriggers.entryEventCount, entryCount);
  assert.equal(instance.core.snapshot.checkpointCapture.successfulCommits, 1);

  instance.place(80);
  instance.step();
  instance.place(1220);
  instance.step();
  advanceToTerminal(instance);
  const reentered = instance.core.snapshot;
  assert.equal(reentered.checkpointTriggers.entryEventCount, entryCount + 2);
  assert.ok(reentered.checkpointTriggers.latestEntryEventId > firstIds.entry);
  assert.ok(reentered.checkpointCapture.eventId > firstIds.capture);
  assert.ok(reentered.checkpointCapture.commandId > firstIds.command);
  assert.ok(reentered.checkpointCapture.transactionId > firstIds.transaction);
  assert.ok(reentered.checkpointCapture.resultEventId > firstIds.result);
  assert.equal(reentered.checkpointCapture.successfulCommits, 2);

  instance.place(80);
  instance.step();
  instance.place(1270);
  instance.step();
  assert.equal(
    instance.core.snapshot.checkpointTriggers.lastArbitration.winnerCheckpointId,
    GRAYBOX_TEST_CAPTURE_CHECKPOINT_B_ID,
  );
  advanceToTerminal(instance);
  const switched = instance.core.snapshot;
  assert.equal(
    switched.checkpointTriggers.currentCheckpointId,
    GRAYBOX_TEST_CAPTURE_CHECKPOINT_B_ID,
  );
  assert.equal(switched.checkpointSnapshot.current.checkpointId,
    GRAYBOX_TEST_CAPTURE_CHECKPOINT_B_ID);
  assert.equal(switched.checkpointCapture.successfulCommits, 3);
});

test('D10-A3 TR02 arbitration order is priority-stable and duplicate priority is a configuration error', () => {
  const [definitionA, definitionB] = GRAYBOX_CHECKPOINT_TRIGGERS;
  const older = {
    definition: definitionA,
    eventId: 2,
    detectedTick: 10,
  };
  const newer = {
    definition: definitionB,
    eventId: 1,
    detectedTick: 10,
  };
  assert.equal(arbitrateCheckpointTriggerEntries([older, newer])[0], older);
  assert.equal(arbitrateCheckpointTriggerEntries([newer, older])[0], older);

  assert.throws(
    () => validateCheckpointTriggerDefinitions([
      definitionA,
      { ...definitionB, priority: definitionA.priority },
    ]),
    /Duplicate checkpoint priority 10/,
  );

  const first = fixture();
  first.step(2);
  first.place(1200);
  first.step();
  const firstWinner = first.core.snapshot.checkpointTriggers.lastArbitration;
  assert.equal(firstWinner.winnerCheckpointId, GRAYBOX_TEST_CAPTURE_CHECKPOINT_A_ID);
  first.place(1220);
  first.step();
  const extraEntrant = first.core.snapshot.checkpointTriggers.lastArbitration;
  assert.equal(extraEntrant.winnerCheckpointId, GRAYBOX_TEST_CAPTURE_CHECKPOINT_A_ID);
  assert.equal(
    first.core.snapshot.checkpointCapture.counts.commands,
    1,
    'A later Tick request must not retroactively enter or invert the earlier batch',
  );
});

test('D10-A3 TR03 busy and losing opportunities are consumed, never queued or replayed', () => {
  const instance = fixture();
  instance.step(2);
  instance.place(1220);
  instance.step();
  const firstCapture = instance.core.snapshot.checkpointCapture;
  assert.equal(firstCapture.phase, 'request-pending');

  // Leave and immediately attempt another real entry while the first capture
  // lifecycle is still active. Both entry events end; the capture request is
  // blocked instead of being retained for later replay.
  instance.place(80);
  instance.step();
  instance.place(1220);
  instance.step();
  const blocked = instance.core.snapshot;
  assert.equal(blocked.checkpointTriggers.entryEventCount, 4);
  assert.equal(blocked.checkpointTriggers.captureRequestCount, 2);
  assert.ok(blocked.checkpointTriggers.blockedCount >= 1);
  assert.match(blocked.checkpointTriggers.feedback, /未排队/);
  assert.equal(blocked.checkpointCapture.counts.commands, 1);
  assert.equal(blocked.checkpointCapture.counts.transactions, 1);
  assert.ok(blocked.checkpointTriggers.lastArbitration.entrants
    .every(entry => entry.finalized && entry.retired));

  advanceToTerminal(instance);
  const completed = instance.core.snapshot;
  const requestCount = completed.checkpointTriggers.captureRequestCount;
  const entryCount = completed.checkpointTriggers.entryEventCount;
  instance.step(20);
  const idle = instance.core.snapshot;
  assert.equal(idle.checkpointTriggers.captureRequestCount, requestCount);
  assert.equal(idle.checkpointTriggers.entryEventCount, entryCount);
  assert.equal(idle.checkpointCapture.counts.commands, 1);

  instance.place(80);
  instance.step();
  instance.place(1220);
  instance.step();
  advanceToTerminal(instance);
  const renewed = instance.core.snapshot;
  assert.equal(renewed.checkpointTriggers.captureRequestCount, requestCount + 1);
  assert.equal(renewed.checkpointCapture.counts.commands, 2);
});

test('D10-A3 TR04 capture failure preserves the old record and standing still never auto-retries', () => {
  let failTriggeredCapture = false;
  const instance = fixture({
    captureFaultInjector: phase => {
      if (failTriggeredCapture && phase === 'capture') {
        throw new Error('injected trigger capture failure');
      }
    },
  });
  instance.step(2);
  const original = JSON.stringify(instance.core.snapshot.checkpointSnapshot.current);
  failTriggeredCapture = true;
  instance.place(1220);
  instance.step();
  advanceToTerminal(instance);
  const failed = instance.core.snapshot;
  assert.equal(failed.checkpointCapture.phase, 'failed');
  assert.equal(failed.checkpointTriggers.phase, 'failed');
  assert.equal(failed.checkpointCapture.successfulCommits, 0);
  assert.equal(JSON.stringify(failed.checkpointSnapshot.current), original);
  assert.equal(failed.checkpointTriggers.currentCheckpointId, GRAYBOX_CHECKPOINT_ID);
  assert.match(failed.checkpointTriggers.feedback, /保存失败/);
  const attempts = failed.checkpointTriggers.captureRequestCount;
  const entries = failed.checkpointTriggers.entryEventCount;
  instance.step(20);
  assert.equal(instance.core.snapshot.checkpointTriggers.captureRequestCount, attempts);
  assert.equal(instance.core.snapshot.checkpointTriggers.entryEventCount, entries);

  instance.place(80);
  instance.step();
  instance.place(1220);
  instance.step();
  assert.equal(
    instance.core.snapshot.checkpointTriggers.captureRequestCount,
    attempts + 1,
    'Only a true leave and re-entry may start a later attempt',
  );
});

test('D10-A3 TR05 pause freezes capture, R is safely rejected while frozen, and normal R preserves the record', () => {
  const instance = fixture();
  instance.step(2);
  instance.place(1220);
  instance.step();
  const owner = {};
  const requestKey = {};
  const firstPauseToken = instance.core.lifecycle.acquire(owner, requestKey);
  assert.ok(firstPauseToken);
  const beforePausedStep = JSON.stringify(instance.core.snapshot);
  instance.step(5);
  assert.equal(JSON.stringify(instance.core.snapshot), beforePausedStep);
  assert.equal(instance.core.lifecycle.release(owner, firstPauseToken), 'released');
  instance.step(2);

  const frozen = instance.core.snapshot;
  assert.equal(frozen.checkpointCapture.phase, 'verifying');
  assert.deepEqual(
    frozen.checkpointCapture.frozenObjectIds,
    ['moving-horizontal-a', 'moving-vertical-a'],
  );
  const frozenClock = instance.world.platformClockMs;
  assert.deepEqual(instance.core.reset(), {
    status: 'blocked',
    message: 'Debug reset is unavailable while checkpoint objects are frozen.',
  });
  assert.equal(instance.world.platformClockMs, frozenClock);
  assert.deepEqual(instance.core.snapshot.checkpointCapture.frozenObjectIds,
    frozen.checkpointCapture.frozenObjectIds);

  const pauseOwner = {};
  const pauseKey = {};
  const pauseToken = instance.core.lifecycle.acquire(pauseOwner, pauseKey);
  assert.ok(pauseToken);
  const frozenTick = instance.core.snapshot.tick;
  instance.step(5);
  assert.equal(instance.core.snapshot.tick, frozenTick);
  assert.equal(
    instance.core.lifecycle.release({}, pauseToken),
    'rejected',
    'A different owner cannot release the active pause',
  );
  assert.equal(instance.core.lifecycle.release(pauseOwner, pauseToken), 'released');
  instance.step(2);
  advanceToTerminal(instance);
  const completed = instance.core.snapshot;
  assert.equal(completed.checkpointTriggers.currentCheckpointId,
    GRAYBOX_TEST_CAPTURE_CHECKPOINT_A_ID);
  assert.equal(completed.checkpointCapture.successfulCommits, 1);
  const payload = completed.checkpointPayload;
  const triggerEntries = completed.checkpointTriggers.entryEventCount;

  const reset = instance.core.reset();
  assert.equal(reset.status, 'reset');
  const afterReset = instance.core.snapshot;
  assert.equal(afterReset.checkpointTriggers.currentCheckpointId,
    GRAYBOX_TEST_CAPTURE_CHECKPOINT_A_ID);
  assert.equal(afterReset.checkpointPayload, payload);
  assert.equal(afterReset.checkpointTriggers.entryEventCount, triggerEntries);
  assert.ok(afterReset.checkpointTriggers.zones.every(zone => !zone.occupied));
  instance.step(10);
  assert.equal(instance.core.snapshot.checkpointTriggers.entryEventCount, triggerEntries);
  assert.equal(instance.core.snapshot.progress.counts.rewards, 1);
});
