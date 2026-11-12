import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BROWSER_DEFINITIONS,
  browserExecutableCandidates,
  identifyBrowser,
  parseBrowserSelection,
  resolveBrowserExecutable,
} from './browser-selection.mjs';

const env = {
  LOCALAPPDATA: 'C:\\Users\\tester\\AppData\\Local',
  ProgramFiles: 'C:\\Program Files',
  'ProgramFiles(x86)': 'C:\\Program Files (x86)',
};

test('browser selection defaults to Chrome and accepts both explicit browsers', () => {
  assert.deepEqual(parseBrowserSelection([]), { ...BROWSER_DEFINITIONS.chrome, explicit: false });
  assert.deepEqual(parseBrowserSelection(['--web-only', '--browser=chrome']),
    { ...BROWSER_DEFINITIONS.chrome, explicit: true });
  assert.deepEqual(parseBrowserSelection(['--browser=edge', '--web-only']),
    { ...BROWSER_DEFINITIONS.edge, explicit: true });
});

test('browser selection rejects unknown, empty, bare and duplicate options', () => {
  for (const argv of [
    ['--browser=firefox'],
    ['--browser='],
    ['--browser'],
    ['--browser=chrome', '--browser=edge'],
  ]) {
    assert.throws(() => parseBrowserSelection(argv),
      error => error.code === 'UNKNOWN_BROWSER_ARGUMENT');
  }
});

test('candidate discovery includes user-level Chrome before machine installs', () => {
  assert.deepEqual(browserExecutableCandidates(BROWSER_DEFINITIONS.chrome, env, 'win32'), [
    'C:\\Users\\tester\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ]);
  assert.deepEqual(browserExecutableCandidates(BROWSER_DEFINITIONS.edge, env, 'win32'), [
    'C:\\Users\\tester\\AppData\\Local\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ]);
});

test('resolver returns the existing selected browser and never silently substitutes another', () => {
  const chrome = BROWSER_DEFINITIONS.chrome;
  const existing = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  assert.equal(resolveBrowserExecutable(chrome, {
    env, platform: 'win32', exists: path => path === existing,
  }).executablePath, existing);

  const edgeOnly = 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe';
  assert.throws(() => resolveBrowserExecutable(chrome, {
    env, platform: 'win32', exists: path => path === edgeOnly,
  }), error => error.code === 'ENVIRONMENT_PRECONDITION' &&
    error.requested === 'chrome' && error.candidates.length === 3);
});

test('browser identity comes from the actual CDP version response', () => {
  const chrome = identifyBrowser({
    product: 'Chrome/156.0.8078.74',
    revision: '@fixture',
    userAgent: 'Mozilla/5.0 Chrome/156.0.8078.74 Safari/537.36',
    jsVersion: '15.6',
  });
  assert.equal(chrome.brand, 'Google Chrome');
  assert.equal(chrome.version, '156.0.8078.74');

  const edge = identifyBrowser({
    product: 'Edg/156.0.4314.58',
    revision: '@fixture',
    userAgent: 'Mozilla/5.0 Chrome/156.0.0.0 Safari/537.36 Edg/156.0.4314.58',
    jsVersion: '15.6',
  });
  assert.equal(edge.brand, 'Microsoft Edge');
  assert.equal(edge.version, '156.0.4314.58');
});
