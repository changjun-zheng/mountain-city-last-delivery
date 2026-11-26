import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { extname, join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import {
  parseBrowserSelection,
  resolveBrowserExecutable,
} from '../../../../tests/browser-selection.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, '..');
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff': 'font/woff',
};

await mkdir(out, { recursive: true });
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const path = resolve(here, '.' + decodeURIComponent(url.pathname));
  if (!path.startsWith(here)) {
    res.writeHead(403).end();
    return;
  }
  try {
    const data = await readFile(path);
    res.writeHead(200, {
      'content-type': types[extname(path)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    }).end(data);
  } catch {
    if (!res.headersSent) res.writeHead(404).end();
    else res.end();
  }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}/`;

const { id: browserId, executablePath } = resolveBrowserExecutable(parseBrowserSelection([]));
const browser = await chromium.launch({ executablePath, headless: true });
const report = {
  startedAt: new Date().toISOString(),
  browser: browserId,
  sizes: {},
  screenshots: [],
  pageErrors: [],
  consoleErrors: [],
};

const shots = [
  { view: 'title', size: 'desktop', width: 1280, height: 760, name: 'title-desktop' },
  { view: 'loading', size: 'desktop', width: 1280, height: 760, name: 'title-loading' },
  { view: 'title', size: 'mobile', width: 844, height: 390, name: 'title-mobile' },
  { view: 'play', size: 'desktop', width: 1280, height: 760, name: 'play-desktop' },
  { view: 'play', size: 'mobile', width: 844, height: 390, name: 'play-mobile' },
  { view: 'character', size: 'desktop', width: 1200, height: 840, name: 'character-sheet' },
];

for (const shot of shots) {
  const context = await browser.newContext({
    viewport: { width: shot.width, height: shot.height },
    deviceScaleFactor: 1,
    isMobile: shot.size === 'mobile',
    hasTouch: shot.size === 'mobile',
  });
  const page = await context.newPage();
  page.on('pageerror', error => report.pageErrors.push({ name: shot.name, error: String(error) }));
  page.on('console', message => {
    if (message.type() === 'error') report.consoleErrors.push({ name: shot.name, text: message.text() });
  });
  await page.goto(`${base}index.html?view=${shot.view}&size=${shot.size}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.body.dataset.ready === 'true', null, { timeout: 20000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(350);
  const path = join(out, `${shot.name}.png`);
  await page.screenshot({ path, fullPage: false });
  report.screenshots.push(shot.name + ".png");
  report.sizes[shot.name] = await page.evaluate(() => ({
    view: document.body.dataset.view,
    size: document.body.dataset.size,
    viewport: [innerWidth, innerHeight],
    sceneChildren: document.querySelector('#scene svg')?.children.length ?? 0,
  }));
  console.log('shot', shot.name, `${shot.width}x${shot.height}`);
  await context.close();
}

// Click through the sample loading flow once, so the animation is not just a
// static screenshot. This is not a game validation.
{
  const context = await browser.newContext({
    viewport: { width: 1280, height: 760 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto(`${base}index.html?view=title&size=desktop`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.body.dataset.ready === 'true', null, { timeout: 20000 });
  await page.click('#title .primary');
  const loadingVisible = await page.evaluate(() => !document.getElementById('loading').hidden);
  await page.waitForFunction(() => document.body.dataset.view === 'play', null, { timeout: 6000 });
  await page.waitForTimeout(600);
  const after = await page.evaluate(() => ({
    view: document.body.dataset.view,
    loadingHidden: document.getElementById('loading').hidden,
    sceneHasSvg: Boolean(document.querySelector('#scene svg')),
  }));
  report.loadingFlow = { loadingVisible, ...after, errors };
  await context.close();
}

await browser.close();
await new Promise(done => server.close(done));
report.finishedAt = new Date().toISOString();
await writeFile(join(out, 'render-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({
  screenshots: report.screenshots.length,
  pageErrors: report.pageErrors.length,
  consoleErrors: report.consoleErrors.length,
  loadingFlow: report.loadingFlow,
}));