import { chromium } from 'playwright-core';
import { mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const BASE = 'http://localhost:5175/';
const OUT = join(process.cwd(), 'test-results', 'topdown');
mkdirSync(OUT, { recursive: true });

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Users/24839/AppData/Local/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find(p => existsSync(p));
console.log('browser exe', CHROME);

const state = page => page.locator('#exp-root').evaluate(e => {
  const g = document.querySelector('#exp-stage')?.dataset ?? {};
  return {
    view: e.dataset.view, map: e.dataset.map,
    x: Number(e.dataset.x), y: Number(e.dataset.y),
    tick: Number(e.dataset.tick), tokens: Number(e.dataset.tokens),
  };
});
const wait = (page, fn, arg) => page.waitForFunction(fn, arg, { timeout: 30000, polling: 'raf' });

const held = new Set();
async function release(page) {
  for (const k of held) { await page.keyboard.up(k); held.delete(k); }
}
async function walk(page, tx, ty, tol = 18, maxMs = 40000) {
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
async function interact(page) {
  await release(page);
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(400);
}
async function shot(page, name) {
  const path = join(OUT, name + '.png');
  await page.screenshot({ path });
  console.log('shot', path);
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
page.on('pageerror', e => console.log('PAGEERROR', e.message));
await page.goto(BASE, { waitUntil: 'networkidle' });
await wait(page, () => !!document.querySelector('#exp-title'));
await wait(page, () => Number(document.querySelector('#exp-root')?.dataset.tick ?? -1) >= 0);
console.log('title state', JSON.stringify(await state(page)));
await page.waitForTimeout(400);
await shot(page, 'td-title');

const begin = page.locator('#exp-begin');
await begin.click();
await wait(page, () => document.querySelector('#exp-root')?.dataset.view === 'play');
await wait(page, () => Number(document.querySelector('#exp-root')?.dataset.tick) > 2);
await page.waitForTimeout(600);
console.log('after begin', JSON.stringify(await state(page)));

const here = await state(page);
if (here.map !== 'plaza') {
  console.log('WARN start map is', here.map);
  await shot(page, 'td-' + here.map);
} else {
  await shot(page, 'td-plaza-fresh');
  // walk to the service shop door and enter it
  await walk(page, 1250, 596, 14, 30000);
  console.log('at door', JSON.stringify(await state(page)));
  await shot(page, 'td-plaza-door');
  await interact(page);
  await page.waitForTimeout(500);
  const inside = await state(page);
  console.log('inside', JSON.stringify(inside));
  if (inside.map === 'service') {
    await shot(page, 'td-service');
    await walk(page, 540, 430, 22, 12000);
    await shot(page, 'td-service-turn');
    // leave through the same door
    await walk(page, 540, 600, 20, 12000);
    await interact(page);
    await page.waitForTimeout(600);
    console.log('after exit', JSON.stringify(await state(page)));
    await shot(page, 'td-plaza-back');
  }
}

// Mobile width: check that the doorway and the character's feet stay visible and the stick does not cover the door.
const mob = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
await mob.goto(BASE, { waitUntil: 'networkidle' });
await wait(mob, () => !!document.querySelector('#exp-title'));
const mbegin = mob.locator('#exp-begin');
if (await mbegin.count()) await mbegin.tap();
await wait(mob, () => document.querySelector('#exp-root')?.dataset.view === 'play');
await mob.waitForTimeout(700);
console.log('mobile', JSON.stringify(await state(mob)));
await mob.screenshot({ path: join(OUT, 'td-mobile-plaza.png') });
await mob.close();

await browser.close();
console.log('done');