import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGameCore } from '../src/core/game.ts';
import { bindVisibilityPause } from '../src/platform/web/visibility.ts';

test('visibility adapter handles hidden startup, duplicate signals, new intervals and disposal', () => {
  const document = new EventTarget();
  document.visibilityState = 'hidden';
  globalThis.document = document;
  try {
    const core = createGameCore();
    const otherOwner = Symbol();
    const otherToken = core.lifecycle.acquire(otherOwner, Symbol());
    let notifications = 0;
    const unbind = bindVisibilityPause(core.lifecycle, () => notifications++);
    assert.equal(core.snapshot.pauseCount, 2);
    document.dispatchEvent(new Event('visibilitychange'));
    assert.equal(core.snapshot.pauseCount, 2);
    document.visibilityState = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
    assert.equal(core.snapshot.pauseCount, 1);
    assert.equal(core.snapshot.paused, true);
    core.lifecycle.release(otherOwner, otherToken);
    assert.equal(core.snapshot.paused, false);
    document.visibilityState = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));
    assert.equal(core.snapshot.pauseCount, 1);
    unbind();
    assert.equal(core.snapshot.pauseCount, 0);
    const count = notifications;
    document.dispatchEvent(new Event('visibilitychange'));
    unbind();
    assert.equal(notifications, count);
    assert.equal(core.snapshot.pauseCount, 0);
  } finally { delete globalThis.document; }
});
