import assert from 'node:assert/strict';

const poll = { polling: 'raf', timeout: 12000 };
const rawSample = page => page.locator('#diagnostics').evaluate(element => ({ ...element.dataset }));
const parseSample = data => ({ tick: +data.tick, x: +data.x, y: +data.y, vx: +data.vx, vy: +data.vy,
  worldVx: +data.worldVx, worldVy: +data.worldVy, supportVx: +data.supportVx, supportVy: +data.supportVy,
  grounded: data.grounded === 'true', jumps: +data.jumps, support: data.support,
  physicsSteps: +data.physicsSteps, physicsTime: +data.physicsTime, discarded: +data.discarded,
  paused: data.paused === 'true', tokens: +data.tokens, control: data.controlAllowed === 'true',
  needsRelease: data.needsRelease === 'true', oneWayCollision: data.oneWayCollision === 'true',
  platformClock: +data.platformClock,
  movingHX: +data.movingHX, movingHY: +data.movingHY, movingHVx: +data.movingHVx,
  movingHDirection: +data.movingHDirection, movingHPhase: +data.movingHPhase, movingHCycle: +data.movingHCycle,
  movingVX: +data.movingVX, movingVY: +data.movingVY, movingVVy: +data.movingVVy,
  movingVDirection: +data.movingVDirection, movingVPhase: +data.movingVPhase, movingVCycle: +data.movingVCycle,
  supportRelativeX: data.supportRelativeX === '' ? null : +data.supportRelativeX,
  supportRelativeY: data.supportRelativeY === '' ? null : +data.supportRelativeY });
const sample = async page => parseSample(await rawSample(page));

export async function chooseScene(ctx, mode) {
  await ctx.show();
  await ctx.page.waitForFunction(() => document.querySelector('#restart')?.disabled === false, undefined, { timeout: 15000, polling: 100 });
  if (await ctx.page.locator('#scene-select').inputValue() !== mode) {
    await ctx.monitor.navigation('scene-switch-' + mode);
    await Promise.all([
      ctx.page.waitForEvent('framenavigated', { predicate: frame => frame === ctx.page.mainFrame() }),
      ctx.page.locator('#scene-select').selectOption(mode),
    ]);
  }
  await ctx.page.waitForFunction(mode => document.querySelector('#diagnostics')?.dataset.mode === mode &&
    document.querySelector('#restart')?.disabled === false, mode, { timeout: 15000, polling: 100 });
  await ctx.show();
}

