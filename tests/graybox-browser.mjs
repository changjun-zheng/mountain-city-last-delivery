import assert from 'node:assert/strict';

const poll = { polling: 'raf', timeout: 12000 };
const sample = page => page.locator('#diagnostics').evaluate(element => {
  const data = element.dataset;
  return { tick: +data.tick, x: +data.x, y: +data.y, vx: +data.vx, vy: +data.vy,
    grounded: data.grounded === 'true', jumps: +data.jumps, support: data.support,
    physicsSteps: +data.physicsSteps, physicsTime: +data.physicsTime, discarded: +data.discarded,
    paused: data.paused === 'true', tokens: +data.tokens, control: data.controlAllowed === 'true',
    needsRelease: data.needsRelease === 'true' };
});

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
        jumps: +d.jumps, wall: d.wall === 'true', ceiling: d.ceiling === 'true', grounded: d.grounded === 'true' });
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
