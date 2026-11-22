import { chromium } from 'playwright-core';
import { mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const BASE = 'http://localhost:5175/';
const OUT = join(process.cwd(), 'test-results', 'topdown');
mkdirSync(OUT, { recursive: true });
const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Users/24839/AppData/Local/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(p => existsSync(p));

const state = page => page.locator('#exp-root').evaluate(e => ({
  view: e.dataset.view, map: e.dataset.map,
  x: Number(e.dataset.x), y: Number(e.dataset.y), tick: Number(e.dataset.tick),
}));
const wait = (page, fn) => page.waitForFunction(fn, undefined, { timeout: 30000, polling: 'raf' });
const held = new Set();
async function release(page) { for (const k of held) { await page.keyboard.up(k); held.delete(k); } }
async function walk(page, tx, ty, tol = 18, maxMs = 50000) {
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
  await release(page);
  return state(page);
}
async function interact(page, label) {
  await release(page);
  const before = await state(page);
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(500);
  const after = await state(page);
  console.log(`${label}: ${before.map} -> ${after.map} at ${Math.round(after.x)},${Math.round(after.y)}`);
  return after;
}
async function shot(page, name) {
  const path = join(OUT, name + '.png');
  await page.screenshot({ path });
  console.log('shot', name);
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
page.on('pageerror', e => console.log('PAGEERROR', e.message));
await page.goto(BASE, { waitUntil: 'networkidle' });
await wait(page, () => !!document.querySelector('#exp-title'));
await page.locator('#exp-begin').click();
await wait(page, () => document.querySelector('#exp-root')?.dataset.view === 'play');
await page.waitForTimeout(500);
console.log('start', JSON.stringify(await state(page)));

// plaza -> entry, going below the monument so it does not pin us against the plinth
await walk(page, 470, 1000, 16, 15000);
await walk(page, 3120, 1000, 20, 40000);
await walk(page, 3120, 880, 16, 12000);
await page.waitForTimeout(200);
const check1 = await interact(page, 'plaza->entry');
if (check1.map !== 'entry') { console.log('STOP', JSON.stringify(check1)); await browser.close(); process.exit(1); }
await shot(page, 'td-entry');
// entry -> upper
await walk(page, 2040, 760);
const up = await interact(page, 'entry->upper');
if (up.map !== 'upper') { console.log('STOP', JSON.stringify(up)); await browser.close(); process.exit(1); }
await page.waitForTimeout(500);
await shot(page, 'td-upper');
// stand in front of the guide doorway so the roof, the doorway notch and the blocker are all visible
await walk(page, 710, 600, 14, 12000);
await shot(page, 'td-upper-guide-door');

// upper street: move around the retaining mass, then down the east steps to the middle street
await walk(page, 2000, 760, 20, 40000);
await shot(page, 'td-upper-east');
await walk(page, 2000, 995, 18, 20000);
const mid = await interact(page, 'upper->middle');
await page.waitForTimeout(500);
await shot(page, 'td-middle');

// middle -> guide 1F doorway
await walk(page, 710, 575, 16, 40000);
await shot(page, 'td-middle-guide-door');
const g1 = await interact(page, 'middle->guide');
if (g1.map !== 'guide') console.log('guide entry failed');
else { await page.waitForTimeout(500); await shot(page, 'td-guide'); }
console.log('final', JSON.stringify(await state(page)));

await browser.close();
console.log('done');
