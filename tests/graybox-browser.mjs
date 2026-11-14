import assert from 'node:assert/strict';

const poll = { polling: 'raf', timeout: 12000 };
const rawSample = page => page.locator('#diagnostics').evaluate(element => ({ ...element.dataset }));
const parseSample = data => ({ tick: +data.tick, x: +data.x, y: +data.y, vx: +data.vx, vy: +data.vy,
  worldVx: +data.worldVx, worldVy: +data.worldVy, supportVx: +data.supportVx, supportVy: +data.supportVy,
  grounded: data.grounded === 'true', jumps: +data.jumps, support: data.support,
  physicsSteps: +data.physicsSteps, physicsTime: +data.physicsTime, discarded: +data.discarded, resets: +data.resets,
  paused: data.paused === 'true', tokens: +data.tokens, control: data.controlAllowed === 'true',
  needsRelease: data.needsRelease === 'true', oneWayCollision: data.oneWayCollision === 'true',
  progressRouteOpen: data.progressRouteOpen === 'true',
  platformClock: +data.platformClock,
  movingHX: +data.movingHX, movingHY: +data.movingHY, movingHVx: +data.movingHVx,
  movingHDirection: +data.movingHDirection, movingHPhase: +data.movingHPhase, movingHCycle: +data.movingHCycle,
  movingVX: +data.movingVX, movingVY: +data.movingVY, movingVVy: +data.movingVVy,
  movingVDirection: +data.movingVDirection, movingVPhase: +data.movingVPhase, movingVCycle: +data.movingVCycle,
  supportRelativeX: data.supportRelativeX === '' ? null : +data.supportRelativeX,
  supportRelativeY: data.supportRelativeY === '' ? null : +data.supportRelativeY,
  zoneBaselineTick: +data.zoneBaselineTick, zoneBaselineCount: +data.zoneBaselineCount,
  zoneAOccupied: data.zoneAOccupied === 'true', zoneAOccupiedSteps: +data.zoneAOccupiedSteps,
  zoneALastOccupiedSteps: +data.zoneALastOccupiedSteps,
  zoneAEnter: +data.zoneAEnter, zoneAExit: +data.zoneAExit, zoneALastTick: +data.zoneALastTick,
  zoneATransitions: data.zoneATransitions || '',
  zoneBOccupied: data.zoneBOccupied === 'true', zoneBOccupiedSteps: +data.zoneBOccupiedSteps,
  zoneBLastOccupiedSteps: +data.zoneBLastOccupiedSteps,
  zoneBEnter: +data.zoneBEnter, zoneBExit: +data.zoneBExit, zoneBLastTick: +data.zoneBLastTick,
  zoneBTransitions: data.zoneBTransitions || '',
  interactionMode: data.interactionMode || '',
  interactionSelected: data.interactionSelected || '',
  interactionActive: data.interactionActive || '',
  interactionPrompt: data.interactionPrompt || '',
  interactionTitle: data.interactionTitle || '',
  interactionContent: data.interactionContent || '',
  interactionFeedback: data.interactionFeedback || '',
  interactionFeedbackRemaining: +(data.interactionFeedbackRemaining || 0),
  interactionConsumed: +(data.interactionConsumed || 0),
  interactionStarts: +(data.interactionStarts || 0),
  interactionFeedbackCount: +(data.interactionFeedbackCount || 0),
  interactionCandidates: +(data.interactionCandidates || 0),
  interactionFacing: +(data.interactionFacing || 1),
  interactionNeedsRelease: data.interactionNeedsRelease === 'true',
  interactionControlBlocked: data.interactionControlBlocked === 'true',
  progressCollectionCount: +(data.progressCollectionCount || 0),
  progressGoalCount: +(data.progressGoalCount || 0),
  progressRewardCount: +(data.progressRewardCount || 0),
  progressEffectCount: +(data.progressEffectCount || 0),
  progressCollectionIds: data.progressCollectionIds || '',
  progressGoalIds: data.progressGoalIds || '',
  progressRewardIds: data.progressRewardIds || '',
  progressEffects: data.progressEffects || '',
  goalRuntimeInstanceId: data.goalRuntimeInstanceId || '',
  goalPhase: data.goalPhase || '',
  goalMessage: data.goalMessage || '',
  goalEventId: data.goalEventId === '' ? null : +data.goalEventId,
  goalCommandId: data.goalCommandId === '' ? null : +data.goalCommandId,
  goalTransactionId: data.goalTransactionId === '' ? null : +data.goalTransactionId,
  goalResultEventId: data.goalResultEventId === '' ? null : +data.goalResultEventId,
  goalDeliveryStatus: data.goalDeliveryStatus || '',
  goalTransactionStatus: data.goalTransactionStatus || '',
  goalResultLifecycle: data.goalResultLifecycle || '',
  goalTerminalStatus: data.goalTerminalStatus || '',
  goalAcceptedTick: data.goalAcceptedTick === '' ? null : +data.goalAcceptedTick,
  goalApplyTick: data.goalApplyTick === '' ? null : +data.goalApplyTick,
  goalVerifyTick: data.goalVerifyTick === '' ? null : +data.goalVerifyTick,
  goalTerminalTick: data.goalTerminalTick === '' ? null : +data.goalTerminalTick,
  goalOriginalCompletedTick: data.goalOriginalCompletedTick === ''
    ? null : +data.goalOriginalCompletedTick,
  goalResultCreatedTick: data.goalResultCreatedTick === ''
    ? null : +data.goalResultCreatedTick,
  goalResultConsumedTick: data.goalResultConsumedTick === ''
    ? null : +data.goalResultConsumedTick,
  goalOriginalAcknowledged: data.goalOriginalAcknowledged === 'true',
  goalOriginalRetired: data.goalOriginalRetired === 'true',
  goalResultAcknowledged: data.goalResultAcknowledged === 'true',
  goalResultRetired: data.goalResultRetired === 'true',
  goalResultConsumerAttempts: +(data.goalResultConsumerAttempts || 0),
  goalResultConsumptionCount: +(data.goalResultConsumptionCount || 0),
  goalAcceptedBusinessGoals: +(data.goalAcceptedBusinessGoals || 0),
  goalAcceptedBusinessRewards: +(data.goalAcceptedBusinessRewards || 0),
  goalAcceptedBusinessEffects: +(data.goalAcceptedBusinessEffects || 0),
  goalTerminalBusinessGoals: +(data.goalTerminalBusinessGoals || 0),
  goalTerminalBusinessRewards: +(data.goalTerminalBusinessRewards || 0),
  goalTerminalBusinessEffects: +(data.goalTerminalBusinessEffects || 0),
  goalEventRecords: +(data.goalEventRecords || 0),
  goalInboxEvents: +(data.goalInboxEvents || 0),
  goalCommands: +(data.goalCommands || 0),
  goalAcceptedCommands: +(data.goalAcceptedCommands || 0),
  goalTransactionIntents: +(data.goalTransactionIntents || 0),
  goalTransactions: +(data.goalTransactions || 0),
  goalResultEvents: +(data.goalResultEvents || 0),
  goalLastError: data.goalLastError || '',
  checkpointStatus: data.checkpointStatus || '',
  checkpointError: data.checkpointError || '',
  checkpointCaptureAttempts: +(data.checkpointCaptureAttempts || 0),
  checkpointCapturedAtTick: data.checkpointCapturedAtTick === ''
    ? null : +data.checkpointCapturedAtTick,
  checkpointSchemaVersion: data.checkpointSchemaVersion === ''
    ? null : +data.checkpointSchemaVersion,
  checkpointRuntimeInstanceId: data.checkpointRuntimeInstanceId || '',
  checkpointId: data.checkpointId || '',
  checkpointLevelId: data.checkpointLevelId || '',
  checkpointAnchor: data.checkpointAnchor || '',
  checkpointObjectIds: data.checkpointObjectIds || '',
  checkpointStateVersions: data.checkpointStateVersions || '',
  checkpointObjectCount: +(data.checkpointObjectCount || 0),
  checkpointPayload: data.checkpointPayload || '',
  checkpointTriggersEnabled: data.checkpointTriggersEnabled === 'true',
  checkpointTriggerPhase: data.checkpointTriggerPhase || '',
  checkpointTriggerFeedbackKind: data.checkpointTriggerFeedbackKind || '',
  checkpointTriggerFeedback: data.checkpointTriggerFeedback || '',
  checkpointBatchCount: +(data.checkpointBatchCount || 0),
  checkpointBatchTick: data.checkpointBatchTick === '' ? null : +data.checkpointBatchTick,
  checkpointClosedTick: data.checkpointClosedTick === '' ? null : +data.checkpointClosedTick,
  checkpointArbitrationTick: data.checkpointArbitrationTick === ''
    ? null : +data.checkpointArbitrationTick,
  checkpointEntryEventCount: +(data.checkpointEntryEventCount || 0),
  checkpointSelectedCount: +(data.checkpointSelectedCount || 0),
  checkpointCaptureRequestCount: +(data.checkpointCaptureRequestCount || 0),
  checkpointBlockedCount: +(data.checkpointBlockedCount || 0),
  checkpointFailureCount: +(data.checkpointFailureCount || 0),
  checkpointCurrentId: data.checkpointCurrentId || '',
  checkpointCandidateId: data.checkpointCandidateId || '',
  checkpointLatestOpportunityId: data.checkpointLatestOpportunityId || '',
  checkpointLatestEntryEventId: data.checkpointLatestEntryEventId === ''
    ? null : +data.checkpointLatestEntryEventId,
  checkpointLatestCaptureEventId: data.checkpointLatestCaptureEventId === ''
    ? null : +data.checkpointLatestCaptureEventId,
  checkpointLatestCaptureRequestId: data.checkpointLatestCaptureRequestId || '',
  checkpointArbitrationWinner: data.checkpointArbitrationWinner || '',
  checkpointArbitrationBatchTick: data.checkpointArbitrationBatchTick === ''
    ? null : +data.checkpointArbitrationBatchTick,
  checkpointArbitrationClosedTick: data.checkpointArbitrationClosedTick === ''
    ? null : +data.checkpointArbitrationClosedTick,
  checkpointArbitrationTickValue: data.checkpointArbitrationTickValue === ''
    ? null : +data.checkpointArbitrationTickValue,
  checkpointArbitrationWinnerEntryEventId:
    data.checkpointArbitrationWinnerEntryEventId === ''
      ? null : +data.checkpointArbitrationWinnerEntryEventId,
  checkpointArbitrationWinnerOpportunityId:
    data.checkpointArbitrationWinnerOpportunityId || '',
  checkpointArbitrationCaptureEventId:
    data.checkpointArbitrationCaptureEventId === ''
      ? null : +data.checkpointArbitrationCaptureEventId,
  checkpointArbitrationCaptureRequestStatus:
    data.checkpointArbitrationCaptureRequestStatus || '',
  checkpointArbitrationEntrants: data.checkpointArbitrationEntrants || '',
  checkpointZoneAOccupied: data.checkpointZoneAOccupied === 'true',
  checkpointZoneAEnter: +(data.checkpointZoneAEnter || 0),
  checkpointZoneAExit: +(data.checkpointZoneAExit || 0),
  checkpointZoneALastTick: data.checkpointZoneALastTick === ''
    ? null : +data.checkpointZoneALastTick,
  checkpointZoneAOpportunity: data.checkpointZoneAOpportunity || '',
  checkpointZoneAEntryEventId: data.checkpointZoneAEntryEventId === ''
    ? null : +data.checkpointZoneAEntryEventId,
  checkpointZoneADecision: data.checkpointZoneADecision || '',
  checkpointZoneBOccupied: data.checkpointZoneBOccupied === 'true',
  checkpointZoneBEnter: +(data.checkpointZoneBEnter || 0),
  checkpointZoneBExit: +(data.checkpointZoneBExit || 0),
  checkpointZoneBLastTick: data.checkpointZoneBLastTick === ''
    ? null : +data.checkpointZoneBLastTick,
  checkpointZoneBOpportunity: data.checkpointZoneBOpportunity || '',
  checkpointZoneBEntryEventId: data.checkpointZoneBEntryEventId === ''
    ? null : +data.checkpointZoneBEntryEventId,
  checkpointZoneBDecision: data.checkpointZoneBDecision || '',
  checkpointCapturePhase: data.checkpointCapturePhase || '',
  checkpointCaptureSourceEntryEventId: data.checkpointCaptureSourceEntryEventId === ''
    ? null : +data.checkpointCaptureSourceEntryEventId,
  checkpointCaptureEventId: data.checkpointCaptureEventId === ''
    ? null : +data.checkpointCaptureEventId,
  checkpointCaptureCommandId: data.checkpointCaptureCommandId === ''
    ? null : +data.checkpointCaptureCommandId,
  checkpointCaptureTransactionId: data.checkpointCaptureTransactionId === ''
    ? null : +data.checkpointCaptureTransactionId,
  checkpointCaptureResultEventId: data.checkpointCaptureResultEventId === ''
    ? null : +data.checkpointCaptureResultEventId,
  checkpointCaptureRequestId: data.checkpointCaptureRequestId || '',
  checkpointCaptureSaves: +(data.checkpointCaptureSaves || 0),
  checkpointCaptureLockHeld: data.checkpointCaptureLockHeld === 'true',
  checkpointCaptureResourcesReleased:
    data.checkpointCaptureResourcesReleased === 'true',
});
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
  const up = async () => { for (const code of ['KeyA', 'KeyD', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyE', 'Escape']) await key(code, false); };
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
    assert.ok(
      resetState.tick >= tickBeforeReset,
      'Debug reset must not move the global Tick backwards',
    );
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

// D07 intentionally verifies only the unified interaction loop. It uses the
// same production input, coordinator and fixed-step world as the full suite.
export async function checkInteractions(ctx, record, capture) {
  const page = ctx.page;
  const key = (code, down) => ctx.monitor.key(code, down);
  const up = async () => {
    for (const code of ['KeyA', 'KeyD', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyE', 'Escape']) {
      await key(code, false);
    }
  };
  const reset = async () => {
    await ctx.show();
    await up();
    const before = await sample(page);
    await page.locator('#reset-graybox').click();
    await page.waitForFunction(({ resets, tick }) => {
      const data = document.querySelector('#diagnostics')?.dataset;
      return Number(data?.resets) !== resets && Number(data?.tick) >= tick &&
        data?.interactionMode === 'idle' && data?.interactionActive === '' &&
        data?.interactionSelected === '' && data?.interactionConsumed === '0' &&
        data?.interactionStarts === '0' && data?.interactionFeedbackCount === '0' &&
        data?.grounded === 'true' && data?.controlAllowed === 'true';
    }, { resets: before.resets, tick: before.tick }, poll);
  };
  const moveToOverlap = async () => {
    await key('KeyD', true);
    await page.waitForFunction(() => +document.querySelector('#diagnostics').dataset.x > 245, undefined, poll);
    await key('KeyD', false);
    await page.waitForFunction(() => {
      const data = document.querySelector('#diagnostics').dataset;
      return data.interactionSelected === 'prototype-investigation-b' &&
        data.interactionCandidates === '2' && data.interactionFacing === '1';
    }, undefined, poll);
  };
  const moveToPickup = async () => {
    await key('KeyD', true);
    await page.waitForFunction(() => {
      const data = document.querySelector('#diagnostics').dataset;
      return +data.x > 300 && data.interactionSelected === 'prototype-pickup-c';
    }, undefined, poll);
    await key('KeyD', false);
    await page.waitForFunction(() =>
      document.querySelector('#diagnostics').dataset.interactionSelected === 'prototype-pickup-c',
    undefined, poll);
  };
  const waitStablePausedSample = async () => {
    let previous;
    for (let attempt = 0; attempt < 10; attempt++) {
      await page.waitForTimeout(100);
      const current = await sample(page);
      if (previous && JSON.stringify(current) === JSON.stringify(previous)) return current;
      previous = current;
    }
    throw new Error('Paused interaction diagnostics did not settle');
  };
  const installResumeProbe = () => page.evaluate(() => {
    window.__d07Resume = new Promise(resolve => {
      const changed = () => {
        if (document.visibilityState !== 'visible') return;
        document.removeEventListener('visibilitychange', changed);
        requestAnimationFrame(() => resolve({ ...document.querySelector('#diagnostics').dataset }));
      };
      document.addEventListener('visibilitychange', changed);
    });
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

  await run('D07-I01-I02-range-facing-and-single-target', async () => {
    await reset();
    const outside = await sample(page);
    assert.equal(outside.interactionSelected, '');
    assert.equal(outside.interactionPrompt, '');
    await key('KeyE', true);
    await key('KeyE', false);
    await page.waitForTimeout(120);
    const ignored = await sample(page);
    assert.equal(ignored.interactionConsumed, 0, 'E outside every range must not be buffered');
    assert.equal(ignored.interactionMode, 'idle');

    await moveToOverlap();
    const facingRight = await sample(page);
    assert.equal(facingRight.interactionCandidates, 2);
    assert.equal(facingRight.interactionSelected, 'prototype-investigation-b');
    assert.match(facingRight.interactionPrompt, /调查 B/);
    await capture('D07-overlap-facing-right', true);

    await key('KeyA', true);
    await page.waitForFunction(() =>
      document.querySelector('#diagnostics').dataset.interactionFacing === '-1' &&
      document.querySelector('#diagnostics').dataset.interactionSelected === 'prototype-investigation-a',
    undefined, poll);
    await key('KeyA', false);
    const facingLeft = await sample(page);
    assert.equal(facingLeft.interactionCandidates, 2);
    assert.equal(facingLeft.interactionSelected, 'prototype-investigation-a');
    assert.match(facingLeft.interactionPrompt, /调查 A/);

    await key('KeyD', true);
    await page.waitForFunction(() =>
      document.querySelector('#diagnostics').dataset.interactionFacing === '1' &&
      document.querySelector('#diagnostics').dataset.interactionSelected === 'prototype-investigation-b',
    undefined, poll);
    await key('KeyD', false);
    const restoredFacing = await sample(page);
    assert.equal(restoredFacing.interactionConsumed, 0, 'Showing a prompt must not auto-interact');
    return {
      outside: { selected: outside.interactionSelected, prompt: outside.interactionPrompt },
      ignoredConsumeCount: ignored.interactionConsumed,
      facingRight: { candidates: facingRight.interactionCandidates, selected: facingRight.interactionSelected },
      facingLeft: { candidates: facingLeft.interactionCandidates, selected: facingLeft.interactionSelected },
    };
  });

  await run('D07-R1-prompt-availability-across-hidden-and-restore', async () => {
    await reset();
    await moveToOverlap();
    const ready = await sample(page);
    assert.equal(ready.interactionSelected, 'prototype-investigation-b');
    assert.match(ready.interactionPrompt, /调查 B/);

    ctx.stage = 'D07-R1-prompt-wait-hidden';
    await ctx.hide();
    await page.waitForFunction(() => document.visibilityState === 'hidden' &&
      document.querySelector('#diagnostics').dataset.paused === 'true', undefined, { polling: 100 });
    const frozen = await waitStablePausedSample();
    assert.equal(frozen.control, false);
    assert.equal(frozen.interactionSelected, 'prototype-investigation-b');
    assert.equal(frozen.interactionPrompt, '',
      'Unavailable or paused input must not advertise an actionable prompt');
    if (ctx.windowState) await ctx.windowState();
    await capture('D07-R1-prompt-hidden-frozen', true);
    await page.waitForTimeout(1200);
    assert.deepEqual(await sample(page), frozen,
      'Prompt availability must remain unavailable for the hidden interval');

    await installResumeProbe();
    ctx.stage = 'D07-R1-prompt-restore';
    await ctx.show();
    const resumedAtVisibility = parseSample(await page.evaluate(() => window.__d07Resume));
    assert.equal(resumedAtVisibility.paused, false);
    assert.equal(resumedAtVisibility.interactionSelected, 'prototype-investigation-b');
    if (!resumedAtVisibility.control) {
      assert.equal(resumedAtVisibility.interactionPrompt, '',
        'Prompt must stay unavailable until the restored window actually has focus');
    }
    await page.waitForFunction(() => document.visibilityState === 'visible' &&
      document.hasFocus() &&
      document.querySelector('#diagnostics').dataset.paused === 'false' &&
      document.querySelector('#diagnostics').dataset.controlAllowed === 'true' &&
      /调查 B/.test(document.querySelector('#diagnostics').dataset.interactionPrompt || ''),
    undefined, poll);
    const resumed = await sample(page);
    assert.equal(resumed.control, true);
    assert.equal(resumed.interactionSelected, 'prototype-investigation-b');
    assert.match(resumed.interactionPrompt, /调查 B/,
      'Prompt must return only after the input becomes available again');
    if (ctx.windowState) await ctx.windowState();
    await capture('D07-R1-prompt-restored', true);
    return {
      ready: { selected: ready.interactionSelected, prompt: ready.interactionPrompt },
      frozen: { prompt: frozen.interactionPrompt, control: frozen.control, paused: frozen.paused },
      resumedAtVisibility: {
        prompt: resumedAtVisibility.interactionPrompt,
        control: resumedAtVisibility.control,
        paused: resumedAtVisibility.paused,
      },
      resumedAvailable: { prompt: resumed.interactionPrompt, control: resumed.control, paused: resumed.paused },
    };
  });

  await run('D07-R1-reset-preserves-release-gate', async () => {
    await reset();
    await moveToOverlap();
    await key('KeyE', true);
    await page.waitForFunction(() =>
      document.querySelector('#diagnostics').dataset.interactionMode === 'investigation',
    undefined, poll);
    await key('Escape', true);
    await key('Escape', false);
    await page.waitForFunction(() =>
      document.querySelector('#diagnostics').dataset.interactionMode === 'idle',
    undefined, poll);

    ctx.stage = 'D07-R1-release-gate-wait-hidden';
    await ctx.hide();
    await page.waitForFunction(() => document.visibilityState === 'hidden' &&
      document.querySelector('#diagnostics').dataset.paused === 'true', undefined, { polling: 100 });
    const frozen = await waitStablePausedSample();
    assert.equal(frozen.interactionNeedsRelease, true);
    assert.equal(frozen.interactionPrompt, '');
    await capture('D07-R1-release-gate-hidden-frozen', true);

    ctx.stage = 'D07-R1-release-gate-restore-reset';
    await ctx.show();
    await page.waitForFunction(() => document.visibilityState === 'visible' &&
      document.hasFocus() &&
      document.querySelector('#diagnostics').dataset.paused === 'false' &&
      document.querySelector('#diagnostics').dataset.interactionNeedsRelease === 'true',
    undefined, poll);
    const resumed = await sample(page);
    assert.equal(resumed.control, true);
    assert.equal(resumed.interactionNeedsRelease, true);
    assert.equal(resumed.interactionPrompt, '', 'A held E must keep the prompt unavailable');

    const beforeReset = await sample(page);
    await page.locator('#reset-graybox').click();
    await page.waitForFunction(value =>
      document.querySelector('#diagnostics').dataset.resets !== value,
    String(beforeReset.resets), poll);
    const resetHeld = await sample(page);
    assert.equal(resetHeld.interactionMode, 'idle');
    assert.equal(resetHeld.interactionNeedsRelease, true,
      'Reset must not clear a pending E release gate');
    assert.equal(resetHeld.interactionPrompt, '');

    await moveToOverlap();
    const atTargetWithGate = await sample(page);
    assert.equal(atTargetWithGate.interactionSelected, 'prototype-investigation-b');
    assert.equal(atTargetWithGate.interactionNeedsRelease, true);
    assert.equal(atTargetWithGate.interactionPrompt, '');

    await key('KeyE', true);
    await page.waitForTimeout(150);
    const ignored = await sample(page);
    assert.equal(ignored.interactionMode, 'idle');
    assert.equal(ignored.interactionConsumed, 0);
    assert.equal(ignored.interactionStarts, 0);
    await capture('D07-R1-release-gate-reset-held', true);

    await key('KeyE', false);
    await page.waitForFunction(() =>
      document.querySelector('#diagnostics').dataset.interactionNeedsRelease === 'false' &&
      /调查 B/.test(document.querySelector('#diagnostics').dataset.interactionPrompt || ''),
    undefined, poll);
    const released = await sample(page);
    assert.match(released.interactionPrompt, /调查 B/);

    await key('KeyE', true);
    await page.waitForFunction(() =>
      document.querySelector('#diagnostics').dataset.interactionMode === 'investigation',
    undefined, poll);
    const triggered = await sample(page);
    assert.equal(triggered.interactionConsumed, 1);
    assert.equal(triggered.interactionStarts, 1);
    await key('KeyE', false);
    await key('Escape', true);
    await key('Escape', false);
    return {
      frozen: { needsRelease: frozen.interactionNeedsRelease, prompt: frozen.interactionPrompt },
      resumed: { needsRelease: resumed.interactionNeedsRelease, prompt: resumed.interactionPrompt },
      resetHeld: { needsRelease: resetHeld.interactionNeedsRelease, prompt: resetHeld.interactionPrompt },
      ignored: { mode: ignored.interactionMode, starts: ignored.interactionStarts },
      released: { needsRelease: released.interactionNeedsRelease, prompt: released.interactionPrompt },
      triggered: { starts: triggered.interactionStarts, consumed: triggered.interactionConsumed },
    };
  });

  await run('D07-I03-I04-control-lock-hold-and-pause', async () => {
    await reset();
    await moveToOverlap();
    await key('KeyE', true);
    await page.waitForFunction(() =>
      document.querySelector('#diagnostics').dataset.interactionMode === 'investigation',
    undefined, poll);
    const opened = await sample(page);
    assert.equal(opened.interactionActive, 'prototype-investigation-b');
    assert.equal(opened.interactionStarts, 1);
    assert.equal(opened.interactionConsumed, 1);
    assert.equal(opened.control, false);
    assert.equal(opened.interactionPrompt, '');
    await capture('D07-investigation-open', true);

    await key('KeyE', true); // Repeats while held must not begin another investigation.
    await key('KeyD', true);
    await key('Space', true);
    await page.waitForTimeout(350);
    const locked = await sample(page);
    assert.ok(locked.tick > opened.tick, 'Physics/fixed steps continue behind the investigation panel');
    assert.equal(locked.interactionStarts, 1);
    assert.equal(locked.interactionConsumed, 1);
    assert.equal(locked.jumps, opened.jumps);
    assert.ok(Math.abs(locked.vx) < 0.1, 'Locked input must decelerate the existing velocity to zero');
    await key('KeyD', false);
    await page.waitForTimeout(250);
    const stationary = await sample(page);
    assert.ok(Math.abs(stationary.x - locked.x) < 0.5,
      'After the prototype deceleration, locked movement must remain stationary');

    ctx.stage = 'D07-investigation-wait-hidden';
    await ctx.hide();
    await page.waitForFunction(() => document.visibilityState === 'hidden' &&
      document.querySelector('#diagnostics').dataset.paused === 'true', undefined, { polling: 100 });
    const frozen = await waitStablePausedSample();
    assert.equal(frozen.tokens, 1);
    assert.equal(frozen.control, false);
    assert.equal(frozen.interactionMode, 'investigation');
    assert.equal(frozen.interactionActive, 'prototype-investigation-b');
    assert.equal(frozen.interactionNeedsRelease, true);
    assert.equal(frozen.needsRelease, true);
    if (ctx.windowState) await ctx.windowState();
    await capture('D07-investigation-hidden-frozen', true);
    await page.waitForTimeout(1200);
    assert.deepEqual(await sample(page), frozen, 'Interaction content and physics must freeze while hidden');

    await installResumeProbe();
    ctx.stage = 'D07-investigation-restore';
    await ctx.show();
    const resumed = parseSample(await page.evaluate(() => window.__d07Resume));
    assert.equal(resumed.paused, false);
    assert.equal(resumed.tokens, 0);
    assert.ok(resumed.tick - frozen.tick <= 5, 'Resume must not catch up background time');
    assert.equal(resumed.discarded, frozen.discarded);
    assert.equal(resumed.interactionStarts, frozen.interactionStarts);
    assert.equal(resumed.interactionConsumed, frozen.interactionConsumed);
    assert.equal(resumed.interactionActive, 'prototype-investigation-b');
    assert.equal(resumed.control, false, 'Interaction owner must keep control locked after focus returns');
    assert.equal(resumed.interactionNeedsRelease, true);
    if (ctx.windowState) await ctx.windowState();
    await capture('D07-investigation-restored', true);
    await page.waitForTimeout(450);
    const heldAfterResume = await sample(page);
    assert.equal(heldAfterResume.interactionStarts, frozen.interactionStarts);
    assert.equal(heldAfterResume.jumps, frozen.jumps);
    assert.equal(heldAfterResume.interactionMode, 'investigation');

    await key('KeyE', false);
    await key('Space', false);
    await key('Escape', true);
    await key('Escape', false);
    await page.waitForFunction(() => {
      const data = document.querySelector('#diagnostics').dataset;
      return data.interactionMode === 'idle' && data.controlAllowed === 'true';
    }, undefined, poll);
    const closed = await sample(page);
    const unlockedX = closed.x;
    await key('KeyD', true);
    await page.waitForFunction(x => +document.querySelector('#diagnostics').dataset.x > x + 5,
      unlockedX, poll);
    await key('KeyD', false);
    return {
      opened: { active: opened.interactionActive, tick: opened.tick, control: opened.control },
      lockedTick: locked.tick, lockedVx: locked.vx, decelerationDistance: locked.x - opened.x,
      lockedJumpCount: locked.jumps, stationaryX: stationary.x,
      frozen: { tick: frozen.tick, mode: frozen.interactionMode, needsRelease: frozen.interactionNeedsRelease },
      resumed: { tick: resumed.tick, mode: resumed.interactionMode, control: resumed.control },
      closed: { tick: closed.tick, control: closed.control },
    };
  });

  await run('D07-I05-pickup-feedback-without-lock', async () => {
    await reset();
    await moveToPickup();
    const before = await sample(page);
    await key('KeyE', true);
    await page.waitForFunction(() =>
      document.querySelector('#diagnostics').dataset.interactionMode === 'feedback',
    undefined, poll);
    const feedback = await sample(page);
    assert.equal(feedback.interactionFeedbackCount, 1);
    assert.equal(feedback.interactionConsumed, 1);
    assert.equal(feedback.control, true);
    assert.ok(feedback.interactionFeedbackRemaining > 0);
    await capture('D07-pickup-feedback', true);

    await key('KeyD', true);
    await page.waitForFunction(x => {
      const data = document.querySelector('#diagnostics').dataset;
      return +data.x > x + 15 && data.interactionMode === 'feedback' && data.controlAllowed === 'true';
    }, before.x, poll);
    await key('KeyD', false);
    await key('KeyE', false);
    const moving = await sample(page);
    assert.ok(moving.x > before.x + 15, 'Pickup feedback must not lock movement');
    await page.waitForFunction(() => {
      const data = document.querySelector('#diagnostics').dataset;
      return data.interactionMode === 'idle' && data.interactionFeedbackRemaining === '0';
    }, undefined, { polling: 100, timeout: 5000 });
    const expired = await sample(page);
    assert.equal(expired.control, true);
    assert.equal(expired.interactionStarts, 0);
    await reset();
    const resetState = await sample(page);
    assert.equal(resetState.interactionFeedbackCount, 0);
    return {
      feedback: { count: feedback.interactionFeedbackCount, remainingMs: feedback.interactionFeedbackRemaining },
      movingX: moving.x, controlDuringFeedback: feedback.control, expiredMode: expired.interactionMode,
      resetFeedbackCount: resetState.interactionFeedbackCount,
    };
  });

  await run('D07-I06-reset-and-scene-cleanup', async () => {
    await reset();
    await moveToOverlap();
    await key('KeyE', true);
    await key('KeyE', false);
    await page.waitForFunction(() =>
      document.querySelector('#diagnostics').dataset.interactionMode === 'investigation',
    undefined, poll);
    await reset();
    const afterReset = await sample(page);
    assert.equal(afterReset.x, 80);
    assert.equal(afterReset.interactionMode, 'idle');
    assert.equal(afterReset.interactionActive, '');
    assert.equal(afterReset.interactionStarts, 0);
    assert.equal(afterReset.control, true);
    await capture('D07-reset-clean', true);

    await moveToOverlap();
    await key('KeyE', true);
    await key('KeyE', false);
    await page.waitForFunction(() =>
      document.querySelector('#diagnostics').dataset.interactionMode === 'investigation',
    undefined, poll);
    await chooseScene(ctx, 'diagnostic');
    await capture('D07-scene-switch-diagnostic', true);
    await chooseScene(ctx, 'graybox');
    await page.waitForFunction(() => {
      const data = document.querySelector('#diagnostics').dataset;
      return data.interactionMode === 'idle' && data.interactionActive === '' &&
        data.interactionSelected === '' && data.interactionStarts === '0' &&
        data.interactionConsumed === '0' && data.controlAllowed === 'true';
    }, undefined, poll);
    const switched = await sample(page);
    await page.waitForTimeout(250);
    const stable = await sample(page);
    assert.equal(stable.interactionMode, 'idle');
    assert.equal(stable.interactionStarts, 0);
    assert.equal(stable.control, true);
    await capture('D07-scene-switch-clean', true);
    await up();
    return {
      reset: { x: afterReset.x, mode: afterReset.interactionMode, starts: afterReset.interactionStarts },
      switched: { tick: switched.tick, mode: switched.interactionMode, control: switched.control },
    };
  });
}

// D04-R1 intentionally runs only the moving-platform lifecycle path. It reuses the
// production greybox and the platform runner's real tab/window operations.
export async function checkMovingPlatformLifecycle(ctx, record, capture) {
  const page = ctx.page;
  const key = (code, down) => ctx.monitor.key(code, down);
  const up = async () => {
    for (const code of ['KeyA', 'KeyD', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyE', 'Escape']) await key(code, false);
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

// D05 uses a short, independently selectable path so trigger diagnostics can be
// verified without requiring the historical all-purpose platform suite to pass first.
export async function checkDiagnosticZones(ctx, record, capture) {
  const page = ctx.page;
  const key = (code, down) => ctx.monitor.key(code, down);
  const up = async () => {
    for (const code of ['KeyA', 'KeyD', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyE', 'Escape']) await key(code, false);
  };
  const reset = async () => {
    await ctx.show();
    await up();
    const before = await sample(page);
    await page.locator('#reset-graybox').click();
    await page.waitForFunction(({ resets, baseline }) => {
      const data = document.querySelector('#diagnostics')?.dataset;
      return data?.resets !== resets && Number(data?.zoneBaselineCount) === baseline + 1 &&
        data?.zoneAOccupied === 'false' && data?.zoneBOccupied === 'false' &&
        data?.grounded === 'true' && data.controlAllowed === 'true';
    }, { resets: String(before.resets), baseline: before.zoneBaselineCount }, poll);
  };
  const waitStablePausedSample = async () => {
    let previous;
    for (let attempt = 0; attempt < 10; attempt++) {
      await page.waitForTimeout(100);
      const current = await sample(page);
      if (previous && JSON.stringify(current) === JSON.stringify(previous)) return current;
      previous = current;
    }
    throw new Error('Paused diagnostic-zone state did not settle');
  };
  const installResumeProbe = () => page.evaluate(() => {
    window.__d05Resume = new Promise(resolve => {
      const changed = () => {
        if (document.visibilityState !== 'visible') return;
        document.removeEventListener('visibilitychange', changed);
        requestAnimationFrame(() => resolve({ ...document.querySelector('#diagnostics').dataset }));
      };
      document.addEventListener('visibilitychange', changed);
    });
  });

  ctx.operation = 'D05-diagnostic-zones';
  ctx.stage = 'graybox-preparation';
  const result = await ctx.monitor.race(async () => {
    await chooseScene(ctx, 'graybox');
    await ctx.show();
    await reset();
    const initial = await sample(page);
    assert.equal(initial.zoneBaselineCount, 1);
    assert.equal(initial.zoneAOccupied, false);
    assert.equal(initial.zoneBOccupied, false);
    assert.equal(initial.zoneAEnter, 0);
    assert.equal(initial.zoneBEnter, 0);

    // G01/G03: enter through real movement, sustain occupancy, and jump using ground support.
    await key('KeyD', true);
    await page.waitForFunction(() => {
      const data = document.querySelector('#diagnostics').dataset;
      return data.zoneAOccupied === 'true' && data.grounded === 'true' && data.support === 'ground-a';
    }, undefined, poll);
    const firstA = await sample(page);
    await key('KeyD', false);
    assert.equal(firstA.zoneAEnter, 1);
    assert.equal(firstA.zoneAExit, 0);
    const jumpBefore = firstA.jumps;
    await key('Space', true);
    await page.waitForFunction(({ jumps, tick }) => {
      const data = document.querySelector('#diagnostics').dataset;
      return +data.jumps > jumps && data.grounded === 'false' && +data.tick > tick;
    }, { jumps: jumpBefore, tick: firstA.tick }, poll);
    await key('Space', false);
    await page.waitForFunction(() => {
      const data = document.querySelector('#diagnostics').dataset;
      return data.grounded === 'true' && data.support === 'ground-a' && data.zoneAOccupied === 'true';
    }, undefined, poll);
    const sustainedA = await sample(page);
    assert.equal(sustainedA.zoneAEnter, 1, 'Overlap and landing must not duplicate enter');
    assert.ok(sustainedA.zoneAOccupiedSteps > firstA.zoneAOccupiedSteps);
    await capture('zone-a-enter-sustained', true);

    // G02: cross the overlap, then isolate each zone independently.
    await key('KeyD', true);
    await page.waitForFunction(() =>
      document.querySelector('#diagnostics').dataset.zoneAOccupied === 'false' &&
      document.querySelector('#diagnostics').dataset.zoneBOccupied === 'true', undefined, poll);
    const bOnly = await sample(page);
    assert.equal(bOnly.zoneAExit, 1);
    assert.equal(bOnly.zoneBEnter, 1);
    await key('KeyD', false);
    await key('KeyA', true);
    await page.waitForFunction(() =>
      document.querySelector('#diagnostics').dataset.zoneAOccupied === 'true' &&
      document.querySelector('#diagnostics').dataset.zoneBOccupied === 'true', undefined, poll);
    const overlap = await sample(page);
    assert.ok(overlap.zoneAEnter >= 2);
    assert.equal(overlap.zoneBExit, 0);
    await capture('zones-overlap-independent', true);
    await page.waitForFunction(() =>
      document.querySelector('#diagnostics').dataset.zoneAOccupied === 'true' &&
      document.querySelector('#diagnostics').dataset.zoneBOccupied === 'false', undefined, poll);
    await key('KeyA', false);
    const aOnly = await sample(page);
    assert.equal(aOnly.zoneBExit, 1);

    // G05: reset from inside a zone establishes a new baseline without fake walk events.
    const tickBeforeReset = aOnly.tick;
    await reset();
    const resetState = await sample(page);
    assert.ok(resetState.tick >= tickBeforeReset, 'Debug reset must not reset global Tick');
    assert.equal(resetState.zoneBaselineCount, 2);
    assert.ok(resetState.zoneBaselineTick <= resetState.tick);
    assert.equal(resetState.zoneAOccupied, false);
    assert.equal(resetState.zoneBOccupied, false);
    assert.equal(resetState.zoneAEnter, 0);
    assert.equal(resetState.zoneAExit, 0);
    assert.equal(resetState.zoneBEnter, 0);
    assert.equal(resetState.zoneBExit, 0);
    await capture('zones-reset-baseline', true);

    // G04: hidden/minimized interval freezes state and resume does not repeat enter.
    await key('KeyD', true);
    await page.waitForFunction(() => document.querySelector('#diagnostics').dataset.zoneAOccupied === 'true',
      undefined, poll);
    await key('KeyD', false);
    const beforePause = await sample(page);
    ctx.stage = 'zone-a-wait-hidden';
    await ctx.hide();
    await page.waitForFunction(() => document.visibilityState === 'hidden' &&
      document.querySelector('#diagnostics').dataset.paused === 'true', undefined, { polling: 100 });
    const frozen = await waitStablePausedSample();
    assert.equal(frozen.control, false);
    assert.equal(frozen.zoneAOccupied, true);
    assert.equal(frozen.zoneAEnter, 1);
    assert.equal(frozen.zoneAExit, 0);
    const hiddenWindow = await ctx.windowState?.();
    await capture('zone-a-hidden-frozen', true);
    await page.waitForTimeout(1200);
    assert.deepEqual(await sample(page), frozen, 'Diagnostic zones must freeze while hidden/minimized');

    await installResumeProbe();
    ctx.stage = 'zone-a-restore';
    await ctx.show();
    const resumed = parseSample(await page.evaluate(() => window.__d05Resume));
    assert.equal(resumed.paused, false);
    assert.equal(resumed.tokens, 0);
    assert.ok(resumed.tick - frozen.tick <= 5);
    assert.equal(resumed.discarded, frozen.discarded);
    assert.deepEqual({
      a: [resumed.zoneAOccupied, resumed.zoneAEnter, resumed.zoneAExit],
      b: [resumed.zoneBOccupied, resumed.zoneBEnter, resumed.zoneBExit],
    }, {
      a: [frozen.zoneAOccupied, frozen.zoneAEnter, frozen.zoneAExit],
      b: [frozen.zoneBOccupied, frozen.zoneBEnter, frozen.zoneBExit],
    });
    const resumedWindow = await ctx.windowState?.();
    await capture('zone-a-restored', true);
    await page.waitForTimeout(250);
    assert.equal((await sample(page)).zoneAEnter, resumed.zoneAEnter);

    // A real post-resume exit and re-entry must still record normally.
    await key('KeyA', true);
    await page.waitForFunction(exitCount =>
      +document.querySelector('#diagnostics').dataset.zoneAExit > exitCount,
    frozen.zoneAExit, poll);
    await key('KeyA', false);
    await key('KeyD', true);
    await page.waitForFunction(enterCount =>
      +document.querySelector('#diagnostics').dataset.zoneAEnter > enterCount,
    frozen.zoneAEnter, poll);
    await key('KeyD', false);
    const postResumeReentry = await sample(page);
    await capture('zone-a-post-resume-reentry', true);

    // G05: a scene switch creates a fresh world with no old occupancy, counters or listeners.
    await chooseScene(ctx, 'diagnostic');
    await capture('diagnostic-scene', true);
    await chooseScene(ctx, 'graybox');
    await ctx.show();
    await page.waitForFunction(() => {
      const data = document.querySelector('#diagnostics').dataset;
      return data.zoneBaselineCount === '0' && data.zoneAOccupied === 'false' &&
        data.zoneBOccupied === 'false' && data.zoneAEnter === '0' && data.zoneBEnter === '0';
    }, undefined, poll);
    const switched = await sample(page);
    await page.waitForTimeout(300);
    const switchedStable = await sample(page);
    assert.equal(switchedStable.zoneAEnter, 0);
    assert.equal(switchedStable.zoneBEnter, 0);
    assert.equal(switchedStable.zoneAOccupied, false);
    assert.equal(switchedStable.zoneBOccupied, false);
    await capture('scene-switch-zones-clean', true);

    // G06 regression smoke: existing moving platforms remain live on the fresh scene.
    assert.ok(switchedStable.movingHX >= 1710 && switchedStable.movingHX <= 1780);
    assert.ok(switchedStable.movingVY >= 220 && switchedStable.movingVY <= 310);
    await page.waitForFunction(clock => +document.querySelector('#diagnostics').dataset.platformClock > clock,
      switchedStable.platformClock, poll);
    const platformsAlive = await sample(page);
    assert.equal(platformsAlive.physicsSteps, platformsAlive.tick);
    await up();
    assert.deepEqual(ctx.errors, []);
    return {
      initial, firstA, sustainedA, bOnly, overlap, aOnly, resetState, frozen, resumed,
      postResumeReentry, switched: switchedStable, platformsAlive, hiddenWindow, resumedWindow,
    };
  });
  record('D05-diagnostic-zones', { status: 'PASS', ...result });
  console.log('PASS', ctx.label, 'D05 diagnostic-zones', JSON.stringify(result));
  await capture('D05-diagnostic-zones-completed', true);
}

// D08 intentionally exercises only the in-memory progress prototype through the
// production E interaction entry and the real Web/Electron lifecycle signals.
export async function checkInMemoryProgress(ctx, record, capture) {
  const page = ctx.page;
  const key = (code, down) => ctx.monitor.key(code, down);
  const up = async () => {
    for (const code of ['KeyA', 'KeyD', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyE', 'Escape', 'KeyR']) {
      await key(code, false);
    }
  };
  const resetViaR = async () => {
    await ctx.show();
    await up();
    const before = await sample(page);
    await key('KeyR', true);
    await key('KeyR', false);
    await page.waitForFunction(({ resets, tick }) => {
      const data = document.querySelector('#diagnostics')?.dataset;
      return Number(data?.resets) !== resets && Number(data?.tick) >= tick &&
        Number(data?.x) <= 81 && data?.interactionMode === 'idle' &&
        data?.interactionActive === '' && data?.interactionConsumed === '0' &&
        data?.interactionStarts === '0' && data?.interactionFeedbackCount === '0' &&
        data?.grounded === 'true' && data?.controlAllowed === 'true';
    }, { resets: before.resets, tick: before.tick }, poll);
  };
  const moveUntilSelected = async (id, code = 'KeyD') => {
    await key(code, true);
    await page.waitForFunction(id =>
      document.querySelector('#diagnostics')?.dataset.interactionSelected === id,
    id, poll);
    await key(code, false);
    await page.waitForFunction(id =>
      document.querySelector('#diagnostics')?.dataset.interactionSelected === id,
    id, poll);
  };
  const interact = async () => {
    await key('KeyE', true);
    await page.waitForFunction(() =>
      document.querySelector('#diagnostics')?.dataset.interactionMode === 'feedback',
    undefined, poll);
    await key('KeyE', false);
  };
  const waitStablePausedSample = async () => {
    let previous;
    for (let attempt = 0; attempt < 10; attempt++) {
      await page.waitForTimeout(100);
      const current = await sample(page);
      if (previous && JSON.stringify(current) === JSON.stringify(previous)) return current;
      previous = current;
    }
    throw new Error('Paused D08 diagnostics did not settle');
  };
  const installResumeProbe = () => page.evaluate(() => {
    window.__d08Resume = new Promise(resolve => {
      const changed = () => {
        if (document.visibilityState !== 'visible') return;
        document.removeEventListener('visibilitychange', changed);
        requestAnimationFrame(() => resolve({ ...document.querySelector('#diagnostics').dataset }));
      };
      document.addEventListener('visibilitychange', changed);
    });
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

  await run('D08-P01-initial-run-progress-empty', async () => {
    await resetViaR();
    const initial = await sample(page);
    assert.deepEqual({
      collections: initial.progressCollectionCount,
      goals: initial.progressGoalCount,
      rewards: initial.progressRewardCount,
      effects: initial.progressEffectCount,
    }, { collections: 0, goals: 0, rewards: 0, effects: 0 });
    assert.equal(initial.progressCollectionIds, '');
    assert.equal(initial.progressGoalIds, '');
    assert.equal(initial.progressRewardIds, '');
    assert.equal(initial.progressEffects, '');
    assert.equal(initial.progressRouteOpen, false);
    return {
      counts: [0, 0, 0, 0], routeGateOpen: initial.progressRouteOpen,
      resets: initial.resets,
    };
  });

  await run('D08-P02-collection-idempotent-repeat-reentry', async () => {
    await resetViaR();
    await moveUntilSelected('prototype-collection-d');
    const before = await sample(page);
    assert.match(before.interactionPrompt, /收藏 D/);
    await interact();
    await page.waitForFunction(() =>
      document.querySelector('#diagnostics')?.dataset.progressCollectionCount === '1',
    undefined, poll);
    const first = await sample(page);
    assert.equal(first.progressCollectionIds, 'collection.prototype.travel-token');
    assert.equal(first.progressGoalCount, 0);
    assert.match(first.interactionFeedback, /测试收藏 \+1/);
    await capture('D08-collection-first', true);

    await interact();
    assert.equal((await sample(page)).progressCollectionCount, 1);

    await key('KeyA', true);
    await page.waitForFunction(() =>
      +document.querySelector('#diagnostics').dataset.x < 350 &&
      document.querySelector('#diagnostics').dataset.interactionSelected !== 'prototype-collection-d',
    undefined, poll);
    await key('KeyA', false);
    await moveUntilSelected('prototype-collection-d');
    const consumedBeforeRepeat = (await sample(page)).interactionConsumed;
    await interact();
    const repeated = await sample(page);
    assert.equal(repeated.progressCollectionCount, 1);
    assert.equal(repeated.interactionConsumed, consumedBeforeRepeat + 1);
    assert.match(repeated.interactionFeedback, /重复请求未新增/);
    return {
      collectionCount: repeated.progressCollectionCount,
      collectionId: repeated.progressCollectionIds,
      consumedInteractions: repeated.interactionConsumed,
      goalCount: repeated.progressGoalCount,
    };
  });

  await run('D08-P03-goal-reward-and-effect-single-award', async () => {
    await resetViaR();
    await moveUntilSelected('prototype-goal-e');
    const before = await sample(page);
    assert.match(before.interactionPrompt, /完成目标 E/);
    await interact();
    await page.waitForFunction(() => {
      const data = document.querySelector('#diagnostics')?.dataset;
      return data.progressGoalCount === '1' && data.progressRewardCount === '1' &&
        data.progressEffectCount === '1' && data.progressRouteOpen === 'true' &&
        data.goalPhase === 'succeeded';
    }, undefined, poll);
    const completed = await sample(page);
    assert.equal(completed.progressGoalIds, 'goal.prototype.open-test-route');
    assert.equal(completed.progressRewardIds, 'reward.prototype.open-test-route');
    assert.equal(completed.progressEffects, 'effect.prototype.open-test-route:active');
    assert.match(completed.interactionFeedback, /Event #1.*Pending/);
    assert.equal(completed.goalPhase, 'succeeded');
    assert.match(completed.goalMessage, /链路完成/);
    await capture('D08-goal-route-open', true);

    await interact();
    progressReplayCheck: {
      const repeated = await sample(page);
      assert.equal(repeated.progressGoalCount, 1);
      assert.equal(repeated.progressRewardCount, 1);
      assert.equal(repeated.progressEffectCount, 1);
      assert.equal(repeated.progressRouteOpen, true);
      break progressReplayCheck;
    }
    return {
      counts: {
        collection: completed.progressCollectionCount,
        goal: completed.progressGoalCount,
        reward: completed.progressRewardCount,
        effect: completed.progressEffectCount,
      },
      ids: {
        goal: completed.progressGoalIds,
        reward: completed.progressRewardIds,
        effect: completed.progressEffects,
      },
      routeGateOpen: completed.progressRouteOpen,
      feedback: completed.interactionFeedback,
    };
  });

  await run('D08-P04-effect-remains-open-without-toggle', async () => {
    const before = await sample(page);
    assert.equal(before.progressRouteOpen, true);
    await interact();
    const replay = await sample(page);
    assert.equal(replay.progressRouteOpen, true);
    assert.equal(replay.progressRewardCount, 1);
    assert.equal(replay.progressEffectCount, 1);
    assert.equal(replay.progressEffects, 'effect.prototype.open-test-route:active');
    await capture('D08-effect-replayed-still-open', true);
    return {
      routeGateOpen: replay.progressRouteOpen,
      rewardCount: replay.progressRewardCount,
      effectCount: replay.progressEffectCount,
      effectState: replay.progressEffects,
    };
  });

  await run('D08-P05-reset-preserves-progress-and-reapplies-effect', async () => {
    const beforeReset = await sample(page);
    await resetViaR();
    const reset = await sample(page);
    assert.ok(reset.resets > beforeReset.resets);
    assert.equal(reset.x, 80);
    assert.equal(reset.interactionMode, 'idle');
    assert.equal(reset.interactionConsumed, 0);
    assert.equal(reset.interactionFeedbackCount, 0);
    assert.equal(reset.progressCollectionCount, 1);
    assert.equal(reset.progressGoalCount, 1);
    assert.equal(reset.progressRewardCount, 1);
    assert.equal(reset.progressEffectCount, 1);
    assert.equal(reset.progressRouteOpen, true,
      'Reset clears transient state, then reconciles the retained permanent effect');
    assert.ok(reset.platformClock < 700);
    await capture('D08-reset-progress-retained', true);
    return {
      x: reset.x, interactionConsumed: reset.interactionConsumed,
      progressCounts: [reset.progressCollectionCount, reset.progressGoalCount,
        reset.progressRewardCount, reset.progressEffectCount],
      routeGateOpen: reset.progressRouteOpen, platformClockMs: reset.platformClock,
    };
  });

  await run('D08-P06-hidden-minimized-freeze-and-no-auto-interaction', async () => {
    await moveUntilSelected('prototype-goal-e');
    await key('KeyE', true);
    await page.waitForFunction(() =>
      document.querySelector('#diagnostics')?.dataset.interactionMode === 'feedback',
    undefined, poll);
    const beforeHide = await sample(page);
    assert.equal(beforeHide.progressRewardCount, 1);

    ctx.stage = 'D08-lifecycle-wait-hidden';
    await ctx.hide();
    await page.waitForFunction(() => document.visibilityState === 'hidden' &&
      document.querySelector('#diagnostics').dataset.paused === 'true', undefined, { polling: 100 });
    const frozen = await waitStablePausedSample();
    assert.equal(frozen.control, false);
    assert.equal(frozen.interactionNeedsRelease, true);
    assert.equal(frozen.progressCollectionCount, beforeHide.progressCollectionCount);
    assert.equal(frozen.progressGoalCount, beforeHide.progressGoalCount);
    assert.equal(frozen.progressRewardCount, beforeHide.progressRewardCount);
    assert.equal(frozen.progressEffectCount, beforeHide.progressEffectCount);
    assert.equal(frozen.interactionConsumed, beforeHide.interactionConsumed);
    await capture('D08-hidden-frozen', true);
    await page.waitForTimeout(1200);
    assert.deepEqual(await sample(page), frozen,
      'Hidden/minimized progress and interaction diagnostics must remain frozen');

    await installResumeProbe();
    ctx.stage = 'D08-lifecycle-wait-restore';
    await ctx.show();
    const resumedAtVisibility = parseSample(await page.evaluate(() => window.__d08Resume));
    assert.equal(resumedAtVisibility.paused, false);
    assert.equal(resumedAtVisibility.progressRewardCount, 1);
    if (!resumedAtVisibility.control) assert.equal(resumedAtVisibility.interactionPrompt, '');
    await page.waitForFunction(() => document.visibilityState === 'visible' &&
      document.hasFocus() && document.querySelector('#diagnostics').dataset.paused === 'false' &&
      document.querySelector('#diagnostics').dataset.controlAllowed === 'true',
    undefined, poll);
    const resumed = await sample(page);
    assert.equal(resumed.progressCollectionCount, frozen.progressCollectionCount);
    assert.equal(resumed.progressGoalCount, frozen.progressGoalCount);
    assert.equal(resumed.progressRewardCount, frozen.progressRewardCount);
    assert.equal(resumed.progressEffectCount, frozen.progressEffectCount);
    assert.equal(resumed.interactionConsumed, frozen.interactionConsumed);
    assert.equal(resumed.interactionNeedsRelease, true);
    assert.equal(resumed.interactionPrompt, '');
    await capture('D08-restored-no-auto-interaction', true);

    await key('KeyE', false);
    await page.waitForTimeout(200);
    const released = await sample(page);
    assert.equal(released.progressRewardCount, 1);
    assert.equal(released.interactionConsumed, frozen.interactionConsumed);
    return {
      frozen: {
        tick: frozen.tick, progress: [frozen.progressCollectionCount, frozen.progressGoalCount,
          frozen.progressRewardCount, frozen.progressEffectCount],
        consumed: frozen.interactionConsumed, needsRelease: frozen.interactionNeedsRelease,
      },
      resumed: {
        tick: resumed.tick, visibilityDelayTicks: resumed.tick - frozen.tick,
        consumed: resumed.interactionConsumed, control: resumed.control,
        needsRelease: resumed.interactionNeedsRelease,
      },
      afterRelease: { consumed: released.interactionConsumed, prompt: released.interactionPrompt },
    };
  });
}

export async function checkGoalRouteRuntime(ctx, record, capture) {
  const page = ctx.page;
  const key = (code, down) => ctx.monitor.key(code, down);
  const up = async () => {
    for (const code of ['KeyA', 'KeyD', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyE', 'Escape', 'KeyR']) {
      await key(code, false);
    }
  };
  const resetViaR = async () => {
    await ctx.show();
    await up();
    const before = await sample(page);
    await key('KeyR', true);
    await key('KeyR', false);
    await page.waitForFunction(({ resets, tick }) => {
      const data = document.querySelector('#diagnostics')?.dataset;
      return Number(data?.resets) > resets && Number(data?.tick) >= tick &&
        Number(data?.x) <= 81 && data?.interactionMode === 'idle' &&
        data?.interactionConsumed === '0' && data?.grounded === 'true' &&
        data?.controlAllowed === 'true';
    }, { resets: before.resets, tick: before.tick }, poll);
    return sample(page);
  };
  const moveUntilGoalSelected = async () => {
    await key('KeyD', true);
    await page.waitForFunction(() =>
      document.querySelector('#diagnostics')?.dataset.interactionSelected === 'prototype-goal-e',
    undefined, poll);
    await key('KeyD', false);
    await page.waitForFunction(() =>
      document.querySelector('#diagnostics')?.dataset.interactionSelected === 'prototype-goal-e',
    undefined, poll);
  };
  const waitStablePausedSample = async () => {
    let previous;
    for (let attempt = 0; attempt < 10; attempt++) {
      await page.waitForTimeout(100);
      const current = await sample(page);
      if (previous && JSON.stringify(current) === JSON.stringify(previous)) return current;
      previous = current;
    }
    throw new Error('Paused D09-D1 diagnostics did not settle');
  };
  const run = async (name, fn) => {
    ctx.operation = 'graybox-' + name;
    ctx.stage = ctx.operation;
    await ctx.show();
    await page.waitForFunction(() => document.visibilityState === 'visible' && document.hasFocus(),
      undefined, poll);
    const result = await ctx.monitor.race(fn);
    record(name, { status: 'PASS', ...result });
    console.log('PASS', ctx.label, 'graybox', name, JSON.stringify(result));
  };

  await chooseScene(ctx, 'graybox');
  let successful = await resetViaR();
  assert.equal(successful.progressGoalCount, 0);
  assert.equal(successful.goalPhase, 'idle');

  await run('D09-D1-H01-real-host-route', async () => {
    await moveUntilGoalSelected();
    const before = await sample(page);
    assert.match(before.interactionPrompt, /完成目标 E/);
    assert.equal(before.progressGoalCount, 0);
    assert.equal(before.progressRewardCount, 0);
    assert.equal(before.progressEffectCount, 0);
    assert.equal(before.progressRouteOpen, false);
    assert.equal(before.goalEventId, null);

    await key('KeyE', true);
    await page.waitForFunction(() => {
      const data = document.querySelector('#diagnostics')?.dataset;
      return data.goalPhase === 'succeeded' &&
        data.progressGoalCount === '1' && data.progressRewardCount === '1' &&
        data.progressEffectCount === '1' && data.progressRouteOpen === 'true';
    }, undefined, poll);
    successful = await sample(page);

    assert.equal(successful.goalDeliveryStatus, 'accepted');
    assert.equal(successful.goalTransactionStatus, 'succeeded');
    assert.equal(successful.goalTerminalStatus, 'succeeded');
    assert.equal(successful.goalResultLifecycle, 'retired');
    assert.ok(successful.goalEventId >= 1);
    assert.ok(successful.goalCommandId >= 1);
    assert.ok(successful.goalTransactionId >= 1);
    assert.ok(successful.goalResultEventId > successful.goalEventId,
      'The final result must own an independent later Event ID');
    assert.equal(successful.goalOriginalCompletedTick, successful.goalAcceptedTick);
    assert.equal(successful.goalApplyTick, successful.goalAcceptedTick);
    assert.ok(successful.goalVerifyTick > successful.goalApplyTick);
    assert.equal(successful.goalTerminalTick, successful.goalVerifyTick);
    assert.equal(successful.goalResultCreatedTick, successful.goalVerifyTick);
    assert.ok(successful.goalResultConsumedTick > successful.goalVerifyTick,
      'The result event must be consumed in a later coordination Tick');
    assert.equal(successful.goalOriginalAcknowledged, true);
    assert.equal(successful.goalOriginalRetired, true);
    assert.equal(successful.goalResultAcknowledged, true);
    assert.equal(successful.goalResultRetired, true);
    assert.equal(successful.goalResultConsumerAttempts, 1);
    assert.equal(successful.goalResultConsumptionCount, 1);
    assert.deepEqual([
      successful.goalAcceptedBusinessGoals,
      successful.goalAcceptedBusinessRewards,
      successful.goalAcceptedBusinessEffects,
    ], [0, 0, 0], 'Accepted happened before business mutation');
    assert.deepEqual([
      successful.goalTerminalBusinessGoals,
      successful.goalTerminalBusinessRewards,
      successful.goalTerminalBusinessEffects,
    ], [1, 1, 1]);
    assert.deepEqual([
      successful.goalCommands,
      successful.goalAcceptedCommands,
      successful.goalTransactionIntents,
      successful.goalTransactions,
      successful.goalResultEvents,
      successful.goalInboxEvents,
    ], [1, 1, 1, 1, 1, 0]);
    assert.equal(successful.goalLastError, '');
    assert.match(successful.interactionFeedback, /Event #\d+ 已创建为 Pending/);
    assert.match(successful.goalMessage, /链路完成/);
    await capture('D09-D1-real-host-route-success', true);
    return {
      runtimeInstanceId: successful.goalRuntimeInstanceId,
      eventId: successful.goalEventId,
      commandId: successful.goalCommandId,
      transactionId: successful.goalTransactionId,
      resultEventId: successful.goalResultEventId,
      acceptedTick: successful.goalAcceptedTick,
      applyTick: successful.goalApplyTick,
      verifyTick: successful.goalVerifyTick,
      resultConsumedTick: successful.goalResultConsumedTick,
      businessCounts: [
        successful.progressGoalCount,
        successful.progressRewardCount,
        successful.progressEffectCount,
      ],
      routeOpen: successful.progressRouteOpen,
    };
  });

  await run('D09-D1-H02-H03-held-key-pause-release-and-idempotency', async () => {
    const beforeHide = successful;
    assert.equal(beforeHide.interactionNeedsRelease, false);
    assert.equal((await sample(page)).interactionNeedsRelease, false);

    ctx.stage = 'D09-D1-lifecycle-wait-hidden';
    await ctx.hide();
    await page.waitForFunction(() => document.visibilityState === 'hidden' &&
      document.querySelector('#diagnostics').dataset.paused === 'true', undefined,
    { polling: 100 });
    const frozen = await waitStablePausedSample();
    assert.equal(frozen.control, false);
    assert.equal(frozen.interactionNeedsRelease, true);
    assert.equal(frozen.goalPhase, 'succeeded');
    assert.equal(frozen.goalResultConsumptionCount, 1);
    assert.equal(frozen.interactionConsumed, beforeHide.interactionConsumed);
    await page.waitForTimeout(1200);
    assert.deepEqual(await sample(page), frozen,
      'Hidden/minimized route state and held input must remain frozen');
    await capture('D09-D1-hidden-with-held-key', true);

    ctx.stage = 'D09-D1-lifecycle-wait-restore';
    await ctx.show();
    await page.waitForFunction(() => document.visibilityState === 'visible' &&
      document.hasFocus() && document.querySelector('#diagnostics').dataset.paused === 'false' &&
      document.querySelector('#diagnostics').dataset.controlAllowed === 'true', undefined, poll);
    const resumed = await sample(page);
    assert.equal(resumed.goalRuntimeInstanceId, frozen.goalRuntimeInstanceId);
    assert.equal(resumed.goalEventId, frozen.goalEventId);
    assert.equal(resumed.goalCommandId, frozen.goalCommandId);
    assert.equal(resumed.goalTransactionId, frozen.goalTransactionId);
    assert.equal(resumed.goalResultEventId, frozen.goalResultEventId);
    assert.equal(resumed.goalResultConsumptionCount, 1);
    assert.equal(resumed.interactionConsumed, frozen.interactionConsumed);
    assert.equal(resumed.interactionNeedsRelease, true);
    assert.equal(resumed.interactionPrompt, '');
    await capture('D09-D1-restored-held-key-no-auto-interaction', true);

    await key('KeyE', false);
    await page.waitForFunction(() =>
      document.querySelector('#diagnostics')?.dataset.interactionNeedsRelease === 'false',
    undefined, poll);
    await key('KeyE', true);
    await page.waitForFunction(consumed =>
      +document.querySelector('#diagnostics').dataset.interactionConsumed > consumed,
    frozen.interactionConsumed, poll);
    await key('KeyE', false);
    const repeated = await sample(page);
    assert.equal(repeated.progressGoalCount, 1);
    assert.equal(repeated.progressRewardCount, 1);
    assert.equal(repeated.progressEffectCount, 1);
    assert.equal(repeated.goalCommands, 1);
    assert.equal(repeated.goalTransactions, 1);
    assert.equal(repeated.goalResultEvents, 1);
    assert.equal(repeated.goalResultConsumptionCount, 1);
    return {
      frozenTick: frozen.tick,
      resumedTick: resumed.tick,
      held: {
        consumed: frozen.interactionConsumed,
        needsRelease: frozen.interactionNeedsRelease,
      },
      repeated: {
        consumed: repeated.interactionConsumed,
        commandCount: repeated.goalCommands,
        transactionCount: repeated.goalTransactions,
        resultEventCount: repeated.goalResultEvents,
        rewards: repeated.progressRewardCount,
      },
    };
  });

  await run('D09-D1-H04-reset-and-full-runtime-boundary', async () => {
    const beforeReset = await sample(page);
    const reset = await resetViaR();
    assert.equal(reset.goalRuntimeInstanceId, beforeReset.goalRuntimeInstanceId);
    assert.equal(reset.goalEventId, beforeReset.goalEventId);
    assert.equal(reset.goalCommandId, beforeReset.goalCommandId);
    assert.equal(reset.goalTransactionId, beforeReset.goalTransactionId);
    assert.equal(reset.goalResultEventId, beforeReset.goalResultEventId);
    assert.equal(reset.goalPhase, 'succeeded');
    assert.equal(reset.progressGoalCount, 1);
    assert.equal(reset.progressRewardCount, 1);
    assert.equal(reset.progressEffectCount, 1);
    assert.equal(reset.progressRouteOpen, true);
    assert.equal(reset.x, 80);
    assert.equal(reset.interactionConsumed, 0);
    await capture('D09-D1-debug-reset-retains-run-identity', true);

    await up();
    ctx.monitor.navigation('D09-D1-full-runtime-restart');
    await Promise.all([
      page.waitForEvent('framenavigated', { predicate: frame => frame === page.mainFrame() }),
      page.locator('#restart').click(),
    ]);
    await page.waitForFunction(oldId => {
      const data = document.querySelector('#diagnostics')?.dataset;
      return Boolean(data?.goalRuntimeInstanceId) && data.goalRuntimeInstanceId !== oldId &&
        document.querySelector('#restart')?.disabled === false;
    }, beforeReset.goalRuntimeInstanceId, { timeout: 15000, polling: 100 });
    await ctx.show();
    await chooseScene(ctx, 'graybox');
    await page.waitForFunction(() => {
      const data = document.querySelector('#diagnostics')?.dataset;
      return Number(data?.tick) >= 1 && data?.goalPhase === 'idle';
    }, undefined, poll);
    const fresh = await sample(page);
    assert.notEqual(fresh.goalRuntimeInstanceId, beforeReset.goalRuntimeInstanceId);
    assert.equal(fresh.goalEventId, null);
    assert.equal(fresh.goalCommandId, null);
    assert.equal(fresh.goalTransactionId, null);
    assert.equal(fresh.goalResultEventId, null);
    assert.equal(fresh.progressGoalCount, 0);
    assert.equal(fresh.progressRewardCount, 0);
    assert.equal(fresh.progressEffectCount, 0);
    assert.equal(fresh.progressRouteOpen, false);
    await capture('D09-D1-full-runtime-fresh-identity', true);
    return {
      debugReset: {
        runtimeInstanceId: reset.goalRuntimeInstanceId,
        eventId: reset.goalEventId,
        commandId: reset.goalCommandId,
        transactionId: reset.goalTransactionId,
        resultEventId: reset.goalResultEventId,
        rewards: reset.progressRewardCount,
        routeOpen: reset.progressRouteOpen,
      },
      fullRestart: {
        runtimeInstanceId: fresh.goalRuntimeInstanceId,
        goalCount: fresh.progressGoalCount,
        rewardCount: fresh.progressRewardCount,
        effectCount: fresh.progressEffectCount,
        routeOpen: fresh.progressRouteOpen,
      },
    };
  });

  await up();
  assert.deepEqual(ctx.errors, []);
}

// D10-A1 keeps the check focused on initialization, lifecycle stability and
// the existing goal-E chain instead of rerunning the historical physics suite.
export async function checkInitialSnapshot(ctx, record, capture) {
  const page = ctx.page;
  const key = (code, down) => ctx.monitor.key(code, down);
  const up = async () => {
    for (const code of ['KeyA', 'KeyD', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyE', 'Escape', 'KeyR']) {
      await key(code, false);
    }
  };
  const waitStablePausedSample = async () => {
    let previous;
    for (let attempt = 0; attempt < 10; attempt++) {
      await page.waitForTimeout(100);
      const current = await sample(page);
      if (previous && JSON.stringify(current) === JSON.stringify(previous)) return current;
      previous = current;
    }
    throw new Error('Paused D10-A1 diagnostics did not settle');
  };
  const resetViaR = async () => {
    await ctx.show();
    await up();
    const before = await sample(page);
    await key('KeyR', true);
    await key('KeyR', false);
    await page.waitForFunction(({ resets, tick }) => {
      const data = document.querySelector('#diagnostics')?.dataset;
      return Number(data?.resets) > resets && Number(data?.tick) >= tick &&
        Number(data?.x) <= 81 && data?.interactionMode === 'idle' &&
        data?.interactionConsumed === '0' && data?.grounded === 'true' &&
        data?.controlAllowed === 'true';
    }, { resets: before.resets, tick: before.tick }, poll);
    return sample(page);
  };
  const moveUntilGoalSelected = async () => {
    await key('KeyD', true);
    await page.waitForFunction(() =>
      document.querySelector('#diagnostics')?.dataset.interactionSelected === 'prototype-goal-e',
    undefined, poll);
    await key('KeyD', false);
    await page.waitForFunction(() =>
      document.querySelector('#diagnostics')?.dataset.interactionSelected === 'prototype-goal-e',
    undefined, poll);
  };

  ctx.operation = 'D10-A1-initial-snapshot';
  ctx.stage = 'graybox-preparation';
  const result = await ctx.monitor.race(async () => {
    await chooseScene(ctx, 'graybox');
    await ctx.show();
    const initial = await sample(page);
    assert.equal(initial.checkpointStatus, 'READY');
    assert.equal(initial.checkpointError, '');
    assert.equal(initial.checkpointCaptureAttempts, 1);
    assert.equal(initial.checkpointCapturedAtTick, 0);
    assert.equal(initial.checkpointSchemaVersion, 1);
    assert.equal(initial.checkpointObjectCount, 2);
    assert.equal(initial.checkpointObjectIds, 'moving-horizontal-a,moving-vertical-a');
    assert.equal(initial.checkpointStateVersions,
      'moving-horizontal-a:1,moving-vertical-a:1');
    assert.equal(initial.checkpointAnchor, '80,472,1');
    assert.equal(initial.checkpointRuntimeInstanceId, initial.goalRuntimeInstanceId);
    assert.ok(initial.checkpointPayload);
    assert.equal(initial.control, true);
    await capture('D10-A1-initial-snapshot-ready', true);

    // Input held at the lifecycle boundary is cleared; a restore must not replay
    // either the jump or interaction request, and the backup must not be recaptured.
    await key('Space', true);
    await key('KeyE', true);
    await page.waitForTimeout(100);
    ctx.stage = 'D10-A1-lifecycle-wait-hidden';
    await ctx.hide();
    await page.waitForFunction(() => document.visibilityState === 'hidden' &&
      document.querySelector('#diagnostics').dataset.paused === 'true', undefined,
    { polling: 100 });
    const frozen = await waitStablePausedSample();
    assert.equal(frozen.control, false);
    assert.equal(frozen.needsRelease, true);
    assert.equal(frozen.interactionNeedsRelease, true);
    assert.equal(frozen.checkpointCaptureAttempts, 1);
    assert.equal(frozen.checkpointPayload, initial.checkpointPayload);
    await page.waitForTimeout(1200);
    assert.deepEqual(await sample(page), frozen,
      'Initial snapshot and simulation state must freeze while hidden/minimized');
    await capture('D10-A1-hidden-frozen', true);

    ctx.stage = 'D10-A1-lifecycle-wait-restore';
    await ctx.show();
    await page.waitForFunction(() => document.visibilityState === 'visible' &&
      document.hasFocus() && document.querySelector('#diagnostics').dataset.paused === 'false' &&
      document.querySelector('#diagnostics').dataset.controlAllowed === 'true', undefined, poll);
    const resumed = await sample(page);
    assert.ok(resumed.tick - frozen.tick <= 5);
    assert.equal(resumed.discarded, frozen.discarded);
    assert.equal(resumed.checkpointCaptureAttempts, 1);
    assert.equal(resumed.checkpointPayload, frozen.checkpointPayload);
    assert.equal(resumed.checkpointRuntimeInstanceId, initial.checkpointRuntimeInstanceId);
    assert.equal(resumed.jumps, frozen.jumps);
    assert.equal(resumed.interactionConsumed, frozen.interactionConsumed);
    assert.equal(resumed.interactionNeedsRelease, true);
    assert.equal(resumed.interactionPrompt, '');
    await capture('D10-A1-restored-held-inputs-no-replay', true);
    await up();

    const reset = await resetViaR();
    assert.equal(reset.checkpointCaptureAttempts, 1);
    assert.equal(reset.checkpointPayload, initial.checkpointPayload);
    assert.equal(reset.goalRuntimeInstanceId, initial.goalRuntimeInstanceId);
    await capture('D10-A1-reset-preserves-backup', true);

    // Existing target-E host chain remains functional on the same snapshot run.
    await moveUntilGoalSelected();
    const beforeGoal = await sample(page);
    assert.match(beforeGoal.interactionPrompt, /完成目标 E/);
    await key('KeyE', true);
    await page.waitForFunction(() => {
      const data = document.querySelector('#diagnostics')?.dataset;
      return data.goalPhase === 'succeeded' && data.progressGoalCount === '1' &&
        data.progressRewardCount === '1' && data.progressEffectCount === '1' &&
        data.progressRouteOpen === 'true';
    }, undefined, poll);
    await key('KeyE', false);
    const completed = await sample(page);
    assert.equal(completed.checkpointCaptureAttempts, 1);
    assert.equal(completed.checkpointPayload, initial.checkpointPayload);
    assert.equal(completed.checkpointRuntimeInstanceId, initial.checkpointRuntimeInstanceId);
    assert.equal(completed.goalResultLifecycle, 'retired');
    assert.equal(completed.goalResultConsumptionCount, 1);
    await capture('D10-A1-goal-e-succeeded-snapshot-unchanged', true);

    const afterCompletionReset = await resetViaR();
    assert.equal(afterCompletionReset.progressGoalCount, 1);
    assert.equal(afterCompletionReset.progressRewardCount, 1);
    assert.equal(afterCompletionReset.progressEffectCount, 1);
    assert.equal(afterCompletionReset.progressRouteOpen, true);
    assert.equal(afterCompletionReset.checkpointCaptureAttempts, 1);
    assert.equal(afterCompletionReset.checkpointPayload, initial.checkpointPayload);
    assert.deepEqual({
      runtime: afterCompletionReset.goalRuntimeInstanceId,
      event: afterCompletionReset.goalEventId,
      command: afterCompletionReset.goalCommandId,
      transaction: afterCompletionReset.goalTransactionId,
      result: afterCompletionReset.goalResultEventId,
    }, {
      runtime: completed.goalRuntimeInstanceId,
      event: completed.goalEventId,
      command: completed.goalCommandId,
      transaction: completed.goalTransactionId,
      result: completed.goalResultEventId,
    });
    await capture('D10-A1-reset-preserves-progress-and-backup', true);

    await up();
    ctx.monitor.navigation('D10-A1-full-runtime-restart');
    await Promise.all([
      page.waitForEvent('framenavigated', { predicate: frame => frame === page.mainFrame() }),
      page.locator('#restart').click(),
    ]);
    await page.waitForFunction(oldId => {
      const data = document.querySelector('#diagnostics')?.dataset;
      return Boolean(data?.goalRuntimeInstanceId) &&
        data.goalRuntimeInstanceId !== oldId && data.checkpointStatus === 'READY' &&
        document.querySelector('#restart')?.disabled === false;
    }, initial.goalRuntimeInstanceId, { timeout: 15000, polling: 100 });
    await ctx.show();
    await chooseScene(ctx, 'graybox');
    await page.waitForFunction(() =>
      document.querySelector('#diagnostics')?.dataset.checkpointStatus === 'READY',
    undefined, poll);
    const fresh = await sample(page);
    assert.notEqual(fresh.goalRuntimeInstanceId, initial.goalRuntimeInstanceId);
    assert.notEqual(fresh.checkpointRuntimeInstanceId, initial.checkpointRuntimeInstanceId);
    assert.notEqual(fresh.checkpointPayload, initial.checkpointPayload);
    assert.equal(fresh.checkpointCaptureAttempts, 1);
    assert.equal(fresh.checkpointObjectCount, 2);
    assert.equal(fresh.checkpointCapturedAtTick, 0);
    assert.equal(fresh.progressGoalCount, 0);
    assert.equal(fresh.progressRewardCount, 0);
    assert.equal(fresh.progressEffectCount, 0);
    await capture('D10-A1-full-runtime-new-backup', true);

    assert.deepEqual(ctx.errors, []);
    return {
      initial: {
        runtimeInstanceId: initial.goalRuntimeInstanceId,
        checkpointRuntimeInstanceId: initial.checkpointRuntimeInstanceId,
        captureAttempts: initial.checkpointCaptureAttempts,
        capturedAtTick: initial.checkpointCapturedAtTick,
        schemaVersion: initial.checkpointSchemaVersion,
        objectIds: initial.checkpointObjectIds,
        stateVersions: initial.checkpointStateVersions,
        anchor: initial.checkpointAnchor,
      },
      lifecycle: {
        frozenTick: frozen.tick,
        resumedTick: resumed.tick,
        jumps: [frozen.jumps, resumed.jumps],
        interactionConsumed: [frozen.interactionConsumed, resumed.interactionConsumed],
        captureAttempts: resumed.checkpointCaptureAttempts,
      },
      goalE: {
        eventId: completed.goalEventId,
        commandId: completed.goalCommandId,
        transactionId: completed.goalTransactionId,
        resultEventId: completed.goalResultEventId,
        resultLifecycle: completed.goalResultLifecycle,
        progress: [
          completed.progressGoalCount,
          completed.progressRewardCount,
          completed.progressEffectCount,
        ],
        routeOpen: completed.progressRouteOpen,
        checkpointPayloadStable:
          completed.checkpointPayload === initial.checkpointPayload,
      },
      reset: {
        captureAttempts: afterCompletionReset.checkpointCaptureAttempts,
        payloadStable: afterCompletionReset.checkpointPayload === initial.checkpointPayload,
        runtimeStable:
          afterCompletionReset.goalRuntimeInstanceId === completed.goalRuntimeInstanceId,
      },
      fullRestart: {
        runtimeInstanceId: fresh.goalRuntimeInstanceId,
        checkpointRuntimeInstanceId: fresh.checkpointRuntimeInstanceId,
        captureAttempts: fresh.checkpointCaptureAttempts,
        capturedAtTick: fresh.checkpointCapturedAtTick,
      },
    };
  });
  record('D10-A1-initial-snapshot', { status: 'PASS', ...result });
  console.log('PASS', ctx.label, 'D10-A1 initial-snapshot', JSON.stringify(result));
}

// D10-A3 exercises the real host path: keyboard movement into visible sensors,
// closed-Tick arbitration, the existing capture command/transaction/result
// chain, and a later true re-entry. It deliberately does not call the direct
// requestCheckpointCapture test hook.
export async function checkCheckpointCapture(ctx, record, capture) {
  const page = ctx.page;
  const key = (code, down) => ctx.monitor.key(code, down);
  const up = async () => {
    for (const code of [
      'KeyA', 'KeyD', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyE', 'Escape', 'KeyR',
    ]) await key(code, false);
  };
  const waitStablePausedSample = async () => {
    let previous;
    for (let attempt = 0; attempt < 10; attempt++) {
      await page.waitForTimeout(100);
      const current = await sample(page);
      if (previous && JSON.stringify(current) === JSON.stringify(previous)) return current;
      previous = current;
    }
    throw new Error('Paused D10-A3 diagnostics did not settle');
  };
  const resetViaR = async () => {
    await ctx.show();
    await up();
    const before = await sample(page);
    await key('KeyR', true);
    await key('KeyR', false);
    await page.waitForFunction(({ resets, tick }) => {
      const data = document.querySelector('#diagnostics')?.dataset;
      return Number(data?.resets) > resets && Number(data?.tick) >= tick &&
        Number(data?.x) <= 81 && data?.grounded === 'true' &&
        data?.controlAllowed === 'true';
    }, { resets: before.resets, tick: before.tick }, poll);
    return sample(page);
  };
  const moveUntilGoalSelected = async () => {
    await key('KeyD', true);
    await page.waitForFunction(() =>
      document.querySelector('#diagnostics')?.dataset.interactionSelected === 'prototype-goal-e',
    undefined, poll);
    await key('KeyD', false);
    await page.waitForFunction(() =>
      document.querySelector('#diagnostics')?.dataset.interactionSelected === 'prototype-goal-e',
    undefined, poll);
  };
  const navigatePastRouteGateToCheckpoint = async () => {
    await key('KeyD', true);
    await page.waitForFunction(() => +document.querySelector('#diagnostics').dataset.x > 425,
      undefined, poll);
    await key('Space', true);
    await page.waitForFunction(() => +document.querySelector('#diagnostics').dataset.x > 600,
      undefined, poll);
    await key('Space', false);
    await page.waitForFunction(() => {
      const data = document.querySelector('#diagnostics').dataset;
      return +data.x > 880 && data.grounded === 'false';
    }, undefined, poll);
    const edgeJumps = (await sample(page)).jumps;
    await key('Space', true);
    await page.waitForFunction(jumps =>
      +document.querySelector('#diagnostics').dataset.jumps > jumps,
    edgeJumps, poll);
    await page.waitForFunction(() => {
      const data = document.querySelector('#diagnostics').dataset;
      return +data.x > 1030 && data.grounded === 'true';
    }, undefined, poll);
    await key('Space', false);
    await page.waitForFunction(() =>
      document.querySelector('#diagnostics')?.dataset.checkpointZoneAOccupied === 'true',
    undefined, poll);
    await key('KeyD', false);
    await page.waitForFunction(() =>
      document.querySelector('#diagnostics')?.dataset.checkpointZoneAOccupied === 'true',
    undefined, poll);
  };
  const waitCapture = async (checkpointId, saves) => {
    await page.waitForFunction(({ checkpointId, saves }) => {
      const data = document.querySelector('#diagnostics')?.dataset;
      return data?.checkpointCurrentId === checkpointId &&
        data?.checkpointCapturePhase === 'succeeded' &&
        Number(data?.checkpointCaptureSaves) === saves &&
        data?.checkpointCaptureResourcesReleased === 'true' &&
        data?.checkpointCaptureLockHeld === 'false';
    }, { checkpointId, saves }, { timeout: 15000, polling: 100 });
    return sample(page);
  };
  const run = async (name, fn) => {
    ctx.operation = 'graybox-' + name;
    ctx.stage = ctx.operation;
    await ctx.show();
    await page.waitForFunction(() =>
      document.visibilityState === 'visible' && document.hasFocus(),
    undefined, poll);
    const result = await ctx.monitor.race(fn);
    record(name, { status: 'PASS', ...result });
    console.log('PASS', ctx.label, 'graybox', name, JSON.stringify(result));
  };

  await chooseScene(ctx, 'graybox');
  let initial = await resetViaR();
  assert.equal(initial.checkpointTriggersEnabled, false);
  assert.equal(initial.checkpointCurrentId, 'graybox-initial-spawn');

  let firstA;
  await run('D10-A3-TR01-real-entry-and-save-A', async () => {
    await moveUntilGoalSelected();
    await key('KeyE', true);
    await page.waitForFunction(() => {
      const data = document.querySelector('#diagnostics')?.dataset;
      return data.goalPhase === 'succeeded' && data.progressRouteOpen === 'true' &&
        data.progressRewardCount === '1' && data.checkpointTriggersEnabled === 'true';
    }, undefined, poll);
    await key('KeyE', false);

    // Keep crossing the existing walk/jump route under real input. The direct
    // host API is intentionally unused for this capture.
    await navigatePastRouteGateToCheckpoint();
    const saving = await sample(page);
    assert.ok(saving.checkpointZoneAEnter >= 1);
    assert.ok(saving.checkpointZoneAEntryEventId >= 1);
    assert.equal(saving.checkpointCandidateId, 'graybox-test-capture-a');
    assert.ok([
      'graybox-initial-spawn',
      'graybox-test-capture-a',
    ].includes(saving.checkpointCurrentId),
    'A capture may complete before the first post-entry diagnostic sample');
    await capture('D10-A3-real-entry-saving-A', true);

    firstA = await waitCapture('graybox-test-capture-a', 1);
    assert.equal(firstA.checkpointTriggerFeedbackKind, 'saved');
    assert.equal(firstA.checkpointArbitrationWinner, 'graybox-test-capture-a');
    assert.equal(firstA.checkpointArbitrationBatchTick, firstA.checkpointZoneALastTick);
    assert.equal(firstA.checkpointArbitrationClosedTick, firstA.checkpointArbitrationBatchTick);
    assert.equal(firstA.checkpointArbitrationTickValue, firstA.checkpointArbitrationClosedTick);
    assert.equal(firstA.checkpointCaptureSourceEntryEventId,
      firstA.checkpointArbitrationWinnerEntryEventId);
    assert.ok(firstA.checkpointCaptureEventId >
      firstA.checkpointCaptureSourceEntryEventId);
    assert.ok(firstA.checkpointCaptureCommandId >= 1);
    assert.ok(firstA.checkpointCaptureTransactionId >= 1);
    assert.ok(firstA.checkpointCaptureResultEventId >
      firstA.checkpointCaptureEventId);
    assert.equal(firstA.checkpointCaptureRequestId,
      firstA.checkpointArbitrationWinnerOpportunityId);
    assert.equal(firstA.progressGoalCount, 1);
    assert.equal(firstA.progressRewardCount, 1);
    assert.equal(firstA.progressEffectCount, 1);
    await capture('D10-A3-saved-A-with-real-identities', true);

    const entries = firstA.checkpointEntryEventCount;
    const requests = firstA.checkpointCaptureRequestCount;
    await page.waitForTimeout(800);
    const sustained = await sample(page);
    assert.equal(sustained.checkpointEntryEventCount, entries,
      'Otherwise continuous occupancy must not create another opportunity');
    assert.equal(sustained.checkpointCaptureRequestCount, requests);
    assert.equal(sustained.checkpointCaptureSaves, 1);
    return {
      tick: firstA.tick,
      detectionTick: firstA.checkpointZoneALastTick,
      batchTick: firstA.checkpointArbitrationBatchTick,
      closedTick: firstA.checkpointArbitrationClosedTick,
      arbitrationTick: firstA.checkpointArbitrationTickValue,
      currentCheckpointId: firstA.checkpointCurrentId,
      entryEventId: firstA.checkpointCaptureSourceEntryEventId,
      captureEventId: firstA.checkpointCaptureEventId,
      commandId: firstA.checkpointCaptureCommandId,
      transactionId: firstA.checkpointCaptureTransactionId,
      resultEventId: firstA.checkpointCaptureResultEventId,
      requestId: firstA.checkpointCaptureRequestId,
      saves: firstA.checkpointCaptureSaves,
    };
  });

  let firstB;
  await run('D10-A3-TR01-independent-B-replaces-current', async () => {
    // A is already sustained, so crossing into B creates only a new B
    // opportunity in the next closed batch.
    await key('KeyD', true);
    await page.waitForFunction(() =>
      document.querySelector('#diagnostics')?.dataset.checkpointZoneBOccupied === 'true',
    undefined, poll);
    await key('KeyD', false);
    const savingB = await sample(page);
    assert.ok(savingB.checkpointZoneBEntryEventId >
      (firstA.checkpointZoneBEntryEventId ?? 0));
    assert.equal(savingB.checkpointCandidateId, 'graybox-test-capture-b');
    await capture('D10-A3-real-entry-saving-B', true);
    firstB = await waitCapture('graybox-test-capture-b', 2);
    assert.equal(firstB.checkpointCurrentId, 'graybox-test-capture-b');
    assert.equal(firstB.checkpointArbitrationWinner, 'graybox-test-capture-b');
    assert.equal(firstB.checkpointCaptureSourceEntryEventId,
      firstB.checkpointZoneBEntryEventId);
    assert.equal(firstB.checkpointCaptureSaves, 2);
    await capture('D10-A3-saved-B-replaces-A', true);
    return {
      detectionTick: firstB.checkpointZoneBLastTick,
      batchTick: firstB.checkpointArbitrationBatchTick,
      currentCheckpointId: firstB.checkpointCurrentId,
      entryEventId: firstB.checkpointCaptureSourceEntryEventId,
      captureEventId: firstB.checkpointCaptureEventId,
      commandId: firstB.checkpointCaptureCommandId,
      transactionId: firstB.checkpointCaptureTransactionId,
      resultEventId: firstB.checkpointCaptureResultEventId,
      saves: firstB.checkpointCaptureSaves,
    };
  });

  let frozen;
  await run('D10-A3-TR05-pause-no-retrigger', async () => {
    await up();
    ctx.stage = 'D10-A3-lifecycle-wait-hidden';
    await ctx.hide();
    await page.waitForFunction(() =>
      document.visibilityState === 'hidden' &&
      document.querySelector('#diagnostics').dataset.paused === 'true',
    undefined, { polling: 100 });
    frozen = await waitStablePausedSample();
    assert.equal(frozen.control, false);
    assert.equal(frozen.checkpointCurrentId, 'graybox-test-capture-b');
    const entries = frozen.checkpointEntryEventCount;
    const requests = frozen.checkpointCaptureRequestCount;
    const saves = frozen.checkpointCaptureSaves;
    await page.waitForTimeout(1200);
    assert.deepEqual(await sample(page), frozen,
      'Hidden/minimized checkpoint state and batch must remain frozen');
    await capture('D10-A3-hidden-checkpoint-frozen', true);

    ctx.stage = 'D10-A3-lifecycle-wait-restore';
    await ctx.show();
    await page.waitForFunction(() =>
      document.visibilityState === 'visible' && document.hasFocus() &&
      document.querySelector('#diagnostics').dataset.paused === 'false' &&
      document.querySelector('#diagnostics').dataset.controlAllowed === 'true',
    undefined, poll);
    const resumed = await sample(page);
    assert.ok(resumed.tick - frozen.tick <= 5, 'No background Tick catch-up');
    assert.equal(resumed.discarded, frozen.discarded);
    assert.equal(resumed.checkpointCurrentId, 'graybox-test-capture-b');
    assert.equal(resumed.checkpointEntryEventCount, entries);
    assert.equal(resumed.checkpointCaptureRequestCount, requests);
    assert.equal(resumed.checkpointCaptureSaves, saves);
    await capture('D10-A3-restored-no-fake-entry', true);
    return {
      frozenTick: frozen.tick,
      resumedTick: resumed.tick,
      entries: [entries, resumed.checkpointEntryEventCount],
      saves: [saves, resumed.checkpointCaptureSaves],
    };
  });

  let afterReset;
  await run('D10-A3-TR05-reset-preserves-current-and-baseline', async () => {
    const before = await sample(page);
    afterReset = await resetViaR();
    assert.equal(afterReset.checkpointCurrentId, 'graybox-test-capture-b');
    assert.equal(afterReset.checkpointPayload, before.checkpointPayload);
    assert.equal(afterReset.goalRuntimeInstanceId, before.goalRuntimeInstanceId);
    assert.equal(afterReset.progressGoalCount, 1);
    assert.equal(afterReset.progressRewardCount, 1);
    assert.equal(afterReset.progressEffectCount, 1);
    assert.equal(afterReset.progressRouteOpen, true);
    assert.equal(afterReset.checkpointEntryEventCount,
      before.checkpointEntryEventCount,
      'Reset baseline synchronization must not synthesize an enter');
    await page.waitForTimeout(500);
    assert.equal((await sample(page)).checkpointEntryEventCount,
      before.checkpointEntryEventCount);
    await capture('D10-A3-reset-preserves-checkpoint-no-fake-entry', true);
    return {
      currentCheckpointId: afterReset.checkpointCurrentId,
      payloadStable: afterReset.checkpointPayload === before.checkpointPayload,
      runtimeStable: afterReset.goalRuntimeInstanceId === before.goalRuntimeInstanceId,
      progress: [
        afterReset.progressGoalCount,
        afterReset.progressRewardCount,
        afterReset.progressEffectCount,
      ],
      entryCount: afterReset.checkpointEntryEventCount,
    };
  });

  let reentered;
  await run('D10-A3-TR01-TR03-true-reentry-new-identities', async () => {
    const before = await sample(page);
    await navigatePastRouteGateToCheckpoint();
    const saving = await sample(page);
    assert.ok(saving.checkpointCaptureRequestCount > before.checkpointCaptureRequestCount);
    assert.ok(saving.checkpointLatestEntryEventId > before.checkpointLatestEntryEventId);
    await capture('D10-A3-true-reentry-saving', true);
    reentered = await waitCapture('graybox-test-capture-a', 3);
    assert.equal(reentered.checkpointCurrentId, 'graybox-test-capture-a');
    assert.ok(reentered.checkpointCaptureEventId > before.checkpointCaptureEventId);
    assert.ok(reentered.checkpointCaptureCommandId > before.checkpointCaptureCommandId);
    assert.ok(reentered.checkpointCaptureTransactionId >
      before.checkpointCaptureTransactionId);
    assert.ok(reentered.checkpointCaptureResultEventId >
      before.checkpointCaptureResultEventId);
    assert.equal(reentered.progressRewardCount, 1,
      'Goal E and its one reward remain unchanged by checkpoint captures');
    await capture('D10-A3-true-reentry-saved-new-identities', true);
    return {
      priorCaptureEventId: before.checkpointCaptureEventId,
      captureEventId: reentered.checkpointCaptureEventId,
      commandId: reentered.checkpointCaptureCommandId,
      transactionId: reentered.checkpointCaptureTransactionId,
      resultEventId: reentered.checkpointCaptureResultEventId,
      requestId: reentered.checkpointCaptureRequestId,
      currentCheckpointId: reentered.checkpointCurrentId,
      saves: reentered.checkpointCaptureSaves,
      rewardCount: reentered.progressRewardCount,
    };
  });

  await up();
  assert.deepEqual(ctx.errors, []);
}
