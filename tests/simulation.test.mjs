import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FixedStepSimulation } from '../src/core/simulation.ts';
import { createGameCore } from '../src/core/game.ts';
import { RuntimeLifecycleController } from '../src/core/lifecycle.ts';

test('different frame distributions produce the same actual ticks and fixed delta', () => {
  for (const rate of [30, 60, 144]) {
    const calls = [];
    const simulation = new FixedStepSimulation({ fixedDeltaMs: 20, maxStepsPerFrame: 5 },
      (delta, tick) => calls.push([delta, tick]));
    simulation.frame(0);
    for (let i = 1; i <= rate; i++) simulation.frame(1000 * i / rate);
    assert.deepEqual(calls, Array.from({ length: 50 }, (_, i) => [20, i + 1]));
    assert.ok(simulation.snapshot.remainderMs < 1e-8);
    assert.equal(simulation.snapshot.discardedMs, 0);
  }
});

test('fractional fixed delta is stable across frame boundaries', () => {
  const simulation = new FixedStepSimulation({ fixedDeltaMs: 1000 / 60, maxStepsPerFrame: 5 }, () => {});
  for (let i = 0; i <= 144; i++) simulation.frame(1000 * i / 144);
  assert.equal(simulation.snapshot.tick, 60);
  assert.ok(simulation.snapshot.remainderMs < 1e-8);
});

test('bounded catch-up discards whole steps, retains residue and never invokes discarded work', () => {
  const calls = [];
  const simulation = new FixedStepSimulation({ fixedDeltaMs: 20, maxStepsPerFrame: 2 },
    (delta, tick) => calls.push([delta, tick]));
  simulation.frame(0);
  simulation.frame(85);
  assert.deepEqual(simulation.snapshot, {
    tick: 2, remainderMs: 5, discardedMs: 40, stepsLastFrame: 2, paused: false,
  });
  simulation.frame(100);
  assert.deepEqual(calls, [[20, 1], [20, 2], [20, 3]]);
  assert.equal(simulation.snapshot.remainderMs, 0);
  simulation.frame(10105);
  assert.equal(simulation.snapshot.stepsLastFrame, 2);
  assert.equal(simulation.snapshot.tick, calls.length);
  assert.equal(simulation.snapshot.remainderMs, 5);
  assert.equal(simulation.snapshot.discardedMs, 10000);
});

test('invalid configuration and samples fail before advancing simulation', () => {
  for (const config of [
    { fixedDeltaMs: 0, maxStepsPerFrame: 5 },
    { fixedDeltaMs: Infinity, maxStepsPerFrame: 5 },
    { fixedDeltaMs: 20, maxStepsPerFrame: 0 },
    { fixedDeltaMs: 20, maxStepsPerFrame: 1.5 },
  ]) assert.throws(() => new FixedStepSimulation(config, () => {}));
  const simulation = new FixedStepSimulation({ fixedDeltaMs: 20, maxStepsPerFrame: 5 }, () => {});
  simulation.frame(10);
  for (const time of [NaN, Infinity, -1, 9]) assert.throws(() => simulation.frame(time));
  simulation.frame(30);
  assert.equal(simulation.snapshot.tick, 1);
});

test('owner + key deduplicates without reference counting; retired keys cannot reactivate', () => {
  const transitions = [];
  const lifecycle = new RuntimeLifecycleController({
    pause: () => transitions.push('pause'), resume: () => transitions.push('resume'),
  });
  const owner = Symbol();
  const key = Symbol();
  const token = lifecycle.acquire(owner, key);
  assert.equal(lifecycle.acquire(owner, key), token);
  assert.equal(lifecycle.pauseCount, 1);
  assert.equal(lifecycle.release(owner, token), 'released');
  assert.equal(lifecycle.release(owner, token), 'already-released');
  assert.equal(lifecycle.acquire(owner, key), undefined);
  assert.equal(lifecycle.pauseCount, 0);
  const next = lifecycle.acquire(owner, Symbol());
  assert.notEqual(next, token);
  assert.equal(lifecycle.release(owner, token), 'already-released');
  assert.equal(lifecycle.pauseCount, 1);
  assert.deepEqual(transitions, ['pause', 'resume', 'pause']);
});

test('independent requests, shared keys across owners and unauthorized releases remain isolated', () => {
  const transitions = [];
  const lifecycle = new RuntimeLifecycleController({
    pause: () => transitions.push('pause'), resume: () => transitions.push('resume'),
  });
  const first = Symbol();
  const second = Symbol();
  const key = Symbol();
  const a = lifecycle.acquire(first, key);
  const b = lifecycle.acquire(first, Symbol());
  const c = lifecycle.acquire(second, key);
  assert.equal(new Set([a, b, c]).size, 3);
  assert.equal(lifecycle.pauseCount, 3);
  assert.equal(lifecycle.release(second, a), 'rejected');
  assert.equal(lifecycle.release(first, key), 'rejected'); // Key is not release authority.
  assert.equal(lifecycle.release(first, Symbol()), 'rejected');
  assert.equal(lifecycle.release(first, a), 'released');
  assert.equal(lifecycle.release(first, a), 'already-released');
  assert.equal(lifecycle.release(first, b), 'released');
  assert.equal(lifecycle.pauseCount, 1);
  assert.deepEqual(transitions, ['pause']);
  assert.equal(lifecycle.release(second, c), 'released');
  assert.deepEqual(transitions, ['pause', 'resume']);
  const other = new RuntimeLifecycleController({ pause() {}, resume() {} });
  assert.equal(other.release(second, c), 'rejected');
});

test('shared core pauses marker/ticks, retains pre-pause residue and resumes from a fresh baseline', () => {
  const core = createGameCore();
  const platform = Symbol();
  const diagnostic = Symbol();
  core.frame(0);
  core.frame(27);
  assert.equal(core.snapshot.tick, 1);
  assert.equal(core.snapshot.markerX, 2);
  const platformToken = core.lifecycle.acquire(platform, Symbol());
  const diagnosticToken = core.lifecycle.acquire(diagnostic, Symbol());
  const frozen = core.snapshot;
  core.frame(60000);
  assert.deepEqual(core.snapshot, frozen);
  core.lifecycle.release(platform, platformToken);
  core.frame(90000);
  assert.equal(core.snapshot.paused, true);
  assert.equal(core.snapshot.markerX, 2);
  core.lifecycle.release(diagnostic, diagnosticToken);
  core.frame(120000); // First resumed sample does not simulate background time.
  assert.equal(core.snapshot.tick, 1);
  assert.equal(core.snapshot.remainderMs, 7);
  core.frame(120013);
  assert.equal(core.snapshot.tick, 2);
  assert.equal(core.snapshot.markerX, 4);
  assert.equal(core.snapshot.discardedMs, 0);
  assert.equal(core.snapshot.paused, false);
});
