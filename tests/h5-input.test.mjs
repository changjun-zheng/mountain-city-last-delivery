import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import {
  FIRST_LEVEL_EVENT_TYPES,
  FIRST_LEVEL_INTERACTIONS,
  FIRST_LEVEL_INTERACTION_IDS,
  FirstLevelRuntime,
} from '../src/core/first-level.ts';
import { createGrayboxCore } from '../src/core/graybox.ts';
import { PlayerMotor } from '../src/core/player.ts';
import { FirstLevelMatterWorld } from '../src/physics/matter/first-level-world.ts';
import {
  InputSourceAggregator,
  actionForKey,
  codeForAction,
} from '../src/platform/web/input-sources.ts';
import { bindPlayerInput } from '../src/platform/web/player-input.ts';
import {
  createRuntimeUuid,
  runtimeUuidProvider,
} from '../src/platform/web/runtime-uuid.ts';
import { bindTouchControls } from '../src/platform/web/touch-controls.ts';

const M = createRequire(import.meta.url)(
  '../node_modules/phaser/src/physics/matter-js/CustomMain.js',
);

class FixtureElement extends EventTarget {
  constructor() {
    super();
    this.dataset = {};
    this.hidden = false;
    this.disabled = false;
    this.textContent = '';
    this.attributes = {};
    this.tagName = 'BUTTON';
    this.captures = new Set();
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  setPointerCapture(pointerId) {
    this.captures.add(pointerId);
  }

  releasePointerCapture(pointerId) {
    this.captures.delete(pointerId);
  }

  querySelectorAll(selector) {
    return selector === '[data-action]' ? this.buttons ?? [] : [];
  }

  click() {
    this.dispatchEvent(new Event('click', { cancelable: true }));
  }
}

function installDom() {
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  let focused = true;
  const windowTarget = new EventTarget();
  windowTarget.matchMedia = () => ({ matches: false });
  const documentTarget = new EventTarget();
  documentTarget.visibilityState = 'visible';
  documentTarget.hasFocus = () => focused;
  globalThis.window = windowTarget;
  globalThis.document = documentTarget;
  const emit = (target, type, properties = {}) => {
    const event = new Event(type, { bubbles: true, cancelable: true });
    for (const [name, value] of Object.entries(properties)) {
      Object.defineProperty(event, name, { value });
    }
    target.dispatchEvent(event);
    return event;
  };
  return {
    windowTarget,
    documentTarget,
    emit,
    focus(value) {
      focused = value;
      emit(windowTarget, value ? 'focus' : 'blur');
    },
    visibility(value) {
      documentTarget.visibilityState = value;
      emit(documentTarget, 'visibilitychange');
    },
    restore() {
      globalThis.window = previousWindow;
      globalThis.document = previousDocument;
    },
  };
}

let firstLevelOrdinal = 0;
function createInputHarness() {
  const dom = installDom();
  const engine = M.Engine.create();
  const world = new FirstLevelMatterWorld(
    M,
    engine,
    deltaMs => M.Engine.update(engine, deltaMs),
  );
  firstLevelOrdinal++;
  const core = createGrayboxCore(world, {
    uuidProvider: {
      generate: () =>
        `a5000000-0000-4000-8000-${String(firstLevelOrdinal).padStart(12, '0')}`,
    },
    extraEventTypes: FIRST_LEVEL_EVENT_TYPES,
    interactionObjects: FIRST_LEVEL_INTERACTIONS,
    createGameplayRuntime: context => new FirstLevelRuntime(context),
  });
  let sampleMs = 0;
  const step = (count = 1) => {
    for (let index = 0; index < count; index++) {
      sampleMs += core.config.fixedDeltaMs;
      core.frame(sampleMs);
    }
  };
  const input = bindPlayerInput(core);
  step(30);
  return {
    dom,
    engine,
    world,
    core,
    input,
    step,
    key(code, down) {
      dom.emit(dom.windowTarget, down ? 'keydown' : 'keyup', {
        code,
        repeat: false,
      });
    },
    pointer(target, type, pointerId = 1, properties = {}) {
      dom.emit(target, type, {
        pointerId,
        pointerType: 'touch',
        isPrimary: true,
        buttons: type === 'pointerup' || type === 'pointercancel' ? 0 : 1,
        ...properties,
      });
    },
    dispose() {
      input.dispose();
      dom.restore();
    },
  };
}

function bindFixtureTouch(harness, enabled = true) {
  const root = new FixtureElement();
  const controls = new FixtureElement();
  const notice = new FixtureElement();
  const toggle = new FixtureElement();
  const pause = new FixtureElement();
  const menu = new FixtureElement();
  const continueButton = new FixtureElement();
  const closeDialogue = new FixtureElement();
  const left = new FixtureElement();
  const right = new FixtureElement();
  const jump = new FixtureElement();
  const interact = new FixtureElement();
  left.dataset.action = 'left';
  right.dataset.action = 'right';
  jump.dataset.action = 'jump';
  interact.dataset.action = 'interact';
  controls.buttons = [left, right, jump, interact];
  root.dataset.touchEnabled = String(enabled);
  const touch = bindTouchControls({
    root,
    controls,
    notice,
    toggle,
    pause,
    menu,
    continueButton,
    closeDialogue,
    input: harness.input,
    core: harness.core,
    changed: () => {},
  });
  return {
    root,
    controls,
    notice,
    toggle,
    pause,
    menu,
    continueButton,
    closeDialogue,
    left,
    right,
    jump,
    interact,
    touch,
  };
}

function recorder() {
  const edges = [];
  const aggregator = new InputSourceAggregator(
    (code, down, repeat = false) => edges.push({ code, down, repeat }),
  );
  return { aggregator, edges };
}

test('H01 aliases share one effective action without releasing another source', () => {
  const { aggregator, edges } = recorder();
  assert.equal(actionForKey('KeyA'), 'left');
  assert.equal(actionForKey('ArrowLeft'), 'left');
  assert.equal(codeForAction('left'), 'KeyA');

  assert.equal(aggregator.keyboardDown('KeyA'), true);
  assert.equal(aggregator.keyboardDown('ArrowLeft'), true);
  assert.deepEqual(edges, [{ code: 'KeyA', down: true, repeat: false }]);
  assert.equal(aggregator.keyboardUp('KeyA'), true);
  assert.equal(edges.length, 1, 'one alias release must not release the other');
  assert.equal(aggregator.keyboardUp('ArrowLeft'), true);
  assert.deepEqual(edges.at(-1), { code: 'KeyA', down: false, repeat: false });
});

test('H01 keyboard and pointer sources coexist, repeats and stale releases are ignored', () => {
  const { aggregator, edges } = recorder();
  aggregator.keyboardDown('Space');
  aggregator.keyboardDown('Space', true);
  aggregator.pointerActionDown('jump', 7);
  assert.deepEqual(edges, [{ code: 'Space', down: true, repeat: false }]);

  assert.equal(aggregator.keyboardUp('Space'), true);
  assert.equal(edges.length, 1);
  assert.equal(aggregator.pointerActionUp('jump', 7), true);
  assert.deepEqual(edges.at(-1), { code: 'Space', down: false, repeat: false });
  assert.equal(aggregator.pointerActionUp('jump', 7), false);
  assert.equal(aggregator.keyboardDown('Space', true), false);
});

test('H01 multiple pointers move and jump together; cancellation invalidates only that generation', () => {
  const { aggregator, edges } = recorder();
  aggregator.pointerActionDown('right', 1);
  assert.equal(aggregator.pointerActionDown('jump', 2), true);
  assert.deepEqual(edges, [
    { code: 'KeyD', down: true, repeat: false },
    { code: 'Space', down: true, repeat: false },
  ]);

  const oldGeneration = aggregator.generation;
  aggregator.clearPointers();
  assert.deepEqual(edges.slice(-2), [
    { code: 'KeyD', down: false, repeat: false },
    { code: 'Space', down: false, repeat: false },
  ]);
  assert.equal(
    aggregator.pointerActionUp('jump', 2, oldGeneration),
    false,
    'a stale tail event must not affect the new generation',
  );
  aggregator.pointerActionDown('right', 1);
  aggregator.pointerActionDown('jump', 2);
  aggregator.pointerActionUp('right', 1, aggregator.generation, false);
  assert.deepEqual(edges.at(-1), {
    code: 'Space',
    down: true,
    repeat: false,
  });
  assert.equal(aggregator.snapshot().right.length, 0);
  assert.equal(aggregator.snapshot().jump.length, 1);
  assert.equal(aggregator.pointerActionDown('jump', 2), false,
    'the new-generation pointer is already held');
});

test('H04 platform interruption clears sources without fabricating a release', () => {
  const { aggregator, edges } = recorder();
  aggregator.pointerActionDown('jump', 9);
  aggregator.pointerActionDown('right', 10);
  assert.deepEqual(edges, [
    { code: 'Space', down: true, repeat: false },
    { code: 'KeyD', down: true, repeat: false },
  ]);
  aggregator.cancelAll(false);
  assert.equal(edges.length, 2,
    'blur, hidden and teardown cannot fabricate releases');
  assert.deepEqual(aggregator.snapshot(), {
    left: [],
    right: [],
    jump: [],
    interact: [],
  });
  aggregator.pointerActionDown('right', 11);
  assert.deepEqual(edges.at(-1), {
    code: 'KeyD',
    down: true,
    repeat: false,
  });
  aggregator.pointerActionUp('right', 11);
  assert.deepEqual(edges.at(-1), {
    code: 'KeyD',
    down: false,
    repeat: false,
  });
});

test('H02 aggregator edges reach the unchanged PlayerMotor and consume one press', () => {
  const motor = new PlayerMotor();
  const edges = [];
  const aggregator = new InputSourceAggregator((code, down, repeat) => {
    edges.push({ code, down, repeat });
    motor.key(code, down, repeat);
  });
  aggregator.keyboardDown('Space');
  aggregator.keyboardDown('Space', true);
  aggregator.pointerActionDown('jump', 3);
  assert.deepEqual(edges, [
    { code: 'Space', down: true, repeat: false },
  ]);
  const grounded = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    worldVx: 0,
    worldVy: 0,
    supportVx: 0,
    supportVy: 0,
    grounded: true,
    normalX: 0,
    normalY: -1,
    support: 'ground',
    wall: false,
    ceiling: false,
  };
  motor.afterStep(grounded, 20);
  const first = motor.beforeStep({ ...grounded, vy: -530 }, 20);
  const second = motor.beforeStep(grounded, 20);
  assert.equal(first.vy, -530);
  assert.equal(second.vy, 0);
  assert.equal(motor.snapshot.jumps, 1);

  aggregator.keyboardUp('Space');
  assert.equal(edges.length, 1, 'pointer still holds jump');
  aggregator.pointerActionUp('jump', 3);
  assert.deepEqual(edges.at(-1), {
    code: 'Space',
    down: false,
    repeat: false,
  });
});

