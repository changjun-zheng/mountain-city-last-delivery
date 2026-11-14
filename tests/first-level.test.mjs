import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import {
  FIRST_LEVEL_ACTIONS,
  FIRST_LEVEL_EVENT_TYPES,
  FIRST_LEVEL_INITIAL_CHECKPOINT_ID,
  FIRST_LEVEL_INTERACTIONS,
  FIRST_LEVEL_SPATIAL_CONFIG,
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

function interactionPoint(id) {
  const object = FIRST_LEVEL_INTERACTIONS.find(candidate => candidate.id === id);
  assert.ok(object, `Missing first-level interaction ${id}`);
  return { x: object.x, y: object.y };
}

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
  const npc = interactionPoint('first-level-b-npc');
  instance.place(npc.x, npc.y);
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

function openNpcDialogue(instance) {
  const npc = interactionPoint('first-level-b-npc');
  instance.place(npc.x, npc.y);
  instance.core.key('KeyE', false);
  assert.equal(
    instance.core.snapshot.interaction.selectedId,
    'first-level-b-npc',
  );
  instance.core.key('KeyE', true);
  instance.step();
  instance.core.key('KeyE', false);
  assert.equal(instance.core.snapshot.interaction.mode, 'investigation');
  assert.equal(
    instance.core.snapshot.interaction.activeId,
    'first-level-b-npc',
  );
}

function unlockRoute(instance) {
  const control = interactionPoint('first-level-c-lever-left');
  instance.place(control.x, control.y);
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
  const photo = interactionPoint('first-level-d-photo');
  instance.place(photo.x, photo.y);
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

test('D12-A3 SA01 spatial config places A/B above descending C tiers and lower D', () => {
  const instance = fixture();
  const top = label => {
    const body = instance.world.terrain.find(candidate => candidate.label === label);
    assert.ok(body, `Missing real Matter terrain ${label}`);
    return body.bounds.min.y;
  };

  assert.deepEqual(FIRST_LEVEL_SPATIAL_CONFIG.topology, [
    'A-liberation-monument',
    'B-cangbai-road-hongyadong-entrance',
    'C-upper-woodwalk',
    'C-middle-market-lane',
    'C-lower-eave-walk',
    'D-jialing-riverbank',
  ]);
  assert.ok(top('b-terrace') < top('c-upper-ground'));
  assert.ok(top('c-upper-ground') < top('c-middle-ground'));
  assert.ok(top('c-middle-ground') < top('c-lower-ground'));
  assert.ok(top('c-lower-ground') < top('d-riverbank'));
  assert.equal(FIRST_LEVEL_SPATIAL_CONFIG.lift.validation, 'TO_VALIDATE');
  assert.ok(FIRST_LEVEL_SPATIAL_CONFIG.lift.fromY
    < FIRST_LEVEL_SPATIAL_CONFIG.lift.toY,
  'The current lift prototype must descend from C3 toward D');
  assert.equal(instance.core.snapshot.checkpointSnapshot.current.anchor.y, 278);
  assert.equal(instance.core.snapshot.checkpointSnapshot.current.objects.length, 1);
  assert.equal(
    instance.core.snapshot.checkpointSnapshot.current.objects[0].objectId,
    'first-level-service-lift',
  );
  // Move the probe player out of every candidate anchor before validating.
  // Recovery intentionally treats any complete current-player overlap as a
  // blocker, so leaving the fixture at its spawn would reject the spawn and
  // nearby fallback anchors for a test-only reason.
  instance.world.placePlayerAtAnchor({ x: 100, y: 500, facing: 1 });
  for (const anchor of [
    FIRST_LEVEL_SPATIAL_CONFIG.spawn,
    ...FIRST_LEVEL_SPATIAL_CONFIG.fallbackAnchors,
  ]) {
    assert.equal(
      instance.world.validateRecoveryAnchor(anchor, 'spatial-test').status,
      'valid',
    );
  }
  const npcAnchor = interactionPoint('first-level-b-npc');
  assert.equal(
    instance.world.validateRecoveryAnchor(
      { ...npcAnchor, facing: 1 },
      'spatial-test',
    ).support,
    'b-terrace',
  );
  const photoAnchor = interactionPoint('first-level-d-photo');
  assert.equal(
    instance.world.validateRecoveryAnchor(
      { ...photoAnchor, facing: 1 },
      'spatial-test',
    ).support,
    'd-riverbank',
  );
});

test('D12-A1 LV02 proximity and missing prerequisites do not complete; wrong lever is retryable', () => {
  const instance = fixture();
  const npc = interactionPoint('first-level-b-npc');
  instance.place(npc.x, npc.y);
  assert.equal(gameplay(instance).questAccepted, false);
  assert.equal(
    gameplay(instance).actions.find(action => action.action === 'quest')
      .flow.eventId,
    null,
  );

  const photo = interactionPoint('first-level-d-photo');
  instance.place(photo.x, photo.y);
  instance.core.key('KeyE', true);
  instance.step(3);
  instance.core.key('KeyE', false);
  assert.equal(gameplay(instance).completed, false);
  assert.match(instance.core.snapshot.interaction.feedbackText ?? '', /尚未主动接取/);

  const right = interactionPoint('first-level-c-lever-right');
  instance.place(right.x, right.y);
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

test('D12-A2 UX01 opening NPC dialogue allocates no quest identity until normal completion', () => {
  const instance = fixture();
  openNpcDialogue(instance);
  const opened = gameplay(instance);
  assert.equal(opened.questAccepted, false);
  assert.equal(
    opened.actions.find(action => action.action === 'quest').flow.eventId,
    null,
  );
  assert.equal(instance.progress.snapshot.counts.goals, 0);

  instance.step(30);
  assert.equal(
    gameplay(instance).actions.find(action => action.action === 'quest')
      .flow.eventId,
    null,
    'Waiting while the dialogue remains open must not accept the quest',
  );

  assert.equal(instance.core.closeInteraction(), true);
  instance.stepUntil(snapshot => snapshot.gameplay?.questAccepted, 30);
  instance.stepUntil(snapshot =>
    snapshot.gameplay?.actions.find(action => action.action === 'quest')
      ?.flow.phase === 'succeeded', 30);
  const accepted = gameplay(instance);
  const quest = accepted.actions.find(action => action.action === 'quest').flow;
  assert.equal(accepted.questAccepted, true);
  assert.equal(instance.progress.snapshot.counts.goals, 1);
  assert.ok(quest.eventId > 0);
  assert.ok(quest.commandId > 0);
  assert.ok(quest.transactionId > 0);
  assert.ok(quest.resultEventId > 0);

  assert.equal(instance.core.closeInteraction(), false);
  instance.step(10);
  assert.equal(
    gameplay(instance).actions.find(action => action.action === 'quest')
      .flow.eventId,
    quest.eventId,
  );
  assert.equal(instance.progress.snapshot.counts.goals, 1);
});

test('D12-A2 UX02 pause, reset and recovery discard unfinished dialogue without accepting', () => {
  const instance = fixture();
  openNpcDialogue(instance);

  const pauseOwner = {};
  const pauseToken = instance.core.lifecycle.acquire(
    pauseOwner,
    Symbol('dialogue-hidden'),
  );
  assert.ok(pauseToken);
  instance.step(20);
  assert.equal(instance.core.snapshot.interaction.mode, 'investigation');
  assert.equal(
    gameplay(instance).actions.find(action => action.action === 'quest')
      .flow.eventId,
    null,
  );
  assert.equal(instance.core.lifecycle.release(pauseOwner, pauseToken), 'released');

  assert.equal(instance.core.reset().status, 'reset');
  instance.step(5);
  assert.equal(instance.core.snapshot.interaction.mode, 'idle');
  assert.equal(gameplay(instance).questAccepted, false);
  assert.equal(instance.progress.snapshot.counts.goals, 0);

  openNpcDialogue(instance);
  instance.world.placePlayerAtAnchor({ x: 1025, y: 720, facing: 1 });
  instance.stepUntil(snapshot =>
    snapshot.recovery.phase === 'succeeded' &&
    snapshot.recovery.recoveryCount === 1, 700);
  assert.equal(instance.core.snapshot.interaction.mode, 'idle');
  assert.equal(gameplay(instance).questAccepted, false);
  assert.equal(instance.progress.snapshot.counts.goals, 0);

  openNpcDialogue(instance);
  instance.core.key('KeyE', true, true);
  instance.core.key('KeyE', false);
  assert.equal(instance.core.closeInteraction(), true);
  assert.equal(instance.core.closeInteraction(), false);
  instance.core.key('Escape', true);
  instance.core.key('Escape', true, true);
  instance.core.key('Escape', false);
  instance.stepUntil(snapshot => snapshot.gameplay?.questAccepted, 30);
  assert.equal(instance.progress.snapshot.counts.goals, 1);
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
  const npc = interactionPoint('first-level-b-npc');
  instance.place(npc.x, npc.y);
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
  assert.ok(instance.world.liftBody.position.y > 530);
  instance.world.placePlayerAtAnchor({ x: 1025, y: 720, facing: 1 });
  instance.stepUntil(snapshot =>
    snapshot.recovery.phase === 'fading-in', 700);
  assert.equal(gameplay(instance).routeUnlocked, true);
  assert.equal(instance.world.routeOpen, true);
  assert.notEqual(instance.world.liftBody, liftBefore);
  // The restored lift resumes from its captured lower endpoint; fixed steps
  // consumed by fade-in may move it slightly, but recovery elapsed time must
  // not be converted into extra travel.
  assert.ok(Math.abs(instance.world.liftBody.position.y - 509) < 2);
  instance.stepUntil(snapshot =>
    snapshot.recovery.phase === 'succeeded' &&
    snapshot.recovery.recoveryCount === 1, 120);
  assert.equal(gameplay(instance).routeUnlocked, true);
  assert.equal(instance.world.routeOpen, true);
  assert.notEqual(instance.world.liftBody, liftBefore);
  assert.ok(instance.world.liftBody.position.y > 509);
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
  instance.step(40);
  const after = instance.core.snapshot.player;
  assert.equal(after.support, 'first-level-service-lift');
  assert.ok(after.y > before.y + 20,
    'The real Matter lift must carry the player as its body descends');
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
