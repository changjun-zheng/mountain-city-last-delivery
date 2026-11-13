import assert from 'node:assert/strict';
import { mkdtemp, cp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { appendFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import {
  identifyBrowser,
  parseBrowserSelection,
  resolveBrowserExecutable,
} from './browser-selection.mjs';
import {
  chooseScene, checkDiagnosticZones, checkGraybox, checkInMemoryProgress,
  checkInteractions, checkMovingPlatformLifecycle, checkGoalRouteRuntime,
  checkInitialSnapshot,
} from './graybox-browser.mjs';
import { createPlatformObserver } from './platform-observer.mjs';

const TIMEOUT = 15000; // Same readiness budget as before R1; hidden frames are not polled via RAF.
const cliArgs = process.argv.slice(2);
let browserSelection;
try {
  browserSelection = parseBrowserSelection(cliArgs);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
await mkdir('test-results/platform', { recursive: true });
const evidenceDir = await mkdtemp(resolve('test-results/platform/run-'));
const injection = cliArgs.find(arg => arg.startsWith('--inject-interruption='))?.split('=')[1];
if (injection && !['hidden', 'close'].includes(injection)) throw new Error('Unknown interruption injection');
const focusedD04R1 = cliArgs.includes('--d04-r1');
const focusedD05 = cliArgs.includes('--d05');
const focusedD07 = cliArgs.includes('--d07');
const focusedD08 = cliArgs.includes('--d08');
const focusedD09D1 = cliArgs.includes('--d09-d1');
const focusedD10A1 = cliArgs.includes('--d10-a1');
if ([focusedD04R1, focusedD05, focusedD07, focusedD08, focusedD09D1, focusedD10A1]
  .filter(Boolean).length > 1) {
  throw new Error('Select only one focused platform scenario');
}
const focused = focusedD04R1 || focusedD05 || focusedD07 || focusedD08 ||
  focusedD09D1 || focusedD10A1;
const webOnly = cliArgs.includes('--web-only') || Boolean(injection);
let browserResolution;
let browserResolutionError;
try {
  browserResolution = resolveBrowserExecutable(browserSelection);
} catch (error) {
  browserResolutionError = error;
}
const report = {
  task: focusedD04R1 ? 'D04-R1' : focusedD05 ? 'D05'
    : focusedD07 ? 'D07-R1' : focusedD08 ? 'D08'
      : focusedD09D1 ? 'D09-D1' : focusedD10A1 ? 'D10-A1' : 'D04',
  scope: focusedD04R1 ? 'moving-platform-lifecycle'
    : focusedD05 ? 'diagnostic-zones'
      : focusedD07 ? 'interaction-prompt-and-release-gate'
        : focusedD08 ? 'in-memory-progress-idempotency'
          : focusedD09D1 ? 'goal-route-real-event-command-transaction-result'
            : focusedD10A1 ? 'initial-snapshot-registry-and-atomic-capture'
              : 'full-platform-regression',
  startedAt: new Date().toISOString(), evidenceDir, injection,
  commandLine: cliArgs,
  runtime: { node: process.version, platform: process.platform, arch: process.arch },
  browser: {
    requested: browserSelection.id,
    expectedBrand: browserSelection.brand,
    explicit: browserSelection.explicit,
    candidates: browserResolution?.candidates ?? browserResolutionError?.candidates ?? [],
    executablePath: browserResolution?.executablePath ?? null,
    availability: browserResolution ? 'PASS' : 'BLOCKED',
    unavailableReason: browserResolutionError?.message,
  },
  platforms: Object.fromEntries(['web', 'electron-dev', 'electron-packaged'].map(label => [label, { status: 'NOT RUN' }])),
  events: [], processes: [], services: [], cleanupFailures: [],
};
report.version = Object.fromEntries(await Promise.all([
  'tests/platform-smoke.mjs', 'tests/browser-selection.mjs', 'tests/graybox-browser.mjs',
  'tests/platform-observer.mjs', 'scripts/test.mjs',
  'tests/foreground-window.ps1',
  'src/core/player.ts', 'src/core/graybox.ts', 'src/core/snapshot.ts',
  'src/physics/matter/graybox-world.ts',
  'src/core/interaction.ts', 'src/core/progress.ts', 'src/platform/web/player-input.ts',
  'src/core/goal-route-runtime.ts', 'src/core/events.ts', 'src/core/commands.ts',
  'src/core/delivery.ts', 'src/core/transactions.ts', 'src/core/transaction-results.ts',
  'src/rendering/phaser/graybox.ts', 'src/platform/web/main.ts',
  'tests/goal-route-runtime.test.mjs', 'tests/snapshot.test.mjs',
  'tests/player-physics.test.mjs', 'package.json',
  'release/layered-city-adventures/win-unpacked/resources/app.asar',
].map(async path => [path, createHash('sha256').update(await readFile(path)).digest('hex')])));
let captureNumber = 0;
const started = performance.now();
const note = (label, phase, data = {}) => {
  const event = { seq: report.events.length + 1, at: new Date().toISOString(), elapsedMs: performance.now() - started,
    label, phase, ...data };
  report.events.push(event);
  appendFileSync(join(evidenceDir, 'timeline.jsonl'), JSON.stringify(event) + '\n');
};
let saveQueue = Promise.resolve();
const save = () => {
  const json = JSON.stringify(report, null, 2);
  return saveQueue = saveQueue.then(() => writeFile(join(evidenceDir, 'report.json'), json));
};

async function bounded(promise, ms, label) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Timed out: ' + label)), ms);
    })]);
  } finally { clearTimeout(timer); }
}

