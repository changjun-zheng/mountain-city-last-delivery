import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import {
  FIRST_LEVEL_ACTIONS,
  FIRST_LEVEL_EVENT_TYPES,
  FIRST_LEVEL_INITIAL_CHECKPOINT_ID,
  FIRST_LEVEL_INTERACTIONS,
  FIRST_LEVEL_SNAPSHOT_SCENARIO,
  FirstLevelRuntime,
} from '../src/core/first-level.ts';
import { createGrayboxCore } from '../src/core/graybox.ts';
import {
  FIRST_LEVEL_PROGRESS_CONTENT,
  InMemoryRunProgress,
} from '../src/core/progress.ts';
import { PLAYER_PROTOTYPE } from '../src/core/player.ts';
import { FirstLevelMatterWorld } from '../src/physics/matter/first-level-world.ts';

const M = createRequire(import.meta.url)(
  '../node_modules/phaser/src/physics/matter-js/CustomMain.js',
);
let runtimeOrdinal = 0;

function fixture(progress = new InMemoryRunProgress()) {
  runtimeOrdinal++;
  const runtimeInstanceId =
    `d1200000-0000-4000-8000-${String(runtimeOrdinal).padStart(12, '0')}`;
  const engine = M.Engine.create();
  const world = new FirstLevelMatterWorld(
    M,
    engine,
    deltaMs => M.Engine.update(engine, deltaMs),
  );
  let runtime;
  const core = createGrayboxCore(world, {
    uuidProvider: { generate: () => runtimeInstanceId },
    progress,
    extraEventTypes: FIRST_LEVEL_EVENT_TYPES,
    interactionObjects: FIRST_LEVEL_INTERACTIONS,
    createGameplayRuntime: context => {
      runtime = new FirstLevelRuntime(context);
      return runtime;
    },
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
          tick: core.snapshot.tick,
          player: core.snapshot.player,
          gameplay: core.snapshot.gameplay,
          recovery: core.snapshot.recovery,
          progress: core.snapshot.progress,
          diagnostics: world.diagnostics,
        }),
    );
  };
  const place = (x, y) => {
    world.placePlayerAtAnchor({ x, y, facing: 1 });
    step(2);
  };
  const interact = async () => {
    core.key('KeyE', true);
    step(2);
    core.key('KeyE', false);
    step(2);
  };
  step(4);
  return {
    core,
    world,
    engine,
    progress,
    runtime,
    runtimeInstanceId,
    step,
    stepUntil,
    place,
    interact,
  };
}

function gameplay(instance) {
  return instance.core.snapshot.gameplay;
}

function completeQuest(instance) {
  instance.place(650, 448);
  assert.equal(instance.core.snapshot.interaction.selectedId, 'first-level-b-npc');
  instance.core.key('KeyE', true);
  instance.step();
  instance.core.key('KeyE', false);
  instance.core.key('Escape', true);
  instance.step();
  instance.core.key('Escape', false);
  instance.stepUntil(snapshot => snapshot.gameplay?.questAccepted, 20);
  instance.stepUntil(snapshot =>
    snapshot.gameplay?.actions.find(action => action.action === 'quest')
      ?.flow.phase === 'succeeded', 20);
}

function unlockRoute(instance) {
  instance.place(1135, 518);
  assert.equal(
    instance.core.snapshot.interaction.selectedId,
    'first-level-c-lever-left',
  );
  instance.core.key('KeyE', true);
  instance.step();
  instance.core.key('KeyE', false);
  instance.stepUntil(snapshot =>
    snapshot.gameplay?.routeUnlocked && snapshot.player.controlAllowed, 30);
  instance.stepUntil(snapshot =>
    snapshot.gameplay?.actions.find(action => action.action === 'lift')
      ?.flow.phase === 'succeeded', 30);
  assert.equal(instance.world.routeOpen, true);
}

function completePhoto(instance) {
  instance.place(1830, 258);
  assert.equal(
    instance.core.snapshot.interaction.selectedId,
    'first-level-d-photo',
  );
  instance.core.key('KeyE', true);
  instance.step();
  instance.core.key('KeyE', false);
  instance.stepUntil(snapshot => snapshot.gameplay?.completed, 30);
  instance.stepUntil(snapshot =>
    snapshot.gameplay?.actions.find(action => action.action === 'complete')
      ?.flow.phase === 'succeeded', 30);
}

