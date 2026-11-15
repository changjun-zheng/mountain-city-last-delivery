import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PlayerMotor } from '../src/core/player.ts';
import {
  InputSourceAggregator,
  actionForKey,
  codeForAction,
} from '../src/platform/web/input-sources.ts';
import {
  createRuntimeUuid,
  runtimeUuidProvider,
} from '../src/platform/web/runtime-uuid.ts';

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
