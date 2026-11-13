import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { createGrayboxCore } from '../src/core/graybox.ts';
import { PLAYER_PROTOTYPE, PlayerMotor } from '../src/core/player.ts';
import {
  InMemoryRunProgress,
  PROTOTYPE_PROGRESS_CONTENT,
} from '../src/core/progress.ts';
import { MatterGrayboxWorld } from '../src/physics/matter/graybox-world.ts';

// The same Matter 0.20.0 implementation bundled by Phaser, without a second dependency.
const M = createRequire(import.meta.url)('../node_modules/phaser/src/physics/matter-js/CustomMain.js');
let fixtureRuntimeNumber = 0;
function fixtureRuntimeId() {
  fixtureRuntimeNumber++;
  return `70000000-0000-4000-8000-${String(fixtureRuntimeNumber).padStart(12, '0')}`;
}
function fixture(x = 80, y = 472, settle = 30, progress, options = {}) {
  const engine = M.Engine.create();
  const world = new MatterGrayboxWorld(M, engine, dt => M.Engine.update(engine, dt));
  M.Body.setPosition(world.player, { x, y });
  const core = createGrayboxCore(world, {
    progress,
    uuidProvider: { generate: fixtureRuntimeId },
    ...options,
  });
  let frame = 0;
  const step = (n = 1) => { for (let i = 0; i < n; i++) core.frame(frame++ * core.config.fixedDeltaMs); };
  const until = (condition, max = 300) => {
    for (let i = 0; i < max; i++) { if (condition(core.snapshot)) return; step(); }
    assert.fail('Condition not reached: ' + JSON.stringify(core.snapshot));
  };
  step(settle);
  return { core, world, step, until };
}

function placePlayer(instance, x, y = 478) {
  M.Body.setPosition(instance.world.player, { x, y });
  M.Body.setVelocity(instance.world.player, { x: 0, y: 0 });
  instance.step(3);
}

function pressKey(instance, code) {
  instance.core.key(code, true);
  instance.step();
  instance.core.key(code, false);
  instance.step();
}

function placeOnMovingPlatform(label) {
  const instance = fixture();
  const platform = instance.world.movingPlatforms.find(item => item.label === label);
  assert.ok(platform, `Missing moving platform ${label}`);
  M.Body.setPosition(instance.world.player, {
    x: platform.x,
    y: platform.y - platform.height / 2 - PLAYER_PROTOTYPE.height / 2,
  });
  M.Body.setVelocity(instance.world.player, { x: 0, y: 0 });
  instance.step(2);
  assert.equal(instance.core.snapshot.player.support, label);
  return { ...instance, platform };
}

function diagnosticZone(world, suffix) {
  const zone = world.diagnostics.diagnosticZones.find(item => item.label === `diagnostic-zone-${suffix}`);
  assert.ok(zone, `Missing diagnostic zone ${suffix}`);
  return zone;
}