const read = page => page.locator('#diagnostics').evaluate(element => ({
  tick: Number(element.dataset.tick), marker: Number(element.dataset.marker),
  paused: element.dataset.paused === 'true', tokens: Number(element.dataset.tokens),
  discarded: Number(element.dataset.discarded), visibility: document.visibilityState,
}));
const poll = { timeout: TIMEOUT, polling: 100 };

async function snapshot(ctx, phase, screenshot = false) {
  const state = { stage: ctx.stage, operation: ctx.operation, failure: ctx.failure,
    pageErrors: [...ctx.errors], navigation: [...ctx.navigation], breadcrumbs: [...ctx.breadcrumbs],
    lastObservation: ctx.lastObservation, interruption: ctx.interruption,
    driverHeld: ctx.monitor?.held, nativeAlive: ctx.native?.alive(), foreground: ctx.foreground };
  if (ctx.page && !ctx.page.isClosed()) {
    try {
      state.page = await bounded(ctx.page.evaluate(() => ({
        url: location.href, title: document.title, sceneLabel: document.querySelector('#game')?.getAttribute('aria-label'),
        visibility: document.visibilityState, readyState: document.readyState,
        focused: document.hasFocus(), diagnostics: { ...document.querySelector('#diagnostics')?.dataset },
        lifecycleTrace: window.__platformLifecycleTrace,
        diagnosticText: document.querySelector('#diagnostics')?.textContent,
        canvasCount: document.querySelectorAll('#game canvas').length,
        restartDisabled: document.querySelector('#restart')?.disabled,
        errorText: document.querySelector('#error')?.textContent,
      })), 3000, 'page diagnostic snapshot');
    } catch (error) { state.pageUnavailable = String(error); }
  }
  try { state.window = await bounded(ctx.windowState?.() ?? Promise.resolve(null), 3000, 'native window snapshot'); }
  catch (error) { state.windowUnavailable = String(error); }
  if (screenshot && ctx.page && !ctx.page.isClosed()) {
    const file = `${String(++captureNumber).padStart(3, '0')}-${ctx.label}-${phase.replace(/[^a-z0-9-]/gi, '-')}.png`;
    try {
      if (state.page?.visibility === 'hidden' && ctx.desktop) {
        // Capture the real hidden surface without activating the window or changing visibility.
        const image = await ctx.desktop.evaluate(async ({ BrowserWindow }) => {
          const image = await BrowserWindow.getAllWindows()[0].capturePage(undefined, { stayHidden: true });
          return { empty: image.isEmpty(), png: image.toPNG().toString('base64') };
        });
        assert.equal(image.empty, false, 'Native hidden capture returned an empty image');
        await writeFile(join(evidenceDir, file), Buffer.from(image.png, 'base64'));
        state.captureMethod = 'BrowserWindow.capturePage(stayHidden=true)';
      } else {
        await ctx.page.screenshot({ path: join(evidenceDir, file), timeout: 3000 });
        state.captureMethod = 'page.screenshot';
      }
      state.screenshot = file;
    } catch (error) { state.screenshotUnavailable = String(error); }
  }
  note(ctx.label, phase, state);
  await save();
  return state;
}

async function observe(ctx, page) {
  ctx.page = page;
  page.setDefaultTimeout(TIMEOUT);
  page.setDefaultNavigationTimeout(TIMEOUT);
  await ctx.monitor.attach(page);
  page.on('pageerror', error => ctx.errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') ctx.errors.push(message.text());
    if (message.text().startsWith('R1_RESTART_')) ctx.breadcrumbs.push(message.text());
  });
  page.on('framenavigated', frame => {
    if (frame === page.mainFrame()) ctx.navigation.push({ at: new Date().toISOString(), event: 'navigation', url: frame.url() });
  });
  page.on('load', () => ctx.navigation.push({ at: new Date().toISOString(), event: 'load', url: page.url() }));
  page.on('requestfailed', request => note(ctx.label, 'request-failed', { url: request.url(), error: request.failure() }));
  page.on('crash', () => ctx.errors.push('Renderer crashed'));
}

async function loaded(ctx) {
  ctx.stage = 'page-loaded';
  await ctx.page.waitForFunction(() => document.readyState === 'complete' &&
    document.querySelector('#diagnostics')?.dataset.tick !== undefined, undefined, poll);
  assert.equal(await ctx.page.locator('#error').textContent(), '');
  assert.equal(await ctx.page.title(), '叠城大冒险 | Layered City Adventures');
  assert.match(await ctx.page.locator('#game').getAttribute('aria-label'), /^叠城大冒险 · Layered City Adventures/);
}

async function sceneReady(ctx) {
  ctx.stage = 'scene-created-and-rendered';
  // The existing enabled button is resolved after Phaser POST_RENDER, independent of Tick.
  await ctx.page.waitForFunction(() => document.querySelectorAll('#game canvas').length === 1 &&
    document.querySelector('#restart')?.disabled === false, undefined, poll);
  assert.equal(await ctx.page.locator('#game canvas').evaluate(canvas =>
    canvas.getContext('2d').getImageData(400, 55, 1, 1).data[0]), 240);
}

