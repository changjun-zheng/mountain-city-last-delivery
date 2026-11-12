import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPlatformObserver } from './platform-observer.mjs';

test('latched interruption cannot become PASS while capture is pending, or permit new input/focus', async () => {
  let finishCapture;
  let input = false, focus = false;
  const ctx = { label: 'guard-unit', page: {
    evaluate: async () => ({ visible: 'visible', focused: true }),
    waitForFunction: async () => {},
    keyboard: { down: async () => { input = true; } },
  } };
  const monitor = createPlatformObserver(ctx, () => {}, () => new Promise(resolve => { finishCapture = resolve; }));
  await monitor.show(async () => {});
  await assert.rejects(monitor.race(async () => {
    monitor.processExit({ pid: 1, code: 1 });
    return 'completed-before-screenshot';
  }), /Unexpected platform interruption/);
  await assert.rejects(monitor.show(async () => { focus = true; }), /Unexpected/);
  await assert.rejects(monitor.key('KeyD', true), /Unexpected/);
  assert.equal(focus, false);
  assert.equal(input, false);
  finishCapture();
  await monitor.settled();
});