function untilZone(instance, predicate, max = 300) {
  for (let i = 0; i < max; i++) {
    if (predicate()) return;
    instance.step();
  }
  assert.fail('Diagnostic zone condition not reached: ' + JSON.stringify(instance.world.diagnostics.diagnosticZones));
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

test('P01 solid platforms block from below, support from above, and release at the edge', () => {
  const underside = fixture(745);
  underside.core.key('Space', true);
  let minY = Infinity, hitUnderside = false;
  for (let i = 0; i < 150; i++) {
    underside.step();
    minY = Math.min(minY, underside.core.snapshot.player.y);
    hitUnderside ||= underside.core.snapshot.player.ceiling;
  }
  assert.ok(minY >= 439.5, JSON.stringify(underside.core.snapshot.player));
  assert.equal(hitUnderside, true);
  assert.notEqual(underside.core.snapshot.player.support, 'solid-platform-a');

  const top = fixture(745, 350);
  top.until(s => s.player.support === 'solid-platform-a');
  assert.equal(top.core.snapshot.player.grounded, true);
  assert.ok(Math.abs(top.core.snapshot.player.y - 378) < 0.2);
  top.core.key('KeyD', true);
  top.until(s => !s.player.grounded);
  top.until(s => s.player.grounded && s.player.support === 'ground-a');
  assert.ok(top.core.snapshot.player.x > 790);
  assert.ok(Math.abs(top.core.snapshot.player.y - 478) < 0.2);
});

test('P02 a full one-way ascent passes the underside without ceiling contact and lands from above', () => {
  const { core, world, step } = fixture(1060);
  assert.equal(world.oneWayCollisionEnabled, false);
  core.key('Space', true);
  let minY = Infinity, ceiling = false;
  for (let i = 0; i < 180 && core.snapshot.player.support !== 'one-way-platform-a'; i++) {
    step();
    minY = Math.min(minY, core.snapshot.player.y);
    ceiling ||= core.snapshot.player.ceiling;
  }
  assert.ok(minY < 388, JSON.stringify({ minY, state: core.snapshot.player }));
  assert.equal(ceiling, false, 'Ascent must ignore the one-way platform underside');
  assert.equal(core.snapshot.player.support, 'one-way-platform-a');
  assert.equal(world.oneWayCollisionEnabled, true);
  assert.equal(core.snapshot.player.grounded, true);
  assert.ok(Math.abs(core.snapshot.player.y - 388) < 0.2);
  assert.equal(core.snapshot.player.jumps, 1);
});

test('P03 one-way landing supports walking and a held jump cannot auto-repeat', () => {
  const { core, world, step } = fixture(1060);
  core.key('Space', true); // Keep held through take-off, landing and standing.
  for (let i = 0; i < 180 && core.snapshot.player.support !== 'one-way-platform-a'; i++) step();
  const landedX = core.snapshot.player.x;
  core.key('KeyA', true); step(4); core.key('KeyA', false);
  assert.equal(core.snapshot.player.support, 'one-way-platform-a');
  assert.ok(core.snapshot.player.x < landedX - 1);
  const leftX = core.snapshot.player.x;
  core.key('KeyD', true); step(20); core.key('KeyD', false);
  assert.ok(core.snapshot.player.x > leftX + 1);
  step(20);
  assert.equal(core.snapshot.player.support, 'one-way-platform-a');
  step(120);
  assert.equal(core.snapshot.player.jumps, 1);
  assert.equal(core.snapshot.player.grounded, true);
  assert.equal(world.oneWayCollisionEnabled, true);

  const overlap = fixture(1060, 420, 0);
  overlap.step();
  assert.equal(overlap.core.snapshot.player.grounded, false);
  assert.equal(overlap.world.oneWayCollisionEnabled, false,
    'Foot-sensor overlap below the top does not grant support');
});

test('P04 short jumps cannot false-land; one-way edges release into the supporting ground', () => {
  const short = fixture(1060);
  short.core.key('Space', true); short.step(); short.core.key('Space', false);
  let minY = Infinity, oneWaySupport = false;
  for (let i = 0; i < 180; i++) {
    short.step();
    minY = Math.min(minY, short.core.snapshot.player.y);
    oneWaySupport ||= short.core.snapshot.player.support === 'one-way-platform-a';
  }
  assert.ok(minY > 420, JSON.stringify({ minY, state: short.core.snapshot.player }));
  assert.equal(oneWaySupport, false);
  assert.equal(short.world.oneWayCollisionEnabled, false);
  assert.equal(short.core.snapshot.player.grounded, true);
  assert.equal(short.core.snapshot.player.support, 'ground-b');
  assert.ok(Math.abs(short.core.snapshot.player.y - 478) < 0.2);

  const edge = fixture(1060);
  edge.core.key('Space', true);
  edge.until(s => s.player.support === 'one-way-platform-a');
  edge.core.key('Space', false); edge.core.key('KeyA', true);
  edge.until(s => !s.player.grounded);
  edge.core.key('KeyA', false);
  edge.until(s => s.player.grounded && s.player.support === 'ground-b');
  assert.ok(edge.core.snapshot.player.x < 1030);
  assert.ok(Math.abs(edge.core.snapshot.player.y - 478) < 0.2);
});

test('P05 one-way edges retain coyote/buffer jumps; Down + Space never drops through', () => {
  const landOneWay = () => {
    const f = fixture(1060);
    f.core.key('Space', true);
    f.until(s => s.player.support === 'one-way-platform-a');
    f.core.key('Space', false);
    return f;
  };

  const coyote = landOneWay();
  coyote.core.key('KeyA', true);
  coyote.until(s => !s.player.grounded);
  coyote.core.key('KeyA', false);
  coyote.step(2); coyote.core.key('Space', true); coyote.step();
  assert.equal(coyote.core.snapshot.player.jumps, 2);

  const buffered = landOneWay();
  buffered.core.key('KeyA', true);
  buffered.until(s => !s.player.grounded);
  buffered.core.key('KeyA', false);
  buffered.until(s => s.player.y > 445 && s.player.vy > 0);
  buffered.core.key('Space', true); buffered.core.key('Space', false);
  buffered.until(s => s.player.jumps === 2 && s.player.vy < 0);

  const down = landOneWay();
  down.core.key('ArrowDown', true);
  down.step(30);
  assert.equal(down.core.snapshot.player.support, 'one-way-platform-a');
  assert.ok(Math.abs(down.core.snapshot.player.y - 388) < 0.2);
  down.core.key('Space', true); down.step();
  assert.ok(down.core.snapshot.player.vy < 0);
  assert.equal(down.core.snapshot.player.support, '');
  assert.equal(down.world.oneWayCollisionEnabled, false);
});

test('P06 reset and pause do not retain one-way collision bypass or old support', () => {
  const reset = fixture(1060);
  reset.core.key('Space', true);
  reset.until(s => s.player.y < 450 && s.player.vy < 0);
  assert.equal(reset.world.oneWayCollisionEnabled, false);
  reset.core.reset();
  assert.equal(reset.world.oneWayCollisionEnabled, false);
  assert.equal(reset.core.snapshot.player.grounded, false);
  M.Body.setPosition(reset.world.player, { x: 1060, y: 472 });
  reset.step(30);
  reset.core.key('Space', false); reset.core.key('Space', true);
  reset.until(s => s.player.support === 'one-way-platform-a');
  assert.equal(reset.world.oneWayCollisionEnabled, true);

  const paused = fixture(1060);
  paused.core.key('Space', true);
  paused.until(s => s.player.support === 'one-way-platform-a');
  paused.core.key('Space', false);
  const owner = Symbol(), token = paused.core.lifecycle.acquire(owner, Symbol());
  const frozen = paused.core.snapshot;
  paused.core.frame(60000);
  assert.deepEqual(paused.core.snapshot, frozen);
  paused.core.lifecycle.release(owner, token);
  paused.core.frame(120000);
  assert.equal(paused.core.snapshot.physicsSteps, frozen.physicsSteps);
  paused.core.frame(120000 + paused.core.config.fixedDeltaMs);
  assert.equal(paused.core.snapshot.physicsSteps, frozen.physicsSteps + 1);
  assert.equal(paused.core.snapshot.player.support, 'one-way-platform-a');
  assert.equal(paused.core.snapshot.player.grounded, true);
  assert.equal(paused.core.snapshot.player.jumps, frozen.player.jumps);
});

test('D04 M01 horizontal and vertical platforms carry through multiple reversals without drift', () => {
  for (const label of ['moving-horizontal-a', 'moving-vertical-a']) {
    const moving = placeOnMovingPlatform(label);
    const axis = moving.platform.axis;
    const relative = () => axis === 'horizontal'
      ? moving.core.snapshot.player.x - moving.world.movingPlatforms.find(item => item.label === label).x
      : moving.core.snapshot.player.y - moving.world.movingPlatforms.find(item => item.label === label).y;
    const startRelative = relative();
    const period = axis === 'horizontal' ? 4000 : 3600;
    const ticks = Math.ceil(period * 2.2 / moving.core.config.fixedDeltaMs);
    let minPosition = Infinity, maxPosition = -Infinity, maxDrift = 0;
    for (let i = 0; i < ticks; i++) {
      moving.step();
      const platform = moving.world.movingPlatforms.find(item => item.label === label);
      assert.equal(moving.core.snapshot.player.support, label);
      assert.equal(moving.core.snapshot.player.grounded, true);
      const position = axis === 'horizontal' ? platform.x : platform.y;
      minPosition = Math.min(minPosition, position);
      maxPosition = Math.max(maxPosition, position);
      maxDrift = Math.max(maxDrift, Math.abs(relative() - startRelative));
    }
    const platform = moving.world.movingPlatforms.find(item => item.label === label);
    assert.ok(platform.cycle >= 2, JSON.stringify(platform));
    assert.ok(maxPosition - minPosition > 60, JSON.stringify({ label, minPosition, maxPosition }));
    assert.ok(maxDrift < 0.35, JSON.stringify({ label, startRelative, maxDrift, platform }));
    const state = moving.core.snapshot.player;
    assert.ok(Math.abs(state.vx) < 1 && Math.abs(state.vy) < 1);
    if (axis === 'horizontal') {
      assert.ok(Math.abs(Math.abs(state.supportVx) - 35) < 0.1);
      assert.ok(Math.abs(state.worldVx - state.supportVx) < 0.1);
    } else {
      assert.ok(Math.abs(Math.abs(state.supportVy) - 50) < 0.1);
      assert.ok(Math.abs(state.worldVy - state.supportVy) < 0.1);
    }
  }
});

test('D04 M02 player walking, braking, reversal and edge exit combine correctly with platform motion', () => {
  const moving = placeOnMovingPlatform('moving-horizontal-a');
  const relativeX = () => moving.core.snapshot.player.x - moving.world.movingPlatforms[0].x;
  const start = relativeX();
  moving.core.key('KeyD', true);
  moving.step(6);
  const moved = relativeX();
  assert.ok(moved > start + 4, JSON.stringify({ start, moved }));
  moving.core.key('KeyD', false);
  moving.step(5);
  const braked = moving.core.snapshot.player.vx;
  assert.ok(Math.abs(braked) < 220);
  moving.core.key('KeyA', true);
  moving.step(8);
  const reversed = relativeX();
  assert.ok(reversed < moved, JSON.stringify({ moved, reversed }));
  moving.core.key('KeyA', false);
  moving.core.key('KeyD', true);
  moving.until(s => !s.player.grounded, 120);
  moving.core.key('KeyD', false);
  assert.notEqual(moving.core.snapshot.player.support, 'moving-horizontal-a');
});

test('D04 M03 short and long jumps from a moving platform land again without auto-repeat', () => {
  const jumpFromMovingPlatform = short => {
    const moving = placeOnMovingPlatform('moving-horizontal-a');
    const before = moving.core.snapshot.player.jumps;
    moving.core.key('Space', true);
    moving.step(short ? 2 : 1);
    if (short) moving.core.key('Space', false);
    let peakY = moving.core.snapshot.player.y;
    for (let i = 0; i < 120; i++) {
      moving.step();
      peakY = Math.min(peakY, moving.core.snapshot.player.y);
    }
    assert.equal(moving.core.snapshot.player.grounded, true);
    assert.equal(moving.core.snapshot.player.support, 'moving-horizontal-a');
    assert.equal(moving.core.snapshot.player.jumps, before + 1);
    return { peakY, moving };
  };
  const short = jumpFromMovingPlatform(true);
  const long = jumpFromMovingPlatform(false);
  assert.ok(short.peakY - long.peakY > 25, JSON.stringify({ short: short.peakY, long: long.peakY }));

  const coyote = placeOnMovingPlatform('moving-horizontal-a');
  coyote.core.key('KeyA', true);
  coyote.until(s => !s.player.grounded, 120);
  coyote.core.key('KeyA', false);
  coyote.step(2);
  coyote.core.key('Space', true);
  coyote.step();
  assert.equal(coyote.core.snapshot.player.jumps, 1);

  const buffered = placeOnMovingPlatform('moving-horizontal-a');
  buffered.core.key('KeyA', true);
  buffered.until(s => !s.player.grounded, 120);
  buffered.core.key('KeyA', false);
  buffered.until(s => s.player.vy > 0 && s.player.y > 330, 120);
  buffered.core.key('Space', true);
  buffered.core.key('Space', false);
  buffered.until(s => s.player.jumps === 1 && s.player.vy < 0, 20);
});

test('D04 M04 airborne, side and underside contacts never receive remote platform carry', () => {
  const airborne = placeOnMovingPlatform('moving-horizontal-a');
  airborne.core.key('Space', true);
  airborne.step();
  assert.equal(airborne.core.snapshot.player.support, '');
  assert.equal(airborne.core.snapshot.player.supportVx, 0);
  const takeoff = airborne.core.snapshot.player;
  airborne.step(8);
  const platform = airborne.world.movingPlatforms[0];
  assert.ok(airborne.core.snapshot.player.x < platform.x, 'Platform must move under an airborne player without carrying them');
  assert.ok(Math.abs(takeoff.vx) < 0.01, 'Prototype jumping does not inherit platform velocity');

  const side = fixture();
  const horizontal = side.world.movingPlatforms[0];
  M.Body.setPosition(side.world.player, {
    x: horizontal.x - horizontal.width / 2 - PLAYER_PROTOTYPE.width / 2 - 1, y: horizontal.y,
  });
  side.step(3);
  assert.equal(side.core.snapshot.player.support, '');

  const below = fixture();
  const vertical = below.world.movingPlatforms[1];
  M.Body.setPosition(below.world.player, {
    x: vertical.x, y: vertical.y + vertical.height / 2 + PLAYER_PROTOTYPE.height / 2 + 2,
  });
  below.step(3);
  assert.equal(below.core.snapshot.player.support, '');

  const switched = placeOnMovingPlatform('moving-horizontal-a');
  switched.core.key('KeyD', true);
  switched.until(s => !s.player.grounded, 120);
  switched.core.key('KeyD', false);
  switched.until(s => s.player.grounded && s.player.support === 'upper-ground', 160);
  switched.step(30);
  const groundedX = switched.core.snapshot.player.x;
  switched.step(60);
  assert.equal(switched.core.snapshot.player.support, 'upper-ground');
  assert.equal(switched.core.snapshot.player.supportVx, 0);
  assert.ok(Math.abs(switched.core.snapshot.player.x - groundedX) < 1);
});

test('D04 M05 pause freezes platform route and bounded catch-up cannot add discarded travel', () => {
  const moving = placeOnMovingPlatform('moving-vertical-a');
  const beforePlatform = moving.world.movingPlatforms;
  const owner = Symbol(), token = moving.core.lifecycle.acquire(owner, Symbol());
  const frozen = moving.core.snapshot;
  moving.core.frame(60000);
  assert.deepEqual(moving.core.snapshot, frozen);
  assert.deepEqual(moving.world.movingPlatforms, beforePlatform);
  moving.core.lifecycle.release(owner, token);
  moving.core.frame(120000);
  assert.deepEqual(moving.world.movingPlatforms, beforePlatform);
  const resumedAt = 120000 + moving.core.config.fixedDeltaMs;
  moving.core.frame(resumedAt);
  assert.equal(moving.core.snapshot.physicsSteps, frozen.physicsSteps + 1);
  assert.ok(Math.abs(
    moving.world.platformClockMs - (frozen.physicsSteps + 1) * moving.core.config.fixedDeltaMs,
  ) < 0.001);
  moving.core.frame(resumedAt + 10000);
  const advanced = moving.core.snapshot.physicsSteps - frozen.physicsSteps;
  assert.ok(advanced <= 1 + moving.core.config.maxStepsPerFrame);
  assert.equal(moving.core.snapshot.player.support, 'moving-vertical-a');
  assert.equal(moving.core.snapshot.player.jumps, frozen.player.jumps);
});

test('D04 M06 reset restores platform origin and clears carry state without resetting global Tick', () => {
  const moving = placeOnMovingPlatform('moving-vertical-a');
  moving.step(240);
  assert.ok(moving.world.movingPlatforms[1].cycle >= 1);
  const tickBeforeReset = moving.core.snapshot.tick;
  moving.core.reset();
  assert.equal(moving.core.snapshot.tick, tickBeforeReset);
  assert.equal(moving.core.snapshot.player.x, 80);
  assert.equal(moving.core.snapshot.player.support, '');
  assert.equal(moving.world.platformClockMs, 0);
  for (const [index, platform] of moving.world.movingPlatforms.entries()) {
    assert.equal(platform.direction, index === 0 ? 1 : -1);
    assert.equal(platform.cycle, 0);
    assert.equal(platform.x, index === 0 ? 1710 : 1910);
    assert.equal(platform.y, index === 0 ? 300 : 310);
  }
  const horizontal = moving.world.movingPlatforms[0];
  M.Body.setPosition(moving.world.player, {
    x: horizontal.x, y: horizontal.y - horizontal.height / 2 - PLAYER_PROTOTYPE.height / 2,
  });
  moving.step(2);
  assert.equal(moving.core.snapshot.player.support, 'moving-horizontal-a');
});

test('D05 G01 zone enter, sustained occupancy, exit and re-entry are edge-triggered', () => {
  const instance = fixture();
  assert.equal(diagnosticZone(instance.world, 'a').occupied, false);
  instance.core.key('KeyD', true);
  untilZone(instance, () => diagnosticZone(instance.world, 'a').occupied);
  const entered = diagnosticZone(instance.world, 'a');
  assert.equal(entered.enterCount, 1);
  assert.equal(entered.exitCount, 0);
  instance.step(30);
  const sustained = diagnosticZone(instance.world, 'a');
  assert.equal(sustained.occupied, true);
  assert.equal(sustained.enterCount, 1);
  assert.ok(sustained.occupiedSteps > entered.occupiedSteps);
  untilZone(instance, () => !diagnosticZone(instance.world, 'a').occupied);
  assert.equal(diagnosticZone(instance.world, 'a').exitCount, 1);
  instance.core.key('KeyD', false);
  instance.core.key('KeyA', true);
  untilZone(instance, () => diagnosticZone(instance.world, 'a').occupied);
  const reentered = diagnosticZone(instance.world, 'a');
  assert.equal(reentered.enterCount, 2);
  assert.equal(reentered.exitCount, 1);
});

test('D05 G02 overlapping zones change independently and share the real transition Tick', () => {
  const instance = fixture(430, 478, 0);
  instance.step(); // Establish the simulation time baseline.
  untilZone(instance, () =>
    diagnosticZone(instance.world, 'a').occupied && diagnosticZone(instance.world, 'b').occupied);
  const enteredA = diagnosticZone(instance.world, 'a');
  const enteredB = diagnosticZone(instance.world, 'b');
  assert.equal(enteredA.enterCount, 1);
  assert.equal(enteredB.enterCount, 1);
  assert.equal(enteredA.lastTransitionTick, instance.core.snapshot.tick);
  assert.equal(enteredB.lastTransitionTick, enteredA.lastTransitionTick);
  instance.step(20);
  assert.equal(diagnosticZone(instance.world, 'a').enterCount, 1);
  assert.equal(diagnosticZone(instance.world, 'b').enterCount, 1);

  M.Body.setPosition(instance.world.player, { x: 430, y: 100 });
  M.Body.setVelocity(instance.world.player, { x: 0, y: 0 });
  instance.step();
  const exitedA = diagnosticZone(instance.world, 'a');
  const exitedB = diagnosticZone(instance.world, 'b');
  assert.equal(exitedA.occupied, false);
  assert.equal(exitedB.occupied, false);
  assert.equal(exitedA.exitCount, 1);
  assert.equal(exitedB.exitCount, 1);
  assert.equal(exitedA.lastTransitionTick, instance.core.snapshot.tick);
  assert.equal(exitedB.lastTransitionTick, exitedA.lastTransitionTick);
});

test('D05 G03 zone sensors neither block nor support and the foot region cannot trigger occupancy', () => {
  const standing = fixture(430);
  standing.step(10);
  assert.equal(diagnosticZone(standing.world, 'a').occupied, true);
  assert.equal(standing.core.snapshot.player.support, 'ground-a');
  assert.equal(standing.core.snapshot.player.grounded, true);
  for (const body of standing.world.diagnosticZoneBodies) {
    assert.equal(body.isSensor, true);
    assert.equal(standing.world.terrain.includes(body), false);
  }
  const beforeX = standing.core.snapshot.player.x;
  standing.core.key('KeyD', true);
  standing.step(5);
  assert.ok(standing.core.snapshot.player.x > beforeX, 'Diagnostic zones must not block horizontal movement');
  assert.equal(standing.core.snapshot.player.support, 'ground-a');

  const airborne = fixture(405, 398, 0);
  airborne.step();
  airborne.step();
  assert.equal(diagnosticZone(airborne.world, 'a').occupied, false);
  assert.equal(diagnosticZone(airborne.world, 'b').occupied, false);
  assert.equal(airborne.core.snapshot.player.grounded, false);
  airborne.core.key('Space', true);
  airborne.step();
  assert.equal(airborne.core.snapshot.player.jumps, 0,
    'Foot-region proximity without player-body overlap cannot grant jump eligibility');
});

test('D05 G04 pause freezes zone state; resume neither repeats enter nor catches up', () => {
  const instance = fixture();
  instance.core.key('KeyD', true);
  untilZone(instance, () => diagnosticZone(instance.world, 'a').occupied);
  instance.core.key('KeyD', false);
  const frozenZones = instance.world.diagnostics.diagnosticZones;
  const frozenTick = instance.core.snapshot.tick;
  const owner = Symbol(), token = instance.core.lifecycle.acquire(owner, Symbol());
  instance.core.frame(60000);
  assert.equal(instance.core.snapshot.tick, frozenTick);
  assert.deepEqual(instance.world.diagnostics.diagnosticZones, frozenZones);
  instance.core.lifecycle.release(owner, token);
  instance.core.frame(120000);
  assert.deepEqual(instance.world.diagnostics.diagnosticZones, frozenZones);
  instance.core.frame(120000 + instance.core.config.fixedDeltaMs);
  const resumedA = diagnosticZone(instance.world, 'a');
  assert.equal(resumedA.enterCount, 1);
  assert.equal(resumedA.occupied, true);
  assert.equal(resumedA.occupiedSteps, frozenZones.find(zone => zone.label === 'diagnostic-zone-a').occupiedSteps + 1);

  M.Body.setPosition(instance.world.player, { x: 600, y: 478 });
  M.Body.setVelocity(instance.world.player, { x: 0, y: 0 });
  instance.core.frame(120000 + instance.core.config.fixedDeltaMs * 2);
  assert.equal(diagnosticZone(instance.world, 'a').exitCount, 1);
  M.Body.setPosition(instance.world.player, { x: 400, y: 478 });
  M.Body.setVelocity(instance.world.player, { x: 0, y: 0 });
  instance.core.frame(120000 + instance.core.config.fixedDeltaMs * 3);
  assert.equal(diagnosticZone(instance.world, 'a').enterCount, 2);
});

test('D05 G05 reset synchronizes zone baseline without fake walk events or Tick reset', () => {
  const instance = fixture(430);
  instance.step(5);
  const before = diagnosticZone(instance.world, 'a');
  assert.equal(before.occupied, true);
  const priorOrdinal = before.recentTransitions.at(-1).diagnosticOrdinal;
  const tickBeforeReset = instance.core.snapshot.tick;
  instance.core.reset();
  const resetA = diagnosticZone(instance.world, 'a');
  const resetB = diagnosticZone(instance.world, 'b');
  assert.equal(instance.core.snapshot.tick, tickBeforeReset);
  assert.equal(instance.core.snapshot.player.x, 80);
  assert.equal(resetA.occupied, false);
  assert.equal(resetB.occupied, false);
  assert.equal(resetA.enterCount, 0);
  assert.equal(resetA.exitCount, 0);
  assert.deepEqual(resetA.recentTransitions, []);
  assert.equal(instance.world.diagnostics.diagnosticBaselineCount, 1);
  assert.equal(instance.world.diagnostics.diagnosticBaselineTick, tickBeforeReset);
  instance.step(30);
  assert.equal(diagnosticZone(instance.world, 'a').occupied, false);
  instance.core.key('KeyD', true);
  untilZone(instance, () => diagnosticZone(instance.world, 'a').occupied);
  const reentered = diagnosticZone(instance.world, 'a');
  assert.equal(reentered.enterCount, 1);
  assert.equal(reentered.exitCount, 0);
  assert.ok(reentered.recentTransitions.at(-1).diagnosticOrdinal > priorOrdinal,
    'Diagnostic ordinals remain monotonic across a debug baseline reset');
});

test('D05 G06 bounded catch-up checks actual steps only and discarded time creates no zone records', () => {
  const instance = fixture(325, 478, 0);
  instance.core.frame(0);
  instance.core.key('KeyD', true);
  instance.core.frame(300);
  const entered = diagnosticZone(instance.world, 'a');
  assert.equal(entered.enterCount, 1);
  assert.equal(instance.core.snapshot.tick, instance.core.config.maxStepsPerFrame);
  assert.equal(instance.core.snapshot.physicsSteps, instance.core.snapshot.tick);
  assert.ok(entered.recentTransitions[0].tick >= 1);
  assert.ok(entered.recentTransitions[0].tick <= instance.core.snapshot.tick);
  assert.ok(instance.core.snapshot.discardedMs > 0);

  const enterCount = entered.enterCount;
  const transitionCount = entered.recentTransitions.length;
  const occupiedSteps = entered.occupiedSteps;
  const discardedBefore = instance.core.snapshot.discardedMs;
  instance.core.frame(300 + 10000);
  const advanced = diagnosticZone(instance.world, 'a');
  assert.equal(advanced.enterCount, enterCount);
  assert.equal(advanced.recentTransitions.length, transitionCount);
  assert.equal(advanced.occupiedSteps, occupiedSteps + instance.core.config.maxStepsPerFrame);
  assert.ok(instance.core.snapshot.discardedMs > discardedBefore);
  assert.equal(instance.core.snapshot.physicsSteps, instance.core.snapshot.tick);
});

test('D07 interaction selection, coordinator lock and reset use the same live Matter world', () => {
  const instance = fixture(240, 478, 0);
  instance.step(2);
  assert.equal(instance.core.snapshot.interaction.candidateCount, 2);
  assert.equal(instance.core.snapshot.interaction.selectedId, 'prototype-investigation-b');
  instance.core.key('KeyE', true);
  assert.equal(instance.core.snapshot.interaction.mode, 'investigation');
  assert.equal(instance.core.snapshot.player.controlAllowed, false);
  const tick = instance.core.snapshot.tick;
  const x = instance.core.snapshot.player.x;
  const jumps = instance.core.snapshot.player.jumps;
  instance.core.key('KeyD', true);
  instance.core.key('Space', true);
  instance.step(40);
  assert.ok(instance.core.snapshot.tick > tick, 'Matter simulation must continue during investigation');
  assert.equal(instance.core.snapshot.player.jumps, jumps);
  assert.ok(Math.abs(instance.core.snapshot.player.x - x) < 2, 'Locked movement must not walk');
  instance.core.key('KeyE', false);
  instance.core.key('Space', false);
  instance.core.key('KeyD', false);
  instance.core.key('Escape', true);
  instance.core.key('Escape', false);
  assert.equal(instance.core.snapshot.interaction.mode, 'idle');
  assert.equal(instance.core.snapshot.player.controlAllowed, true);
  const unlockedX = instance.core.snapshot.player.x;
  instance.core.key('KeyD', true);
  instance.step(8);
  instance.core.key('KeyD', false);
  assert.ok(instance.core.snapshot.player.x > unlockedX + 5);

  instance.core.key('KeyE', true);
  assert.equal(instance.core.snapshot.interaction.mode, 'investigation');
  instance.core.reset();
  assert.equal(instance.core.snapshot.interaction.mode, 'idle');
  assert.equal(instance.core.snapshot.interaction.investigationStarts, 0);
  assert.equal(instance.core.snapshot.player.controlAllowed, true);
});

test('D08 P02 collection interaction is idempotent across repeat, re-entry and object rebuild', () => {
  const progress = new InMemoryRunProgress();
  const first = fixture(80, 472, 30, progress);
  placePlayer(first, 390);
  assert.equal(first.core.snapshot.interaction.selectedId,
    PROTOTYPE_PROGRESS_CONTENT.collection.interactionId);

  pressKey(first, 'KeyE');
  assert.deepEqual(first.core.snapshot.progress.collections,
    [PROTOTYPE_PROGRESS_CONTENT.collection.businessId]);
  assert.match(first.core.snapshot.interaction.feedbackText, /\+1/);
  pressKey(first, 'KeyE');
  assert.equal(first.core.snapshot.progress.counts.collections, 1);
  assert.match(first.core.snapshot.interaction.feedbackText, /重复请求未新增/);

  placePlayer(first, 330);
  assert.notEqual(first.core.snapshot.interaction.selectedId,
    PROTOTYPE_PROGRESS_CONTENT.collection.interactionId);
  placePlayer(first, 390);
  pressKey(first, 'KeyE');
  assert.equal(first.core.snapshot.progress.counts.collections, 1);

  // A new temporary interaction/world object sees the same run progress by ID.
  const rebuilt = fixture(80, 472, 30, progress);
  placePlayer(rebuilt, 390);
  assert.equal(rebuilt.core.snapshot.progress.counts.collections, 1);
  pressKey(rebuilt, 'KeyE');
  assert.equal(rebuilt.core.snapshot.progress.counts.collections, 1);
});

test('D08 P03 goal and reward are recorded once; world effect is explicitly reconciled', () => {
  const progress = new InMemoryRunProgress();
  const instance = fixture(80, 472, 30, progress);
  placePlayer(instance, 460);
  assert.equal(instance.core.snapshot.interaction.selectedId,
    PROTOTYPE_PROGRESS_CONTENT.goal.interactionId);
  assert.equal(instance.world.progressRouteGate.collisionFilter.mask, 0x0002,
    'The test route gate starts with a real player collision mask');

  pressKey(instance, 'KeyE');
  instance.until(state => state.goalRoute.phase === 'succeeded');
  assert.deepEqual(instance.core.snapshot.progress.goals,
    [PROTOTYPE_PROGRESS_CONTENT.goal.businessId]);
  assert.deepEqual(instance.core.snapshot.progress.rewards,
    [PROTOTYPE_PROGRESS_CONTENT.goal.rewardId]);
  assert.deepEqual(instance.core.snapshot.progress.effects,
    [{ id: PROTOTYPE_PROGRESS_CONTENT.goal.effectId, expectedActive: true }]);
  assert.equal(instance.world.progressRouteOpen, true);
  assert.equal(instance.world.progressRouteGate.collisionFilter.mask, 0,
    'The permanent effect opens the route by disabling the real collision mask');
  assert.match(instance.core.snapshot.interaction.feedbackText, /Event #1.*Pending/);
  assert.equal(instance.core.snapshot.goalRoute.resultConsumptionCount, 1);
  assert.match(instance.core.snapshot.goalRoute.message, /链路完成/);

  pressKey(instance, 'KeyE');
  assert.equal(instance.core.snapshot.goalRoute.counts.commands, 1);
  assert.equal(instance.core.snapshot.goalRoute.counts.transactions, 1);
  progress.completeGoal(PROTOTYPE_PROGRESS_CONTENT.goal.businessId);
  instance.core.reset();
  assert.deepEqual(instance.core.snapshot.progress.counts, {
    collections: 0, goals: 1, rewards: 1, effects: 1,
  });
  assert.equal(instance.core.snapshot.progress.rewards.filter(id =>
    id === PROTOTYPE_PROGRESS_CONTENT.goal.rewardId).length, 1);
  assert.equal(instance.world.progressRouteOpen, true);
});

test('D08 P04 P05 permanent effect survives closed world reset and temporary object rebuild', () => {
  const progress = new InMemoryRunProgress();
  const first = fixture(80, 472, 30, progress);
  placePlayer(first, 460);
  pressKey(first, 'KeyE');
  first.until(state => state.goalRoute.phase === 'succeeded');
  assert.equal(first.world.progressRouteOpen, true);

  // Simulate a rebuilt temporary world starting with its initial closed effect.
  first.world.setPermanentEffect(PROTOTYPE_PROGRESS_CONTENT.goal.effectId, false);
  assert.equal(first.world.progressRouteOpen, false);
  assert.equal(first.world.progressRouteGate.collisionFilter.mask, 0x0002);
  first.core.reset();
  assert.equal(first.world.progressRouteOpen, true);
  assert.equal(first.world.progressRouteGate.collisionFilter.mask, 0);
  assert.deepEqual(first.core.snapshot.progress.counts, {
    collections: 0, goals: 1, rewards: 1, effects: 1,
  });
  assert.equal(first.core.snapshot.player.x, 80);
  assert.equal(first.core.snapshot.interaction.consumedCount, 0);

  const rebuilt = fixture(80, 472, 30, progress);
  assert.equal(rebuilt.world.progressRouteOpen, true);
  assert.deepEqual(rebuilt.core.snapshot.progress.rewards,
    [PROTOTYPE_PROGRESS_CONTENT.goal.rewardId]);

  const empty = fixture(80, 472, 30, new InMemoryRunProgress());
  assert.equal(empty.world.progressRouteOpen, false,
    'A fresh runtime fixture must not inherit another progress repository');
  assert.deepEqual(empty.core.snapshot.progress.counts, {
    collections: 0, goals: 0, rewards: 0, effects: 0,
  });
});

test('D08 P06 pause freezes progress and a held E does not replay interaction after resume', () => {
  const progress = new InMemoryRunProgress();
  const instance = fixture(80, 472, 30, progress);
  placePlayer(instance, 460);
  instance.core.key('KeyE', true);
  instance.step(2);
  const completed = instance.core.snapshot;
  assert.deepEqual(completed.progress.counts, {
    collections: 0, goals: 1, rewards: 1, effects: 1,
  });
  assert.equal(completed.interaction.consumedCount, 1);
  assert.equal(completed.interaction.needsRelease, false);
  assert.equal(completed.goalRoute.phase, 'result-pending');

  const owner = Symbol('test-pause-owner');
  instance.core.setAvailable(false);
  const token = instance.core.lifecycle.acquire(owner, Symbol('test-pause-request'));
  assert.ok(token);
  instance.core.frame(60000);
  assert.deepEqual(instance.core.snapshot.progress, completed.progress);
  assert.equal(instance.core.snapshot.interaction.consumedCount, 1);
  assert.equal(instance.core.snapshot.tick, completed.tick);
  assert.equal(instance.world.progressRouteOpen, true);

  assert.equal(instance.core.lifecycle.release(owner, token), 'released');
  instance.core.setAvailable(true);
  instance.core.frame(120000);
  instance.core.frame(120000 + instance.core.config.fixedDeltaMs);
  assert.deepEqual(instance.core.snapshot.progress, completed.progress);
  assert.equal(instance.core.snapshot.interaction.consumedCount, 1);
  assert.equal(instance.core.snapshot.interaction.needsRelease, true);
  assert.ok(instance.core.snapshot.tick <= completed.tick + 1);
  assert.ok(instance.core.snapshot.goalRoute.resultConsumptionCount <= 1);
  instance.core.key('KeyE', false);
});

test('D09-D1 H01-H02 real host input creates Event first and never repeats Command, Transaction or award', () => {
  const progress = new InMemoryRunProgress();
  const instance = fixture(80, 472, 30, progress);
  placePlayer(instance, 460);
  assert.equal(instance.core.snapshot.goalRoute.phase, 'idle');
  assert.equal(instance.world.progressRouteOpen, false);

  instance.core.key('KeyE', true);
  let snapshot = instance.core.snapshot;
  assert.equal(snapshot.goalRoute.phase, 'request-pending');
  assert.equal(snapshot.goalRoute.eventId, 1);
  assert.equal(snapshot.goalRoute.commandId, null);
  assert.deepEqual(snapshot.progress.counts, {
    collections: 0,
    goals: 0,
    rewards: 0,
    effects: 0,
  });
  assert.equal(instance.world.progressRouteOpen, false,
    'Creating a Pending Event must not modify the Matter gate');
  instance.core.key('KeyE', false);

  instance.step();
  snapshot = instance.core.snapshot;
  assert.equal(snapshot.goalRoute.phase, 'verifying');
  assert.equal(snapshot.goalRoute.commandId, 1);
  assert.equal(snapshot.goalRoute.transactionId, 1);
  assert.deepEqual(snapshot.progress.counts, {
    collections: 0,
    goals: 1,
    rewards: 1,
    effects: 1,
  });
  assert.equal(instance.world.progressRouteOpen, true);

  instance.core.key('KeyE', true);
  instance.core.key('KeyE', false);
  snapshot = instance.core.snapshot;
  assert.equal(snapshot.goalRoute.counts.commands, 1);
  assert.equal(snapshot.goalRoute.counts.transactions, 1);

  instance.until(state => state.goalRoute.phase === 'succeeded');
  snapshot = instance.core.snapshot;
  const identities = {
    runtimeInstanceId: snapshot.goalRoute.runtimeInstanceId,
    eventId: snapshot.goalRoute.eventId,
    commandId: snapshot.goalRoute.commandId,
    transactionId: snapshot.goalRoute.transactionId,
    resultEventId: snapshot.goalRoute.resultEventId,
  };
  assert.equal(identities.resultEventId, 2);
  assert.notEqual(identities.resultEventId, identities.eventId);
  assert.equal(snapshot.goalRoute.resultConsumptionCount, 1);
  assert.equal(snapshot.goalRoute.originalRetired, true);
  assert.equal(snapshot.goalRoute.resultRetired, true);

  const consumedBefore = snapshot.interaction.consumedCount;
  instance.core.key('KeyE', true);
  instance.core.key('KeyE', false);
  instance.step(2);
  snapshot = instance.core.snapshot;
  assert.equal(snapshot.interaction.consumedCount, consumedBefore + 1);
  assert.deepEqual({
    runtimeInstanceId: snapshot.goalRoute.runtimeInstanceId,
    eventId: snapshot.goalRoute.eventId,
    commandId: snapshot.goalRoute.commandId,
    transactionId: snapshot.goalRoute.transactionId,
    resultEventId: snapshot.goalRoute.resultEventId,
  }, identities);
  assert.deepEqual(snapshot.progress.counts, {
    collections: 0,
    goals: 1,
    rewards: 1,
    effects: 1,
  });
});

test('D09-D1 H03 pause freezes Pending and in-progress route work without catch-up', () => {
  const instance = fixture(80, 472, 30);
  placePlayer(instance, 460);
  instance.core.key('KeyE', true);
  instance.core.key('KeyE', false);
  const pending = instance.core.snapshot;
  assert.equal(pending.goalRoute.phase, 'request-pending');

  const pendingOwner = Symbol('d09-pending-pause');
  const pendingToken = instance.core.lifecycle.acquire(
    pendingOwner,
    Symbol('d09-pending-request'),
  );
  assert.ok(pendingToken);
  instance.core.frame(60000);
  assert.equal(instance.core.snapshot.tick, pending.tick);
  assert.equal(instance.core.snapshot.goalRoute.phase, 'request-pending');
  assert.equal(instance.core.snapshot.goalRoute.counts.inboxEvents, 1);
  assert.equal(instance.core.lifecycle.release(pendingOwner, pendingToken), 'released');

  let manualNow = 60000 + instance.core.config.fixedDeltaMs * 2;
  instance.core.frame(manualNow);
  manualNow += instance.core.config.fixedDeltaMs;
  instance.core.frame(manualNow);
  const applying = instance.core.snapshot;
  assert.equal(applying.goalRoute.phase, 'verifying');
  assert.equal(applying.goalRoute.applyTick, applying.tick);

  const transactionOwner = Symbol('d09-transaction-pause');
  const transactionToken = instance.core.lifecycle.acquire(
    transactionOwner,
    Symbol('d09-transaction-request'),
  );
  assert.ok(transactionToken);
  const frozen = instance.core.snapshot;
  instance.core.frame(120000);
  assert.equal(instance.core.snapshot.tick, frozen.tick);
  assert.equal(instance.core.snapshot.goalRoute.phase, 'verifying');
  assert.equal(instance.core.snapshot.goalRoute.verifyTick, null);
  assert.deepEqual(instance.core.snapshot.progress, frozen.progress);
  assert.equal(instance.core.lifecycle.release(transactionOwner, transactionToken), 'released');

  for (let index = 0; index < 8 && instance.core.snapshot.goalRoute.phase !== 'succeeded'; index++) {
    manualNow += instance.core.config.fixedDeltaMs;
    instance.core.frame(manualNow);
  }
  assert.equal(instance.core.snapshot.goalRoute.phase, 'succeeded');
  assert.equal(instance.core.snapshot.goalRoute.resultConsumptionCount, 1);
  assert.deepEqual(instance.core.snapshot.progress.counts, {
    collections: 0,
    goals: 1,
    rewards: 1,
    effects: 1,
  });
});

test('D09-D1 H04 debug reset preserves Pending identities and a completed run identity', () => {
  const instance = fixture(80, 472, 30);
  placePlayer(instance, 460);
  instance.core.key('KeyE', true);
  instance.core.key('KeyE', false);
  const pendingBeforeReset = instance.core.snapshot;
  instance.core.reset();
  assert.equal(instance.core.snapshot.goalRoute.runtimeInstanceId,
    pendingBeforeReset.goalRoute.runtimeInstanceId);
  assert.equal(instance.core.snapshot.goalRoute.eventId, pendingBeforeReset.goalRoute.eventId);
  assert.equal(instance.core.snapshot.goalRoute.phase, 'request-pending');
  assert.equal(instance.core.snapshot.progress.counts.goals, 0);
  instance.until(state => state.goalRoute.phase === 'succeeded');
  assert.equal(instance.core.snapshot.goalRoute.counts.commands, 1);
  assert.equal(instance.core.snapshot.goalRoute.counts.transactions, 1);
  assert.equal(instance.core.snapshot.progress.rewards.filter(id =>
    id === PROTOTYPE_PROGRESS_CONTENT.goal.rewardId).length, 1);

  const completedBeforeReset = instance.core.snapshot;
  instance.core.reset();
  const completedAfterReset = instance.core.snapshot;
  assert.equal(completedAfterReset.goalRoute.runtimeInstanceId,
    completedBeforeReset.goalRoute.runtimeInstanceId);
  assert.equal(completedAfterReset.goalRoute.eventId, completedBeforeReset.goalRoute.eventId);
  assert.equal(completedAfterReset.goalRoute.commandId, completedBeforeReset.goalRoute.commandId);
  assert.equal(completedAfterReset.goalRoute.transactionId,
    completedBeforeReset.goalRoute.transactionId);
  assert.equal(completedAfterReset.goalRoute.resultEventId,
    completedBeforeReset.goalRoute.resultEventId);
  assert.equal(completedAfterReset.goalRoute.phase, 'succeeded');
  assert.equal(instance.world.progressRouteOpen, true);
  assert.deepEqual(completedAfterReset.progress.counts, {
    collections: 0,
    goals: 1,
    rewards: 1,
    effects: 1,
  });
});

test('D10-A1 CP02 real graybox captures both platforms after permanent reconciliation before Tick 1', () => {
  const progress = new InMemoryRunProgress();
  progress.completeGoal(PROTOTYPE_PROGRESS_CONTENT.goal.businessId);
  const engine = M.Engine.create();
  const world = new MatterGrayboxWorld(M, engine, dt => M.Engine.update(engine, dt));
  const originalCapture = world.captureTemporaryObject.bind(world);
  const captureObservations = [];
  world.captureTemporaryObject = objectId => {
    captureObservations.push({
      objectId,
      routeOpen: world.progressRouteOpen,
      matterSteps: world.steps,
    });
    return originalCapture(objectId);
  };
  const core = createGrayboxCore(world, {
    progress,
    uuidProvider: { generate: fixtureRuntimeId },
  });
  const initial = core.snapshot;
  const record = initial.checkpointSnapshot.current;

  assert.equal(initial.tick, 0);
  assert.equal(initial.physicsSteps, 0);
  assert.equal(initial.checkpointSnapshot.status, 'READY');
  assert.equal(initial.checkpointSnapshot.captureAttempts, 1);
  assert.equal(initial.checkpointSnapshot.capturedAtTick, 0);
  assert.ok(record);
  assert.equal(record.runtimeInstanceId, initial.goalRoute.runtimeInstanceId);
  assert.equal(record.schemaVersion, 1);
  assert.deepEqual(record.anchor, { x: 80, y: 472, facing: 1 });
  assert.deepEqual(record.objects.map(object => object.objectId), [
    'moving-horizontal-a',
    'moving-vertical-a',
  ]);
  assert.deepEqual(record.objects.map(object => object.stateVersion), [1, 1]);
  assert.deepEqual(captureObservations, [
    { objectId: 'moving-horizontal-a', routeOpen: true, matterSteps: 0 },
    { objectId: 'moving-vertical-a', routeOpen: true, matterSteps: 0 },
  ]);
  assert.equal(world.progressRouteOpen, true);
  assert.deepEqual(initial.progress.counts, {
    collections: 0,
    goals: 1,
    rewards: 1,
    effects: 1,
  });
  const serialized = JSON.stringify(record);
  assert.equal(serialized.includes(PROTOTYPE_PROGRESS_CONTENT.goal.businessId), false);
  assert.equal(serialized.includes(PROTOTYPE_PROGRESS_CONTENT.goal.rewardId), false);
  assert.equal(serialized.includes(PROTOTYPE_PROGRESS_CONTENT.goal.effectId), false);

  let frame = 0;
  for (let index = 0; index < 40; index++) core.frame(frame++ * core.config.fixedDeltaMs);
  assert.equal(JSON.stringify(core.snapshot.checkpointSnapshot.current), serialized,
    'Captured data must not track later platform motion');
});

test('D10-A1 CP05 failed initialization keeps movement, jump, interaction and debug reset locked', () => {
  let firstCaptureCount = 0;
  const instance = fixture(80, 472, 0, undefined, {
    snapshotFaultInjector: (phase, details) => {
      if (phase === 'capture' && details.objectId === 'moving-vertical-a') {
        throw new Error('injected second-object capture failure');
      }
      if (phase === 'capture') firstCaptureCount++;
    },
  });
  const failed = instance.core.snapshot;
  assert.equal(failed.checkpointSnapshot.status, 'FAILED');
  assert.equal(failed.checkpointSnapshot.current, null);
  assert.match(failed.checkpointSnapshot.error, /injected second-object/);
  assert.equal(failed.checkpointSnapshot.captureAttempts, 1);
  assert.equal(failed.player.controlAllowed, false);
  assert.equal(failed.player.x, 80);
  assert.equal(failed.interaction.consumedCount, 0);
  assert.equal(firstCaptureCount, 1);

  instance.core.setAvailable(true);
  instance.core.key('KeyD', true);
  instance.core.key('Space', true);
  instance.core.key('KeyE', true);
  instance.step(12);
  let locked = instance.core.snapshot;
  assert.equal(locked.player.controlAllowed, false);
  assert.ok(Math.abs(locked.player.x - 80) < 0.1);
  assert.equal(locked.player.jumps, 0);
  assert.equal(locked.interaction.consumedCount, 0);

  instance.core.reset();
  locked = instance.core.snapshot;
  assert.equal(locked.player.controlAllowed, false);
  assert.equal(locked.checkpointSnapshot.captureAttempts, 1);
  assert.equal(locked.checkpointSnapshot.status, 'FAILED');
  assert.equal(locked.checkpointSnapshot.current, null);
});

test('D10-A1 CP05 successful owner release composes with other locks; R and goal E preserve the backup', () => {
  const instance = fixture();
  const initial = instance.core.snapshot;
  const initialPayload = JSON.stringify(initial.checkpointSnapshot.current);
  const runtimeInstanceId = initial.goalRoute.runtimeInstanceId;
  assert.equal(initial.checkpointSnapshot.status, 'READY');
  assert.equal(initial.player.controlAllowed, true);

  instance.core.setAvailable(false);
  assert.equal(instance.core.snapshot.player.controlAllowed, false);
  instance.core.setAvailable(true);
  assert.equal(instance.core.snapshot.player.controlAllowed, true);

  instance.core.reset();
  const afterReset = instance.core.snapshot;
  assert.equal(afterReset.checkpointSnapshot.captureAttempts, 1);
  assert.equal(JSON.stringify(afterReset.checkpointSnapshot.current), initialPayload);
  assert.equal(afterReset.goalRoute.runtimeInstanceId, runtimeInstanceId);

  placePlayer(instance, 460);
  assert.equal(instance.core.snapshot.interaction.selectedId,
    PROTOTYPE_PROGRESS_CONTENT.goal.interactionId);
  pressKey(instance, 'KeyE');
  instance.until(state => state.goalRoute.phase === 'succeeded');
  const completed = instance.core.snapshot;
  assert.deepEqual(completed.progress.counts, {
    collections: 0,
    goals: 1,
    rewards: 1,
    effects: 1,
  });
  assert.equal(instance.world.progressRouteOpen, true);
  assert.equal(completed.checkpointSnapshot.captureAttempts, 1);
  assert.equal(JSON.stringify(completed.checkpointSnapshot.current), initialPayload);

  instance.core.reset();
  const resetAfterCompletion = instance.core.snapshot;
  assert.equal(resetAfterCompletion.checkpointSnapshot.captureAttempts, 1);
  assert.equal(JSON.stringify(resetAfterCompletion.checkpointSnapshot.current), initialPayload);
  assert.equal(resetAfterCompletion.goalRoute.runtimeInstanceId, runtimeInstanceId);
  assert.deepEqual(resetAfterCompletion.progress.counts, {
    collections: 0,
    goals: 1,
    rewards: 1,
    effects: 1,
  });
  assert.equal(instance.world.progressRouteOpen, true);
});