async function activeSceneReady(ctx) {
  ctx.stage = 'focused-scene-show-restore-activate';
  await ctx.show();
  await ctx.page.waitForFunction(() => document.visibilityState === 'visible', undefined, poll);
  await ctx.page.waitForFunction(() => document.querySelectorAll('#game canvas').length === 1 &&
    document.querySelector('#restart')?.disabled === false, undefined, poll);
  await running(ctx);
}

async function running(ctx) {
  ctx.stage = 'simulation-running';
  await ctx.page.waitForFunction(() => document.visibilityState === 'visible' &&
    document.querySelector('#diagnostics')?.dataset.paused === 'false', undefined, poll);
  const before = await read(ctx.page);
  await ctx.page.waitForFunction(tick => Number(document.querySelector('#diagnostics').dataset.tick) > tick, before.tick, poll);
  assert.equal((await read(ctx.page)).tokens, 0);
}

async function visibleReady(ctx) {
  ctx.stage = 'native-show-restore-activate';
  await ctx.show(); // Real window/tab operations precede the visibility and running assertions.
  await ctx.page.waitForFunction(() => document.visibilityState === 'visible', undefined, poll);
  await sceneReady(ctx);
  await running(ctx);
}

function launchNative(ctx, executable, args, env = process.env) {
  const label = ctx.label;
  const child = spawn(executable, args, { env, stdio: ['ignore', 'pipe', 'pipe'] });
  const record = {
    label, pid: child.pid, executable, args: [...args], startedAt: new Date().toISOString(),
    status: 'NOT RUN', output: '',
  };
  report.processes.push(record);
  ctx.monitor.stamp('native-process-spawn', { pid: child.pid, executable, args });
  let failure;
  let finished = false;
  const exit = new Promise(resolveExit => {
    child.once('exit', (code, signal) => {
      finished = true;
      Object.assign(record, { code, signal, exitedAt: new Date().toISOString() });
      ctx.monitor.processExit({ pid: child.pid, code, signal });
      resolveExit({ code, signal });
    });
    child.once('error', error => { failure = error; finished = true; record.spawnError = String(error); resolveExit({ spawnError: String(error) }); });
  });
  child.stdout.on('data', chunk => { record.output += chunk; });
  child.stderr.on('data', chunk => { record.output += chunk; });
  return {
    child, exit, record, alive: () => !finished && Boolean(child.pid),
    async endpoint(prefix) {
      for (let i = 0; i < 200; i++) {
        if (failure) throw failure;
        const match = record.output.match(new RegExp(prefix + ' (ws://[^\\s]+)'));
        if (match) return match[1];
        if (finished) break;
        await delay(50);
      }
      throw new Error('Native test process did not expose a debugging endpoint: ' + record.output);
    },
  };
}

async function inspectMain(endpoint) {
  const socket = new WebSocket(endpoint);
  await bounded(once(socket, 'open'), 5000, 'Node inspector connect');
  let sequence = 0;
  const pending = new Map();
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    const callback = pending.get(message.id);
    if (callback) { pending.delete(message.id); callback.resolve(message); }
  });
  socket.addEventListener('close', () => {
    for (const callback of pending.values()) callback.reject(new Error('Node inspector disconnected'));
    pending.clear();
  });
  return {
    close: () => socket.close(),
    async evaluate(fn) {
      const id = ++sequence;
      const response = new Promise((resolveResponse, reject) => pending.set(id, { resolve: resolveResponse, reject }));
      socket.send(JSON.stringify({
        id, method: 'Runtime.evaluate', params: {
          expression: `(async () => { const electron = process.getBuiltinModule('module').createRequire(process.cwd() + '/package.json')('electron'); return (${fn.toString()})(electron); })()`,
          awaitPromise: true, returnByValue: true,
        },
      }));
      try {
        const message = await bounded(response, 5000, 'Node inspector evaluate');
        assert.equal(message.error, undefined, JSON.stringify(message.error));
        assert.equal(message.result.exceptionDetails, undefined, JSON.stringify(message.result.exceptionDetails));
        return message.result.result.value;
      } finally { pending.delete(id); }
    },
  };
}

