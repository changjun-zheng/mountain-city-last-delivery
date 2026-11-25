import {createServer} from 'node:http';
import {readFile, mkdir} from 'node:fs/promises';
import {extname, join, resolve} from 'node:path';
import {chromium} from 'playwright-core';
import {parseBrowserSelection, resolveBrowserExecutable} from '../../../../tests/browser-selection.mjs';

const root = resolve('docs/assets/ui-target-v1/mock');
const out = resolve('docs/assets/ui-target-v1');
await mkdir(out, {recursive:true});

const types = {'.html':'text/html','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.css':'text/css','.js':'application/javascript'};
const server = createServer(async (req, res) => {
  const path = resolve(root, '.' + new URL(req.url, 'http://localhost').pathname.replace(/\/$/, '/mock.html'));
  try {
    const body = await readFile(path);
    res.writeHead(200, {'content-type': types[extname(path)] ?? 'application/octet-stream', 'cache-control':'no-store'}).end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}/mock.html`;

const {executablePath} = resolveBrowserExecutable(parseBrowserSelection([]));
const browser = await chromium.launch({executablePath, headless:true});
const context = await browser.newContext({viewport:{width:1440, height:1000}, deviceScaleFactor:1});
const page = await context.newPage();
await page.goto(base, {waitUntil:'networkidle'});
await page.evaluate(async () => {
  await document.fonts.ready;
  await Promise.all([...document.images].map(image => image.complete ? Promise.resolve() : new Promise(done => { image.onload = done; image.onerror = done; })));
});
await page.waitForTimeout(400);

const screens = ['title-desktop','title-mobile','intro-desktop','intro-mobile','play-desktop','play-mobile','journal-desktop','journal-mobile','pause-desktop','pause-mobile'];
for (const id of screens) {
  const locator = page.locator(`#${id}`);
  await locator.screenshot({path:join(out, `${id}.png`)});
  console.log('captured', id, await locator.evaluate(el => `${el.offsetWidth}x${el.offsetHeight}`));
}

await browser.close();
await new Promise(done => server.close(done));
console.log(out);
