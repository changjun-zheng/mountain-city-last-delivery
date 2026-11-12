import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { createGrayboxCore } from '../src/core/graybox.ts';
import { PlayerMotor } from '../src/core/player.ts';
import { MatterGrayboxWorld } from '../src/physics/matter/graybox-world.ts';

// The same Matter 0.20.0 implementation bundled by Phaser, without a second dependency.
const M = createRequire(import.meta.url)('../node_modules/phaser/src/physics/matter-js/CustomMain.js');
function fixture(x = 80, y = 472, settle = 30) {
  const engine = M.Engine.create();
  const world = new MatterGrayboxWorld(M, engine, dt => M.Engine.update(engine, dt));
  M.Body.setPosition(world.player, { x, y });
  const core = createGrayboxCore(world);
  let frame = 0;
  const step = (n = 1) => { for (let i = 0; i < n; i++) core.frame(frame++ * core.config.fixedDeltaMs); };
  const until = (condition, max = 300) => {
    for (let i = 0; i < max; i++) { if (condition(core.snapshot)) return; step(); }
    assert.fail('Condition not reached: ' + JSON.stringify(core.snapshot));
  };
  step(settle);
  return { core, world, step, until };
}

test('Matter is stepped exactly once per fixed tick; ground supports the body', () => {
  const { core, step } = fixture();
  step(120);
  assert.equal(core.snapshot.physicsSteps, core.snapshot.tick);
  assert.ok(Math.abs(core.snapshot.physicsTimestamp - core.snapshot.tick * core.config.fixedDeltaMs) < 1e-6);
  assert.equal(core.snapshot.player.grounded, true);
  assert.ok(Math.abs(core.snapshot.player.y - 478) < 0.2);
});

test('horizontal acceleration, braking, reversal and air steering are gradual', () => {
  const { core, step } = fixture();
  core.key('KeyD', true); step();
  const first = core.snapshot.player.vx;
  assert.ok(first > 0 && first < 100);
  step(12);
  assert.ok(core.snapshot.player.vx > 200);
  core.key('KeyD', false); core.key('KeyA', true); step();
  assert.ok(core.snapshot.player.vx > 0, 'Reversal brakes before moving left');
  step(20);
  assert.ok(core.snapshot.player.vx < -200);
  core.key('Space', true); step();
  core.key('KeyA', false); core.key('KeyD', true); step(15);
  assert.ok(core.snapshot.player.vx > 0);
});

test('short/long jumps differ in height; held/repeated Space never auto-repeats on landing', () => {
  const peak = short => {
    const { core, step } = fixture();
    core.key('Space', true); step();
    if (short) core.key('Space', false);
    let minY = core.snapshot.player.y;
    for (let i = 0; i < 100; i++) {
      if (!short) core.key('Space', true, true);
      step(); minY = Math.min(minY, core.snapshot.player.y);
    }
    assert.equal(core.snapshot.player.jumps, 1);
    assert.equal(core.snapshot.player.grounded, true);
    return minY;
  };
  const short = peak(true), long = peak(false);
  assert.ok(short - long > 40, JSON.stringify({ short, long }));
});

test('floor, wall and ceiling collisions block penetration; side contact cannot restore a jump', () => {
  const wall = fixture(470);
  wall.core.key('KeyD', true); wall.step(90);
  assert.ok(wall.core.snapshot.player.x <= 507);
  assert.equal(wall.core.snapshot.player.wall, true);
  const side = fixture(506, 430, 1);
  side.core.key('KeyD', true); side.step(2);
  assert.equal(side.core.snapshot.player.grounded, false);
  side.core.key('Space', true); side.step(2);
  assert.equal(side.core.snapshot.player.jumps, 0);
  const roof = fixture(290);
  roof.core.key('Space', true);
  let minY = Infinity, ceiling = false;
  for (let i = 0; i < 60; i++) { roof.step(); minY = Math.min(minY, roof.core.snapshot.player.y); ceiling ||= roof.core.snapshot.player.ceiling; }
  assert.ok(minY >= 451);
  assert.equal(ceiling, true);
});