async function stopOwned(ctx, politeClose) {
  const native = ctx.native;
  if (!native) return;
  ctx.monitor.close('owned-process-cleanup');
  ctx.monitor.stamp('cleanup-start', { pid: native.child.pid, alive: native.alive() });
  try {
    if (native.alive()) {
      try {
        ctx.monitor.stamp('cleanup-close-request', { pid: native.child.pid });
        await bounded(Promise.resolve().then(politeClose), 3000, 'owned process close request');
      }
      catch (error) { native.record.closeRequestError = String(error); }
      try { await bounded(native.exit, 5000, 'owned process exit'); }
      catch {
        // Only the still-live ChildProcess created above is eligible. No name/global process search.
        if (native.alive()) {
          native.record.forcedCleanup = true;
          ctx.monitor.stamp('cleanup-force-request', { pid: native.child.pid });
          const killer = spawn('taskkill', ['/PID', String(native.child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
          await bounded(once(killer, 'exit'), 5000, 'owned process tree cleanup');
          await bounded(native.exit, 5000, 'owned process exit after cleanup');
        }
      }
    }
    native.record.cleanupStatus = native.alive() ? 'FAIL' : 'PASS';
    native.record.status = native.record.code === 0 ? 'PASS' : 'FAIL';
    ctx.monitor.stamp('cleanup-complete', { pid: native.child.pid, code: native.record.code, alive: native.alive() });
    if (native.alive()) throw new Error('Owned process is still alive: ' + native.child.pid);
  } catch (error) {
    native.record.status = 'FAIL';
    native.record.cleanupError = String(error);
    report.cleanupFailures.push({ label: native.record.label, error: String(error) });
    throw error;
  }
}

async function resumeProbe(ctx, frozen, label) {
  await ctx.page.evaluate(() => {
    window.__resumeSample = new Promise(resolveResume => {
      const changed = () => {
        if (document.visibilityState !== 'visible') return;
        document.removeEventListener('visibilitychange', changed);
        requestAnimationFrame(() => resolveResume({ ...document.querySelector('#diagnostics').dataset }));
      };
      document.addEventListener('visibilitychange', changed);
    });
  });
  await ctx.show();
  const resumed = await bounded(ctx.page.evaluate(() => window.__resumeSample), TIMEOUT, 'first visible frame');
  assert.equal(resumed.paused, 'false');
  assert.equal(Number(resumed.tokens), 0);
  assert.ok(Number(resumed.tick) - frozen.tick <= 5, 'No background-time catch-up');
  assert.equal(Number(resumed.discarded), frozen.discarded, 'No background time counted as active time');
  await sceneReady(ctx);
  await running(ctx);
  note(ctx.label, label, { status: 'PASS', frozen, firstResumedTick: Number(resumed.tick) });
  console.log('PASS', ctx.label, label, JSON.stringify({ frozenTick: frozen.tick, firstResumedTick: Number(resumed.tick) }));
}

async function hiddenStartup(ctx) {
  ctx.operation = 'hidden-startup';
  ctx.stage = 'hidden-renderer-startup';
  await ctx.hide();
  await ctx.page.waitForFunction(() => document.visibilityState === 'hidden', undefined, poll);
  await ctx.page.reload({ waitUntil: 'load' }); // A fresh Renderer initialization while genuinely hidden.
  await loaded(ctx);
  const frozen = await read(ctx.page);
  assert.equal(frozen.visibility, 'hidden');
  assert.equal(frozen.tick, 0);
  assert.equal(frozen.marker, 0);
  assert.equal(frozen.paused, true);
  assert.equal(frozen.tokens, 1);
  await snapshot(ctx, 'hidden-start-loaded', true);
  if (process.argv.includes('--inject-failure=web-hidden-start') && ctx.label === 'web') {
    throw new Error('Intentional failure to verify owned-process and service cleanup.');
  }
  if (process.argv.includes('--reproduce-legacy-ready') && ctx.label === 'electron-packaged') {
    let legacyError;
    try {
      // This is the exact previous predicate and 15-second timeout, retained as a reproduction.
      await ctx.page.waitForFunction(() => Number(document.querySelector('#diagnostics')?.dataset.tick) > 0, undefined, { timeout: TIMEOUT });
    } catch (error) { legacyError = error; }
    assert.equal(legacyError?.name, 'TimeoutError', 'Legacy hidden-start readiness must fail to reproduce');
    note(ctx.label, 'legacy-ready-reproduction', { status: 'FAIL', expected: true, error: String(legacyError) });
    console.log('FAIL (expected reproduction)', ctx.label, 'legacy ready: hidden + Tick 0 + Token 1');
    await snapshot(ctx, 'legacy-ready-timeout', true);
  }
  await delay(1200);
  assert.deepEqual(await read(ctx.page), frozen, 'Hidden startup must remain correctly paused at Tick 0');
  await resumeProbe(ctx, frozen, 'hidden-start-restore');
  await snapshot(ctx, 'hidden-start-restored', true);
}

async function checkPause(ctx, index) {
  ctx.operation = 'hide-restore-' + index;
  ctx.stage = 'hide-restore-' + index;
  await ctx.hide();
  await ctx.page.waitForFunction(() => document.visibilityState === 'hidden' &&
    document.querySelector('#diagnostics')?.dataset.paused === 'true', undefined, poll);
  const frozen = await read(ctx.page);
  assert.equal(frozen.tokens, 1);
  await delay(1200);
  assert.deepEqual(await read(ctx.page), frozen, 'Tick and marker must remain unchanged while hidden');
  await resumeProbe(ctx, frozen, 'hide-restore-' + index);
}

async function checkRestart(ctx, index) {
  ctx.operation = 'restart-' + index;
  ctx.stage = 'restart-' + index + '-preparation';
  await visibleReady(ctx);
  await snapshot(ctx, 'restart-' + index + '-before');
  const tag = 'R1_RESTART_' + index;
  await ctx.page.evaluate(tag => {
    const canvas = document.querySelector('#game canvas');
    const observer = new MutationObserver(() => {
      if (!canvas.isConnected) { console.info(tag + ':canvas-removed'); observer.disconnect(); }
    });
    observer.observe(document.querySelector('#game'), { childList: true });
    window.addEventListener('beforeunload', () => console.info(tag + ':beforeunload'), { once: true });
  }, tag);
  await ctx.monitor.navigation('restart-' + index);
  ctx.stage = 'restart-' + index + '-destroy-and-navigation';
  await Promise.all([
    ctx.page.waitForEvent('framenavigated', { predicate: frame => frame === ctx.page.mainFrame() }),
    ctx.page.locator('#restart').click(),
  ]);
  await loaded(ctx); // Loading is allowed to finish while paused; do not require Tick here.
  await snapshot(ctx, 'restart-' + index + '-loaded-before-activation');
  await visibleReady(ctx);
  assert.ok(ctx.breadcrumbs.includes(tag + ':canvas-removed'), 'Old canvas was not observed removed');
  assert.ok(ctx.breadcrumbs.includes(tag + ':beforeunload'), 'Reload was not observed');
  assert.equal((await read(ctx.page)).tokens, 0);
  await snapshot(ctx, 'restart-' + index + '-running');
  console.log('PASS', ctx.label, 'restart', index, 'old canvas removed -> navigation -> visible scene -> running');
}

async function checkDesktop(ctx, executablePath, devURL) {
  const env = { ...process.env, MCLD_DEV_URL: devURL ?? 'https://example.invalid/' };
  delete env.ELECTRON_RUN_AS_NODE;
  ctx.native = launchNative(ctx, executablePath,
    ['--inspect=0', '--remote-debugging-port=0', ...(devURL ? [resolve('.')] : [])], env);
  try {
    await ctx.monitor.race(async () => {
    ctx.desktop = await inspectMain(await ctx.native.endpoint('Debugger listening on'));
    ctx.windowState = () => ctx.desktop.evaluate(({ app, BrowserWindow }) => ({
      packaged: app.isPackaged, pid: process.pid, appName: app.getName(), userData: app.getPath('userData'),
      windows: BrowserWindow.getAllWindows().map(window => ({
        id: window.id, title: window.getTitle(), visible: window.isVisible(), minimized: window.isMinimized(), focused: window.isFocused(),
        bounds: window.getBounds(), url: window.webContents.getURL(), loading: window.webContents.isLoading(),
      })),
    }));
    ctx.show = async () => {
      await ctx.desktop.evaluate(({ BrowserWindow }) => {
        const window = BrowserWindow.getAllWindows()[0];
        if (window.isMinimized()) window.restore();
        window.show();
        window.focus();
      });
      await ctx.page.bringToFront();
      const state = await ctx.windowState();
      assert.equal(state.windows[0].visible, true);
      assert.equal(state.windows[0].minimized, false);
    };
    ctx.hide = async () => {
      await ctx.desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].minimize());
      assert.equal((await ctx.windowState()).windows[0].minimized, true);
    };
    ctx.rawShow = ctx.show;
    ctx.rawHide = ctx.hide;
    ctx.show = () => ctx.monitor.show(ctx.rawShow);
    ctx.hide = () => ctx.monitor.hide(ctx.rawHide);
    ctx.browser = await chromium.connectOverCDP(await ctx.native.endpoint('DevTools listening on'), { noDefaults: true });
    const context = ctx.browser.contexts()[0];
    const page = context.pages()[0] ?? await context.waitForEvent('page', { timeout: TIMEOUT });
    ctx.monitor.attachBrowser(ctx.browser, context);
    await observe(ctx, page);
    await page.waitForURL(url => url.searchParams.get('platform') === 'windows', { waitUntil: 'load' });
    await chooseScene(ctx, focused ? 'graybox' : 'diagnostic');
    await loaded(ctx);
    await snapshot(ctx, 'initial-load-before-activation', true);
    const identity = await ctx.windowState();
    assert.equal(identity.windows[0].title, '叠城大冒险 | Layered City Adventures');
    assert.equal(identity.appName, 'mountain-city-last-delivery', 'Display rename must preserve the internal app name');
    assert.equal(identity.userData, join(process.env.APPDATA, 'mountain-city-last-delivery'));
    note(ctx.label, 'display-and-storage-identity', { status: 'PASS', ...identity });
    const preferences = await ctx.desktop.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences());
    assert.equal(preferences.nodeIntegration, false);
    assert.equal(preferences.contextIsolation, true);
    assert.equal(preferences.sandbox, true);
    assert.equal(preferences.webSecurity, true);
    assert.notEqual(preferences.backgroundThrottling, false);
    if (!devURL) {
      assert.equal((await ctx.windowState()).packaged, true);
      assert.ok(page.url().startsWith('app://game/'));
    }
    await (focused ? activeSceneReady(ctx) : visibleReady(ctx));
    await snapshot(ctx, 'initial-visible-running');
    if (focusedD04R1) {
      await checkMovingPlatformLifecycle(ctx, (name, data) => note(ctx.label, 'd04-r1-' + name, data),
        (phase, screenshot) => snapshot(ctx, phase, screenshot));
    } else if (focusedD05) {
      await checkDiagnosticZones(ctx, (name, data) => note(ctx.label, 'd05-' + name, data),
        (phase, screenshot) => snapshot(ctx, phase, screenshot));
    } else if (focusedD07) {
      await checkInteractions(ctx, (name, data) => note(ctx.label, 'd07-r1-' + name, data),
        (phase, screenshot) => snapshot(ctx, phase, screenshot));
    } else if (focusedD08) {
      await checkInMemoryProgress(ctx, (name, data) => note(ctx.label, 'd08-' + name, data),
        (phase, screenshot) => snapshot(ctx, phase, screenshot));
    } else if (focusedD09D1) {
      await checkGoalRouteRuntime(ctx, (name, data) => note(ctx.label, 'd09-d1-' + name, data),
        (phase, screenshot) => snapshot(ctx, phase, screenshot));
    } else if (focusedD10A1) {
      await checkInitialSnapshot(ctx, (name, data) => note(ctx.label, 'd10-a1-' + name, data),
        (phase, screenshot) => snapshot(ctx, phase, screenshot));
    } else {
      await hiddenStartup(ctx);
      for (let i = 1; i <= 2; i++) await checkPause(ctx, i);
      for (let i = 1; i <= 3; i++) await checkRestart(ctx, i);
      await checkGraybox(ctx, (name, data) => note(ctx.label, 'graybox-' + name, data),
        (phase, screenshot) => snapshot(ctx, phase, screenshot));
    }
    assert.deepEqual(ctx.errors, []);
    await snapshot(ctx, 'completed', true);
    ctx.stage = 'native-close';
    ctx.monitor.check();
    ctx.monitor.close('successful-native-window-close');
    ctx.monitor.stamp('normal-close-request', { pid: ctx.native.child.pid });
    await ctx.desktop.evaluate(({ BrowserWindow }) => { setTimeout(() => BrowserWindow.getAllWindows()[0].close(), 100); });
    ctx.desktop.close();
    const exit = await bounded(ctx.native.exit, 5000, 'native window close -> exit');
    assert.equal(exit.code, 0);
    });
  } catch (error) {
    ctx.failure = String(error);
    await ctx.monitor.settled();
    await snapshot(ctx, 'failure', true);
    throw error;
  } finally {
    try {
      await stopOwned(ctx, async () => {
        try { await ctx.desktop?.evaluate(({ app }) => { setTimeout(() => app.quit(), 100); }); }
        finally { ctx.desktop?.close(); }
      });
    } finally {
      ctx.desktop?.close();
      await ctx.browser?.close().catch(() => {});
      await save();
    }
  }
}

