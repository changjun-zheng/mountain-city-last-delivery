import assert from 'node:assert/strict';
import { mkdtemp, cp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';

const TIMEOUT = 15000; // Same readiness budget as before R1; hidden frames are not polled via RAF.
await mkdir('test-results/platform', { recursive: true });
const evidenceDir = await mkdtemp(resolve('test-results/platform/run-'));
const report = {
  task: 'M1.2.1-R1', startedAt: new Date().toISOString(), evidenceDir,
  platforms: Object.fromEntries(['web', 'electron-dev', 'electron-packaged'].map(label => [label, { status: 'NOT RUN' }])),
  events: [], processes: [], services: [], cleanupFailures: [],
};
let captureNumber = 0;
const note = (label, phase, data = {}) => report.events.push({ at: new Date().toISOString(), label, phase, ...data });
const save = () => writeFile(join(evidenceDir, 'report.json'), JSON.stringify(report, null, 2));

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
    pageErrors: [...ctx.errors], navigation: [...ctx.navigation], breadcrumbs: [...ctx.breadcrumbs] };
  if (ctx.page && !ctx.page.isClosed()) {
    try {
      state.page = await bounded(ctx.page.evaluate(() => ({
        url: location.href, visibility: document.visibilityState, readyState: document.readyState,
        focused: document.hasFocus(), diagnostics: { ...document.querySelector('#diagnostics')?.dataset },
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

function observe(ctx, page) {
  ctx.page = page;
  page.setDefaultTimeout(TIMEOUT);
  page.setDefaultNavigationTimeout(TIMEOUT);
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
}

async function sceneReady(ctx) {
  ctx.stage = 'scene-created-and-rendered';
  // The existing enabled button is resolved after Phaser POST_RENDER, independent of Tick.
  await ctx.page.waitForFunction(() => document.querySelectorAll('#game canvas').length === 1 &&
    document.querySelector('#restart')?.disabled === false, undefined, poll);
  assert.equal(await ctx.page.locator('#game canvas').evaluate(canvas =>
    canvas.getContext('2d').getImageData(400, 55, 1, 1).data[0]), 240);
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

function launchNative(label, executable, args, env = process.env) {
  const child = spawn(executable, args, { env, stdio: ['ignore', 'pipe', 'pipe'] });
  const record = { label, pid: child.pid, executable, status: 'NOT RUN', output: '' };
  report.processes.push(record);
  let failure;
  let finished = false;
  const exit = new Promise(resolveExit => {
    child.once('exit', (code, signal) => { finished = true; Object.assign(record, { code, signal, exitedAt: new Date().toISOString() }); resolveExit({ code, signal }); });
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

async function stopOwned(native, politeClose) {
  if (!native) return;
  try {
    if (native.alive()) {
      try { await bounded(Promise.resolve().then(politeClose), 3000, 'owned process close request'); }
      catch (error) { native.record.closeRequestError = String(error); }
      try { await bounded(native.exit, 5000, 'owned process exit'); }
      catch {
        // Only the still-live ChildProcess created above is eligible. No name/global process search.
        if (native.alive()) {
          native.record.forcedCleanup = true;
          const killer = spawn('taskkill', ['/PID', String(native.child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
          await bounded(once(killer, 'exit'), 5000, 'owned process tree cleanup');
          await bounded(native.exit, 5000, 'owned process exit after cleanup');
        }
      }
    }
    native.record.status = native.alive() ? 'FAIL' : 'PASS';
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
  ctx.native = launchNative(ctx.label, executablePath,
    ['--inspect=0', '--remote-debugging-port=0', ...(devURL ? [resolve('.')] : [])], env);
  try {
    ctx.desktop = await inspectMain(await ctx.native.endpoint('Debugger listening on'));
    ctx.windowState = () => ctx.desktop.evaluate(({ app, BrowserWindow }) => ({
      packaged: app.isPackaged, pid: process.pid,
      windows: BrowserWindow.getAllWindows().map(window => ({
        id: window.id, visible: window.isVisible(), minimized: window.isMinimized(), focused: window.isFocused(),
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
    ctx.browser = await chromium.connectOverCDP(await ctx.native.endpoint('DevTools listening on'), { noDefaults: true });
    const context = ctx.browser.contexts()[0];
    const page = context.pages()[0] ?? await context.waitForEvent('page', { timeout: TIMEOUT });
    observe(ctx, page);
    await page.waitForURL(url => url.searchParams.get('platform') === 'windows', { waitUntil: 'load' });
    await loaded(ctx);
    await snapshot(ctx, 'initial-load-before-activation', true);
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
    await visibleReady(ctx);
    await snapshot(ctx, 'initial-visible-running');
    await hiddenStartup(ctx);
    for (let i = 1; i <= 2; i++) await checkPause(ctx, i);
    for (let i = 1; i <= 3; i++) await checkRestart(ctx, i);
    assert.deepEqual(ctx.errors, []);
    await snapshot(ctx, 'completed', true);
    ctx.stage = 'native-close';
    await ctx.desktop.evaluate(({ BrowserWindow }) => { setTimeout(() => BrowserWindow.getAllWindows()[0].close(), 100); });
    ctx.desktop.close();
    const exit = await bounded(ctx.native.exit, 5000, 'native window close -> exit');
    assert.equal(exit.code, 0);
  } catch (error) {
    ctx.failure = String(error);
    await snapshot(ctx, 'failure', true);
    throw error;
  } finally {
    try {
      await stopOwned(ctx.native, async () => {
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
  const profile = await mkdtemp(join(tmpdir(), 'mountain-city-r1-edge-'));
  const edge = join(process.env['ProgramFiles(x86)'], 'Microsoft/Edge/Application/msedge.exe');
  ctx.native = launchNative(ctx.label, edge,
    ['--remote-debugging-port=0', '--user-data-dir=' + profile, '--no-first-run', 'about:blank']);
  try {
    ctx.browser = await chromium.connectOverCDP(await ctx.native.endpoint('DevTools listening on'), { noDefaults: true });
    const context = ctx.browser.contexts()[0];
    const page = context.pages()[0] ?? await context.waitForEvent('page', { timeout: TIMEOUT });
    observe(ctx, page);
    const other = await context.newPage();
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
    await page.goto(devURL);
    await loaded(ctx);
    await snapshot(ctx, 'initial-load-before-activation');
    await visibleReady(ctx);
    await hiddenStartup(ctx);
    for (let i = 1; i <= 2; i++) await checkPause(ctx, i);
    for (let i = 1; i <= 3; i++) await checkRestart(ctx, i);
    assert.deepEqual(ctx.errors, []);
    await snapshot(ctx, 'completed', true);
  } catch (error) {
    ctx.failure = String(error);
    await snapshot(ctx, 'failure', true);
    throw error;
  } finally {
    try {
      await stopOwned(ctx.native, async () => {
        const session = await ctx.browser?.newBrowserCDPSession();
        await session?.send('Browser.close');
      });
    } finally {
      await ctx.browser?.close().catch(() => {});
      await save();
    }
  }
}

async function runCase(label, fn) {
  const ctx = { label, stage: 'launch', operation: 'initial-startup', errors: [], navigation: [], breadcrumbs: [] };
  const result = report.platforms[label];
  result.startedAt = new Date().toISOString();
  try {
    await fn(ctx);
    result.status = 'PASS';
    console.log('PASS', label, 'loaded / scene / running; hidden start; 2 hide cycles; 3 restarts; owned process exited');
  } catch (error) {
    Object.assign(result, { status: error.code === 'ENOENT' ? 'BLOCKED' : 'FAIL', stage: ctx.stage, error: String(error), stack: error.stack });
    console.error(result.status, label, ctx.stage, String(error));
  }
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
  const { default: electron } = await import('electron');
  await runCase('electron-dev', ctx => checkDesktop(ctx, electron, devURL));
} finally {
  if (server) {
    try { await bounded(server.close(), 5000, 'test development service shutdown'); report.services[0].status = 'PASS'; }
    catch (error) { report.cleanupFailures.push(String(error)); server.httpServer?.closeAllConnections(); server.ws.close(); }
  }
  await save();
}
if (!process.argv.includes('--dev-only')) {
  await runCase('electron-packaged', async ctx => {
    const standalone = await mkdtemp(join(tmpdir(), 'mountain-city-r1-standalone-'));
    await cp(resolve('release/win-unpacked'), standalone, { recursive: true });
    note(ctx.label, 'standalone-copy', { path: standalone, developmentServiceStopped: true });
    await checkDesktop(ctx, join(standalone, 'Mountain City Last Delivery.exe'), undefined);
  });
}
report.finishedAt = new Date().toISOString();
report.status = Object.values(report.platforms).some(result => ['FAIL', 'BLOCKED'].includes(result.status)) || report.cleanupFailures.length ? 'FAIL' : 'PASS';
await save();
console.log(report.status, 'platform suite', evidenceDir);
if (report.status !== 'PASS') process.exitCode = 1;