test('D12-A1 LV01 real Matter core completes A-B-C-D through distinct event chains', () => {
  const instance = fixture();
  assert.equal(
    instance.core.snapshot.checkpointSnapshot.current.checkpointId,
    FIRST_LEVEL_INITIAL_CHECKPOINT_ID,
  );
  assert.equal(
    instance.core.snapshot.checkpointSnapshot.current.levelId,
    FIRST_LEVEL_SNAPSHOT_SCENARIO.checkpointConfigs[0].levelId,
  );
  assert.deepEqual(
    instance.core.snapshot.checkpointSnapshot.current.objects.map(
      object => object.objectId,
    ),
    ['first-level-service-lift'],
  );
  assert.equal(instance.core.snapshot.player.grounded, true);

  completeQuest(instance);
  unlockRoute(instance);
  completePhoto(instance);

  const state = gameplay(instance);
  assert.equal(state.questAccepted, true);
  assert.equal(state.routeUnlocked, true);
  assert.equal(state.completed, true);
  assert.equal(state.completionVisible, true);
  assert.deepEqual(instance.progress.snapshot.goals, [
    FIRST_LEVEL_PROGRESS_CONTENT.questAccepted.goalId,
    FIRST_LEVEL_PROGRESS_CONTENT.liftRouteUnlocked.goalId,
    FIRST_LEVEL_PROGRESS_CONTENT.completed.goalId,
  ]);
  assert.deepEqual(instance.progress.snapshot.effects, [
    {
      id: FIRST_LEVEL_PROGRESS_CONTENT.questAccepted.effectId,
      expectedActive: true,
    },
    {
      id: FIRST_LEVEL_PROGRESS_CONTENT.liftRouteUnlocked.effectId,
      expectedActive: true,
    },
    {
      id: FIRST_LEVEL_PROGRESS_CONTENT.completed.effectId,
      expectedActive: true,
    },
  ]);
  assert.equal(instance.progress.snapshot.counts.rewards, 0);
  const identities = state.actions.map(action => ({
    event: action.flow.eventId,
    command: action.flow.commandId,
    transaction: action.flow.transactionId,
    result: action.flow.resultEventId,
  }));
  assert.equal(new Set(identities.map(value => value.event)).size, 3);
  assert.equal(new Set(identities.map(value => value.command)).size, 3);
  assert.equal(new Set(identities.map(value => value.transaction)).size, 3);
  assert.equal(new Set(identities.map(value => value.result)).size, 3);
  assert.ok(identities.flatMap(value => Object.values(value))
    .every(value => Number.isSafeInteger(value) && value > 0));
});

test('D12-A1 LV02 proximity and missing prerequisites do not complete; wrong lever is retryable', () => {
  const instance = fixture();
  instance.place(650, 448);
  assert.equal(gameplay(instance).questAccepted, false);
  assert.equal(
    gameplay(instance).actions.find(action => action.action === 'quest')
      .flow.eventId,
    null,
  );

  instance.place(1830, 258);
  instance.core.key('KeyE', true);
  instance.step(3);
  instance.core.key('KeyE', false);
  assert.equal(gameplay(instance).completed, false);
  assert.match(instance.core.snapshot.interaction.feedbackText ?? '', /尚未主动接取/);

  instance.place(1235, 518);
  instance.core.key('KeyE', true);
  instance.step(2);
  instance.core.key('KeyE', false);
  assert.match(instance.core.snapshot.interaction.feedbackText ?? '', /右侧吊臂/);
  assert.equal(gameplay(instance).routeUnlocked, false);
  assert.equal(instance.progress.snapshot.counts.goals, 0);

  completeQuest(instance);
  unlockRoute(instance);
  assert.equal(gameplay(instance).routeUnlocked, true);
  assert.equal(instance.progress.snapshot.counts.goals, 2);
});

test('D12-A1 LV03 recovery after dialogue preserves the accepted quest and does not duplicate it', () => {
  const instance = fixture();
  completeQuest(instance);
  const before = gameplay(instance);
  const questIdentity = before.actions.find(action => action.action === 'quest')
    .flow;

  instance.world.placePlayerAtAnchor({ x: 1025, y: 720, facing: 1 });
  instance.stepUntil(snapshot =>
    snapshot.recovery.phase === 'succeeded' &&
    snapshot.recovery.recoveryCount === 1, 700);
  assert.equal(gameplay(instance).questAccepted, true);
  assert.equal(instance.progress.verifyGoal(
    FIRST_LEVEL_PROGRESS_CONTENT.questAccepted.goalId,
  ), true);
  instance.place(650, 448);
  instance.core.key('KeyE', true);
  instance.step();
  instance.core.key('KeyE', false);
  instance.step(8);
  assert.equal(instance.progress.snapshot.counts.goals, 1);
  assert.equal(
    gameplay(instance).actions.find(action => action.action === 'quest')
      .flow.eventId,
    questIdentity.eventId,
  );
});