test('coyote jump works just after the ledge, expires, and never grants a second air jump', () => {
  const walkOff = () => {
    const f = fixture(850);
    f.core.key('KeyD', true);
    f.until(s => !s.player.grounded);
    return f;
  };
  const valid = walkOff();
  valid.step(2); valid.core.key('Space', true); valid.step();
  assert.equal(valid.core.snapshot.player.jumps, 1);
  valid.core.key('Space', false); valid.core.key('Space', true); valid.step(2);
  assert.equal(valid.core.snapshot.player.jumps, 1);
  const late = walkOff();
  late.step(9); late.core.key('Space', true); late.step();
  assert.equal(late.core.snapshot.player.jumps, 0);
});

test('a buffered press is consumed once on landing; early release gives a low jump; expired buffers vanish', () => {
  const buffered = fixture();
  buffered.core.key('Space', true);
  buffered.until(s => s.player.vy > 0 && s.player.y > 447);
  buffered.core.key('Space', false);
  buffered.core.key('Space', true); buffered.core.key('Space', false);
  buffered.until(s => s.player.jumps === 2);
  let minY = buffered.core.snapshot.player.y;
  for (let i = 0; i < 80; i++) { buffered.step(); minY = Math.min(minY, buffered.core.snapshot.player.y); }
  assert.ok(minY > 425);
  assert.equal(buffered.core.snapshot.player.jumps, 2);
  const expired = fixture();
  expired.core.key('Space', true);
  expired.until(s => s.player.vy > 0 && s.player.y < 400);
  expired.core.key('Space', false); expired.core.key('Space', true); expired.core.key('Space', false);
  expired.step(100);
  assert.equal(expired.core.snapshot.player.jumps, 1);
});

test('continuous slope can be ascended, stopped without sliding, and joined to the upper floor', () => {
  const { core, step } = fixture(1350, 450);
  core.key('KeyD', true);
  for (let i = 0; i < 55; i++) {
    step();
    assert.equal(core.snapshot.player.grounded, true, 'Moving up a supported slope is not jumping');
  }
  assert.ok(core.snapshot.player.x > 1480);
  assert.ok(core.snapshot.player.y < 425);
  core.key('KeyD', false); step(30);
  const stopped = core.snapshot.player;
  step(120);
  assert.ok(Math.abs(core.snapshot.player.x - stopped.x) < 1, JSON.stringify({ stopped, now: core.snapshot.player }));
  core.key('KeyD', true); step(90);
  assert.ok(core.snapshot.player.x > 1660);
  assert.equal(core.snapshot.player.grounded, true);
});

test('PC-01 owns control permission; PC-02 clears held input and requires release after focus returns', () => {
  const motor = new PlayerMotor();
  const a = Symbol(), b = Symbol();
  motor.controls.request(a, true); motor.controls.request(b, true);
  motor.controls.request(a, false);
  assert.equal(motor.controls.allowed, false);
  motor.controls.request(b, false);
  assert.equal(motor.controls.allowed, true);
  const { core, step } = fixture();
  core.key('Space', true); core.setAvailable(false); step(60);
  core.setAvailable(true);
  core.key('Space', true, true); core.key('Space', true); step(5);
  assert.equal(core.snapshot.player.jumps, 0);
  core.key('Space', false); core.key('Space', true); step();
  assert.equal(core.snapshot.player.jumps, 1);
});

test('pause freezes real Matter and resumes without chasing background time; reset is not recovery', () => {
  const { core } = fixture();
  const owner = Symbol(), token = core.lifecycle.acquire(owner, Symbol());
  const before = core.snapshot;
  core.frame(60000);
  assert.deepEqual(core.snapshot, before);
  core.lifecycle.release(owner, token);
  core.frame(90000);
  assert.equal(core.snapshot.physicsSteps, before.physicsSteps);
  core.frame(90000 + core.config.fixedDeltaMs);
  assert.equal(core.snapshot.physicsSteps, before.physicsSteps + 1);
  const tick = core.snapshot.tick;
  core.reset();
  assert.equal(core.snapshot.tick, tick);
  assert.equal(core.snapshot.player.x, 80);
  assert.equal(core.snapshot.player.vy, 0);
  assert.equal(core.snapshot.player.jumps, 0);
  for (let i = 2; i < 122; i++) core.frame(90000 + i * core.config.fixedDeltaMs);
  assert.equal(core.snapshot.player.grounded, true, 'Reset must rebuild Matter collision detection');
  assert.ok(Math.abs(core.snapshot.player.y - 478) < 0.2);
});