export async function checkGraybox(ctx, record, capture) {
  const page = ctx.page;
  const key = (code, down) => ctx.monitor.key(code, down);
  await chooseScene(ctx, 'graybox');
  await ctx.show();
  const up = async () => { for (const code of ['KeyA', 'KeyD', 'ArrowLeft', 'ArrowRight', 'Space']) await key(code, false); };
  const reset = async () => {
    await ctx.show();
    await up();
    const before = await page.locator('#diagnostics').getAttribute('data-resets');
    await page.locator('#reset-graybox').click();
    await page.waitForFunction(before => {
      const d = document.querySelector('#diagnostics')?.dataset;
      return d?.resets !== before && d?.grounded === 'true' && d.controlAllowed === 'true';
    }, before, poll);
  };
  const traceStart = () => page.evaluate(() => {
    window.__grayboxTrace = [];
    const collect = () => {
      const d = document.querySelector('#diagnostics').dataset;
      window.__grayboxTrace.push({ x: +d.x, y: +d.y, vx: +d.vx, vy: +d.vy,
        worldVx: +d.worldVx, worldVy: +d.worldVy, supportVx: +d.supportVx, supportVy: +d.supportVy,
        jumps: +d.jumps, wall: d.wall === 'true', ceiling: d.ceiling === 'true',
        grounded: d.grounded === 'true', support: d.support,
        oneWayCollision: d.oneWayCollision === 'true',
        platformClock: +d.platformClock, movingHX: +d.movingHX, movingHY: +d.movingHY,
        movingHVx: +d.movingHVx, movingHDirection: +d.movingHDirection,
        movingVX: +d.movingVX, movingVY: +d.movingVY, movingVVy: +d.movingVVy,
        movingVDirection: +d.movingVDirection,
        supportRelativeX: d.supportRelativeX === '' ? null : +d.supportRelativeX,
        supportRelativeY: d.supportRelativeY === '' ? null : +d.supportRelativeY });
      window.__grayboxTraceRAF = requestAnimationFrame(collect);
    };
    collect();
  });
  const traceStop = () => page.evaluate(() => {
    cancelAnimationFrame(window.__grayboxTraceRAF);
    return window.__grayboxTrace;
  });
  const run = async (name, fn) => {
    ctx.operation = 'graybox-' + name;
    ctx.stage = ctx.operation;
    await ctx.show();
    await page.waitForFunction(() => document.visibilityState === 'visible' && document.hasFocus(), undefined, poll);
    const result = await ctx.monitor.race(fn);
    record(name, { status: 'PASS', ...result });
    console.log('PASS', ctx.label, 'graybox', name, JSON.stringify(result));
  };
  await run('movement-reversal-air-control', async () => {
    await reset();
    await key('KeyD', true);
    await page.waitForTimeout(400);
    const moving = await sample(page);
    assert.ok(moving.x > 120 && moving.vx > 190);
    await key('KeyD', false); await key('KeyA', true);
    const reversing = await sample(page);
    assert.ok(reversing.vx > 0);
    await page.waitForTimeout(250);
    const left = await sample(page);
    assert.ok(left.vx < -150);
    await key('KeyA', false); await key('Space', true); await key('KeyD', true);
    await page.waitForFunction(() => {
      const d = document.querySelector('#diagnostics').dataset;
      return +d.jumps === 1 && d.grounded === 'false' && +d.vx > 100;
    }, undefined, poll);
    const air = await sample(page);
    assert.ok(air.jumps === 1 && !air.grounded && air.vx > 100);
    await up();
    return { movingX: moving.x, reversedVx: left.vx, airVx: air.vx };
  });
  const jumpPeak = async short => {
    await reset(); await traceStart();
    await key('Space', true);
    if (short) { await page.waitForTimeout(30); await key('Space', false); }
    await page.waitForTimeout(1000);
    if (!short) { await key('Space', true); await page.waitForTimeout(180); }
    const end = await sample(page), frames = await traceStop();
    assert.equal(end.jumps, 1);
    assert.equal(end.grounded, true);
    await key('Space', false);
    return Math.min(...frames.map(p => p.y));
  };
  await run('short-long-single-press', async () => {
    const shortPeak = await jumpPeak(true), longPeak = await jumpPeak(false);
    assert.ok(shortPeak - longPeak > 25, JSON.stringify({ shortPeak, longPeak }));
    return { shortPeak, longPeak, heldSpaceJumpCount: 1 };
  });
  await run('ground-ceiling-wall', async () => {
    await reset();
    await key('KeyD', true);
    await page.waitForFunction(() => +document.querySelector('#diagnostics').dataset.x > 265, undefined, poll);
    await key('KeyD', false); await page.waitForTimeout(180);
    await traceStart(); await key('Space', true); await page.waitForTimeout(600); await key('Space', false);
    const roofFrames = await traceStop();
    const roofMinY = Math.min(...roofFrames.map(p => p.y));
    assert.ok(roofMinY >= 451 && roofFrames.some(p => p.ceiling));
    await key('KeyD', true);
    await page.waitForFunction(() => document.querySelector('#diagnostics').dataset.wall === 'true', undefined, poll);
    await page.waitForTimeout(250);
    const wall = await sample(page);
    assert.ok(wall.x <= 507 && wall.grounded);
    await key('KeyD', false);
    return { roofMinY, ceilingContact: true, wallX: wall.x, groundY: wall.y };
  });
  await run('buffer-once-and-expiry', async () => {
    await reset(); await key('Space', true);
    await page.waitForFunction(() => {
      const d = document.querySelector('#diagnostics').dataset;
      return +d.jumps === 1 && +d.vy > 0 && +d.y > 447 && d.grounded === 'false';
    }, undefined, poll);
    await key('Space', false); await key('Space', true); await key('Space', false);
    await page.waitForFunction(() => +document.querySelector('#diagnostics').dataset.jumps === 2, undefined, poll);
    await traceStart(); await page.waitForTimeout(700);
    const frames = await traceStop(), end = await sample(page);
    assert.equal(end.jumps, 2);
    assert.ok(Math.min(...frames.map(p => p.y)) > 425);
    await reset(); await key('Space', true);
    await page.waitForFunction(() => {
      const d = document.querySelector('#diagnostics').dataset;
      return +d.vy > 0 && +d.y < 400;
    }, undefined, poll);
    await key('Space', false); await key('Space', true); await key('Space', false);
    await page.waitForTimeout(800);
    assert.equal((await sample(page)).jumps, 1);
    return { bufferedJumpCount: end.jumps, releasedBufferLowJump: true, expiredJumpCount: 1 };
  });
  await run('coyote-gap-and-slope', async () => {
    await reset(); await key('KeyD', true);
    await page.waitForFunction(() => +document.querySelector('#diagnostics').dataset.x > 425, undefined, poll);
    await key('Space', true);
    await page.waitForFunction(() => +document.querySelector('#diagnostics').dataset.x > 600, undefined, poll);
    await key('Space', false);
    await page.waitForFunction(() => {
      const d = document.querySelector('#diagnostics').dataset;
      return +d.x > 880 && d.grounded === 'false';
    }, undefined, poll);
    const edge = await sample(page);
    await key('Space', true);
    await page.waitForFunction(jumps => +document.querySelector('#diagnostics').dataset.jumps > jumps, edge.jumps, poll);
    await page.waitForFunction(() => +document.querySelector('#diagnostics').dataset.x > 1030 &&
      document.querySelector('#diagnostics').dataset.grounded === 'true', undefined, poll);
    await key('Space', false);
    const crossed = await sample(page);
    await traceStart();
    await page.waitForFunction(() => +document.querySelector('#diagnostics').dataset.x > 1490, undefined, poll);
    const slopeFrames = (await traceStop()).filter(p => p.x > 1370 && p.x < 1480);
    assert.ok(slopeFrames.length > 10 && slopeFrames.every(p => p.grounded), 'Ascent must preserve validated support');
    await key('KeyD', false); await page.waitForTimeout(400);
    const stopped = await sample(page);
    assert.equal(stopped.support, 'continuous-slope');
    await page.waitForTimeout(800);
    const idle = await sample(page);
    assert.ok(Math.abs(idle.x - stopped.x) < 1 && Math.abs(idle.y - stopped.y) < 1);
    await key('ArrowRight', true);
    await page.waitForFunction(() => +document.querySelector('#diagnostics').dataset.x > 1710, undefined, poll);
    await key('ArrowRight', false);
    const upper = await sample(page);
    assert.ok(upper.y < 365);
    await key('ArrowLeft', true);
    await page.waitForFunction(() => +document.querySelector('#diagnostics').dataset.x < 1430, undefined, poll);
    await key('ArrowLeft', false); await page.waitForTimeout(250);
    const down = await sample(page);
    assert.ok(down.grounded && down.y > upper.y + 50);
    return { edgeX: edge.x, crossedX: crossed.x, stoppedX: stopped.x, idleDrift: idle.x - stopped.x,
      upperY: upper.y, downhillY: down.y };
  });
  const navigateToGroundBAt = async targetX => {
    await reset();
    await key('KeyD', true);
    await page.waitForFunction(() => +document.querySelector('#diagnostics').dataset.x > 425, undefined, poll);
    await key('Space', true);
    await page.waitForFunction(() => +document.querySelector('#diagnostics').dataset.x > 600, undefined, poll);
    await key('Space', false);
    await page.waitForFunction(() => {
      const d = document.querySelector('#diagnostics').dataset;
      return +d.x > 880 && d.grounded === 'false';
    }, undefined, poll);
    const edgeJumps = (await sample(page)).jumps;
    await key('Space', true);
    await page.waitForFunction(jumps => +document.querySelector('#diagnostics').dataset.jumps > jumps, edgeJumps, poll);
    await page.waitForFunction(() => {
      const d = document.querySelector('#diagnostics').dataset;
      return +d.x > 1030 && d.grounded === 'true';
    }, undefined, poll);
    await key('Space', false);
    await page.waitForFunction(x => +document.querySelector('#diagnostics').dataset.x > x, targetX, poll);
    await key('KeyD', false);
    await page.waitForFunction(() => {
      const d = document.querySelector('#diagnostics').dataset;
      return d.grounded === 'true' && d.support === 'ground-b';
    }, undefined, poll);
  };
  const navigateToUpperGroundAt = async targetX => {
    await reset();
    await key('KeyD', true);
    await page.waitForFunction(() => +document.querySelector('#diagnostics').dataset.x > 425, undefined, poll);
    await key('Space', true);
    await page.waitForFunction(() => +document.querySelector('#diagnostics').dataset.x > 600, undefined, poll);
    await key('Space', false);
    await page.waitForFunction(() => {
      const d = document.querySelector('#diagnostics').dataset;
      return +d.x > 880 && d.grounded === 'false';
    }, undefined, poll);
    const edgeJumps = (await sample(page)).jumps;
    await key('Space', true);
    await page.waitForFunction(jumps => +document.querySelector('#diagnostics').dataset.jumps > jumps, edgeJumps, poll);
    await page.waitForFunction(() => {
      const d = document.querySelector('#diagnostics').dataset;
      return +d.x > 1030 && d.grounded === 'true';
    }, undefined, poll);
    await key('Space', false);
    await page.waitForFunction(x => +document.querySelector('#diagnostics').dataset.x > x, targetX, poll);
    await key('KeyD', false);
    await page.waitForFunction(() => {
      const d = document.querySelector('#diagnostics').dataset;
      return d.grounded === 'true' && d.support === 'upper-ground';
    }, undefined, poll);
  };
  await run('P01-P06-solid-and-one-way-platforms', async () => {
    await navigateToGroundBAt(1155);

    const solidJump = (await sample(page)).jumps;
    await traceStart();
    await key('Space', true);
    await page.waitForFunction(jumps => {
      const d = document.querySelector('#diagnostics').dataset;
      return +d.jumps > jumps && +d.y < 460;
    }, solidJump, poll);
    await page.waitForFunction(() => {
      const d = document.querySelector('#diagnostics').dataset;
      return d.grounded === 'true' && d.support === 'ground-b';
    }, undefined, poll);
    await key('Space', false);
    const solidFrames = await traceStop();
    const solidMinY = Math.min(...solidFrames.map(point => point.y));
    assert.ok(solidMinY >= 429 && solidFrames.some(point => point.ceiling),
      JSON.stringify({ solidMinY, ceilingFrames: solidFrames.filter(point => point.ceiling).length }));

    await key('KeyA', true);
    await page.waitForFunction(() => +document.querySelector('#diagnostics').dataset.x < 1080, undefined, poll);
    await key('KeyA', false);
    await page.waitForFunction(() => {
      const d = document.querySelector('#diagnostics').dataset;
      return d.grounded === 'true' && d.support === 'ground-b';
    }, undefined, poll);

    const beforeShort = (await sample(page)).jumps;
    await traceStart();
    await key('Space', true);
    await page.waitForTimeout(30);
    await key('Space', false);
    await page.waitForTimeout(900);
    const shortFrames = await traceStop();
    assert.equal((await sample(page)).jumps, beforeShort + 1);
    assert.ok(Math.min(...shortFrames.map(point => point.y)) > 420);
    assert.equal(shortFrames.some(point => point.support === 'one-way-platform-a'), false);

    await traceStart();
    await key('Space', true);
    await page.waitForFunction(() => document.querySelector('#diagnostics').dataset.support === 'one-way-platform-a', undefined, poll);
    const beforeHeld = await sample(page);
    const oneWayFrames = await traceStop();
    assert.equal(beforeHeld.oneWayCollision, true);
    assert.equal(beforeHeld.grounded, true);
    assert.equal(oneWayFrames.some(point => point.ceiling), false);
    assert.ok(Math.min(...oneWayFrames.map(point => point.y)) < 388);
    await page.waitForTimeout(400);
    assert.equal((await sample(page)).jumps, beforeHeld.jumps, 'Held Space must not auto-repeat on a one-way platform');

    await key('ArrowDown', true);
    await page.waitForTimeout(180);
    const downHeld = await sample(page);
    await key('ArrowDown', false);
    assert.equal(downHeld.support, 'one-way-platform-a');
    assert.ok(Math.abs(downHeld.y - 388) < 2);

    await ctx.hide();
    await page.waitForFunction(() => document.visibilityState === 'hidden' &&
      document.querySelector('#diagnostics').dataset.paused === 'true', undefined, { polling: 100 });
    const frozen = await sample(page);
    assert.equal(frozen.control, false);
    await page.waitForTimeout(500);
    assert.deepEqual(await sample(page), frozen);
    await page.evaluate(() => {
      window.__oneWayResume = new Promise(resolve => {
        const changed = () => {
          if (document.visibilityState !== 'visible') return;
          document.removeEventListener('visibilitychange', changed);
          requestAnimationFrame(() => resolve({ ...document.querySelector('#diagnostics').dataset }));
        };
        document.addEventListener('visibilitychange', changed);
      });
    });
    await ctx.show();
    const resumed = await page.evaluate(() => window.__oneWayResume);
    assert.ok(+resumed.tick - frozen.tick <= 5);
    assert.equal(+resumed.discarded, frozen.discarded);
    assert.equal(resumed.needsRelease, 'true');
    assert.equal(resumed.support, 'one-way-platform-a');
    await key('Space', true);
    await page.waitForTimeout(500);
    const recovered = await sample(page);
    assert.equal(recovered.jumps, frozen.jumps);
    assert.equal(recovered.support, 'one-way-platform-a');

    await up();
    await key('KeyD', true);
    await key('Space', true);
    await page.waitForTimeout(30);
    await key('Space', false);
    await page.waitForFunction(() => {
      const d = document.querySelector('#diagnostics').dataset;
      return d.grounded === 'true' && d.support === 'solid-platform-b';
    }, undefined, poll);
    await key('KeyD', false);
    const solidTop = await sample(page);
    assert.ok(solidTop.y < 390 && solidTop.y > 365);

    await up();
    await key('Space', true);
    await page.waitForFunction(() => {
      const d = document.querySelector('#diagnostics').dataset;
      return +d.vy < 0 && +d.y < 360;
    }, undefined, poll);
    const crossingX = (await sample(page)).x;
    await reset();
    await page.waitForFunction(() => {
      const d = document.querySelector('#diagnostics').dataset;
      return +d.x === 80 && d.oneWayCollision === 'false';
    }, undefined, poll);
    return { solidMinY, shortPeak: Math.min(...shortFrames.map(point => point.y)),
      oneWayPeak: Math.min(...oneWayFrames.map(point => point.y)), frozenTick: frozen.tick,
      resumedTick: +resumed.tick, solidTopY: solidTop.y, resetDuringCrossingX: crossingX };
  });
  await run('D04-M01-M04-moving-platform-carriage', async () => {
    await navigateToUpperGroundAt(1835);
    await page.waitForFunction(() => +document.querySelector('#diagnostics').dataset.movingHX < 1765, undefined, poll);
    await key('KeyA', true);
    await key('Space', true);
    await page.waitForTimeout(450);
    await key('KeyA', false);
    await page.waitForFunction(() => document.querySelector('#diagnostics').dataset.support === 'moving-horizontal-a',
      undefined, poll);
    await key('Space', false);
    await page.waitForFunction(() => Math.abs(+document.querySelector('#diagnostics').dataset.vx) < 1 &&
      document.querySelector('#diagnostics').dataset.support === 'moving-horizontal-a', undefined, poll);
    const horizontalLanded = await sample(page);
    assert.equal(horizontalLanded.grounded, true);
    assert.ok(Math.abs(horizontalLanded.supportRelativeX) < 45);
    assert.ok(Math.abs(horizontalLanded.supportRelativeY + 31) < 1);
    assert.ok(Math.abs(horizontalLanded.worldVx - horizontalLanded.supportVx) < 1);

    await page.waitForTimeout(700);
    const horizontalCarried = await sample(page);
    assert.equal(horizontalCarried.support, 'moving-horizontal-a');
    assert.ok(Math.abs(horizontalCarried.supportRelativeX - horizontalLanded.supportRelativeX) < 0.6);
    assert.ok(horizontalCarried.platformClock > horizontalLanded.platformClock);
    await capture('D04-horizontal-carriage', true);

    const relativeBeforeWalk = horizontalCarried.supportRelativeX;
    await key('KeyA', true);
    await page.waitForTimeout(200);
    await key('KeyA', false);
    await page.waitForFunction(() => Math.abs(+document.querySelector('#diagnostics').dataset.vx) < 1 &&
      document.querySelector('#diagnostics').dataset.support === 'moving-horizontal-a', undefined, poll);
    const walkedLeft = await sample(page);
    assert.equal(walkedLeft.support, 'moving-horizontal-a');
    assert.ok(walkedLeft.supportRelativeX < relativeBeforeWalk - 2);
    await key('KeyD', true);
    await page.waitForTimeout(120);
    await key('KeyD', false);
    await page.waitForFunction(() => Math.abs(+document.querySelector('#diagnostics').dataset.vx) < 1 &&
      document.querySelector('#diagnostics').dataset.support === 'moving-horizontal-a', undefined, poll);
    const walkedRight = await sample(page);
    assert.equal(walkedRight.support, 'moving-horizontal-a');
    assert.ok(walkedRight.supportRelativeX > walkedLeft.supportRelativeX + 2);
    await key('KeyA', true);
    await page.waitForTimeout(100);
    await key('KeyA', false);
    await page.waitForFunction(() => Math.abs(+document.querySelector('#diagnostics').dataset.vx) < 1 &&
      document.querySelector('#diagnostics').dataset.support === 'moving-horizontal-a', undefined, poll);
    const reversedWalk = await sample(page);
    assert.equal(reversedWalk.support, 'moving-horizontal-a');
    assert.ok(reversedWalk.supportRelativeX < walkedRight.supportRelativeX);

    const horizontalJumpBefore = reversedWalk.jumps;
    await traceStart();
    await key('Space', true);
    await page.waitForFunction(jumps => {
      const d = document.querySelector('#diagnostics').dataset;
      return +d.jumps > jumps && d.grounded === 'false';
    }, horizontalJumpBefore, poll);
    const horizontalAir = await sample(page);
    assert.equal(horizontalAir.support, '');
    assert.ok(Math.abs(horizontalAir.worldVx - horizontalAir.supportVx) < 1,
      'Airborne player must not inherit horizontal platform velocity');
    await key('Space', false);
    await page.waitForFunction(() => document.querySelector('#diagnostics').dataset.support === 'moving-horizontal-a',
      undefined, poll);
    const horizontalJumped = await sample(page);
    const horizontalJumpFrames = await traceStop();
    assert.equal(horizontalJumped.jumps, horizontalJumpBefore + 1);
    const relativeBeforeReversal = horizontalJumped.supportRelativeX;
    const horizontalDirection = horizontalJumped.movingHDirection;
    await page.waitForFunction(direction =>
      +document.querySelector('#diagnostics').dataset.movingHDirection !== direction,
    horizontalDirection, { polling: 100, timeout: 6000 });
    const horizontalReversed = await sample(page);
    assert.equal(horizontalReversed.support, 'moving-horizontal-a');
    assert.ok(Math.abs(horizontalReversed.supportRelativeX - relativeBeforeReversal) < 0.7);

    await navigateToUpperGroundAt(1835);
    await page.waitForFunction(() => {
      const d = document.querySelector('#diagnostics').dataset;
      return +d.movingVY > 302 && +d.movingVDirection === 1;
    }, undefined, poll);
    await key('KeyD', true);
    await key('Space', true);
    await page.waitForTimeout(500);
    await key('KeyD', false);
    await page.waitForFunction(() => document.querySelector('#diagnostics').dataset.support === 'moving-vertical-a',
      undefined, poll);
    await key('Space', false);
    await page.waitForFunction(() => Math.abs(+document.querySelector('#diagnostics').dataset.vx) < 1 &&
      document.querySelector('#diagnostics').dataset.support === 'moving-vertical-a', undefined, poll);
    const verticalLanded = await sample(page);
    assert.equal(verticalLanded.grounded, true);
    assert.ok(Math.abs(verticalLanded.supportRelativeY + 31) < 1);
    await page.waitForTimeout(700);
    const verticalCarried = await sample(page);
    assert.equal(verticalCarried.support, 'moving-vertical-a');
    assert.ok(Math.abs(verticalCarried.supportRelativeY - verticalLanded.supportRelativeY) < 0.7);
    assert.ok(Math.abs(verticalCarried.worldVy - verticalCarried.supportVy) < 1);
    await capture('D04-vertical-carriage', true);

    const verticalDirection = verticalCarried.movingVDirection;
    await page.waitForFunction(direction =>
      +document.querySelector('#diagnostics').dataset.movingVDirection !== direction,
    verticalDirection, { polling: 100, timeout: 6000 });
    const verticalReversed = await sample(page);
    assert.equal(verticalReversed.support, 'moving-vertical-a');
    assert.ok(Math.abs(verticalReversed.supportRelativeY - verticalCarried.supportRelativeY) < 0.7);

    const verticalJumpBefore = verticalReversed.jumps;
    await traceStart();
    await key('Space', true);
    await page.waitForFunction(jumps => {
      const d = document.querySelector('#diagnostics').dataset;
      return +d.jumps > jumps && d.grounded === 'false';
    }, verticalJumpBefore, poll);
    await key('Space', false);
    await page.waitForFunction(() => document.querySelector('#diagnostics').dataset.support === 'moving-vertical-a',
      undefined, poll);
    const verticalJumped = await sample(page);
    const verticalJumpFrames = await traceStop();
    assert.equal(verticalJumped.jumps, verticalJumpBefore + 1);
    await up();
    return {
      horizontal: { support: horizontalReversed.support, x: horizontalReversed.movingHX,
        y: horizontalReversed.movingHY, phase: horizontalReversed.movingHPhase,
        direction: horizontalReversed.movingHDirection, cycle: horizontalReversed.movingHCycle,
        relativeX: horizontalReversed.supportRelativeX },
      vertical: { support: verticalReversed.support, x: verticalReversed.movingVX,
        y: verticalReversed.movingVY, phase: verticalReversed.movingVPhase,
        direction: verticalReversed.movingVDirection, cycle: verticalReversed.movingVCycle,
        relativeY: verticalReversed.supportRelativeY },
      horizontalJumpPeakY: Math.min(...horizontalJumpFrames.map(point => point.y)),
      horizontalJumpCount: horizontalJumped.jumps,
      verticalJumpPeakY: Math.min(...verticalJumpFrames.map(point => point.y)),
      verticalJumpCount: verticalJumped.jumps,
      airborneSupportVelocity: { horizontal: horizontalAir.supportVx, vertical: verticalCarried.supportVy },
      platformClock: verticalJumped.platformClock,
    };
  });
  await run('D04-M05-M06-platform-pause-reset', async () => {
    await navigateToUpperGroundAt(1835);
    await page.waitForFunction(() => +document.querySelector('#diagnostics').dataset.movingHX < 1765, undefined, poll);
    await key('KeyA', true);
    await key('Space', true);
    await page.waitForTimeout(450);
    await key('KeyA', false);
    await page.waitForFunction(() => document.querySelector('#diagnostics').dataset.support === 'moving-horizontal-a',
      undefined, poll);
    await key('Space', false);
    const before = await sample(page);
    await ctx.hide();
    await page.waitForFunction(() => document.visibilityState === 'hidden' &&
      document.querySelector('#diagnostics').dataset.paused === 'true', undefined, { polling: 100 });
    const frozen = await sample(page);
    assert.equal(frozen.control, false);
    await page.waitForTimeout(1200);
    assert.deepEqual(await sample(page), frozen);
    await page.evaluate(() => {
      window.__movingPlatformResume = new Promise(resolve => {
        const changed = () => {
          if (document.visibilityState !== 'visible') return;
          document.removeEventListener('visibilitychange', changed);
          requestAnimationFrame(() => resolve({ ...document.querySelector('#diagnostics').dataset }));
        };
        document.addEventListener('visibilitychange', changed);
      });
    });
    await ctx.show();
    const resumed = await page.evaluate(() => window.__movingPlatformResume);
    assert.ok(+resumed.tick - frozen.tick <= 5);
    assert.ok(Math.abs(
      +resumed.platformClock - frozen.platformClock -
      (+resumed.physicsSteps - frozen.physicsSteps) * (1000 / 60),
    ) < 0.01);
    assert.equal(resumed.needsRelease, 'true');
    assert.equal(resumed.support, 'moving-horizontal-a');
    await key('Space', true);
    await page.waitForTimeout(500);
    const held = await sample(page);
    assert.equal(held.jumps, frozen.jumps);
    assert.equal(held.support, 'moving-horizontal-a');
    await up();

    const tickBeforeReset = held.tick;
    await reset();
    const resetState = await sample(page);
    assert.equal(resetState.tick, tickBeforeReset);
    assert.equal(resetState.x, 80);
    assert.ok(resetState.platformClock < 700);
    assert.ok(resetState.movingHX >= 1710 && resetState.movingHX < 1735);
    assert.equal(resetState.movingHY, 300);
    assert.equal(resetState.movingVX, 1910);
    assert.ok(resetState.movingVY <= 310 && resetState.movingVY > 280);
    return { frozenTick: frozen.tick, resumedTick: +resumed.tick, frozenPlatformClock: frozen.platformClock,
      resumedPlatformClock: +resumed.platformClock, resetTick: resetState.tick, heldJumpCount: held.jumps,
      beforePlatformClock: before.platformClock };
  });
  await run('pause-input-release-and-physics-clock', async () => {
    await reset(); await key('Space', true); await key('KeyD', true);
    await page.waitForTimeout(100);
    await ctx.hide();
    await page.waitForFunction(() => document.visibilityState === 'hidden' &&
      document.querySelector('#diagnostics').dataset.paused === 'true', undefined, { polling: 100 });
    const frozen = await sample(page);
    assert.equal(frozen.control, false);
    await page.waitForTimeout(1200);
    assert.deepEqual(await sample(page), frozen);
    await page.evaluate(() => {
      window.__grayboxResume = new Promise(resolve => {
        const changed = () => {
          if (document.visibilityState !== 'visible') return;
          document.removeEventListener('visibilitychange', changed);
          requestAnimationFrame(() => resolve({ ...document.querySelector('#diagnostics').dataset }));
        };
        document.addEventListener('visibilitychange', changed);
      });
    });
    await ctx.show();
    const resumed = await page.evaluate(() => window.__grayboxResume);
    assert.ok(+resumed.tick - frozen.tick <= 5);
    assert.equal(+resumed.physicsSteps - frozen.physicsSteps, +resumed.tick - frozen.tick);
    assert.equal(+resumed.discarded, frozen.discarded);
    assert.equal(resumed.needsRelease, 'true');
    await key('Space', true); // Repeat while still held: not a new jump request.
    await page.waitForTimeout(1100);
    const held = await sample(page);
    assert.equal(held.jumps, frozen.jumps);
    assert.ok(held.grounded && held.y < 479);
    await up(); await key('Space', true);
    await page.waitForFunction(jumps => +document.querySelector('#diagnostics').dataset.jumps > jumps, held.jumps, poll);
    await key('Space', false);
    const final = await sample(page);
    assert.equal(final.physicsSteps, final.tick);
    assert.ok(Math.abs(final.physicsTime - final.tick * (1000 / 60)) < 1e-5);
    return { frozenTick: frozen.tick, firstVisibleTick: +resumed.tick, frozenPhysicsSteps: frozen.physicsSteps,
      heldJumpCount: held.jumps, freshPressJumpCount: final.jumps };
  });
  await up();
  await capture('graybox-completed', true);
}