test('D12-A1 LV04 recovery after route unlock preserves OPEN route and reuses the same lift identity', () => {
  const instance = fixture();
  completeQuest(instance);
  unlockRoute(instance);
  const liftBefore = instance.world.liftBody;
  instance.step(40);
  assert.ok(instance.world.liftBody.position.y < 530);
  instance.world.placePlayerAtAnchor({ x: 1025, y: 720, facing: 1 });
  instance.stepUntil(snapshot =>
    snapshot.recovery.phase === 'fading-in', 700);
  assert.equal(gameplay(instance).routeUnlocked, true);
  assert.equal(instance.world.routeOpen, true);
  assert.notEqual(instance.world.liftBody, liftBefore);
  // The restored lift resumes from its captured lower endpoint; fixed steps
  // consumed by fade-in may move it slightly, but recovery elapsed time must
  // not be converted into extra travel.
  assert.ok(Math.abs(instance.world.liftBody.position.y - 549) < 2);
  instance.stepUntil(snapshot =>
    snapshot.recovery.phase === 'succeeded' &&
    snapshot.recovery.recoveryCount === 1, 120);
  assert.equal(gameplay(instance).routeUnlocked, true);
  assert.equal(instance.world.routeOpen, true);
  assert.notEqual(instance.world.liftBody, liftBefore);
  assert.ok(instance.world.liftBody.position.y < 549);
  assert.equal(instance.progress.verifyGoal(
    FIRST_LEVEL_PROGRESS_CONTENT.liftRouteUnlocked.goalId,
  ), true);

  instance.world.placePlayerAtAnchor({
    x: instance.world.liftBody.position.x,
    y: instance.world.liftBody.position.y -
      PLAYER_PROTOTYPE.height / 2 - 9,
    facing: 1,
  });
  instance.step(5);
  assert.equal(
    instance.core.snapshot.player.support,
    'first-level-service-lift',
  );
});

test('D12-A1 LV04 real Matter lift body supports and carries the player', () => {
  const instance = fixture();
  completeQuest(instance);
  unlockRoute(instance);
  instance.step(20);
  instance.world.placePlayerAtAnchor({
    x: instance.world.liftBody.position.x,
    y: instance.world.liftBody.position.y -
      PLAYER_PROTOTYPE.height / 2 - 9,
    facing: 1,
  });
  instance.stepUntil(snapshot =>
    snapshot.player.support === 'first-level-service-lift', 10);
  const before = instance.core.snapshot.player;
  instance.step(20);
  const after = instance.core.snapshot.player;
  assert.equal(after.support, 'first-level-service-lift');
  assert.ok(after.y < before.y - 20,
    'The real Matter lift must carry the player as its body moves');
  assert.ok(Math.abs(after.y - instance.world.liftBody.position.y + 31) < 0.5);
  assert.ok(Math.abs(after.worldVy - after.supportVy) < 0.1);
});

test('D12-A1 LV05 pause freezes business and input; reset retains all permanent records', () => {
  const instance = fixture();
  completeQuest(instance);
  unlockRoute(instance);
  completePhoto(instance);
  const counts = instance.progress.snapshot.counts;
  const owner = {};
  const token = instance.core.lifecycle.acquire(owner, Symbol('pause'));
  assert.ok(token);
  instance.core.key('KeyE', true);
  const frozen = JSON.stringify({
    tick: instance.core.snapshot.tick,
    gameplay: instance.core.snapshot.gameplay,
    player: instance.core.snapshot.player,
  });
  instance.step(20);
  assert.equal(JSON.stringify({
    tick: instance.core.snapshot.tick,
    gameplay: instance.core.snapshot.gameplay,
    player: instance.core.snapshot.player,
  }), frozen);
  assert.equal(instance.core.lifecycle.release(owner, token), 'released');
  instance.step(5);
  assert.equal(instance.core.snapshot.player.jumps, 0);
  const reset = instance.core.reset();
  assert.equal(reset.status, 'reset');
  assert.deepEqual(instance.progress.snapshot.counts, counts);
  assert.equal(instance.core.snapshot.gameplay.completed, true);
  assert.equal(instance.world.routeOpen, true);
  assert.notEqual(
    instance.core.snapshot.checkpointSnapshot.current.checkpointId,
    'graybox-initial-spawn',
  );
});

test('D12-A1 LV05 snapshot identifiers remain isolated from the laboratory', () => {
  const instance = fixture();
  const current = instance.core.snapshot.checkpointSnapshot.current;
  assert.equal(current.levelId, 'first-level-night-postcard');
  assert.equal(current.checkpointId, FIRST_LEVEL_INITIAL_CHECKPOINT_ID);
  assert.equal(
    current.runtimeInstanceId,
    gameplay(instance).runtimeInstanceId,
  );
  assert.notEqual(current.objects[0].objectId, 'moving-horizontal-a');
  assert.notEqual(current.objects[0].objectId, 'moving-vertical-a');
  assert.notEqual(
    gameplay(instance).runtimeInstanceId,
    'graybox-platform-lab',
  );
  assert.notEqual(FIRST_LEVEL_ACTIONS.talkToNpc, 'prototype-goal-e');
});
