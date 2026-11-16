import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { chromium } from 'playwright-core';
import {
  identifyBrowser,
  parseBrowserSelection,
  resolveBrowserExecutable,
} from './browser-selection.mjs';

const TASK = 'H5-02';
const SUBTASK = 'H5-02-R1';
const SCOPE = 'continuous-c-building-exploration-correction';
const args = process.argv.slice(2);
const allowed = new Set(['--production']);
const unknown = args.filter(argument =>
  !allowed.has(argument) && !argument.startsWith('--browser='));
if (unknown.length) {
  console.error(`Unknown argument(s): ${unknown.join(', ')}`);
  process.exit(2);
}
if (!args.includes('--production')) {
  console.error('H5-02 browser verification requires --production.');
  process.exit(2);
}

let browserSelection;
try {
  browserSelection = parseBrowserSelection(args);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(2);
}
if (browserSelection.id !== 'chrome') {
  console.error('H5-02 browser verification uses branded Google Chrome only.');
  process.exit(2);
}

let browser;
try {
  browser = resolveBrowserExecutable(browserSelection);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(3);
}

const runId = new Date().toISOString().replace(/[:.]/g, '-');
const evidenceDir = resolve('test-results/h5-02', `run-${runId}`);
await mkdir(evidenceDir, { recursive: true });
const report = {
  task: TASK,
  subtask: SUBTASK,
  scope: SCOPE,
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
    chromeDesktopKeyboard: 'NOT RUN',
    chromeTouchEmulation: 'NOT RUN',
    androidChrome: 'NOT RUN',
    iosSafari: 'NOT RUN',
    artReview: 'NOT RUN',
  },
  checks: [],
  timeline: [],
  screenshots: [],
  networkFailures: [],
  pageErrors: [],
  interruptions: [],
  cleanup: {
    status: 'NOT RUN',
    contexts: 'NOT RUN',
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

const sha256 = async path => createHash('sha256')
  .update(await readFile(path))
  .digest('hex')
  .toUpperCase();
const collectHashes = async () => {
  const paths = [
    'src/rendering/phaser/first-level.ts',
    'src/rendering/phaser/first-level-art.ts',
    'src/rendering/phaser/first-level-actor.ts',
    'src/core/first-level.ts',
    'src/core/prototype-level.ts',
    'src/physics/matter/first-level-world.ts',
    'tests/h5-02-browser.mjs',
    'dist/index.html',
  ];
  for (const file of await readdir(resolve('src/rendering/phaser/assets/h5-02'))) {
    paths.push(`src/rendering/phaser/assets/h5-02/${file}`);
  }
  try {
    for (const file of await readdir(resolve('src/rendering/phaser/assets/h5-02-r1'))) {
      paths.push(`src/rendering/phaser/assets/h5-02-r1/${file}`);
    }
  } catch {
    // The R1 asset directory is created with the playable scene, not the test.
  }
  const html = await readFile(resolve('dist/index.html'), 'utf8');
  for (const match of html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)) {
    const asset = match[1];
    paths.push(`dist/${asset.replace(/^\//, '')}`);
  }
  const hashes = {};
  for (const path of [...new Set(paths)].sort()) hashes[path] = await sha256(path);
  return hashes;
};

const screenshot = async (page, name, options = {}) => {
  const path = join(evidenceDir, `${name}.png`);
  await page.screenshot({ path, fullPage: false, ...options });
  report.screenshots.push(path);
  return path;
};
const record = (name, status, details = {}) => {
  const entry = { at: new Date().toISOString(), name, status, ...details };
  report.checks.push(entry);
  report.timeline.push({ at: entry.at, name, status });
  console.log(status, name);
};