test('H07 UUID fallback uses secure v4 bytes and rejects insecure or malformed sources', () => {
  const native = '123e4567-e89b-42d3-a456-426614174000';
  assert.equal(createRuntimeUuid({ randomUUID: () => native }), native);

  const generated = createRuntimeUuid({
    getRandomValues(array) {
      for (let index = 0; index < array.length; index++) {
        array[index] = index;
      }
      return array;
    },
  });
  assert.match(
    generated,
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
  assert.throws(() => createRuntimeUuid(undefined), /Secure UUID/);
  assert.throws(() => createRuntimeUuid({}), /unavailable/);
  assert.throws(
    () => createRuntimeUuid({ randomUUID: () => 'not-a-uuid' }),
    /invalid UUID v4/,
  );
  const provider = runtimeUuidProvider({
    getRandomValues(array) {
      return array;
    },
  });
  assert.equal(typeof provider.generate, 'function');
});

test('H5-01-R1 R01 real keyboard release clears an interrupted Space or E gate', () => {
  const variants = [
    { code: 'Space', interruption: 'blur', release: 'before-focus' },
    { code: 'Space', interruption: 'hidden', release: 'after-focus' },
    { code: 'KeyE', interruption: 'hidden', release: 'before-focus' },
    { code: 'KeyE', interruption: 'blur', release: 'after-focus' },
  ];
  for (const variant of variants) {
    const harness = createInputHarness();
    try {
      if (variant.code === 'KeyE') {
        const npc = FIRST_LEVEL_INTERACTIONS.find(
          object => object.id === FIRST_LEVEL_INTERACTION_IDS.npc,
        );
        assert.ok(npc);
        harness.world.placePlayerAtAnchor({ x: npc.x, y: npc.y, facing: 1 });
        harness.step(2);
      } else {
        harness.step(40);
        assert.equal(harness.core.snapshot.player.grounded, true);
      }
      harness.key(variant.code, true);
      harness.step(2);
      if (variant.code === 'Space') {
        assert.equal(harness.core.snapshot.player.jumps, 1);
      } else {
        assert.equal(harness.core.snapshot.interaction.investigationStarts, 1);
      }
      if (variant.interruption === 'blur') {
        harness.dom.focus(false);
      } else {
        harness.dom.visibility('hidden');
      }
      if (variant.release === 'before-focus') {
        harness.key(variant.code, false);
        harness.dom.focus(true);
        if (variant.interruption === 'hidden') harness.dom.visibility('visible');
      } else {
        harness.dom.focus(true);
        if (variant.interruption === 'hidden') harness.dom.visibility('visible');
        harness.key(variant.code, false);
      }
      const gate = variant.code === 'Space'
        ? harness.core.snapshot.player.needsRelease
        : harness.core.snapshot.interaction.needsRelease;
      assert.equal(gate, false,
        `${variant.code} keyup must clear the ${variant.interruption} gate`);

      if (variant.code === 'Space') {
        const jumps = harness.core.snapshot.player.jumps;
        harness.step(100);
        assert.equal(harness.core.snapshot.player.grounded, true);
        harness.key('Space', true);
        harness.step(2);
        assert.equal(harness.core.snapshot.player.jumps, jumps + 1);
        harness.step(4);
        assert.equal(harness.core.snapshot.player.jumps, jumps + 1);
        harness.key('Space', false);
      } else {
        const starts = harness.core.snapshot.interaction.investigationStarts;
        assert.equal(harness.core.closeInteraction(), true);
        harness.step(2);
        harness.key('KeyE', true);
        harness.step(1);
        assert.equal(
          harness.core.snapshot.interaction.investigationStarts,
          starts + 1,
        );
        harness.key('KeyE', false);
      }
    } finally {
      harness.dispose();
    }
  }
});

test('H5-01-R1 R02 explicit touch termination ends the real core action', () => {
  for (const interruption of [
    'resize',
    'orientation',
    'toggle',
    'setEnabled',
    'dispose',
  ]) {
    const harness = createInputHarness();
    const touch = bindFixtureTouch(harness);
    try {
      harness.step(30);
      harness.pointer(touch.right, 'pointerdown', 11);
      harness.step(20);
      assert.ok(harness.world.state.vx > 200);
      const xBefore = harness.world.state.x;
      if (interruption === 'resize') {
        harness.dom.emit(harness.dom.windowTarget, 'resize');
      } else if (interruption === 'orientation') {
        harness.dom.emit(harness.dom.windowTarget, 'orientationchange');
      } else if (interruption === 'toggle') {
        touch.toggle.click();
      } else if (interruption === 'setEnabled') {
        touch.touch.setEnabled(false);
      } else {
        touch.touch.dispose();
      }
      assert.deepEqual(harness.input.aggregator.snapshot().right, []);
      assert.equal(touch.right.dataset.active, 'false');
      assert.equal(touch.right.captures.size, 0);
      harness.step(25);
      const xAfter = harness.world.state.x;
      assert.ok(Math.abs(harness.world.state.vx) < 1,
        `${interruption} must decelerate to rest`);
      assert.ok(xAfter - xBefore < 40,
        `${interruption} must not leave the player running`);

      if (interruption === 'toggle') touch.toggle.click();
      if (interruption === 'setEnabled') touch.touch.setEnabled(true);
      if (interruption !== 'dispose') {
        harness.pointer(touch.right, 'pointerdown', 12);
        harness.step(8);
        assert.ok(harness.world.state.x > xAfter + 4);
        harness.pointer(touch.right, 'pointerup', 12);
      } else {
        harness.key('KeyD', true);
        harness.step(8);
        assert.ok(harness.world.state.x > xAfter + 4);
        harness.key('KeyD', false);
      }
      harness.step(25);
    } finally {
      touch.touch.dispose();
      harness.dispose();
    }
  }
});

test('H5-01-R1 R03 mixed sources, aliases, pointer generations and teardown stay isolated', () => {
  const harness = createInputHarness();
  const touch = bindFixtureTouch(harness);
  try {
    harness.step(30);
    harness.pointer(touch.right, 'pointerdown', 21);
    harness.key('KeyD', true);
    harness.step(15);
    touch.toggle.click();
    assert.deepEqual(harness.input.aggregator.snapshot().right, ['keyboard:KeyD']);
    harness.step(8);
    assert.ok(harness.world.state.vx > 200,
      'Touch termination must preserve an independent held keyboard source');
    harness.key('KeyD', false);
    harness.step(25);
    assert.ok(Math.abs(harness.world.state.vx) < 1);
    touch.toggle.click();

    harness.key('KeyA', true);
    harness.key('ArrowLeft', true);
    harness.step(15);
    assert.equal(harness.input.aggregator.snapshot().left.length, 2);
    harness.key('KeyA', false);
    harness.step(5);
    assert.deepEqual(
      harness.input.aggregator.snapshot().left,
      ['keyboard:ArrowLeft'],
    );
    assert.ok(harness.world.state.vx < -200);
    harness.key('ArrowLeft', false);
    harness.step(25);
    assert.ok(Math.abs(harness.world.state.vx) < 1);

    harness.pointer(touch.right, 'pointerdown', 31);
    harness.pointer(touch.jump, 'pointerdown', 32);
    harness.step(1);
    const jumps = harness.core.snapshot.player.jumps;
    harness.pointer(touch.right, 'pointercancel', 31);
    assert.deepEqual(
      harness.input.aggregator.snapshot().jump,
      ['pointer:0:32'],
    );
    harness.step(8);
    assert.equal(harness.core.snapshot.player.jumps, jumps);
    harness.pointer(touch.jump, 'pointercancel', 32);
    harness.pointer(touch.jump, 'pointerup', 32);

    harness.pointer(touch.right, 'pointerdown', 41);
    harness.key('KeyD', true);
    harness.step(4);
    touch.touch.dispose();
    touch.touch.dispose();
    assert.deepEqual(harness.input.aggregator.snapshot().right, ['keyboard:KeyD']);
    harness.step(8);
    assert.ok(harness.world.state.vx > 200);
    harness.pointer(touch.right, 'pointerup', 41);
    harness.step(8);
    assert.ok(harness.world.state.vx > 200);
    harness.key('KeyD', false);

    const generation = harness.input.aggregator.generation;
    assert.equal(harness.input.pointerDown('right', 51), true);
    assert.equal(harness.input.cancelPointers(true), undefined);
    assert.equal(harness.input.pointerDown('right', 51), true);
    assert.equal(
      harness.input.pointerCancel('right', 51, generation, true),
      false,
    );
    assert.equal(harness.input.aggregator.snapshot().right.length, 1);
    assert.equal(
      harness.input.pointerCancel(
        'right',
        51,
        harness.input.aggregator.generation,
        true,
      ),
      true,
    );
  } finally {
    touch.touch.dispose();
    harness.dispose();
  }
});