async function checkWeb(ctx, devURL) {
  if (browserResolutionError) throw browserResolutionError;
  const profile = await mkdtemp(join(tmpdir(), `mountain-city-d01-r2-${browserResolution.id}-`));
  const browserArgs = [
    '--remote-debugging-port=0',
    '--user-data-dir=' + profile,
    '--no-first-run',
    'about:blank',
  ];
  Object.assign(report.browser, {
    profileDirectory: profile,
    args: browserArgs,
    pid: null,
  });
  ctx.native = launchNative(ctx, browserResolution.executablePath, browserArgs);
  report.browser.pid = ctx.native.child.pid;
  try {
    await ctx.monitor.race(async () => {
    ctx.browser = await chromium.connectOverCDP(await ctx.native.endpoint('DevTools listening on'), { noDefaults: true });
    const browserSession = await ctx.browser.newBrowserCDPSession();
    const browserVersion = await browserSession.send('Browser.getVersion');
    await browserSession.detach().catch(() => {});
    const actual = identifyBrowser(browserVersion);
    Object.assign(report.browser, { actual, verifiedAt: new Date().toISOString() });
    assert.equal(actual.brand, browserResolution.brand,
      `Selected ${browserResolution.brand}, but CDP reported ${actual.brand}`);
    note(ctx.label, 'browser-identity', {
      status: 'PASS',
      requested: browserResolution.id,
      expectedBrand: browserResolution.brand,
      executablePath: browserResolution.executablePath,
      pid: ctx.native.child.pid,
      args: browserArgs,
      actual,
    });
    const context = ctx.browser.contexts()[0];
    const page = context.pages()[0] ?? await context.waitForEvent('page', { timeout: TIMEOUT });
    ctx.monitor.attachBrowser(ctx.browser, context);
    await observe(ctx, page);
    const other = await context.newPage();
    await ctx.monitor.attach(other, 'background-tab');
    const session = await context.newCDPSession(page);
    const { windowId } = await session.send('Browser.getWindowForTarget');
    ctx.windowState = () => session.send('Browser.getWindowBounds', { windowId });
    ctx.show = async () => {
      if ((await ctx.windowState()).bounds.windowState === 'minimized') {
        await session.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'normal' } });
      }
      await page.bringToFront();
    };
    ctx.hide = () => other.bringToFront();
    ctx.rawShow = ctx.show;
    ctx.rawHide = ctx.hide;
    ctx.show = () => ctx.monitor.show(ctx.rawShow);
    ctx.hide = () => ctx.monitor.hide(ctx.rawHide);
    await page.goto(devURL);
    if (injection) return injectInterruption(ctx);
    await chooseScene(ctx, focused ? 'graybox' : 'diagnostic');
    await loaded(ctx);
    await snapshot(ctx, 'initial-load-before-activation');
    await (focused ? activeSceneReady(ctx) : visibleReady(ctx));
    if (focusedD04R1) {
      await checkMovingPlatformLifecycle(ctx, (name, data) => note(ctx.label, 'd04-r1-' + name, data),
        (phase, screenshot) => snapshot(ctx, phase, screenshot));
    } else if (focusedD05) {
      await checkDiagnosticZones(ctx, (name, data) => note(ctx.label, 'd05-' + name, data),
        (phase, screenshot) => snapshot(ctx, phase, screenshot));
    } else if (focusedD07) {
      await checkInteractions(ctx, (name, data) => note(ctx.label, 'd07-' + name, data),
        (phase, screenshot) => snapshot(ctx, phase, screenshot));
    } else if (focusedD08) {
      await checkInMemoryProgress(ctx, (name, data) => note(ctx.label, 'd08-' + name, data),
        (phase, screenshot) => snapshot(ctx, phase, screenshot));
    } else if (focusedD09D1) {
      await checkGoalRouteRuntime(ctx, (name, data) => note(ctx.label, 'd09-d1-' + name, data),
        (phase, screenshot) => snapshot(ctx, phase, screenshot));
    } else if (focusedD10A1) {
      await checkInitialSnapshot(ctx, (name, data) => note(ctx.label, 'd10-a1-' + name, data),
        (phase, screenshot) => snapshot(ctx, phase, screenshot));
    } else {
      await hiddenStartup(ctx);
      for (let i = 1; i <= 2; i++) await checkPause(ctx, i);
      for (let i = 1; i <= 3; i++) await checkRestart(ctx, i);
      await checkGraybox(ctx, (name, data) => note(ctx.label, 'graybox-' + name, data),
        (phase, screenshot) => snapshot(ctx, phase, screenshot));
    }
    assert.deepEqual(ctx.errors, []);
    await snapshot(ctx, 'completed', true);
    });
  } catch (error) {
    ctx.failure = String(error);
    await ctx.monitor.settled();
    await snapshot(ctx, 'failure', true);
    if (injection) await validateInjection(ctx);
    throw error;
  } finally {
    try {
      await stopOwned(ctx, async () => {
        const session = await ctx.browser?.newBrowserCDPSession();
        await session?.send('Browser.close');
      });
    } finally {
      ctx.monitor.stamp('driver-connection-close-request', { pid: ctx.native.child.pid });
      await ctx.browser?.close().catch(() => {});
      await save();
    }
    if (!ctx.failure) assert.equal(ctx.native.record.code, 0, 'Normal browser shutdown must exit 0');
  }
}