const waitRunning = async page => {
  await page.waitForFunction(() => {
    const data = document.querySelector('#diagnostics')?.dataset;
    const game = document.querySelector('#game');
    return data?.mode === 'first-level' &&
      data.firstLevelPhase !== undefined &&
      data.paused === 'false' &&
      game?.dataset.artAssetsReady === 'true' &&
      document.querySelector('#restart')?.disabled === false;
  }, undefined, { timeout: 20000, polling: 100 });
};
const sample = page => page.locator('#diagnostics').evaluate(element => ({
  tick: Number(element.dataset.tick),
  x: Number(element.dataset.x),
  y: Number(element.dataset.y),
  vx: Number(element.dataset.vx),
  vy: Number(element.dataset.vy),
  grounded: element.dataset.grounded === 'true',
  support: element.dataset.support || '',
  jumps: Number(element.dataset.jumps),
  paused: element.dataset.paused === 'true',
  tokens: Number(element.dataset.tokens),
  control: element.dataset.controlAllowed === 'true',
  needsRelease: element.dataset.needsRelease === 'true',
  physicsSteps: Number(element.dataset.physicsSteps),
  interactionMode: element.dataset.interactionMode || '',
  interactionSelected: element.dataset.interactionSelected || '',
  interactionPrompt: element.dataset.interactionPrompt || '',
  interactionFeedback: element.dataset.interactionFeedback || '',
  interactionConsumed: Number(element.dataset.interactionConsumed),
  runtimeInstanceId: element.dataset.firstLevelRuntimeInstanceId || '',
  phase: element.dataset.firstLevelPhase || '',
  objective: element.dataset.firstLevelObjective || '',
  questAccepted: element.dataset.firstLevelQuestAccepted === 'true',
  routeUnlocked: element.dataset.firstLevelRouteUnlocked === 'true',
  completed: element.dataset.firstLevelCompleted === 'true',
  completionVisible: element.dataset.firstLevelCompletionVisible === 'true',
  liftActive: element.dataset.firstLevelLiftActive === 'true',
  liftY: Number(element.dataset.firstLevelLiftY),
  platformClock: Number(element.dataset.firstLevelPlatformClock),
  gateMask: Number(element.dataset.firstLevelGateMask),
  progressGoals: Number(element.dataset.progressGoalCount),
  progressEffects: Number(element.dataset.progressEffectCount),
  questEventId: element.dataset.firstLevelQuestEventId || '',
  liftEventId: element.dataset.firstLevelLiftEventId || '',
  completeEventId: element.dataset.firstLevelCompleteEventId || '',
  resets: Number(element.dataset.resets),
}));
const visibleFocused = page => page.waitForFunction(() =>
  document.visibilityState === 'visible' &&
  document.hasFocus() &&
  document.querySelector('#diagnostics')?.dataset.paused === 'false',
undefined, { timeout: 15000, polling: 100 });
const ensurePageActive = async page => {
  await page.bringToFront();
  await page.waitForFunction(() =>
    document.visibilityState === 'visible' && document.hasFocus(),
  undefined, { timeout: 15000, polling: 100 });
};

const pressKey = async (page, code) => {
  await page.keyboard.down(code);
  await page.keyboard.up(code);
};
const openNpcDialogue = async page => {
  await page.keyboard.up('KeyE');
  await pressKey(page, 'KeyE');
  await page.waitForFunction(() =>
    document.querySelector('#diagnostics')?.dataset.interactionMode ===
      'investigation',
  undefined, { timeout: 12000, polling: 100 });
};
const closeNpcDialogue = async page => {
  await page.keyboard.up('KeyE');
  await pressKey(page, 'Escape');
  await page.waitForFunction(() => {
    const data = document.querySelector('#diagnostics')?.dataset;
    return data?.interactionMode !== 'investigation' &&
      data?.interactionControlBlocked === 'false';
  }, undefined, { timeout: 12000, polling: 100 });
};
const reachNpc = async page => {
  await page.keyboard.down('KeyD');
  await page.waitForFunction(() =>
    Number(document.querySelector('#diagnostics')?.dataset.x) > 340,
  undefined, { timeout: 12000, polling: 100 });
  await page.keyboard.down('Space');
  await page.waitForFunction(() =>
    Number(document.querySelector('#diagnostics')?.dataset.x) > 500,
  undefined, { timeout: 12000, polling: 100 });
  await page.keyboard.up('Space');
  await page.waitForFunction(() => {
    const data = document.querySelector('#diagnostics')?.dataset;
    return data?.grounded === 'true' &&
      data?.support === 'b-terrace' &&
      Number(data.x) > 550;
  }, undefined, { timeout: 12000, polling: 100 });
  await page.waitForFunction(() =>
    document.querySelector('#diagnostics')?.dataset.interactionSelected ===
      'first-level-b-npc',
  undefined, { timeout: 12000, polling: 100 });
  await page.keyboard.up('KeyD');
  await page.waitForFunction(() =>
    Math.abs(Number(document.querySelector('#diagnostics')?.dataset.vx)) < 1,
  undefined, { timeout: 12000, polling: 100 });
};
const reachCControls = async page => {
  await page.keyboard.down('KeyD');
  await page.waitForFunction(() => {
    const data = document.querySelector('#diagnostics')?.dataset;
    return data?.grounded === 'true' &&
      data?.support === 'c-upper-ground' &&
      Number(data.x) > 1050;
  }, undefined, { timeout: 16000, polling: 100 });
  await page.waitForFunction(() =>
    document.querySelector('#diagnostics')?.dataset.interactionSelected ===
      'first-level-c-lever-right',
  undefined, { timeout: 12000, polling: 100 });
  await page.keyboard.up('KeyD');
  await page.waitForFunction(() =>
    Math.abs(Number(document.querySelector('#diagnostics')?.dataset.vx)) < 1,
  undefined, { timeout: 12000, polling: 100 });
};
const selectLeftControl = async page => {
  await page.keyboard.down('KeyA');
  await page.waitForFunction(() =>
    document.querySelector('#diagnostics')?.dataset.interactionSelected ===
      'first-level-c-lever-left',
  undefined, { timeout: 12000, polling: 100 });
  await page.keyboard.up('KeyA');
  await page.waitForFunction(() =>
    Math.abs(Number(document.querySelector('#diagnostics')?.dataset.vx)) < 1,
  undefined, { timeout: 12000, polling: 100 });
};
const recoverFromFall = async (page, previousCount) => {
  await page.waitForFunction(count =>
    Number(document.querySelector('#diagnostics')?.dataset.recoveryCount) >
      count,
  previousCount, { timeout: 20000, polling: 100 });
  await page.waitForFunction(() => {
    const data = document.querySelector('#diagnostics')?.dataset;
    return data?.recoveryPhase === 'succeeded' &&
      data?.recoveryControlLockHeld === 'false' &&
      data?.controlAllowed === 'true';
  }, undefined, { timeout: 20000, polling: 100 });
  return sample(page);
};
const canvasClip = async page => {
  const box = await page.locator('#game canvas').boundingBox();
  assert.ok(box, 'The game canvas must be visible.');
  return {
    x: Math.max(0, box.x + box.width * 0.32),
    y: Math.max(0, box.y + box.height * 0.28),
    width: Math.min(box.width * 0.36, 520),
    height: Math.min(box.height * 0.52, 330),
  };
};