// D04-R1 intentionally runs only the moving-platform lifecycle path. It reuses the
// production greybox and the platform runner's real tab/window operations.
export async function checkMovingPlatformLifecycle(ctx, record, capture) {
  const page = ctx.page;
  const key = (code, down) => ctx.monitor.key(code, down);
  const up = async () => {
    for (const code of ['KeyA', 'KeyD', 'ArrowLeft', 'ArrowRight', 'Space']) await key(code, false);
  };
  const reset = async () => {
    await ctx.show();
    await up();
    const before = await page.locator('#diagnostics').getAttribute('data-resets');
    await page.locator('#reset-graybox').click();
    await page.waitForFunction(value => {
      const data = document.querySelector('#diagnostics')?.dataset;
      return data?.resets !== value && data?.grounded === 'true' && data.controlAllowed === 'true';
    }, before, poll);
  };
  const navigateToUpperGroundAt = async targetX => {
    await reset();
    await key('KeyD', true);
    await page.waitForFunction(() => +document.querySelector('#diagnostics').dataset.x > 425, undefined, poll);
    await key('Space', true);
    await page.waitForFunction(() => +document.querySelector('#diagnostics').dataset.x > 600, undefined, poll);
    await key('Space', false);
    await page.waitForFunction(() => {
      const data = document.querySelector('#diagnostics').dataset;
      return +data.x > 880 && data.grounded === 'false';
    }, undefined, poll);
    const edgeJumps = (await sample(page)).jumps;
    await key('Space', true);
    await page.waitForFunction(jumps => +document.querySelector('#diagnostics').dataset.jumps > jumps,
      edgeJumps, poll);
    await page.waitForFunction(() => {
      const data = document.querySelector('#diagnostics').dataset;
      return +data.x > 1030 && data.grounded === 'true';
    }, undefined, poll);
    await key('Space', false);
    await page.waitForFunction(x => +document.querySelector('#diagnostics').dataset.x > x, targetX, poll);
    await key('KeyD', false);
    await page.waitForFunction(() => {
      const data = document.querySelector('#diagnostics').dataset;
      return data.grounded === 'true' && data.support === 'upper-ground';
    }, undefined, poll);
  };
  const boardHorizontal = async () => {
    await navigateToUpperGroundAt(1835);
    await page.waitForFunction(() => +document.querySelector('#diagnostics').dataset.movingHX < 1765,
      undefined, poll);
    await key('KeyA', true);
    await key('Space', true);
    await page.waitForTimeout(450);
    await key('KeyA', false);
    await page.waitForFunction(() => document.querySelector('#diagnostics').dataset.support === 'moving-horizontal-a',
      undefined, poll);
    await key('Space', false);
    await page.waitForFunction(() => document.querySelector('#diagnostics').dataset.grounded === 'true' &&
      Math.abs(+document.querySelector('#diagnostics').dataset.vx) < 1, undefined, poll);
  };
  const boardVertical = async () => {
    await navigateToUpperGroundAt(1835);
    await page.waitForFunction(() => {
      const data = document.querySelector('#diagnostics').dataset;
      return +data.movingVY > 302 && +data.movingVDirection === 1;
    }, undefined, poll);
    await key('KeyD', true);
    await key('Space', true);
    await page.waitForTimeout(500);
    await key('KeyD', false);
    await page.waitForFunction(() => document.querySelector('#diagnostics').dataset.support === 'moving-vertical-a',
      undefined, poll);
    await key('Space', false);
    await page.waitForFunction(() => document.querySelector('#diagnostics').dataset.grounded === 'true' &&
      Math.abs(+document.querySelector('#diagnostics').dataset.vx) < 1, undefined, poll);
  };
  const installResumeProbe = () => page.evaluate(() => {
    window.__d04r1Resume = new Promise(resolve => {
      const changed = () => {
        if (document.visibilityState !== 'visible') return;
        document.removeEventListener('visibilitychange', changed);
        requestAnimationFrame(() => resolve({ ...document.querySelector('#diagnostics').dataset }));
      };
      document.addEventListener('visibilitychange', changed);
    });
  });
  const waitForStablePausedSample = async () => {
    let previous;
    for (let attempt = 0; attempt < 10; attempt++) {
      await page.waitForTimeout(100);
      const current = await sample(page);
      if (previous && JSON.stringify(current) === JSON.stringify(previous)) return current;
      previous = current;
    }
    throw new Error('Paused diagnostics did not settle after visibility/window transition');
  };
  const freezeAtSupport = async (name, support) => {
    await ctx.monitor.assertVisible();
    const before = await sample(page);
    assert.equal(before.support, support);
    assert.equal(before.grounded, true);
    ctx.operation = `D04-R1-${name}`;
    ctx.stage = `${name}-wait-hidden`;
    await ctx.hide();
    await page.waitForFunction(() => document.visibilityState === 'hidden' &&
      document.querySelector('#diagnostics').dataset.paused === 'true', undefined, { polling: 100 });
    const frozen = await waitForStablePausedSample();
    assert.equal(frozen.tokens, 1);
    assert.equal(frozen.control, false);
    assert.equal(frozen.support, support);
    const hiddenWindow = await ctx.windowState?.();
    await capture(`${name}-hidden-frozen`, true);
    await page.waitForTimeout(1200);
    assert.deepEqual(await sample(page), frozen, `${name} must freeze for the full hidden interval`);

    await installResumeProbe();
    ctx.stage = `${name}-restore`;
    await ctx.show();
    const resumed = parseSample(await page.evaluate(() => window.__d04r1Resume));
    assert.equal(resumed.paused, false);
    assert.equal(resumed.tokens, 0);
    assert.ok(resumed.tick - frozen.tick <= 5, `${name} resumed with a background tick catch-up`);
    assert.equal(resumed.discarded, frozen.discarded);
    assert.ok(Math.abs(
      resumed.platformClock - frozen.platformClock -
      (resumed.physicsSteps - frozen.physicsSteps) * (1000 / 60),
    ) < 0.01, `${name} platform clock did not follow actual simulation steps`);
    assert.equal(resumed.support, support);
    const resumedWindow = await ctx.windowState?.();
    await capture(`${name}-restored`, true);
    await page.waitForTimeout(250);
    const carried = await sample(page);
    assert.equal(carried.support, support);
    assert.ok(carried.tick > resumed.tick);
    if (support === 'moving-horizontal-a') {
      assert.ok(Math.abs(carried.supportRelativeX - resumed.supportRelativeX) < 1);
      assert.ok(Math.abs(carried.worldVx - carried.supportVx) < 1);
    } else {
      assert.ok(Math.abs(carried.supportRelativeY - resumed.supportRelativeY) < 1);
      assert.ok(Math.abs(carried.worldVy - carried.supportVy) < 1);
    }
    return {
      support, beforeTick: before.tick, frozenTick: frozen.tick, resumedTick: resumed.tick,
      frozenPhysicsSteps: frozen.physicsSteps, resumedPhysicsSteps: resumed.physicsSteps,
      frozenPlatformClock: frozen.platformClock, resumedPlatformClock: resumed.platformClock,
      relativeX: support === 'moving-horizontal-a' ? resumed.supportRelativeX : null,
      relativeY: support === 'moving-vertical-a' ? resumed.supportRelativeY : null,
      platform: support === 'moving-horizontal-a'
        ? { x: frozen.movingHX, y: frozen.movingHY, phase: frozen.movingHPhase,
          direction: frozen.movingHDirection, cycle: frozen.movingHCycle }
        : { x: frozen.movingVX, y: frozen.movingVY, phase: frozen.movingVPhase,
          direction: frozen.movingVDirection, cycle: frozen.movingVCycle },
      hiddenWindow, resumedWindow,
    };
  };
  const heldSpaceFreeze = async () => {
    await ctx.monitor.assertVisible();
    await key('Space', false);
    await page.waitForFunction(() => {
      const data = document.querySelector('#diagnostics').dataset;
      return data.needsRelease === 'false' && data.controlAllowed === 'true';
    }, undefined, poll);
    const jumpCount = (await sample(page)).jumps;
    await key('Space', true);
    await page.waitForFunction(count => {
      const data = document.querySelector('#diagnostics').dataset;
      return +data.jumps > count && data.grounded === 'false';
    }, jumpCount, poll);
    const before = await sample(page);
    ctx.operation = 'D04-R1-horizontal-held-space';
    ctx.stage = 'horizontal-held-space-wait-hidden';
    await ctx.hide();
    await page.waitForFunction(() => document.visibilityState === 'hidden' &&
      document.querySelector('#diagnostics').dataset.paused === 'true', undefined, { polling: 100 });
    const frozen = await waitForStablePausedSample();
    assert.equal(frozen.jumps, before.jumps);
    assert.equal(frozen.control, false);
    const hiddenWindow = await ctx.windowState?.();
    await capture('horizontal-held-space-hidden-frozen', true);
    await page.waitForTimeout(1200);
    assert.deepEqual(await sample(page), frozen);

    await installResumeProbe();
    ctx.stage = 'horizontal-held-space-restore';
    await ctx.show();
    const resumed = parseSample(await page.evaluate(() => window.__d04r1Resume));
    assert.equal(resumed.jumps, frozen.jumps, 'Holding Space across resume must not request another jump');
    assert.equal(resumed.needsRelease, true);
    assert.ok(resumed.tick - frozen.tick <= 5);
    const resumedWindow = await ctx.windowState?.();
    await capture('horizontal-held-space-restored', true);
    await page.waitForTimeout(500);
    assert.equal((await sample(page)).jumps, frozen.jumps);
    await key('Space', false);
    await page.waitForFunction(() => document.querySelector('#diagnostics').dataset.support === 'moving-horizontal-a',
      undefined, poll);
    await key('Space', true);
    await page.waitForFunction(count => +document.querySelector('#diagnostics').dataset.jumps > count,
      frozen.jumps, poll);
    await key('Space', false);
    await up();
    return { frozenTick: frozen.tick, resumedTick: resumed.tick, heldJumpCount: frozen.jumps,
      freshPressJumpCount: (await sample(page)).jumps, hiddenWindow, resumedWindow };
  };

  ctx.operation = 'D04-R1-moving-platform-lifecycle';
  ctx.stage = 'graybox-preparation';
  const result = await ctx.monitor.race(async () => {
    await chooseScene(ctx, 'graybox');
    await ctx.show();
    await boardHorizontal();
    const horizontal = await freezeAtSupport('horizontal-support', 'moving-horizontal-a');
    const heldSpace = await heldSpaceFreeze();
    await boardVertical();
    const vertical = await freezeAtSupport('vertical-support', 'moving-vertical-a');
    await up();
    assert.deepEqual(ctx.errors, []);
    return { horizontal, heldSpace, vertical };
  });
  record('D04-R1-moving-platform-lifecycle', { status: 'PASS', ...result });
  console.log('PASS', ctx.label, 'D04-R1 moving-platform-lifecycle', JSON.stringify(result));
  await capture('D04-R1-moving-platform-lifecycle-completed', true);
}
