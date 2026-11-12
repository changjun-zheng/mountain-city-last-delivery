import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { developmentURL, localResourcePath } from '../dist-electron/local-resources.js';

const root = resolve('fixture/dist');

test('local protocol permits the entry and bundled assets', () => {
  assert.equal(localResourcePath(root, 'app://game/index.html?platform=windows'), resolve(root, 'index.html'));
  assert.equal(localResourcePath(root, 'app://game/'), resolve(root, 'index.html'));
  assert.equal(localResourcePath(root, 'app://game/assets/game.js'), resolve(root, 'assets/game.js'));
});

test('local protocol rejects traversal, arbitrary files and other origins', () => {
  for (const url of [
    'app://game/assets/../../package.json',
    'app://game/assets/%2e%2e%5c%2e%2e%5cpackage.json',
    'app://game/assets/%2f..%2f..%2fpackage.json',
    'app://game/package.json', 'app://game/.env',
    'app://game/%00', 'app://game/%ZZ', 'app://game:80/index.html',
    'app://user@game/index.html', 'app://other/index.html',
    'https://game/index.html', 'file:///C:/Windows/win.ini', 'invalid',
  ]) assert.equal(localResourcePath(root, url), undefined, url);
});

test('development URL only accepts a loopback HTTP root without credentials', () => {
  assert.equal(developmentURL('http://127.0.0.1:5174/').port, '5174');
  for (const url of [
    'https://example.com/', 'http://localhost:5174/', 'http://127.0.0.1.evil/',
    'http://user:pass@127.0.0.1/', 'http://127.0.0.1/game',
    'http://127.0.0.1/?url=evil', 'http://127.0.0.1/#evil', 'file:///index.html',
  ]) assert.throws(() => developmentURL(url), undefined, url);
});
