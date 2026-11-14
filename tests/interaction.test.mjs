import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  INTERACTION_OBJECTS,
  INTERACTION_PROTOTYPE,
  InteractionController,
  selectInteractionTarget,
} from '../src/core/interaction.ts';
import { PlayerControlCoordinator } from '../src/core/player.ts';

function player(x, y = 478, vx = 0) {
  return {
    x, y, vx, vy: 0, worldVx: vx, worldVy: 0, supportVx: 0, supportVy: 0,
    grounded: true, normalX: 0, normalY: -1, support: 'ground-a', wall: false, ceiling: false,
  };
}

function setup(
  x = 240,
  isPaused = () => false,
  objects = INTERACTION_OBJECTS,
  activateProgress,
) {
  const controls = new PlayerControlCoordinator(() => {});
  const interaction = new InteractionController(
    controls,
    isPaused,
    objects,
    activateProgress,
  );
  interaction.afterStep(player(x), 0);
  return { controls, interaction };
}

test('I01/I02 target selection is range-bound, facing-first, nearest and stable on ties', () => {
  assert.equal(selectInteractionTarget(INTERACTION_OBJECTS, player(80), 1), undefined);
  assert.equal(selectInteractionTarget(INTERACTION_OBJECTS, player(240), 1)?.id,
    'prototype-investigation-b');
  assert.equal(selectInteractionTarget(INTERACTION_OBJECTS, player(240), -1)?.id,
    'prototype-investigation-a');
  assert.equal(selectInteractionTarget(INTERACTION_OBJECTS, player(300), 1)?.id,
    'prototype-pickup-c');

  const tie = ['b', 'a'].map(id => ({
    id, kind: 'investigation', label: id, title: id, content: id,
    x: 100, y: 478, rangeX: 120, rangeY: 100,
  }));
  assert.equal(selectInteractionTarget(tie, player(0), 1)?.id, 'a',
    'Equal facing and distance rank must use a stable identifier, not creation order');
});

test('I02/I03 one press opens one investigation and the coordinator owns its control lock', () => {
  const { controls, interaction } = setup();
  assert.equal(interaction.snapshot.candidateCount, 2);
  assert.equal(interaction.snapshot.selectedId, 'prototype-investigation-b');

  interaction.key(INTERACTION_PROTOTYPE.interactKey, true);
  assert.equal(interaction.snapshot.mode, 'investigation');
  assert.equal(interaction.snapshot.activeId, 'prototype-investigation-b');
  assert.equal(interaction.snapshot.consumedCount, 1);
  assert.equal(interaction.snapshot.investigationStarts, 1);
  assert.equal(controls.allowed, false);
  interaction.key(INTERACTION_PROTOTYPE.interactKey, true, true);
  interaction.key(INTERACTION_PROTOTYPE.interactKey, true);
  assert.equal(interaction.snapshot.investigationStarts, 1);

  const other = Symbol('other-control');
  controls.request(other, true);
  interaction.key(INTERACTION_PROTOTYPE.closeKey, true);
  interaction.key(INTERACTION_PROTOTYPE.closeKey, false);
  assert.equal(interaction.snapshot.mode, 'idle');
  assert.equal(controls.allowed, false, 'Closing investigation must not release another owner');
  controls.request(other, false);
  assert.equal(controls.allowed, true);

  interaction.reset();
  const blocked = Symbol('already-blocked');
  controls.request(blocked, true);
  interaction.key(INTERACTION_PROTOTYPE.interactKey, true);
  assert.equal(interaction.snapshot.mode, 'idle');
  assert.equal(interaction.snapshot.consumedCount, 0);
  controls.request(blocked, false);
});

