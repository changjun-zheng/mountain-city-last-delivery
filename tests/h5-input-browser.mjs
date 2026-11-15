import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { chromium } from 'playwright-core';
import {
  identifyBrowser,
  parseBrowserSelection,
  resolveBrowserExecutable,
} from './browser-selection.mjs';

const TASK = 'H5-01';
const SCOPE = 'responsive-canvas-and-device-input';
const args = process.argv.slice(2);
const allowed = new Set(['--production']);
const unknown = args.filter(argument =>
  !allowed.has(argument) &&
  !argument.startsWith('--browser='));
if (unknown.length) {
  console.error(`Unknown argument(s): ${unknown.join(', ')}`);
  process.exit(2);
}
if (!args.includes('--production')) {
  console.error('H5-01 browser verification requires --production.');
  process.exit(2);
}
const browserSelection = parseBrowserSelection(args);
if (browserSelection.id !== 'chrome') {
  console.error('H5-01 browser verification uses branded Google Chrome only.');
  process.exit(2);
}
const browser = resolveBrowserExecutable(browserSelection);
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const evidenceDir = resolve('test-results/h5-01', `run-${runId}`);
await mkdir(evidenceDir, { recursive: true });
const report = {
  task: TASK,
  scope: SCOPE,
  subtask: 'H5-01-R2',
  command: [process.execPath, ...process.argv.slice(1)],
  startedAt: new Date().toISOString(),
  browser: {
    requested: browserSelection.id,
    brand: browser.brand,
    executablePath: browser.executablePath,
    candidates: browser.candidates,
  },
  productionEntry: resolve('dist/index.html'),
  layers: {
    chromeDesktop: 'NOT RUN',
    chromeTouchEmulation: 'NOT RUN',
    androidChrome: 'NOT RUN',
    iosSafari: 'NOT RUN',
  },
  checks: [],
  timeline: [],
  pageErrors: [],
  interruptions: [],
  cleanup: {
    status: 'NOT RUN',
    desktopContext: 'NOT RUN',
    mobileContext: 'NOT RUN',
    browserConnection: 'NOT RUN',
    chromeProcess: 'NOT RUN',
    server: 'NOT RUN',
  },
};

const mimeTypes = Object.freeze({
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
});
const distRoot = resolve('dist');
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;
  const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
  const file = normalize(join(distRoot, relative));
  if (!file.startsWith(distRoot)) {
    response.writeHead(403).end('Forbidden');
    return;
  }
  try {
    const body = await readFile(file);
    response.writeHead(200, {
      'content-type': mimeTypes[extname(file)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    });
    response.end(body);
  } catch {
    response.writeHead(404).end('Not found');
  }
});
await new Promise((done, fail) => {
  server.once('error', fail);
  server.listen(0, '127.0.0.1', done);
});
const address = server.address();
const baseURL = `http://127.0.0.1:${address.port}/`;
report.url = baseURL;

const hash = async path => createHash('sha256')
  .update(await readFile(path))
  .digest('hex')
  .toUpperCase();
const collectHashes = async () => {
  const hashes = {};
  for (const path of [
    'src/platform/web/input-sources.ts',
    'src/platform/web/player-input.ts',
    'src/platform/web/touch-controls.ts',
    'src/platform/web/runtime-uuid.ts',
    'src/platform/web/main.ts',
    'src/platform/web/style.css',
    'src/rendering/phaser/first-level.ts',
    'index.html',
    'tests/h5-input.test.mjs',
    'tests/h5-input-browser.mjs',
    'dist/index.html',
  ]) hashes[path] = await hash(path);
  const html = await readFile(resolve('dist/index.html'), 'utf8');
  const assets = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)]
    .map(match => match[1]);
  for (const asset of assets) {
    const path = resolve('dist', asset.replace(/^\//, ''));
    hashes[`dist/${asset.replace(/^\/assets\//, 'assets/')}`] = await hash(path);
  }
  return hashes;
};
const screenshot = async (page, name) => {
  const path = join(evidenceDir, `${name}.png`);
  await page.screenshot({ path, fullPage: false });
  return path;
};
const record = (name, status, details = {}) => {
  const entry = {
    at: new Date().toISOString(),
    name,
    status,
    ...details,
  };
  report.checks.push(entry);
  report.timeline.push({
    at: entry.at,
    name,
    status,
  });
  console.log(status, name);
};
const waitRunning = async page => {
  await page.waitForFunction(() => {
    const data = document.querySelector('#diagnostics')?.dataset;
    return data?.mode === 'first-level' &&
      data.firstLevelPhase !== undefined &&
      data.paused === 'false' &&
      document.querySelector('#restart')?.disabled === false;
  }, undefined, { timeout: 20000, polling: 100 });
};
const installInputEvidence = async page => {
  await page.addInitScript(() => {
    window.__h5InputEvidence = [];
    const record = event => {
      const data = document.querySelector('#diagnostics')?.dataset;
      if (!data) return;
      window.__h5InputEvidence.push({
        at: performance.now(),
        type: event.type,
        code: event.code,
        key: event.key,
        repeat: event.repeat,
        isTrusted: event.isTrusted,
        focused: document.hasFocus(),
        visibility: document.visibilityState,
        tick: Number(data.tick),
        x: Number(data.x),
        vx: Number(data.vx),
        rootSources: JSON.parse(
          document.querySelector('#touch-prototype')?.dataset.touchSources || '{}',
        ),
        diagnosticSources: JSON.parse(data.touchSources || '{}'),
      });
      if (window.__h5InputEvidence.length > 200) {
        window.__h5InputEvidence.shift();
      }
    };
    for (const type of [
      'keydown', 'keyup', 'focus', 'blur', 'resize', 'orientationchange',
    ]) window.addEventListener(type, record, true);
    document.addEventListener('visibilitychange', record, true);
  });
};
const readInputEvidence = page => page.evaluate(() =>
  window.__h5InputEvidence ?? []);
const pointer = async (page, selector, type, pointerId = 1) => {
  const box = await page.locator(selector).boundingBox();
  assert.ok(box, `${selector} must be visible`);
  await page.evaluate(({ selector, type, pointerId, x, y }) => {
    const target = document.querySelector(selector);
    target?.dispatchEvent(new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId,
      pointerType: 'touch',
      isPrimary: pointerId === 1,
      clientX: x,
      clientY: y,
      buttons: type === 'pointerup' || type === 'pointercancel' ? 0 : 1,
    }));
  }, {
    selector,
    type,
    pointerId,
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  });
};

