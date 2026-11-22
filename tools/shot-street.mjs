import { chromium } from 'playwright-core';
import { mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const BASE = 'http://localhost:5175/';
const OUT = join(process.cwd(), 'test-results', 'topdown');
mkdirSync(OUT, { recursive: true });
const CHROME = [
  'C:/Users/24839/AppData/Local/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(p => existsSync(p));

const state = page => page.locator('#exp-root').evaluate(e => ({
  view: e.dataset.view, map: e.dataset.map,
  x: Number(e.dataset.x), y: Number(e.dataset.y),
}));
const wait = (page, fn, arg) => page.waitForFunction(fn, arg, { timeout: 30000, polling: 'raf' });
const held = new Set();
async function walk(page, tx, ty, tol = 16, maxMs = 60000) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    const s = await state(page);
    const dx = tx - s.x, dy = ty - s.y;
    if (Math.hypot(dx, dy) < tol) break;
    const want = new Set();
    if (dx > 6) want.add('KeyD'); else if (dx < -6) want.add('KeyA');
    if (dy > 6) want.add('KeyS'); else if (dy < -6) want.add('KeyW');
    for (const k of held) if (!want.has(k)) { await page.keyboard.up(k); held.delete(k); }
    for (const k of want) if (!held.has(k)) { await page.keyboard.down(k); held.add(k); }
    await page.waitForTimeout(70);
  }
  for (const k of held) { await page.keyboard.up(k); held.delete(k); }
  return state(page);
}
async function shot(page, name) {
  await page.screenshot({ path: join(OUT, name + '.png') });
  console.log('shot', name, JSON.stringify(await state(page)));
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('PAGEERROR', e.message));
await page.goto(BASE, { waitUntil: 'networkidle' });
await wait(page, () => !!document.querySelector('#exp-title'));
await page.locator('#exp-begin').click();
await wait(page, () => document.querySelector('#exp-root')?.dataset.view === 'play');
await page.waitForTimeout(500);

// monument edge -> east along the street -> shop front on the walking street
await walk(page, 900, 880);
await walk(page, 1400, 900);
await walk(page, 1900, 880);
await walk(page, 2130, 760);
await page.waitForTimeout(400);
await shot(page, 'td-street-east');

await walk(page, 2500, 760);
await page.waitForTimeout(300);
await shot(page, 'td-street-far');

await browser.close();
console.log('done');