test('I04 a held or repeated interact key is consumed once and requires release after loss', () => {
  let paused = false;
  const { interaction } = setup(240, () => paused);
  interaction.key(INTERACTION_PROTOTYPE.interactKey, true);
  assert.equal(interaction.snapshot.investigationStarts, 1);
  interaction.key(INTERACTION_PROTOTYPE.interactKey, false);
  interaction.key(INTERACTION_PROTOTYPE.closeKey, true);
  interaction.key(INTERACTION_PROTOTYPE.closeKey, false);

  interaction.key(INTERACTION_PROTOTYPE.interactKey, true);
  assert.equal(interaction.snapshot.investigationStarts, 2);
  assert.equal(interaction.requestClose(), true);
  assert.equal(interaction.snapshot.mode, 'idle');
  interaction.key(INTERACTION_PROTOTYPE.interactKey, true, true);
  assert.equal(interaction.snapshot.mode, 'idle', 'Closing while E remains held must not reopen');
  interaction.key(INTERACTION_PROTOTYPE.interactKey, false);
  interaction.key(INTERACTION_PROTOTYPE.interactKey, true);
  assert.equal(interaction.snapshot.investigationStarts, 3);

  assert.equal(interaction.requestClose(), true);
  interaction.setAvailable(false);
  assert.equal(interaction.snapshot.needsRelease, true);
  interaction.setAvailable(true);
  interaction.key(INTERACTION_PROTOTYPE.interactKey, true, true);
  assert.equal(interaction.snapshot.investigationStarts, 3);
  interaction.key(INTERACTION_PROTOTYPE.interactKey, false);
  interaction.key(INTERACTION_PROTOTYPE.interactKey, true);
  assert.equal(interaction.snapshot.investigationStarts, 4);

  interaction.key(INTERACTION_PROTOTYPE.interactKey, false);
  interaction.requestClose();
  paused = true;
  interaction.key(INTERACTION_PROTOTYPE.interactKey, true);
  assert.equal(interaction.snapshot.mode, 'idle');
  assert.equal(interaction.snapshot.investigationStarts, 4);
});

test('I05 pickup feedback is simulation-timed and never holds player movement', () => {
  const { controls, interaction } = setup(300);
  assert.equal(interaction.snapshot.selectedId, 'prototype-pickup-c');
  interaction.key(INTERACTION_PROTOTYPE.interactKey, true);
  assert.equal(interaction.snapshot.mode, 'feedback');
  assert.equal(interaction.snapshot.feedbackCount, 1);
  assert.equal(controls.allowed, true);
  interaction.key(INTERACTION_PROTOTYPE.interactKey, false);

  interaction.afterStep(player(305), 400);
  assert.equal(interaction.snapshot.mode, 'feedback');
  assert.equal(interaction.snapshot.feedbackRemainingMs, 800);
  interaction.afterStep(player(310), 799);
  assert.equal(interaction.snapshot.mode, 'feedback');
  interaction.afterStep(player(315), 1);
  assert.equal(interaction.snapshot.mode, 'idle');
  assert.equal(interaction.snapshot.feedbackText, null);
  assert.equal(controls.allowed, true);
});

test('I06 reset clears the interaction session and only releases its own control owner', () => {
  const { controls, interaction } = setup(240);
  const other = Symbol('other-control');
  interaction.key(INTERACTION_PROTOTYPE.interactKey, true);
  controls.request(other, true);
  interaction.reset();
  assert.equal(interaction.snapshot.mode, 'idle');
  assert.equal(interaction.snapshot.activeId, null);
  assert.equal(interaction.snapshot.selectedId, null);
  assert.equal(interaction.snapshot.investigationStarts, 0);
  assert.equal(controls.allowed, false);
  controls.request(other, false);
  assert.equal(controls.allowed, true);
});

test('R01 prompt is hidden whenever interaction is unavailable and returns with availability', () => {
  let paused = false;
  const { controls, interaction } = setup(240, () => paused);
  assert.match(interaction.snapshot.prompt, /调查 B/);

  const other = Symbol('other-control');
  controls.request(other, true);
  assert.equal(interaction.snapshot.prompt, null, 'Another control owner must suppress the prompt');
  controls.request(other, false);
  assert.match(interaction.snapshot.prompt, /调查 B/);

  interaction.setAvailable(false);
  assert.equal(interaction.snapshot.prompt, null, 'Unavailable input must suppress the prompt');
  interaction.setAvailable(true);
  assert.match(interaction.snapshot.prompt, /调查 B/);

  paused = true;
  assert.equal(interaction.snapshot.prompt, null, 'Pause must suppress the prompt');
  paused = false;
  assert.match(interaction.snapshot.prompt, /调查 B/);

  interaction.key(INTERACTION_PROTOTYPE.interactKey, true);
  assert.equal(interaction.snapshot.mode, 'investigation');
  interaction.setAvailable(false);
  assert.equal(interaction.snapshot.mode, 'investigation',
    'Losing availability must not close the active investigation');
  interaction.setAvailable(true);
  assert.equal(interaction.snapshot.mode, 'investigation');
  assert.equal(interaction.requestClose(), true);
  assert.equal(interaction.snapshot.prompt, null,
    'A still-held interact key must not advertise another interaction');
  interaction.key(INTERACTION_PROTOTYPE.interactKey, false);
  assert.match(interaction.snapshot.prompt, /调查 B/);
});