let chromeProcess;
let browserConnection;
let desktopContext;
let mobileContext;
let evidencePage;
try {
  report.hashes = await collectHashes();
  const profile = join(evidenceDir, 'chrome-profile');
  await mkdir(profile);
  const launchArgs = [
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    '--no-first-run',
    'about:blank',
  ];
  report.browser.profile = profile;
  report.browser.args = launchArgs;
  const { spawn } = await import('node:child_process');
  chromeProcess = spawn(browser.executablePath, launchArgs, {
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  report.browser.pid = chromeProcess.pid;
  let stderr = '';
  chromeProcess.stderr.setEncoding('utf8');
  chromeProcess.stderr.on('data', chunk => { stderr += chunk; });
  const endpoint = await new Promise((done, fail) => {
    const timer = setTimeout(
      () => fail(new Error(`Chrome did not expose CDP. ${stderr}`)),
      15000,
    );
    chromeProcess.stderr.on('data', () => {
      const match = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) {
        clearTimeout(timer);
        done(match[1]);
      }
    });
    chromeProcess.once('exit', code =>
      fail(new Error(`Chrome exited before CDP (${code}). ${stderr}`)));
  });
  browserConnection = await chromium.connectOverCDP(endpoint, { noDefaults: true });
  const versionSession = await browserConnection.newBrowserCDPSession();
  const version = await versionSession.send('Browser.getVersion');
  await versionSession.detach().catch(() => {});
  report.browser.actual = identifyBrowser(version);
  assert.equal(report.browser.actual.brand, 'Google Chrome');

  desktopContext = browserConnection.contexts()[0];
  const desktopPage = desktopContext.pages()[0] ??
    await desktopContext.waitForEvent('page');
  evidencePage = desktopPage;
  await installInputEvidence(desktopPage);
  desktopPage.on('pageerror', error => report.pageErrors.push(error.message));
  desktopPage.on('crash', () => report.interruptions.push('desktop-page-crash'));
  await desktopPage.goto(baseURL, { waitUntil: 'networkidle' });
  await waitRunning(desktopPage);
  await desktopPage.evaluate(() => {
    document.querySelector('#touch-toggle')?.click();
  });
  await desktopPage.waitForFunction(() =>
    document.querySelector('#touch-controls')?.hidden === false);
  const desktopMetrics = await desktopPage.evaluate(() => {
    const canvas = document.querySelector('#game canvas');
    const game = document.querySelector('#game-shell');
    const buttons = [...document.querySelectorAll('[data-action]')];
    return {
      canvas: canvas ? canvas.getBoundingClientRect().toJSON() : null,
      game: game ? game.getBoundingClientRect().toJSON() : null,
      buttonSizes: buttons.map(button => ({
        action: button.dataset.action,
        ...button.getBoundingClientRect().toJSON(),
      })),
      text: document.querySelector('#debug-tools summary')?.textContent,
      runtime: document.querySelector('#diagnostics')?.dataset.firstLevelRuntimeInstanceId,
      tick: document.querySelector('#diagnostics')?.dataset.tick,
      cssHeight: getComputedStyle(document.documentElement).getPropertyValue('--app-height'),
    };
  });
  assert.ok(desktopMetrics.canvas.width > 0 && desktopMetrics.canvas.height > 0);
  assert.ok(desktopMetrics.buttonSizes.every(button =>
    button.width >= 48 && button.height >= 48));
  report.desktopMetrics = desktopMetrics;
  report.desktopScreenshot = await screenshot(desktopPage, 'chrome-desktop-touch-visible');
  record('H03/H06 desktop Chrome and actual CSS sizes', 'PASS', {
    canvas: desktopMetrics.canvas,
    buttons: desktopMetrics.buttonSizes,
  });
  report.layers.chromeDesktop = 'PASS';

  const runtime = desktopMetrics.runtime;
  const tickBefore = Number(desktopMetrics.tick);
  await desktopPage.bringToFront();
  await desktopPage.waitForFunction(() =>
    document.visibilityState === 'visible' && document.hasFocus());
  await pointer(desktopPage, '[data-action="right"]', 'pointerdown', 31);
  await desktopPage.waitForFunction(() =>
    Number(document.querySelector('#diagnostics')?.dataset.x) > 80,
  undefined, { timeout: 10000, polling: 100 });
  await pointer(desktopPage, '[data-action="right"]', 'pointerup', 31);
  const moved = await desktopPage.locator('#diagnostics').evaluate(element => ({
    x: Number(element.dataset.x),
    sources: element.dataset.touchSources,
    needsRelease: element.dataset.needsRelease,
  }));
  assert.ok(moved.x > 80);
  assert.deepEqual(JSON.parse(moved.sources), {
    left: [],
    right: [],
    jump: [],
    interact: [],
  });
  record('H01/H03 touch movement reaches core', 'PASS', moved);

  const focusBeforeKeyboard = await desktopPage.evaluate(() => ({
    focused: document.hasFocus(),
    visibility: document.visibilityState,
  }));
  await desktopPage.keyboard.down('KeyD');
  const keyboardMotionObserved = await desktopPage.waitForFunction(x =>
    Number(document.querySelector('#diagnostics')?.dataset.x) > x + 12,
  moved.x, { timeout: 10000, polling: 100 })
    .then(() => true, () => false);
  const keyboardMoved = await desktopPage.locator('#diagnostics').evaluate(element => ({
    x: Number(element.dataset.x),
    vx: Number(element.dataset.vx),
  }));
  await desktopPage.keyboard.up('KeyD');
  assert.equal(keyboardMotionObserved, true,
    'Desktop keyboard must move the same first-level player');
  if (!keyboardMotionObserved) {
    record('H02/H03 desktop keyboard movement and jump remain usable', 'FAIL', {
      focusBeforeKeyboard,
      before: moved,
      afterKeydown: keyboardMoved,
    });
    throw new Error('Desktop keyboard movement did not reach the core');
  }
  await desktopPage.waitForFunction(() =>
    document.querySelector('#diagnostics')?.dataset.support === 'a-ground',
  undefined, { timeout: 10000, polling: 100 });
  await desktopPage.keyboard.down('Space');
  await desktopPage.keyboard.up('Space');
  await desktopPage.waitForFunction(() =>
    document.querySelector('#diagnostics')?.dataset.grounded === 'true' &&
    document.querySelector('#diagnostics')?.dataset.controlAllowed === 'true' &&
    document.querySelector('#diagnostics')?.dataset.needsRelease === 'false',
  undefined, { timeout: 10000, polling: 100 });
  const keyboardJumpsBefore = Number(await desktopPage.locator('#diagnostics')
    .getAttribute('data-jumps'));
  const keyboardPreJump = await desktopPage.locator('#diagnostics').evaluate(element => ({
    x: Number(element.dataset.x),
    y: Number(element.dataset.y),
    jumps: Number(element.dataset.jumps),
    grounded: element.dataset.grounded,
    support: element.dataset.support,
    eligible: element.dataset.eligible,
    needsRelease: element.dataset.needsRelease,
    control: element.dataset.controlAllowed,
    focused: document.hasFocus(),
    visibility: document.visibilityState,
  }));
  await desktopPage.keyboard.down('Space');
  const keyboardJumpObserved = await desktopPage.waitForFunction(jumps =>
    Number(document.querySelector('#diagnostics')?.dataset.jumps) > jumps,
  keyboardJumpsBefore, { timeout: 10000, polling: 100 })
    .then(() => true, () => false);
  if (!keyboardJumpObserved) {
    report.keyboardFailure = {
      before: moved,
      moved: keyboardMoved,
      preJump: keyboardPreJump,
    };
  }
  const keyboardPostJump = await desktopPage.locator('#diagnostics').evaluate(element => ({
    x: Number(element.dataset.x),
    y: Number(element.dataset.y),
    jumps: Number(element.dataset.jumps),
    grounded: element.dataset.grounded,
    support: element.dataset.support,
    eligible: element.dataset.eligible,
    needsRelease: element.dataset.needsRelease,
    control: element.dataset.controlAllowed,
    focused: document.hasFocus(),
    visibility: document.visibilityState,
  }));
  await desktopPage.keyboard.up('Space');
  assert.equal(keyboardJumpObserved, true,
    'Desktop Space must consume one jump in the same first-level core');
  if (!keyboardJumpObserved) {
    record('H02/H03 desktop keyboard movement and jump remain usable', 'FAIL', {
      before: moved,
      moved: keyboardMoved,
      preJump: keyboardPreJump,
      postJump: keyboardPostJump,
    });
    throw new Error('Desktop keyboard jump did not reach the core');
  }
  const keyboardState = await desktopPage.locator('#diagnostics').evaluate(element => ({
    x: Number(element.dataset.x),
    jumps: Number(element.dataset.jumps),
    needsRelease: element.dataset.needsRelease,
  }));
  assert.ok(keyboardState.x > moved.x + 12);
  assert.equal(keyboardState.jumps, keyboardJumpsBefore + 1);
  record('H02/H03 desktop keyboard movement and jump remain usable', 'PASS', {
    focusBeforeKeyboard,
    before: moved,
    moved: keyboardMoved,
    after: keyboardState,
  });

  await desktopPage.waitForFunction(() =>
    document.querySelector('#diagnostics')?.dataset.grounded === 'true' &&
    document.querySelector('#diagnostics')?.dataset.needsRelease === 'false' &&
    document.querySelector('#diagnostics')?.dataset.controlAllowed === 'true',
  undefined, { timeout: 10000, polling: 100 });
  const beforeInterruptedKeyboard = await desktopPage.locator('#diagnostics')
    .evaluate(element => ({
      tick: Number(element.dataset.tick),
      jumps: Number(element.dataset.jumps),
      needsRelease: element.dataset.needsRelease,
      runtime: element.dataset.firstLevelRuntimeInstanceId,
    }));
  await desktopPage.keyboard.down('Space');
  await desktopPage.waitForFunction(jumps =>
    Number(document.querySelector('#diagnostics')?.dataset.jumps) > jumps,
  beforeInterruptedKeyboard.jumps, { timeout: 10000, polling: 100 });
  const keyboardInterruptPage = await desktopContext.newPage();
  await keyboardInterruptPage.goto('about:blank');
  await keyboardInterruptPage.bringToFront();
  await desktopPage.waitForFunction(() =>
    document.visibilityState === 'hidden' && !document.hasFocus(),
  undefined, { timeout: 10000, polling: 100 });
  const heldHiddenKeyboard = await desktopPage.locator('#diagnostics')
    .evaluate(element => ({
      tick: Number(element.dataset.tick),
      jumps: Number(element.dataset.jumps),
      needsRelease: element.dataset.needsRelease,
      visibility: document.visibilityState,
      focused: document.hasFocus(),
      runtime: element.dataset.firstLevelRuntimeInstanceId,
    }));
  report.keyboardInterruptScreenshot =
    await screenshot(desktopPage, 'chrome-keyboard-hidden-before-keyup');
  await desktopPage.keyboard.up('Space');
  await desktopPage.bringToFront();
  await desktopPage.waitForFunction(() =>
    document.visibilityState === 'visible' && document.hasFocus(),
  undefined, { timeout: 10000, polling: 100 });
  await desktopPage.waitForFunction(() =>
    document.querySelector('#diagnostics')?.dataset.grounded === 'true' &&
    document.querySelector('#diagnostics')?.dataset.needsRelease === 'false' &&
    document.querySelector('#diagnostics')?.dataset.controlAllowed === 'true',
  undefined, { timeout: 10000, polling: 100 });
  const afterRealInterruptedRelease = await desktopPage.locator('#diagnostics')
    .evaluate(element => ({
      tick: Number(element.dataset.tick),
      jumps: Number(element.dataset.jumps),
      needsRelease: element.dataset.needsRelease,
      visibility: document.visibilityState,
      focused: document.hasFocus(),
      runtime: element.dataset.firstLevelRuntimeInstanceId,
    }));
  await desktopPage.keyboard.down('Space');
  await desktopPage.waitForFunction(jumps =>
    Number(document.querySelector('#diagnostics')?.dataset.jumps) > jumps,
  afterRealInterruptedRelease.jumps, { timeout: 10000, polling: 100 });
  await desktopPage.keyboard.up('Space');
  const afterFreshInterruptedKeyboard = await desktopPage.locator('#diagnostics')
    .evaluate(element => ({
      jumps: Number(element.dataset.jumps),
      needsRelease: element.dataset.needsRelease,
      runtime: element.dataset.firstLevelRuntimeInstanceId,
    }));
  assert.equal(heldHiddenKeyboard.visibility, 'hidden');
  assert.equal(heldHiddenKeyboard.focused, false);
  assert.equal(heldHiddenKeyboard.needsRelease, 'true');
  assert.equal(heldHiddenKeyboard.jumps, beforeInterruptedKeyboard.jumps + 1);
  assert.equal(afterRealInterruptedRelease.needsRelease, 'false');
  assert.equal(afterRealInterruptedRelease.jumps, heldHiddenKeyboard.jumps);
  assert.equal(afterFreshInterruptedKeyboard.jumps,
    afterRealInterruptedRelease.jumps + 1);
  assert.equal(afterFreshInterruptedKeyboard.runtime,
    beforeInterruptedKeyboard.runtime);
  await keyboardInterruptPage.close();
  record('H5-01-R1 R01 real keyboard keyup after hidden clears gate', 'PASS', {
    beforeInterruptedKeyboard,
    heldHiddenKeyboard,
    afterRealInterruptedRelease,
    afterFreshInterruptedKeyboard,
  });

  await desktopPage.locator('#touch-pause').click();
  await desktopPage.waitForFunction(() =>
    document.querySelector('#diagnostics')?.dataset.paused === 'true');
  const paused = await desktopPage.locator('#diagnostics').evaluate(element => ({
    tick: Number(element.dataset.tick),
    tokens: Number(element.dataset.tokens),
    runtime: element.dataset.firstLevelRuntimeInstanceId,
    menu: document.querySelector('#touch-prototype')?.dataset.menuOpen,
  }));
  await desktopPage.waitForTimeout(350);
  const pausedLater = await desktopPage.locator('#diagnostics').evaluate(element => ({
    tick: Number(element.dataset.tick),
    tokens: Number(element.dataset.tokens),
    runtime: element.dataset.firstLevelRuntimeInstanceId,
  }));
  assert.equal(pausedLater.tick, paused.tick);
  assert.equal(pausedLater.tokens, paused.tokens);
  assert.equal(pausedLater.runtime, runtime);
  await desktopPage.locator('#touch-continue').click();
  await desktopPage.waitForFunction(() =>
    document.querySelector('#diagnostics')?.dataset.paused === 'false');
  record('H05 menu pause token and resume', 'PASS', {
    pausedTick: paused.tick,
    tokens: paused.tokens,
    runtime,
  });

  const beforeRotate = await desktopPage.locator('#diagnostics').evaluate(element => ({
    runtime: element.dataset.firstLevelRuntimeInstanceId,
    progressGoals: element.dataset.progressGoalCount,
    tick: Number(element.dataset.tick),
  }));
  await desktopPage.setViewportSize({ width: 667, height: 375 });
  await desktopPage.waitForFunction(runtime =>
    document.querySelector('#diagnostics')?.dataset.firstLevelRuntimeInstanceId === runtime,
  beforeRotate.runtime, { timeout: 10000 });
  const afterRotate = await desktopPage.locator('#diagnostics').evaluate(element => ({
    runtime: element.dataset.firstLevelRuntimeInstanceId,
    progressGoals: element.dataset.progressGoalCount,
    tick: Number(element.dataset.tick),
  }));
  assert.equal(afterRotate.runtime, beforeRotate.runtime);
  assert.equal(afterRotate.progressGoals, beforeRotate.progressGoals);
  assert.ok(afterRotate.tick >= beforeRotate.tick);
  report.rotationScreenshot = await screenshot(desktopPage, 'chrome-mobile-landscape');
  record('H06 resize/rotation retains runtime and progress', 'PASS', {
    before: beforeRotate,
    after: afterRotate,
  });

  await desktopPage.locator('#touch-pause').click();
  await desktopPage.waitForFunction(() =>
    document.querySelector('#diagnostics')?.dataset.paused === 'true');
  const hiddenTick = Number(await desktopPage.locator('#diagnostics')
    .getAttribute('data-tick'));
  const backgroundPage = await desktopContext.newPage();
  await backgroundPage.goto('about:blank');
  await backgroundPage.bringToFront();
  await desktopPage.waitForFunction(() =>
    document.visibilityState === 'hidden' && !document.hasFocus(),
  undefined, { timeout: 10000, polling: 100 });
  await desktopPage.waitForTimeout(350);
  const hiddenState = await desktopPage.locator('#diagnostics').evaluate(element => ({
    tick: Number(element.dataset.tick),
    tokens: Number(element.dataset.tokens),
    paused: element.dataset.paused,
    visibility: document.visibilityState,
    focused: document.hasFocus(),
  }));
  assert.equal(hiddenState.visibility, 'hidden');
  assert.equal(hiddenState.focused, false);
  assert.equal(hiddenState.paused, 'true');
  assert.equal(hiddenState.tokens, 2,
    'visibility and prototype menu owners must coexist');
  assert.ok(hiddenState.tick <= hiddenTick + 1);

  await desktopPage.bringToFront();
  await desktopPage.waitForFunction(() =>
    document.visibilityState === 'visible' && document.hasFocus(),
  undefined, { timeout: 10000, polling: 100 });
  const visibleWithMenu = await desktopPage.locator('#diagnostics').evaluate(element => ({
    tick: Number(element.dataset.tick),
    tokens: Number(element.dataset.tokens),
    paused: element.dataset.paused,
  }));
  assert.equal(visibleWithMenu.tokens, 1,
    'visibility owner releases only its token');
  assert.equal(visibleWithMenu.paused, 'true');
  assert.ok(visibleWithMenu.tick - hiddenState.tick <= 1);

  const resumeStartedAt = Date.now();
  await desktopPage.locator('#touch-continue').click();
  await desktopPage.waitForFunction(() =>
    document.querySelector('#diagnostics')?.dataset.paused === 'false',
  undefined, { timeout: 10000, polling: 10 });
  await desktopPage.waitForTimeout(120);
  const resumedState = await desktopPage.locator('#diagnostics').evaluate(element => ({
    tick: Number(element.dataset.tick),
    remainder: Number(element.dataset.remainder),
    discarded: Number(element.dataset.discarded),
    steps: Number(element.dataset.steps),
  }));
  const resumeWallMs = Date.now() - resumeStartedAt;
  const afterVisibleResume = resumedState.tick;
  assert.ok(
    afterVisibleResume - visibleWithMenu.tick <=
      Math.ceil(resumeWallMs / 16) + 3,
    `Resume advanced ${afterVisibleResume - visibleWithMenu.tick} ticks in ` +
      `${resumeWallMs} ms, which exceeds foreground elapsed time`,
  );
  await backgroundPage.close();
  record('H05 real hidden tab and menu owners coexist without catch-up', 'PASS', {
    hiddenTick,
    hiddenState,
    visibleWithMenu,
    afterVisibleResume,
    resumeWallMs,
    resumedState,
  });

  mobileContext = await browserConnection.newContext({
    viewport: { width: 844, height: 390 },
    deviceScaleFactor: 2.625,
    isMobile: true,
    hasTouch: true,
  });
  const mobilePage = await mobileContext.newPage();
  evidencePage = mobilePage;
  await installInputEvidence(mobilePage);
  mobilePage.on('pageerror', error => report.pageErrors.push(error.message));
  mobilePage.on('crash', () => report.interruptions.push('mobile-emulation-page-crash'));
  await mobilePage.goto(baseURL, { waitUntil: 'networkidle' });
  await waitRunning(mobilePage);
  const controlsVisible = await mobilePage.locator('#touch-controls').isVisible();
  assert.equal(controlsVisible, true);
  const mobileMetrics = await mobilePage.evaluate(() => ({
    viewport: { width: innerWidth, height: innerHeight },
    canvas: document.querySelector('#game canvas')?.getBoundingClientRect().toJSON(),
    buttons: [...document.querySelectorAll('[data-action]')].map(button => ({
      action: button.dataset.action,
      ...button.getBoundingClientRect().toJSON(),
    })),
    pointerMode: document.querySelector('#touch-prototype')?.dataset.pointerMode,
  }));
  assert.ok(mobileMetrics.buttons.every(button =>
    button.width >= 48 && button.height >= 48));
  assert.ok(mobileMetrics.canvas.bottom <= mobileMetrics.viewport.height,
    'The fitted canvas must remain inside the mobile viewport');
  assert.ok(mobileMetrics.buttons.every(button =>
    button.bottom <= mobileMetrics.viewport.height),
  'Touch controls must remain inside the mobile viewport');
  report.mobileEmulationMetrics = mobileMetrics;
  report.mobileScreenshot = await screenshot(mobilePage, 'chrome-touch-emulation');
  record('H03/H06 Chrome touch emulation', 'PASS', mobileMetrics);

  const interruptStartX = Number(
    await mobilePage.locator('#diagnostics').getAttribute('data-x'),
  );
  await pointer(mobilePage, '[data-action="right"]', 'pointerdown', 71);
  await mobilePage.waitForFunction(x =>
    Number(document.querySelector('#diagnostics')?.dataset.x) > x + 8,
  interruptStartX, { timeout: 10000, polling: 100 });
  const touchHeldBeforeResize = await mobilePage.locator('#diagnostics')
    .evaluate(element => ({
      x: Number(element.dataset.x),
      vx: Number(element.dataset.vx),
      sources: JSON.parse(element.dataset.touchSources || '{}'),
      active: document.querySelector('[data-action="right"]')?.dataset.active,
      runtime: element.dataset.firstLevelRuntimeInstanceId,
    }));
  report.touchInterruptScreenshot =
    await screenshot(mobilePage, 'chrome-touch-held-before-resize');
  await mobilePage.setViewportSize({ width: 667, height: 375 });
  await mobilePage.waitForFunction(() => {
    const data = document.querySelector('#diagnostics')?.dataset;
    const sources = JSON.parse(data?.touchSources || '{}');
    return sources.right?.length === 0 &&
      document.querySelector('[data-action="right"]')?.dataset.active === 'false';
  }, undefined, { timeout: 10000, polling: 100 });
  await mobilePage.waitForFunction(() =>
    Math.abs(Number(document.querySelector('#diagnostics')?.dataset.vx)) < 1,
  undefined, { timeout: 10000, polling: 100 });
  const touchAfterResize = await mobilePage.locator('#diagnostics')
    .evaluate(element => ({
      x: Number(element.dataset.x),
      vx: Number(element.dataset.vx),
      sources: JSON.parse(element.dataset.touchSources || '{}'),
      active: document.querySelector('[data-action="right"]')?.dataset.active,
      runtime: element.dataset.firstLevelRuntimeInstanceId,
    }));
  report.touchInterruptAfterScreenshot =
    await screenshot(mobilePage, 'chrome-touch-after-resize');
  report.touchInterrupt = {
    beforeResize: touchHeldBeforeResize,
    afterResize: touchAfterResize,
  };
  assert.deepEqual(touchHeldBeforeResize.sources.right, ['pointer:0:71']);
  assert.deepEqual(touchAfterResize.sources.right, []);
  assert.equal(touchAfterResize.active, 'false');
  assert.equal(touchAfterResize.runtime, touchHeldBeforeResize.runtime);
  assert.ok(touchAfterResize.x - touchHeldBeforeResize.x < 80,
    'Resize must stop the held touch without an unbounded slide');
  await pointer(mobilePage, '[data-action="right"]', 'pointerdown', 72);
  await mobilePage.waitForFunction(x =>
    Number(document.querySelector('#diagnostics')?.dataset.x) > x + 4,
  touchAfterResize.x, { timeout: 10000, polling: 100 });
  await pointer(mobilePage, '[data-action="right"]', 'pointerup', 72);
  const touchAfterResizeRetry = await mobilePage.locator('#diagnostics')
    .evaluate(element => ({
      x: Number(element.dataset.x),
      sources: JSON.parse(element.dataset.touchSources || '{}'),
    }));

  const toggleStartX = touchAfterResizeRetry.x;
  await pointer(mobilePage, '[data-action="right"]', 'pointerdown', 73);
  await mobilePage.waitForFunction(x =>
    Number(document.querySelector('#diagnostics')?.dataset.x) > x + 8,
  toggleStartX, { timeout: 10000, polling: 100 });
  const touchHeldBeforeToggle = await mobilePage.locator('#diagnostics')
    .evaluate(element => ({
      x: Number(element.dataset.x),
      vx: Number(element.dataset.vx),
      sources: JSON.parse(element.dataset.touchSources || '{}'),
    }));
  await mobilePage.locator('#touch-toggle').click();
  await mobilePage.waitForFunction(() => {
    const data = document.querySelector('#diagnostics')?.dataset;
    return data?.touchEnabled === 'false' &&
      JSON.parse(data?.touchSources || '{}').right?.length === 0;
  }, undefined, { timeout: 10000, polling: 100 });
  await mobilePage.waitForFunction(() =>
    Math.abs(Number(document.querySelector('#diagnostics')?.dataset.vx)) < 1,
  undefined, { timeout: 10000, polling: 100 });
  const touchAfterToggle = await mobilePage.locator('#diagnostics')
    .evaluate(element => ({
      x: Number(element.dataset.x),
      vx: Number(element.dataset.vx),
      sources: JSON.parse(element.dataset.touchSources || '{}'),
      touchEnabled: element.dataset.touchEnabled,
    }));
  assert.deepEqual(touchHeldBeforeToggle.sources.right, ['pointer:0:73']);
  assert.deepEqual(touchAfterToggle.sources.right, []);
  assert.equal(touchAfterToggle.touchEnabled, 'false');
  assert.ok(touchAfterToggle.x - touchHeldBeforeToggle.x < 80);
  await mobilePage.locator('#touch-toggle').click();
  await mobilePage.waitForFunction(() =>
    document.querySelector('#diagnostics')?.dataset.touchEnabled === 'true');
  await pointer(mobilePage, '[data-action="right"]', 'pointerdown', 74);
  await mobilePage.waitForFunction(x =>
    Number(document.querySelector('#diagnostics')?.dataset.x) > x + 4,
  touchAfterToggle.x, { timeout: 10000, polling: 100 });
  await pointer(mobilePage, '[data-action="right"]', 'pointerup', 74);
  const touchAfterToggleRetry = await mobilePage.locator('#diagnostics')
    .evaluate(element => ({
      x: Number(element.dataset.x),
      sources: JSON.parse(element.dataset.touchSources || '{}'),
    }));

  const mixedStartX = touchAfterToggleRetry.x;
  await pointer(mobilePage, '[data-action="right"]', 'pointerdown', 75);
  await mobilePage.keyboard.down('KeyD');
  await mobilePage.waitForFunction(x =>
    Number(document.querySelector('#diagnostics')?.dataset.x) > x + 8,
  mixedStartX, { timeout: 10000, polling: 100 });
  await mobilePage.setViewportSize({ width: 800, height: 390 });
  await mobilePage.waitForFunction(() => {
    const sources = JSON.parse(
      document.querySelector('#diagnostics')?.dataset.touchSources || '{}',
    );
    return JSON.stringify(sources.right) === JSON.stringify(['keyboard:KeyD']);
  }, undefined, { timeout: 10000, polling: 100 });
  const mixedAfterResize = await mobilePage.locator('#diagnostics')
    .evaluate(element => ({
      x: Number(element.dataset.x),
      vx: Number(element.dataset.vx),
      tick: Number(element.dataset.tick),
      rootSources: JSON.parse(
        document.querySelector('#touch-prototype')?.dataset.touchSources || '{}',
      ),
      diagnosticSources: JSON.parse(element.dataset.touchSources || '{}'),
    }));
  await mobilePage.waitForFunction(x =>
    Number(document.querySelector('#diagnostics')?.dataset.x) > x + 4,
  mixedAfterResize.x, { timeout: 10000, polling: 100 });
  await mobilePage.bringToFront();
  await mobilePage.waitForFunction(() =>
    document.visibilityState === 'visible' && document.hasFocus(),
  undefined, { timeout: 10000, polling: 100 });
  await mobilePage.keyboard.up('KeyD');
  await mobilePage.waitForFunction(() => {
    const rootSources = JSON.parse(
      document.querySelector('#touch-prototype')?.dataset.touchSources || '{}',
    );
    const diagnosticSources = JSON.parse(
      document.querySelector('#diagnostics')?.dataset.touchSources || '{}',
    );
    return rootSources.right?.length === 0 &&
      diagnosticSources.right?.length === 0;
  }, undefined, { timeout: 10000, polling: 100 });
  const mixedAfterKeyboardRelease = await mobilePage.waitForFunction(
    () => {
      const element = document.querySelector('#diagnostics');
      const rootSources = JSON.parse(
        document.querySelector('#touch-prototype')?.dataset.touchSources || '{}',
      );
      const diagnosticSources = JSON.parse(element?.dataset.touchSources || '{}');
      if (
        rootSources.right?.length !== 0 ||
        diagnosticSources.right?.length !== 0
      ) return false;
      return {
        x: Number(element?.dataset.x),
        vx: Number(element?.dataset.vx),
        tick: Number(element?.dataset.tick),
        rootSources,
        diagnosticSources,
      };
    },
    undefined,
    { timeout: 10000, polling: 100 },
  ).then(handle => handle.jsonValue());
  await mobilePage.waitForFunction(startTick => {
    const data = document.querySelector('#diagnostics')?.dataset;
    return Number(data?.tick) > startTick && Math.abs(Number(data?.vx)) < 1;
  }, mixedAfterKeyboardRelease.tick, { timeout: 10000, polling: 100 });
  const mixedAfterDeceleration = await mobilePage.locator('#diagnostics')
    .evaluate(element => ({
      x: Number(element.dataset.x),
      vx: Number(element.dataset.vx),
      tick: Number(element.dataset.tick),
      rootSources: JSON.parse(
        document.querySelector('#touch-prototype')?.dataset.touchSources || '{}',
      ),
      diagnosticSources: JSON.parse(element.dataset.touchSources || '{}'),
    }));
  await mobilePage.waitForFunction(startTick =>
    Number(document.querySelector('#diagnostics')?.dataset.tick) > startTick + 3,
  mixedAfterDeceleration.tick, { timeout: 10000, polling: 100 });
  const mixedStable = await mobilePage.locator('#diagnostics')
    .evaluate(element => ({
      x: Number(element.dataset.x),
      vx: Number(element.dataset.vx),
      tick: Number(element.dataset.tick),
    }));
  const mixedReinputStartX = mixedStable.x;
  await mobilePage.keyboard.down('KeyD');
  await mobilePage.waitForFunction(x =>
    Number(document.querySelector('#diagnostics')?.dataset.x) > x + 4,
  mixedReinputStartX, { timeout: 10000, polling: 100 });
  await mobilePage.keyboard.up('KeyD');
  await mobilePage.waitForFunction(() =>
    JSON.parse(
      document.querySelector('#diagnostics')?.dataset.touchSources || '{}',
    ).right?.length === 0);
  const mixedAfterReinput = await mobilePage.locator('#diagnostics')
    .evaluate(element => ({
      x: Number(element.dataset.x),
      vx: Number(element.dataset.vx),
      tick: Number(element.dataset.tick),
      rootSources: JSON.parse(
        document.querySelector('#touch-prototype')?.dataset.touchSources || '{}',
      ),
      diagnosticSources: JSON.parse(element.dataset.touchSources || '{}'),
    }));
  assert.deepEqual(mixedAfterResize.rootSources.right, ['keyboard:KeyD']);
  assert.deepEqual(mixedAfterResize.diagnosticSources.right, ['keyboard:KeyD']);
  assert.ok(mixedAfterResize.vx > 200);
  assert.deepEqual(mixedAfterKeyboardRelease.rootSources.right, []);
  assert.deepEqual(mixedAfterKeyboardRelease.diagnosticSources.right, []);
  assert.ok(mixedAfterDeceleration.tick > mixedAfterResize.tick);
  assert.ok(Math.abs(mixedAfterDeceleration.vx) < 1,
    'Keyboard release must decelerate through the unchanged physics path');
  assert.ok(mixedStable.tick > mixedAfterDeceleration.tick);
  assert.ok(Math.abs(mixedStable.x - mixedAfterDeceleration.x) < 0.1,
    'The player must remain stable after deceleration');
  assert.ok(mixedAfterReinput.x > mixedStable.x + 4,
    'A fresh real keyboard press must work once');
  assert.deepEqual(mixedAfterReinput.rootSources.right, []);
  assert.deepEqual(mixedAfterReinput.diagnosticSources.right, []);
  report.mixedInputEvidence = await readInputEvidence(mobilePage);
  record('H5-01-R2 diagnostic sources follow the current input aggregator',
    'PASS', {
      touchHeldBeforeResize,
      touchAfterResize,
      touchAfterResizeRetry,
      touchHeldBeforeToggle,
      touchAfterToggle,
      touchAfterToggleRetry,
      mixedStartX,
      mixedAfterResize,
      mixedAfterKeyboardRelease,
      mixedAfterDeceleration,
      mixedStable,
      mixedAfterReinput,
    });

  const initialX = Number(await mobilePage.locator('#diagnostics').getAttribute('data-x'));
  await pointer(mobilePage, '[data-action="right"]', 'pointerdown', 41);
  await pointer(mobilePage, '[data-action="jump"]', 'pointerdown', 42);
  await mobilePage.waitForFunction(x =>
    Number(document.querySelector('#diagnostics')?.dataset.x) > x + 8,
  initialX, { timeout: 10000, polling: 100 });
  const multi = await mobilePage.locator('#diagnostics').evaluate(element => ({
    x: Number(element.dataset.x),
    jumps: Number(element.dataset.jumps),
    grounded: element.dataset.grounded,
  }));
  assert.equal(multi.jumps, 1);
  await pointer(mobilePage, '[data-action="right"]', 'pointerup', 41);
  await pointer(mobilePage, '[data-action="jump"]', 'pointerup', 42);
  record('H01/H03 multi-touch movement and one jump', 'PASS', multi);

  const debugState = await mobilePage.locator('#diagnostics').evaluate(element => ({
    paused: element.dataset.paused,
    tokens: element.dataset.tokens,
    control: element.dataset.controlAllowed,
    visible: document.visibilityState,
    focused: document.hasFocus(),
    menuOpen: document.querySelector('#touch-prototype')?.dataset.menuOpen,
    pauseDisabled: document.querySelector('#touch-pause')?.disabled,
    runtime: element.dataset.firstLevelRuntimeInstanceId,
  }));
  report.afterBackgroundState = debugState;
  if (debugState.menuOpen === 'true') {
    await mobilePage.evaluate(() => {
      document.querySelector('#touch-continue')?.click();
    });
    await mobilePage.waitForFunction(() =>
      document.querySelector('#diagnostics')?.dataset.paused === 'false');
  }
  const pauseResult = await mobilePage.evaluate(() => {
    const button = document.querySelector('#touch-pause');
    const events = [];
    for (const type of ['pointerdown', 'pointerup', 'click']) {
      button?.addEventListener(type, () => events.push(type), { once: true });
    }
    button?.click();
    return {
      disabled: button?.disabled,
      menuOpen: document.querySelector('#touch-prototype')?.dataset.menuOpen,
      paused: document.querySelector('#diagnostics')?.dataset.paused,
      tokens: document.querySelector('#diagnostics')?.dataset.tokens,
      events,
      runtime: document.querySelector('#diagnostics')?.dataset.firstLevelRuntimeInstanceId,
      clickCount: document.querySelector('#diagnostics')?.dataset.touchPauseClickCount,
      result: document.querySelector('#diagnostics')?.dataset.touchLastPauseResult,
    };
  });
  report.pauseResult = pauseResult;
  await mobilePage.waitForFunction(() =>
    document.querySelector('#diagnostics')?.dataset.paused === 'true');
  const pausedBeforeDomClick = Number(await mobilePage.locator('#diagnostics')
    .getAttribute('data-tick'));
  await mobilePage.evaluate(() => {
    document.querySelector('#touch-pause')?.click();
  });
  await mobilePage.waitForFunction(() =>
    document.querySelector('#diagnostics')?.dataset.paused === 'false');
  await mobilePage.waitForFunction(tick =>
    Number(document.querySelector('#diagnostics')?.dataset.tick) > tick,
  pausedBeforeDomClick, { timeout: 10000, polling: 100 });
  const resumedAfterDomClick = Number(await mobilePage.locator('#diagnostics')
    .getAttribute('data-tick'));
  assert.ok(resumedAfterDomClick > pausedBeforeDomClick);
  await mobilePage.evaluate(() => {
    document.querySelector('#touch-pause')?.click();
  });
  await mobilePage.waitForFunction(() =>
    document.querySelector('#diagnostics')?.dataset.paused === 'true');
  await mobilePage.evaluate(() => {
    document.querySelector('#touch-continue')?.click();
  });
  await mobilePage.waitForFunction(() =>
    document.querySelector('#diagnostics')?.dataset.paused === 'false');
  record('H05 DOM pause/continue button targets remain operable', 'PASS');

  await mobilePage.evaluate(() => {
    const button = document.querySelector('#touch-toggle');
    if (document.querySelector('#touch-controls')?.hidden) button?.click();
  });
  await mobilePage.waitForFunction(() =>
    document.querySelector('#touch-controls')?.hidden === false);
  const beforeRight = await mobilePage.locator('#diagnostics').evaluate(element => ({
    x: element.dataset.x,
    control: element.dataset.controlAllowed,
    paused: element.dataset.paused,
    sources: element.dataset.touchSources,
    touchEnabled: element.dataset.touchEnabled,
    visible: document.visibilityState,
    focused: document.hasFocus(),
  }));
  report.beforeRight = beforeRight;
  await pointer(mobilePage, '[data-action="right"]', 'pointerdown', 51);
  let navigated = false;
  for (let attempt = 0; attempt < 24 && !navigated; attempt++) {
    const jumpPointer = 70 + attempt;
    await pointer(mobilePage, '[data-action="jump"]', 'pointerdown', jumpPointer);
    await mobilePage.waitForTimeout(180);
    await pointer(mobilePage, '[data-action="jump"]', 'pointerup', jumpPointer);
    navigated = await mobilePage.waitForFunction(() =>
      document.querySelector('#diagnostics')?.dataset.interactionSelected ===
        'first-level-b-npc',
    undefined, { timeout: 600, polling: 100 })
      .then(() => true, () => false);
  }
  report.navigationByTouch = navigated;
  if (!navigated) {
    report.navigationState = await mobilePage.locator('#diagnostics').evaluate(element => ({
      x: element.dataset.x,
      vx: element.dataset.vx,
      control: element.dataset.controlAllowed,
      paused: element.dataset.paused,
      sources: element.dataset.touchSources,
      mode: element.dataset.mode,
    }));
  }
  assert.equal(navigated, true,
    'Touch movement and jumps must reach the NPC without teleporting');
  await pointer(mobilePage, '[data-action="right"]', 'pointerup', 51);
  await pointer(mobilePage, '[data-action="interact"]', 'pointerdown', 52);
  await pointer(mobilePage, '[data-action="interact"]', 'pointerup', 52);
  await mobilePage.waitForFunction(() =>
    document.querySelector('#diagnostics')?.dataset.interactionMode === 'investigation');
  const dialogue = await mobilePage.locator('#diagnostics').evaluate(element => ({
    active: element.dataset.interactionActive,
    needsRelease: element.dataset.interactionNeedsRelease,
    closeVisible: !document.querySelector('#touch-close-dialogue')?.hidden,
    questAccepted: element.dataset.firstLevelQuestAccepted,
  }));
  assert.equal(dialogue.active, 'first-level-b-npc');
  assert.equal(dialogue.closeVisible, true);
  assert.equal(dialogue.questAccepted, 'false');
  report.dialogueScreenshot = await screenshot(mobilePage, 'chrome-touch-npc-dialogue');
  await mobilePage.locator('#touch-close-dialogue').click();
  await mobilePage.waitForFunction(() =>
    document.querySelector('#diagnostics')?.dataset.interactionMode !== 'investigation');
  await mobilePage.waitForFunction(() =>
    document.querySelector('#diagnostics')?.dataset.firstLevelQuestAccepted === 'true',
  undefined, { timeout: 15000, polling: 100 });
  report.questAcceptedScreenshot = await screenshot(mobilePage, 'chrome-touch-quest-accepted');
  record('H03/H04 touch NPC dialogue and normal close', 'PASS', dialogue);

  await mobilePage.waitForFunction(() =>
    document.querySelector('#diagnostics')?.dataset.grounded === 'true' &&
    document.querySelector('#diagnostics')?.dataset.interactionMode === 'idle',
  undefined, { timeout: 10000, polling: 100 });
  await pointer(mobilePage, '[data-action="jump"]', 'pointerdown', 60);
  await pointer(mobilePage, '[data-action="jump"]', 'pointerup', 60);
  await mobilePage.waitForFunction(() =>
    document.querySelector('#diagnostics')?.dataset.grounded === 'true' &&
    document.querySelector('#diagnostics')?.dataset.needsRelease === 'false',
  undefined, { timeout: 10000, polling: 100 });
  const freshTouchPrecondition = await mobilePage.locator('#diagnostics')
    .evaluate(element => ({
      x: Number(element.dataset.x),
      y: Number(element.dataset.y),
      grounded: element.dataset.grounded,
      support: element.dataset.support,
      eligible: element.dataset.eligible,
      needsRelease: element.dataset.needsRelease,
      interactionMode: element.dataset.interactionMode,
      paused: element.dataset.paused,
      control: element.dataset.controlAllowed,
    }));
  await mobilePage.evaluate(() => {
    document.querySelector('#touch-pause')?.click();
  });
  await mobilePage.waitForFunction(() =>
    document.querySelector('#diagnostics')?.dataset.paused === 'true');
  const beforePauseHeldJump = await mobilePage.locator('#diagnostics')
    .evaluate(element => ({
      jumps: Number(element.dataset.jumps),
      tick: Number(element.dataset.tick),
    }));
  await pointer(mobilePage, '[data-action="jump"]', 'pointerdown', 60);
  await mobilePage.waitForTimeout(120);
  const heldPressAtPause = await mobilePage.locator('#diagnostics')
    .evaluate(element => ({
      jumps: Number(element.dataset.jumps),
      tick: Number(element.dataset.tick),
      sources: JSON.parse(element.dataset.touchSources || '{}'),
    }));
  await mobilePage.locator('#touch-continue').click();
  await mobilePage.waitForFunction(tick =>
    Number(document.querySelector('#diagnostics')?.dataset.tick) > tick,
  heldPressAtPause.tick, { timeout: 10000, polling: 100 });
  const afterPauseHeldRelease = await mobilePage.locator('#diagnostics')
    .evaluate(element => ({
      jumps: Number(element.dataset.jumps),
      sources: JSON.parse(element.dataset.touchSources || '{}'),
    }));
  assert.equal(heldPressAtPause.jumps, beforePauseHeldJump.jumps);
  assert.equal(heldPressAtPause.tick, beforePauseHeldJump.tick);
  assert.deepEqual(heldPressAtPause.sources.jump, []);
  assert.equal(afterPauseHeldRelease.jumps, beforePauseHeldJump.jumps,
    'A press held immediately before menu pause must not execute after resume');
  assert.deepEqual(afterPauseHeldRelease.sources.jump, []);
  await mobilePage.waitForFunction(() =>
    document.querySelector('#diagnostics')?.dataset.grounded === 'true' &&
    document.querySelector('#diagnostics')?.dataset.needsRelease === 'false',
  undefined, { timeout: 10000, polling: 100 });
  await mobilePage.evaluate(() => {
    document.querySelector('#touch-pause')?.click();
  });
  await mobilePage.waitForFunction(() =>
    document.querySelector('#diagnostics')?.dataset.paused === 'true');
  const beforePausedPointer = await mobilePage.locator('#diagnostics').evaluate(element => ({
    tick: Number(element.dataset.tick),
    jumps: Number(element.dataset.jumps),
    x: Number(element.dataset.x),
    y: Number(element.dataset.y),
  }));
  await pointer(mobilePage, '[data-action="jump"]', 'pointerdown', 61);
  const pausedPointerState = await mobilePage.locator('#diagnostics').evaluate(element => ({
    jumps: Number(element.dataset.jumps),
    tick: Number(element.dataset.tick),
    paused: element.dataset.paused,
    sources: JSON.parse(element.dataset.touchSources || '{}'),
  }));
  await pointer(mobilePage, '[data-action="jump"]', 'pointercancel', 61);
  const cancelledPointerState = await mobilePage.locator('#diagnostics').evaluate(element => ({
    jumps: Number(element.dataset.jumps),
    tick: Number(element.dataset.tick),
    paused: element.dataset.paused,
    sources: JSON.parse(element.dataset.touchSources || '{}'),
  }));
  await mobilePage.locator('#touch-continue').click();
  await mobilePage.waitForFunction(tick =>
    Number(document.querySelector('#diagnostics')?.dataset.tick) > tick,
  beforePausedPointer.tick, { timeout: 10000, polling: 100 });
  const afterCancelledPointer = await mobilePage.locator('#diagnostics').evaluate(element => ({
    jumps: Number(element.dataset.jumps),
    tick: Number(element.dataset.tick),
    paused: element.dataset.paused,
    sources: JSON.parse(element.dataset.touchSources || '{}'),
  }));
  assert.equal(pausedPointerState.jumps, beforePausedPointer.jumps);
  assert.equal(cancelledPointerState.jumps, beforePausedPointer.jumps);
  assert.equal(afterCancelledPointer.jumps, beforePausedPointer.jumps);
  assert.deepEqual(afterCancelledPointer.sources.jump, []);
  await mobilePage.waitForFunction(() =>
    document.querySelector('#diagnostics')?.dataset.grounded === 'true' &&
    document.querySelector('#diagnostics')?.dataset.needsRelease === 'false',
  undefined, { timeout: 10000, polling: 100 });
  await pointer(mobilePage, '[data-action="jump"]', 'pointerdown', 62);
  await pointer(mobilePage, '[data-action="jump"]', 'pointerup', 62);
  const freshTouchJumpObserved = await mobilePage.waitForFunction(jumps =>
    Number(document.querySelector('#diagnostics')?.dataset.jumps) > jumps,
  afterCancelledPointer.jumps, { timeout: 10000, polling: 100 })
    .then(() => true, () => false);
  const afterFreshTouch = await mobilePage.locator('#diagnostics').evaluate(element => ({
    jumps: Number(element.dataset.jumps),
    sources: JSON.parse(element.dataset.touchSources || '{}'),
  }));
  assert.equal(freshTouchJumpObserved, true,
    'A fresh touch after pointercancel must jump without a second tap');

  const beforeLostCapture = await mobilePage.locator('#diagnostics').evaluate(element => ({
    jumps: Number(element.dataset.jumps),
  }));
  await pointer(mobilePage, '[data-action="jump"]', 'pointerdown', 63);
  const beforeLostCaptureState = await mobilePage.locator('#diagnostics')
    .evaluate(element => ({
      x: Number(element.dataset.x),
      y: Number(element.dataset.y),
      grounded: element.dataset.grounded,
      support: element.dataset.support,
      eligible: element.dataset.eligible,
      needsRelease: element.dataset.needsRelease,
      sources: JSON.parse(element.dataset.touchSources || '{}'),
    }));
  await mobilePage.evaluate(() => {
    document.querySelector('[data-action="jump"]')?.dispatchEvent(
      new PointerEvent('lostpointercapture', {
        bubbles: true,
        cancelable: true,
        pointerId: 63,
        pointerType: 'touch',
        isPrimary: false,
        buttons: 0,
      }),
    );
  });
  await pointer(mobilePage, '[data-action="jump"]', 'pointerup', 63);
  const afterLostCapture = await mobilePage.locator('#diagnostics')
    .evaluate(element => ({
      x: Number(element.dataset.x),
      y: Number(element.dataset.y),
      grounded: element.dataset.grounded,
      support: element.dataset.support,
      eligible: element.dataset.eligible,
      needsRelease: element.dataset.needsRelease,
      sources: JSON.parse(element.dataset.touchSources || '{}'),
    }));
  await mobilePage.waitForFunction(() =>
    document.querySelector('#diagnostics')?.dataset.grounded === 'true' &&
    document.querySelector('#diagnostics')?.dataset.needsRelease === 'false',
  undefined, { timeout: 10000, polling: 100 });
  await pointer(mobilePage, '[data-action="jump"]', 'pointerdown', 64);
  await pointer(mobilePage, '[data-action="jump"]', 'pointerup', 64);
  const lostCaptureFreshJumpObserved = await mobilePage.waitForFunction(jumps =>
    Number(document.querySelector('#diagnostics')?.dataset.jumps) > jumps,
  afterFreshTouch.jumps, { timeout: 10000, polling: 100 })
    .then(() => true, () => false);
  const afterLostCaptureFreshTouch =
    await mobilePage.locator('#diagnostics').evaluate(element => ({
      jumps: Number(element.dataset.jumps),
      sources: JSON.parse(element.dataset.touchSources || '{}'),
    }));
  assert.equal(lostCaptureFreshJumpObserved, true,
    'A fresh touch after lost capture must jump without requiring an extra tap');
  assert.ok(afterLostCaptureFreshTouch.jumps > beforeLostCapture.jumps);
  record('H04 cancel, lost capture and resume do not replay held input', 'PASS', {
    beforePauseHeldJump,
    heldPressAtPause,
    afterPauseHeldRelease,
    beforePausedPointer,
    freshTouchPrecondition,
    pausedPointerState,
    cancelledPointerState,
    afterCancelledPointer,
    freshTouchJumpObserved,
    afterFreshTouch,
    beforeLostCapture,
    beforeLostCaptureState,
    afterLostCapture,
    lostCaptureFreshJumpObserved,
    afterLostCaptureFreshTouch,
  });

  await mobilePage.locator('#touch-toggle').click();
  assert.equal(await mobilePage.locator('#touch-controls').isVisible(), false);
  await mobilePage.locator('#touch-toggle').click();
  assert.equal(await mobilePage.locator('#touch-controls').isVisible(), true);
  const hiddenTouchX = Number(await mobilePage.locator('#diagnostics')
    .getAttribute('data-x'));
  await mobilePage.locator('#touch-toggle').click();
  await mobilePage.keyboard.down('KeyD');
  await mobilePage.waitForFunction(x =>
    Number(document.querySelector('#diagnostics')?.dataset.x) > x + 8,
  hiddenTouchX, { timeout: 10000, polling: 100 });
  await mobilePage.keyboard.up('KeyD');
  await mobilePage.locator('#touch-toggle').click();
  record('H07 touch presentation toggle and keyboard retention', 'PASS');
  report.layers.chromeTouchEmulation = 'PASS';

} catch (error) {
  report.failure = {
    message: String(error),
    stack: error instanceof Error ? error.stack : undefined,
  };
  if (evidencePage && !evidencePage.isClosed()) {
    try {
      report.failureScreenshot =
        await screenshot(evidencePage, 'failure-state');
      report.failureState = await evidencePage.evaluate(() => {
        const data = document.querySelector('#diagnostics')?.dataset;
        return {
          focused: document.hasFocus(),
          visibility: document.visibilityState,
          tick: data?.tick,
          x: data?.x,
          vx: data?.vx,
          paused: data?.paused,
          rootSources: JSON.parse(
            document.querySelector('#touch-prototype')?.dataset.touchSources || '{}',
          ),
          diagnosticSources: JSON.parse(data?.touchSources || '{}'),
        };
      });
      report.failureInputEvidence = await readInputEvidence(evidencePage);
    } catch (evidenceError) {
      report.failureEvidenceError = String(evidenceError);
    }
  }
  record('H5-01 browser verification', 'FAIL', report.failure);
} finally {
  if (mobileContext) {
    try {
      await mobileContext.close();
      report.cleanup.mobileContext = 'PASS';
    } catch (error) {
      report.cleanup.mobileContext = 'FAIL';
      report.cleanup.mobileContextError = String(error);
    }
    mobileContext = undefined;
  }
  if (desktopContext) {
    try {
      await desktopContext.close();
      report.cleanup.desktopContext = 'PASS';
    } catch (error) {
      report.cleanup.desktopContext = 'FAIL';
      report.cleanup.desktopContextError = String(error);
    }
    desktopContext = undefined;
  }
  if (browserConnection) {
    try {
      await browserConnection.close();
      report.cleanup.browserConnection = 'PASS';
    } catch (error) {
      report.cleanup.browserConnection = 'FAIL';
      report.cleanup.browserConnectionError = String(error);
    }
    browserConnection = undefined;
  }
  if (chromeProcess) {
    try {
      report.cleanup.chromePid = chromeProcess.pid;
      report.cleanup.chromeArgs = report.browser.args;
      if (chromeProcess.exitCode === null) {
        chromeProcess.kill();
        await new Promise(done => {
          const timer = setTimeout(done, 3000);
          chromeProcess.once('exit', () => {
            clearTimeout(timer);
            done();
          });
        });
      }
      let processAlive = true;
      try {
        process.kill(chromeProcess.pid, 0);
      } catch (error) {
        processAlive = error?.code !== 'ESRCH';
      }
      if (
        chromeProcess.exitCode === null &&
        chromeProcess.signalCode === null &&
        processAlive
      ) {
        report.cleanup.chromeProcess = 'FAIL';
        report.cleanup.chromeProcessError = 'Owned Chrome process did not exit.';
        if (process.platform === 'win32') {
          const { execFileSync } = await import('node:child_process');
          try {
            execFileSync('taskkill', [
              '/PID', String(chromeProcess.pid), '/T', '/F',
            ], { stdio: 'ignore' });
            await new Promise(done => setTimeout(done, 500));
            try {
              process.kill(chromeProcess.pid, 0);
            } catch (error) {
              if (error?.code === 'ESRCH') {
                processAlive = false;
                report.cleanup.chromeForcedTermination = 'PASS';
              }
            }
          } catch (error) {
            report.cleanup.chromeForcedTermination = 'FAIL';
            report.cleanup.chromeForcedTerminationError = String(error);
          }
        }
      } else {
        report.cleanup.chromeProcess = 'PASS';
        report.cleanup.chromeExitCode = chromeProcess.exitCode;
        report.cleanup.chromeSignalCode = chromeProcess.signalCode;
        report.cleanup.chromeProcessAlive = processAlive;
      }
    } catch (error) {
      report.cleanup.chromeProcess = 'FAIL';
      report.cleanup.chromeProcessError = String(error);
    }
    chromeProcess = undefined;
  }
  try {
    await new Promise(done => server.close(done));
    report.cleanup.server = 'PASS';
  } catch (error) {
    report.cleanup.server = 'FAIL';
    report.cleanup.serverError = String(error);
  }
  const cleanupValues = Object.entries(report.cleanup)
    .filter(([key]) =>
      [
        'desktopContext',
        'mobileContext',
        'browserConnection',
        'chromeProcess',
        'server',
      ].includes(key))
    .map(([, value]) => value);
  report.cleanup.status = cleanupValues.every(value => value === 'PASS')
    ? 'PASS'
    : 'FAIL';
  report.finishedAt = new Date().toISOString();
  report.status =
    report.failure || report.cleanup.status === 'FAIL' ? 'FAIL' : 'PASS';
  report.functionalAcceptance = 'BLOCKED';
  report.functionalAcceptanceReason =
    'H08 requires a real phone; emulation is not a device PASS.';
  await writeFile(
    join(evidenceDir, 'report.json'),
    JSON.stringify(report, null, 2),
  );
  console.log('Evidence:', evidenceDir);
  console.log(report.status, TASK, SCOPE);
  if (report.status === 'FAIL') process.exitCode = 1;
}