async function injectInterruption(ctx) {
  await chooseScene(ctx, 'graybox');
  ctx.operation = 'injected-active-operation';
  ctx.stage = ctx.operation;
  await ctx.monitor.key('Space', false);
  await ctx.monitor.key('Space', true);
  await ctx.monitor.key('KeyD', true);
  await ctx.page.waitForTimeout(100);
  await snapshot(ctx, 'before-injection', true);
  ctx.monitor.check();
  ctx.monitor.stamp('fault-injection-request', { kind: injection, pid: ctx.native.child.pid });
  if (injection === 'hidden') await ctx.rawHide();
  else {
    const session = await ctx.browser.newBrowserCDPSession();
    await session.send('Browser.close').catch(error => ctx.monitor.stamp('injection-close-response', { error: String(error) }));
  }
  // The observer must abort the enclosing operation; do not recover, replay or continue.
  await new Promise(() => {});
}

async function validateInjection(ctx) {
  try {
    assert.ok(ctx.interruption, 'The operation must have been interrupted');
    assert.equal(ctx.interruption.expected, 'visible');
    const events = () => report.events.filter(event => event.label === ctx.label);
    const first = events().find(event => event.phase === 'unexpected-interruption');
    const request = events().find(event => event.phase === 'fault-injection-request');
    assert.ok(first);
    assert.ok(request && request.seq < first.seq, 'Interruption must follow this injection, never precede it');
    assert.equal(events().some(event => event.seq > first.seq && ['show-request', 'key-request', 'cleanup-start'].includes(event.phase)), false);
    if (injection === 'hidden') {
      await ctx.page.waitForFunction(() => {
        const d = document.querySelector('#diagnostics').dataset;
        return document.visibilityState === 'hidden' && d.paused === 'true' && d.controlAllowed === 'false';
      }, undefined, poll);
      const frozen = await ctx.page.locator('#diagnostics').evaluate(element => ({ ...element.dataset }));
      await delay(400);
      assert.deepEqual(await ctx.page.locator('#diagnostics').evaluate(element => ({ ...element.dataset })), frozen);
      assert.equal(frozen.tokens, '1');
      assert.equal(frozen.needsRelease, 'true');
      assert.equal(frozen.buffer, '0');
      assert.deepEqual(ctx.lastObservation.domHeld, []);
      note(ctx.label, 'injected-hidden-frozen-input-cleared', { status: 'PASS', frozen, driverHeld: ctx.monitor.held });
    } else {
      await bounded(ctx.native.exit, 5000, 'injected browser close -> process exit');
      for (const phase of ['page-close', 'context-close', 'browser-disconnected', 'native-process-exit']) {
        assert.ok(events().some(event => event.phase === phase), 'Missing ' + phase);
      }
      assert.equal(events().some(event => event.phase === 'cleanup-start'), false, 'Process exited before cleanup began');
    }
    report.injectionValidation = { status: 'PASS', kind: injection, interruption: ctx.interruption.kind };
  } catch (error) {
    report.injectionValidation = { status: 'FAIL', kind: injection, error: String(error) };
  }
  note(ctx.label, 'fault-injection-validation', report.injectionValidation);
}