test('R02 reset preserves the pending E release gate through the original loss sequence', () => {
  const { controls, interaction } = setup(240);
  interaction.key(INTERACTION_PROTOTYPE.interactKey, true);
  assert.equal(interaction.snapshot.investigationStarts, 1);
  assert.equal(interaction.requestClose(), true);

  interaction.setAvailable(false);
  assert.equal(interaction.snapshot.needsRelease, true);
  interaction.reset();
  assert.equal(interaction.snapshot.needsRelease, true,
    'Reset must preserve a gate whose held state was already cleared by input loss');

  interaction.setAvailable(true);
  interaction.afterStep(player(240), 0);
  interaction.key(INTERACTION_PROTOTYPE.interactKey, true);
  assert.equal(interaction.snapshot.mode, 'idle');
  assert.equal(interaction.snapshot.consumedCount, 0);
  assert.equal(interaction.snapshot.investigationStarts, 0);
  assert.equal(interaction.snapshot.prompt, null);

  interaction.key(INTERACTION_PROTOTYPE.interactKey, false);
  assert.equal(interaction.snapshot.needsRelease, false);
  assert.match(interaction.snapshot.prompt, /调查 B/);
  interaction.key(INTERACTION_PROTOTYPE.interactKey, true);
  assert.equal(interaction.snapshot.mode, 'investigation');
  assert.equal(interaction.snapshot.consumedCount, 1);
  assert.equal(interaction.snapshot.investigationStarts, 1);

  interaction.key(INTERACTION_PROTOTYPE.interactKey, false);
  interaction.requestClose();
  interaction.reset();
  assert.equal(interaction.snapshot.needsRelease, false,
    'Reset without a held interact key must remain normally usable');
  interaction.key(INTERACTION_PROTOTYPE.interactKey, true);
  assert.equal(interaction.snapshot.mode, 'investigation');
  assert.equal(controls.allowed, false);
  interaction.requestClose();
});

test('D12-A2 investigation completion runs only on a normal close and never replays', () => {
  const completed = [];
  const object = {
    id: 'normal-completion-target',
    kind: 'investigation',
    activateOnClose: true,
    label: '测试目标',
    title: '正常结束测试',
    content: '只有玩家正常关闭时才提交。',
    x: 100,
    y: 478,
    rangeX: 40,
    rangeY: 100,
  };
  const { controls, interaction } = setup(
    100,
    () => false,
    [object],
    target => {
      completed.push(target.id);
      return '正常结束已提交';
    },
  );

  interaction.key(INTERACTION_PROTOTYPE.interactKey, true);
  assert.equal(interaction.snapshot.mode, 'investigation');
  assert.deepEqual(completed, [], 'Opening a dialogue must not complete it');
  interaction.key(INTERACTION_PROTOTYPE.interactKey, true, true);
  assert.deepEqual(completed, []);
  interaction.key(INTERACTION_PROTOTYPE.interactKey, false);

  const other = Symbol('other-control');
  controls.request(other, true);
  assert.equal(interaction.requestClose(), true);
  assert.deepEqual(completed, ['normal-completion-target']);
  assert.equal(interaction.snapshot.feedbackText, '正常结束已提交');
  assert.equal(controls.allowed, false,
    'Normal close must release only the interaction owner');
  assert.equal(interaction.requestClose(), false,
    'Repeated close must be a no-op');
  assert.deepEqual(completed, ['normal-completion-target']);
  controls.request(other, false);

  interaction.key(INTERACTION_PROTOTYPE.interactKey, true);
  interaction.key(INTERACTION_PROTOTYPE.interactKey, false);
  interaction.interruptTransientSession();
  assert.equal(interaction.snapshot.mode, 'idle');
  assert.deepEqual(completed, ['normal-completion-target'],
    'A system interruption must discard the unfinished dialogue');

  interaction.key(INTERACTION_PROTOTYPE.interactKey, true);
  interaction.key(INTERACTION_PROTOTYPE.interactKey, false);
  interaction.reset();
  assert.equal(interaction.snapshot.mode, 'idle');
  assert.deepEqual(completed, ['normal-completion-target'],
    'Reset must discard the unfinished dialogue');
});