const pointer = async (page, selector, type, pointerId = 1) => {
  const box = await page.locator(selector).boundingBox();
  assert.ok(box, `${selector} must be visible.`);
  await page.evaluate(({ selector, type, pointerId, x, y }) => {
    document.querySelector(selector)?.dispatchEvent(new PointerEvent(type, {
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
const touchTap = async (page, selector, pointerId) => {
  await pointer(page, selector, 'pointerdown', pointerId);
  await pointer(page, selector, 'pointerup', pointerId);
};
const touchReachNpc = async page => {
  await pointer(page, '[data-action="right"]', 'pointerdown', 101);
  await page.waitForFunction(() =>
    Number(document.querySelector('#diagnostics')?.dataset.x) > 340,
  undefined, { timeout: 15000, polling: 100 });
  await pointer(page, '[data-action="jump"]', 'pointerdown', 102);
  await page.waitForFunction(() =>
    Number(document.querySelector('#diagnostics')?.dataset.x) > 500,
  undefined, { timeout: 15000, polling: 100 });
  await pointer(page, '[data-action="jump"]', 'pointerup', 102);
  await page.waitForFunction(() => {
    const data = document.querySelector('#diagnostics')?.dataset;
    return data?.grounded === 'true' &&
      data?.support === 'b-terrace' &&
      Number(data.x) > 550;
  }, undefined, { timeout: 15000, polling: 100 });
  await page.waitForFunction(() =>
    document.querySelector('#diagnostics')?.dataset.interactionSelected ===
      'first-level-b-npc',
  undefined, { timeout: 15000, polling: 100 });
  await pointer(page, '[data-action="right"]', 'pointerup', 101);
  await page.waitForFunction(() =>
    Math.abs(Number(document.querySelector('#diagnostics')?.dataset.vx)) < 1,
  undefined, { timeout: 15000, polling: 100 });
};
const touchReachC = async page => {
  await pointer(page, '[data-action="right"]', 'pointerdown', 111);
  await page.waitForFunction(() => {
    const data = document.querySelector('#diagnostics')?.dataset;
    return data?.grounded === 'true' &&
      data?.support === 'c-upper-ground' &&
      Number(data.x) > 1050;
  }, undefined, { timeout: 20000, polling: 100 });
  await pointer(page, '[data-action="right"]', 'pointerup', 111);
  await page.waitForFunction(() =>
    Math.abs(Number(document.querySelector('#diagnostics')?.dataset.vx)) < 1,
  undefined, { timeout: 15000, polling: 100 });
};

let desktopChromeProcess;
let desktopBrowserConnection;
let desktopContext;
let touchChromeProcess;
let touchBrowserConnection;
let touchContext;
let activePage;

const launchOwnedChrome = async label => {
  const profile = join(evidenceDir, `${label}-chrome-profile`);
  await mkdir(profile);
  const launchArgs = [
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    '--no-first-run',
    'about:blank',
  ];
  const { spawn } = await import('node:child_process');
  const processHandle = spawn(browser.executablePath, launchArgs, {
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let stderr = '';
  processHandle.stderr.setEncoding('utf8');
  processHandle.stderr.on('data', chunk => { stderr += chunk; });
  const endpoint = await new Promise((done, fail) => {
    const timer = setTimeout(() =>
      fail(new Error(`Chrome did not expose CDP. ${stderr}`)), 15000);
    const inspect = () => {
      const match = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (!match) return;
      clearTimeout(timer);
      done(match[1]);
    };
    processHandle.stderr.on('data', inspect);
    processHandle.once('exit', code =>
      fail(new Error(`Chrome exited before CDP (${code}). ${stderr}`)));
    inspect();
  });
  const connection = await chromium.connectOverCDP(endpoint, {
    noDefaults: true,
  });
  const versionSession = await connection.newBrowserCDPSession();
  const version = await versionSession.send('Browser.getVersion');
  await versionSession.detach().catch(() => {});
  const actual = identifyBrowser(version);
  assert.equal(actual.brand, 'Google Chrome');
  return {
    label,
    processHandle,
    connection,
    actual,
    profile,
    args: launchArgs,
  };
};
const stopOwnedChrome = async owned => {
  if (!owned) return;
  try {
    await owned.connection.close();
  } catch { /* report below only process and context state */ }
  try {
    if (owned.processHandle.exitCode === null) owned.processHandle.kill();
    await new Promise(done => {
      const timer = setTimeout(done, 3000);
      owned.processHandle.once('exit', () => {
        clearTimeout(timer);
        done();
      });
    });
  } catch { /* caller records any remaining resource problem */ }
};
const recordStoppedChrome = (owned, suffix) => {
  const connectionKey = suffix === 'desktop'
    ? 'browserConnection' : 'touchBrowserConnection';
  const processKey = suffix === 'desktop'
    ? 'chromeProcess' : 'touchChromeProcess';
  report.cleanup[connectionKey] = 'PASS';
  report.cleanup[processKey] = 'PASS';
  report.cleanup[`${processKey}Pid`] = owned.processHandle.pid;
  report.cleanup[`${processKey}ExitCode`] = owned.processHandle.exitCode;
};

try {
  report.hashes = await collectHashes();
  const desktopChrome = await launchOwnedChrome('desktop');
  desktopChromeProcess = desktopChrome.processHandle;
  desktopBrowserConnection = desktopChrome.connection;
  report.browser.desktop = {
    actual: desktopChrome.actual,
    profile: desktopChrome.profile,
    args: desktopChrome.args,
    pid: desktopChrome.processHandle.pid,
  };
  desktopContext = desktopBrowserConnection.contexts()[0];
  const page = desktopContext.pages()[0] ??
    await desktopContext.waitForEvent('page');
  activePage = page;
  page.on('pageerror', error => report.pageErrors.push(error.message));
  page.on('crash', () => report.interruptions.push('desktop-page-crash'));
  page.on('response', response => {
    if (response.status() >= 400) {
      report.networkFailures.push({
        status: response.status(),
        url: response.url(),
      });
    }
  });
  await page.setViewportSize({ width: 1280, height: 720 });
  await ensurePageActive(page);
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await ensurePageActive(page);
  await waitRunning(page);
  await visibleFocused(page);

  const initial = await sample(page);
  assert.equal(initial.phase, 'intro');
  assert.equal(initial.questAccepted, false);
  assert.equal(initial.progressGoals, 0);
  assert.equal(initial.resets, 0);
  const artState = await page.locator('#game').evaluate(element => ({
    ready: element.dataset.artAssetsReady,
    error: element.dataset.assetLoadError || '',
    visual: JSON.parse(element.dataset.visualState || '{}'),
  }));
  assert.equal(artState.ready, 'true');
  assert.equal(artState.error, '');
  assert.equal(artState.visual.task, TASK);
  assert.equal(artState.visual.assetsReady, true);
  await screenshot(page, 'vis01-A-before-after-spawn');
  record('VIS01 art assets load and same first-level spawn', 'PASS', {
    runtimeInstanceId: initial.runtimeInstanceId,
    artState,
  });

  await reachNpc(page);
  await openNpcDialogue(page);
  const dialog = await sample(page);
  assert.equal(dialog.interactionMode, 'investigation');
  assert.equal(dialog.questAccepted, false);
  await screenshot(page, 'vis02-B-dialogue');
  await closeNpcDialogue(page);
  await page.waitForFunction(() => {
    const data = document.querySelector('#diagnostics')?.dataset;
    return data?.firstLevelQuestAccepted === 'true' &&
      data?.firstLevelQuestPhase === 'succeeded';
  }, undefined, { timeout: 15000, polling: 100 });
  const accepted = await sample(page);
  assert.equal(accepted.questAccepted, true);
  assert.equal(accepted.progressGoals, 1);
  await ensurePageActive(page);
  // Investigation control-lock acquisition intentionally marks Space as needing
  // a real release. Playwright does not dispatch keyup for a key it no longer
  // considers down, so provide one complete down/up interval. The held gate
  // consumes the down without jumping; the real up clears it.
  await page.keyboard.down('Space');
  await page.keyboard.up('Space');
  await page.waitForFunction(() =>
    document.querySelector('#diagnostics')?.dataset.needsRelease === 'false',
  undefined, { timeout: 12000, polling: 100 });

  // Dialogue completion can trigger a real renderer focus change after the
  // previous foreground assertion. Start the C traversal only from a fresh,
  // observed visible/focused baseline instead of treating a paused page as a
  // movement failure.
  await ensurePageActive(page);
  await visibleFocused(page);
  await reachCControls(page);
  await visibleFocused(page);
  const cInitial = await sample(page);
  assert.equal(cInitial.support, 'c-upper-ground');
  assert.ok(cInitial.x > 1050);
  const desktopLayout = await page.locator('#game').evaluate(element => {
    const visual = JSON.parse(element.dataset.visualState || '{}');
    return visual.hud;
  });
  assert.equal(desktopLayout.touchControlsEnabled, false);
  assert.equal(desktopLayout.desktopControlsVisible, true);
  assert.equal(desktopLayout.areaLabelsVisible, false);
  assert.equal(desktopLayout.interactionDebugVisible, false);
  await screenshot(page, 'vis01-C-overview-1280x720');
  await screenshot(page, 'vis01-C-actor-detail', {
    clip: await canvasClip(page),
  });
  record('VIS02 real A-B-C traversal and C rendering', 'PASS', {
    initial,
    dialog,
    accepted,
    cInitial,
    desktopLayout,
  });

  await pressKey(page, 'KeyE');
  await page.waitForFunction(() =>
    /右侧吊臂/.test(
      document.querySelector('#diagnostics')?.dataset.interactionFeedback || '',
    ),
  undefined, { timeout: 12000, polling: 100 });
  const wrong = await sample(page);
  assert.equal(wrong.routeUnlocked, false);
  assert.equal(wrong.progressGoals, 1);
  await screenshot(page, 'vis03-C-wrong-neutral-retry');

  await selectLeftControl(page);
  await pressKey(page, 'KeyE');
  await page.waitForFunction(() => {
    const data = document.querySelector('#diagnostics')?.dataset;
    return data?.firstLevelRouteUnlocked === 'true' &&
      data?.firstLevelLiftPhaseName === 'succeeded' &&
      data?.firstLevelLiftActive === 'true' &&
      data?.firstLevelGateMask === '0';
  }, undefined, { timeout: 15000, polling: 100 });
  const routeOpen = await sample(page);
  assert.equal(routeOpen.questAccepted, true);
  assert.equal(routeOpen.routeUnlocked, true);
  assert.equal(routeOpen.progressGoals, 2);
  await screenshot(page, 'vis03-C-route-open');
  record('VIS03 wrong retry, correct route and real lift state', 'PASS', {
    wrong,
    routeOpen,
  });

  await page.keyboard.down('KeyD');
  await page.waitForFunction(() => {
    const data = document.querySelector('#diagnostics')?.dataset;
    return data?.grounded === 'true' &&
      data?.support === 'c-stair-middle' &&
      Number(data.x) > 1290;
  }, undefined, { timeout: 16000, polling: 100 });
  assert.equal((await sample(page)).jumps, accepted.jumps);
  await screenshot(page, 'vis03-C-middle-keyframe');
  await page.waitForFunction(() => {
    const data = document.querySelector('#diagnostics')?.dataset;
    return data?.grounded === 'true' &&
      data?.support === 'c-stair-lower' &&
      Number(data.x) > 1450;
  }, undefined, { timeout: 16000, polling: 100 });
  await page.keyboard.up('KeyD');
  await page.waitForFunction(() =>
    Math.abs(Number(document.querySelector('#diagnostics')?.dataset.vx)) < 1,
  undefined, { timeout: 12000, polling: 100 });
  await screenshot(page, 'vis03-C-lower-keyframe');

  await page.waitForFunction(() => {
    const data = document.querySelector('#diagnostics')?.dataset;
    return Number(data?.firstLevelLiftY) < 515 &&
      Number(data?.firstLevelLiftDirection) === 1;
  }, undefined, { timeout: 16000, polling: 100 });
  await page.keyboard.down('KeyD');
  await page.waitForFunction(() =>
    document.querySelector('#diagnostics')?.dataset.support ===
      'first-level-service-lift',
  undefined, { timeout: 12000, polling: 100 });
  await page.waitForFunction(() => {
    const data = document.querySelector('#diagnostics')?.dataset;
    return data?.support === 'first-level-service-lift' &&
      Number(data.firstLevelSupportRelativeX) > -20;
  }, undefined, { timeout: 12000, polling: 100 });
  await page.keyboard.up('KeyD');
  await page.keyboard.down('KeyA');
  await page.waitForFunction(() =>
    Number(document.querySelector('#diagnostics')?.dataset.vx) <= 0,
  undefined, { timeout: 12000, polling: 100 });
  await page.keyboard.up('KeyA');
  await page.waitForFunction(() =>
    Math.abs(Number(document.querySelector('#diagnostics')?.dataset.vx)) < 1,
  undefined, { timeout: 12000, polling: 100 });
  assert.equal(
    (await sample(page)).support,
    'first-level-service-lift',
  );
  await page.waitForFunction(() => {
    const data = document.querySelector('#diagnostics')?.dataset;
    return data?.support === 'first-level-service-lift' &&
      Number(data.firstLevelLiftY) > 550;
  }, undefined, { timeout: 16000, polling: 100 });
  await screenshot(page, 'vis03-lift-descending');

  const frozenBefore = await sample(page);
  const other = await desktopContext.newPage();
  await other.goto('about:blank');
  await other.bringToFront();
  await page.waitForFunction(() =>
    document.visibilityState === 'hidden' &&
    document.querySelector('#diagnostics')?.dataset.paused === 'true',
  undefined, { timeout: 12000, polling: 100 });
  const waitStablePausedSample = async () => {
    let previous;
    for (let attempt = 0; attempt < 12; attempt++) {
      await page.waitForTimeout(100);
      const current = await sample(page);
      if (
        previous &&
        current.tick === previous.tick &&
        current.liftY === previous.liftY &&
        current.platformClock === previous.platformClock
      ) return current;
      previous = current;
    }
    throw new Error('Hidden first-level sample did not settle.');
  };
  const frozen = await waitStablePausedSample();
  await page.waitForTimeout(900);
  const frozenAgain = await sample(page);
  assert.equal(frozenAgain.tick, frozen.tick);
  assert.equal(frozenAgain.liftY, frozen.liftY);
  assert.equal(frozenAgain.platformClock, frozen.platformClock);
  await page.bringToFront();
  await visibleFocused(page);
  const resumed = await sample(page);
  // Visibility restoration is observed through the renderer's next RAF; a
  // small number of actual foreground steps may precede this read. Background
  // time is still rejected by the platform-clock equation below.
  assert.ok(resumed.tick - frozen.tick <= 8, JSON.stringify({
    frozenTick: frozen.tick,
    resumedTick: resumed.tick,
  }));
  assert.ok(
    Math.abs(
      resumed.platformClock - frozen.platformClock -
      (resumed.physicsSteps - frozen.physicsSteps) * (1000 / 60),
    ) < 0.02,
  );
  assert.equal(resumed.support, 'first-level-service-lift');
  await screenshot(page, 'vis04-resumed-on-lift');
  await other.close();
  record('VIS04 real hidden pause, resume and lift freeze', 'PASS', {
    frozenBefore,
    frozen,
    frozenAgain,
    resumed,
  });

  await page.waitForFunction(() => {
    const data = document.querySelector('#diagnostics')?.dataset;
    return data?.support === 'first-level-service-lift' &&
      Number(data.firstLevelLiftY) > 620;
  }, undefined, { timeout: 16000, polling: 100 });
  await page.keyboard.down('KeyD');
  await page.waitForFunction(() => {
    const data = document.querySelector('#diagnostics')?.dataset;
    return data?.grounded === 'true' &&
      data?.support === 'd-riverbank' &&
      Number(data.x) > 1695;
  }, undefined, { timeout: 16000, polling: 100 });
  await page.waitForFunction(() =>
    document.querySelector('#diagnostics')?.dataset.interactionSelected ===
      'first-level-d-photo',
  undefined, { timeout: 12000, polling: 100 });
  await page.keyboard.up('KeyD');
  await screenshot(page, 'vis03-D-riverbank-ready');
  await pressKey(page, 'KeyE');
  await page.waitForFunction(() => {
    const data = document.querySelector('#diagnostics')?.dataset;
    return data?.firstLevelCompleted === 'true' &&
      data?.firstLevelCompletionVisible === 'true' &&
      data?.firstLevelCompletePhase === 'succeeded';
  }, undefined, { timeout: 15000, polling: 100 });
  const completed = await sample(page);
  assert.equal(completed.progressGoals, 3);
  assert.equal(completed.progressEffects, 3);
  await screenshot(page, 'vis03-completed');

  await pressKey(page, 'KeyR');
  await page.waitForFunction(previous => {
    const data = document.querySelector('#diagnostics')?.dataset;
    return Number(data?.resets) > previous &&
      data?.firstLevelCompleted === 'true' &&
      data?.firstLevelRouteUnlocked === 'true';
  }, completed.resets, { timeout: 12000, polling: 100 });
  const afterReset = await sample(page);
  assert.ok(afterReset.tick >= completed.tick);
  assert.equal(afterReset.progressGoals, 3);
  assert.equal(afterReset.progressEffects, 3);
  assert.equal(afterReset.questEventId, completed.questEventId);
  assert.equal(afterReset.liftEventId, completed.liftEventId);
  assert.equal(afterReset.completeEventId, completed.completeEventId);
  await screenshot(page, 'vis04-reset-preserves-permanent-state');
  record('VIS04 reset keeps permanent state and stable identities', 'PASS', {
    before: completed,
    afterReset,
  });

  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.waitForTimeout(180);
  await screenshot(page, 'vis05-desktop-1920x1080');
  record('VIS06 desktop production build and full playable route', 'PASS', {
    completed,
    networkFailures: report.networkFailures,
    pageErrors: report.pageErrors,
  });
  report.layers.chromeDesktopKeyboard = 'PASS';
  await page.close();

  await desktopContext.close();
  report.cleanup.contexts = 'PASS';
  desktopContext = undefined;
  await stopOwnedChrome(desktopChrome);
  recordStoppedChrome(desktopChrome, 'desktop');
  desktopBrowserConnection = undefined;
  desktopChromeProcess = undefined;

  const touchChrome = await launchOwnedChrome('touch');
  touchChromeProcess = touchChrome.processHandle;
  touchBrowserConnection = touchChrome.connection;
  report.browser.touch = {
    actual: touchChrome.actual,
    profile: touchChrome.profile,
    args: touchChrome.args,
    pid: touchChrome.processHandle.pid,
  };
  touchContext = await touchBrowserConnection.newContext({
    viewport: { width: 844, height: 390 },
    deviceScaleFactor: 2.625,
    isMobile: true,
    hasTouch: true,
  });
  const touchPage = await touchContext.newPage();
  activePage = touchPage;
  touchPage.on('pageerror', error => report.pageErrors.push(error.message));
  touchPage.on('crash', () => report.interruptions.push('touch-page-crash'));
  await touchPage.goto(baseURL, { waitUntil: 'networkidle' });
  await waitRunning(touchPage);
  assert.equal(await touchPage.locator('#touch-controls').isVisible(), true);
  const touchRuntime = (await sample(touchPage)).runtimeInstanceId;
  await touchReachNpc(touchPage);
  await touchTap(touchPage, '[data-action="interact"]', 103);
  await touchPage.waitForFunction(() =>
    document.querySelector('#diagnostics')?.dataset.interactionMode ===
      'investigation',
  undefined, { timeout: 15000, polling: 100 });
  await screenshot(touchPage, 'vis05-touch-B-dialogue');
  await touchPage.locator('#touch-close-dialogue').click();
  await touchPage.waitForFunction(() => {
    const data = document.querySelector('#diagnostics')?.dataset;
    return data?.firstLevelQuestAccepted === 'true' &&
      data?.firstLevelQuestPhase === 'succeeded';
  }, undefined, { timeout: 15000, polling: 100 });
  await touchReachC(touchPage);
  // Stop at the first control instead of overshooting to the right edge.
  await touchPage.waitForFunction(() =>
    [
      'first-level-c-lever-left',
      'first-level-c-lever-right',
    ].includes(document.querySelector('#diagnostics')?.dataset.interactionSelected),
  undefined, { timeout: 15000, polling: 100 });
  await screenshot(touchPage, 'vis05-touch-C-844x390');
  const touchLayout = await touchPage.evaluate(() => {
    const game = document.querySelector('#game');
    const canvas = game?.querySelector('canvas');
    const visual = JSON.parse(game?.dataset.visualState || '{}');
    if (!canvas) throw new Error('The touch game canvas must exist.');
    const canvasBox = canvas.getBoundingClientRect();
    const buttonTop = Math.min(...[
      ...document.querySelectorAll('#touch-controls [data-action]'),
    ].map(button => button.getBoundingClientRect().top));
    const actionPad = document.querySelector(
      '#touch-controls .touch-action-pad',
    );
    if (!actionPad) throw new Error('The touch action pad must exist.');
    const actionPadLeft = actionPad.getBoundingClientRect().left;
    const utilityLeft = Math.min(...[
      ...document.querySelectorAll('#touch-prototype .touch-utility-button'),
    ].map(button => button.getBoundingClientRect().left));
    const scaleY = 580 / canvasBox.height;
    const scaleX = 1000 / canvasBox.width;
    return {
      ...visual.hud,
      touchButtonTopLogical: (buttonTop - canvasBox.top) * scaleY,
      actionPadLeftLogical: (actionPadLeft - canvasBox.left) * scaleX,
      utilityLeftLogical: (utilityLeft - canvasBox.left) * scaleX,
    };
  });
  report.touchLayout = touchLayout;
  assert.equal(touchLayout.touchControlsEnabled, true);
  assert.equal(touchLayout.desktopControlsVisible, false);
  assert.equal(touchLayout.areaLabelsVisible, false);
  assert.equal(touchLayout.interactionDebugVisible, false);
  assert.ok(touchLayout.objectiveRight < touchLayout.utilityLeftLogical);
  assert.ok(touchLayout.promptRight < touchLayout.actionPadLeftLogical);
  assert.ok(touchLayout.feedbackRight < touchLayout.actionPadLeftLogical);
  assert.ok(touchLayout.promptBottom < touchLayout.touchButtonTopLogical);
  assert.ok(touchLayout.feedbackBottom < touchLayout.touchButtonTopLogical);
  const touchBeforeJump = await sample(touchPage);
  await touchTap(touchPage, '[data-action="jump"]', 112);
  await touchPage.waitForFunction(jumps =>
    Number(document.querySelector('#diagnostics')?.dataset.jumps) > jumps,
  touchBeforeJump.jumps, { timeout: 12000, polling: 100 });
  await touchPage.waitForFunction(() =>
    document.querySelector('#diagnostics')?.dataset.grounded === 'true',
  undefined, { timeout: 12000, polling: 100 });
  await touchTap(touchPage, '[data-action="interact"]', 113);
  await touchPage.waitForFunction(() =>
    /(?:右侧|左侧)吊臂/.test(
      document.querySelector('#diagnostics')?.dataset.interactionFeedback || '',
    ),
  undefined, { timeout: 12000, polling: 100 });
  if (!(await sample(touchPage)).routeUnlocked) {
    await pointer(touchPage, '[data-action="left"]', 'pointerdown', 114);
    await touchPage.waitForFunction(() =>
      document.querySelector('#diagnostics')?.dataset.interactionSelected ===
        'first-level-c-lever-left',
    undefined, { timeout: 15000, polling: 100 });
    await pointer(touchPage, '[data-action="left"]', 'pointerup', 114);
    await touchTap(touchPage, '[data-action="interact"]', 115);
  }
  await touchPage.waitForFunction(() => {
    const data = document.querySelector('#diagnostics')?.dataset;
    return data?.firstLevelRouteUnlocked === 'true' &&
      data?.firstLevelGateMask === '0';
  }, undefined, { timeout: 15000, polling: 100 });
  await screenshot(touchPage, 'vis05-touch-C-route-open');
  await touchPage.setViewportSize({ width: 667, height: 375 });
  await touchPage.waitForTimeout(180);
  await screenshot(touchPage, 'vis05-touch-C-667x375');
  const touchFinal = await sample(touchPage);
  assert.equal(touchFinal.runtimeInstanceId, touchRuntime);
  assert.equal(touchFinal.questAccepted, true);
  assert.equal(touchFinal.routeUnlocked, true);
  assert.ok(touchFinal.tick > 0);
  report.layers.chromeTouchEmulation = 'PASS';
  record('VIS05 touch-emulated C walk and interaction', 'PASS', {
    runtimeInstanceId: touchRuntime,
    beforeJump: touchBeforeJump,
    final: touchFinal,
    layout: touchLayout,
  });
  await touchContext.close();
  report.cleanup.contexts = report.cleanup.contexts === 'FAIL'
    ? 'FAIL' : 'PASS';
  touchContext = undefined;
  await stopOwnedChrome(touchChrome);
  recordStoppedChrome(touchChrome, 'touch');
  touchBrowserConnection = undefined;
  touchChromeProcess = undefined;
  assert.deepEqual(report.pageErrors, []);
  assert.deepEqual(report.networkFailures, []);
  assert.deepEqual(report.interruptions, []);
} catch (error) {
  report.failure = {
    message: String(error),
    stack: error instanceof Error ? error.stack : undefined,
  };
  if (activePage && !activePage.isClosed()) {
    try {
      report.failureScreenshot = await screenshot(activePage, 'failure-state');
      report.failureState = await activePage.evaluate(() => {
        const data = document.querySelector('#diagnostics')?.dataset;
        return {
          visibility: document.visibilityState,
          focused: document.hasFocus(),
          ...data,
        };
      });
    } catch (evidenceError) {
      report.failureEvidenceError = String(evidenceError);
    }
  }
  record('H5-02 browser verification', 'FAIL', report.failure);
} finally {
  if (desktopContext) {
    try {
      await desktopContext.close();
      report.cleanup.contexts = 'PASS';
    } catch (error) {
      report.cleanup.contexts = 'FAIL';
      report.cleanup.contextError = String(error);
    }
  }
  if (touchContext) {
    try {
      await touchContext.close();
      report.cleanup.contexts = report.cleanup.contexts === 'FAIL'
        ? 'FAIL' : 'PASS';
    } catch (error) {
      report.cleanup.contexts = 'FAIL';
      report.cleanup.touchContextError = String(error);
    }
  }
  if (desktopBrowserConnection) {
    try {
      await desktopBrowserConnection.close();
      report.cleanup.browserConnection = 'PASS';
    } catch (error) {
      report.cleanup.browserConnection = 'FAIL';
      report.cleanup.browserConnectionError = String(error);
    }
  }
  if (touchBrowserConnection) {
    try {
      await touchBrowserConnection.close();
      report.cleanup.touchBrowserConnection = 'PASS';
    } catch (error) {
      report.cleanup.touchBrowserConnection = 'FAIL';
      report.cleanup.touchBrowserConnectionError = String(error);
    }
  }
  for (const [label, processHandle] of [
    ['chromeProcess', desktopChromeProcess],
    ['touchChromeProcess', touchChromeProcess],
  ]) {
    if (!processHandle) continue;
    try {
      if (processHandle.exitCode === null) processHandle.kill();
      await new Promise(done => {
        const timer = setTimeout(done, 3000);
        processHandle.once('exit', () => {
          clearTimeout(timer);
          done();
        });
      });
      report.cleanup[label] = 'PASS';
      report.cleanup[`${label}Pid`] = processHandle.pid;
      report.cleanup[`${label}ExitCode`] = processHandle.exitCode;
    } catch (error) {
      report.cleanup[label] = 'FAIL';
      report.cleanup[`${label}Error`] = String(error);
    }
  }
  try {
    await new Promise(done => server.close(done));
    report.cleanup.server = 'PASS';
  } catch (error) {
    report.cleanup.server = 'FAIL';
    report.cleanup.serverError = String(error);
  }
  report.cleanup.status = [
    report.cleanup.contexts,
    report.cleanup.browserConnection,
    report.cleanup.chromeProcess,
    report.cleanup.touchChromeProcess,
    report.cleanup.server,
  ].every(value => value === 'PASS') ? 'PASS' : 'FAIL';
  report.finishedAt = new Date().toISOString();
  report.status = report.failure || report.cleanup.status === 'FAIL'
    ? 'FAIL' : 'PASS';
  report.artAcceptance = 'NOT RUN';
  report.deviceAcceptance = 'NOT RUN';
  await writeFile(
    join(evidenceDir, 'report.json'),
    JSON.stringify(report, null, 2),
  );
  console.log('Evidence:', evidenceDir);
  console.log(report.status, TASK, SUBTASK, SCOPE);
  if (report.status === 'FAIL') process.exitCode = 1;
}