async function runCase(label, fn) {
  const ctx = { label, stage: 'launch', operation: 'initial-startup', errors: [], navigation: [], breadcrumbs: [] };
  ctx.monitor = createPlatformObserver(ctx, note, (phase, screenshot) => snapshot(ctx, phase, screenshot));
  const result = report.platforms[label];
  result.startedAt = new Date().toISOString();
  if (label === 'web') result.browser = browserSelection.id;
  const foreground = spawn('powershell.exe', ['-NoProfile', '-File', resolve('tests/foreground-window.ps1')],
    { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let partial = '';
  const foregroundExit = once(foreground, 'exit');
  foreground.on('error', error => note(label, 'foreground-probe-error', { error: String(error) }));
  foreground.stderr.on('data', chunk => note(label, 'foreground-probe-error', { error: String(chunk) }));
  foreground.stdout.on('data', chunk => {
    partial += chunk;
    let newline;
    while ((newline = partial.indexOf('\n')) !== -1) {
      const line = partial.slice(0, newline).trim(); partial = partial.slice(newline + 1);
      if (!line) continue;
      try {
        ctx.foreground = JSON.parse(line);
        ctx.monitor.stamp('native-foreground', { ...ctx.foreground, testPid: ctx.native?.child.pid });
      } catch { note(label, 'foreground-probe-output', { line }); }
    }
  });
  ctx.monitor.stamp('foreground-probe-start', { pid: foreground.pid });
  try {
    await fn(ctx);
    result.status = 'PASS';
    console.log('PASS', label, focusedD04R1
      ? 'D04-R1 moving-platform hidden/minimized lifecycle; owned process exited'
      : focusedD05
        ? 'D05 diagnostic-zone enter/occupancy/exit lifecycle; owned process exited'
        : focusedD07
          ? 'D07 interaction range/selection/control/pause lifecycle; owned process exited'
          : focusedD08
            ? 'D08 in-memory progress idempotency; owned process exited'
            : focusedD09D1
              ? 'D09-D1 Event -> Command -> Transaction -> Result -> confirmation/retirement; owned process exited'
              : focusedD10A1
                ? 'D10-A1 initial snapshot READY, lifecycle/reload stability and goal E; owned process exited'
                : 'loaded / scene / running; hidden start; 2 hide cycles; 3 restarts; graybox controls / collisions / pause; owned process exited');
  } catch (error) {
    Object.assign(result, { status: ['ENOENT', 'ENVIRONMENT_PRECONDITION'].includes(error.code) ? 'BLOCKED' : 'FAIL', stage: ctx.stage,
      expectedFailure: Boolean(injection), interruption: ctx.interruption, error: String(error), stack: error.stack });
    console.error(result.status, label, ctx.stage, String(error));
  }
  if (ctx.interruption) {
    const events = report.events.filter(event => event.label === label);
    const cleanup = events.find(event => event.phase === 'cleanup-start')?.seq ?? Infinity;
    const signals = events.filter(event => event.seq < cleanup &&
      ['renderer-blur', 'renderer-visibilitychange', 'page-close', 'page-crash', 'context-close',
        'browser-disconnected', 'native-process-exit'].includes(event.phase));
    result.interruption.classification = signals.some(event =>
      ['page-close', 'context-close', 'browser-disconnected', 'native-process-exit'].includes(event.phase))
      ? 'closure-before-cleanup' : 'focus-or-visibility-loss';
    result.interruption.signalsBeforeCleanup = signals.map(event => ({ seq: event.seq, phase: event.phase }));
    note(label, 'interruption-classified', result.interruption);
  }
  ctx.monitor.stamp('foreground-probe-stop-request', { pid: foreground.pid });
  foreground.kill(); // Only the read-only helper created for this case, never a foreground app.
  await bounded(foregroundExit, 3000, 'owned foreground helper exit');
  ctx.monitor.stamp('foreground-probe-exit', { pid: foreground.pid });
  result.finishedAt = new Date().toISOString();
  await save();
}

console.log('Evidence:', evidenceDir);
let server;
try {
  server = await createServer({ server: { host: '127.0.0.1', port: 0, strictPort: true } });
  await server.listen();
  const devURL = server.resolvedUrls.local[0];
  report.services.push({ url: devURL, status: 'NOT RUN' });
  await runCase('web', ctx => checkWeb(ctx, devURL));
  if (!webOnly) {
    const { default: electron } = await import('electron');
    await runCase('electron-dev', ctx => checkDesktop(ctx, electron, devURL));
  }
} finally {
  if (server) {
    try { await bounded(server.close(), 5000, 'test development service shutdown'); report.services[0].status = 'PASS'; }
    catch (error) { report.cleanupFailures.push(String(error)); server.httpServer?.closeAllConnections(); server.ws.close(); }
  }
  await save();
}
if (!webOnly && !process.argv.includes('--dev-only')) {
  await runCase('electron-packaged', async ctx => {
    const standalone = await mkdtemp(join(tmpdir(), 'mountain-city-d01-r2-standalone-'));
    await cp(resolve('release/layered-city-adventures/win-unpacked'), standalone, { recursive: true });
    note(ctx.label, 'standalone-copy', { path: standalone, developmentServiceStopped: true });
    await checkDesktop(ctx, join(standalone, 'Layered City Adventures.exe'), undefined);
  });
}
report.finishedAt = new Date().toISOString();
report.status = Object.values(report.platforms).some(result => ['FAIL', 'BLOCKED'].includes(result.status)) || report.cleanupFailures.length ? 'FAIL' : 'PASS';
await save();
console.log(report.status, 'platform suite', evidenceDir);
if (report.status !== 'PASS') process.exitCode = 1;
