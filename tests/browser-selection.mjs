import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const BROWSER_DEFINITIONS = Object.freeze({
  chrome: Object.freeze({
    id: 'chrome',
    brand: 'Google Chrome',
    layout: ['Google', 'Chrome', 'Application', 'chrome.exe'],
  }),
  edge: Object.freeze({
    id: 'edge',
    brand: 'Microsoft Edge',
    layout: ['Microsoft', 'Edge', 'Application', 'msedge.exe'],
  }),
});

export class BrowserSelectionError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'BrowserSelectionError';
    this.code = code;
    Object.assign(this, details);
  }
}

export function parseBrowserSelection(argv) {
  const values = argv.filter(argument =>
    argument === '--browser' || argument.startsWith('--browser='));
  if (values.length > 1) {
    throw new BrowserSelectionError(
      'Only one --browser option is allowed.',
      'UNKNOWN_BROWSER_ARGUMENT',
      { values },
    );
  }
  if (values.length === 0) {
    return Object.freeze({ ...BROWSER_DEFINITIONS.chrome, explicit: false });
  }

  const value = values[0];
  if (!value.startsWith('--browser=') || value === '--browser=') {
    throw new BrowserSelectionError(
      'Use --browser=chrome or --browser=edge.',
      'UNKNOWN_BROWSER_ARGUMENT',
      { value },
    );
  }
  const requested = value.slice('--browser='.length);
  const definition = BROWSER_DEFINITIONS[requested];
  if (!definition) {
    throw new BrowserSelectionError(
      `Unknown browser "${requested}". Use --browser=chrome or --browser=edge.`,
      'UNKNOWN_BROWSER_ARGUMENT',
      { value, requested },
    );
  }
  return Object.freeze({ ...definition, explicit: true });
}

export function browserExecutableCandidates(browser, env = process.env, platform = process.platform) {
  if (platform !== 'win32') return [];
  const definition = typeof browser === 'string' ? BROWSER_DEFINITIONS[browser] : browser;
  if (!definition || !Array.isArray(definition.layout)) return [];

  // User-level installations take priority, followed by machine-wide locations.
  const roots = [
    env.LOCALAPPDATA,
    env.ProgramFiles,
    env['ProgramFiles(x86)'],
  ].filter(Boolean);
  return [...new Set(roots.map(root => resolve(join(root, ...definition.layout))))];
}

export function resolveBrowserExecutable(
  browser,
  { env = process.env, platform = process.platform, exists = existsSync } = {},
) {
  const candidates = browserExecutableCandidates(browser, env, platform);
  const executablePath = candidates.find(candidate => exists(candidate));
  if (!executablePath) {
    throw new BrowserSelectionError(
      `${browser.brand} was not found in a standard Windows install location.`,
      'ENVIRONMENT_PRECONDITION',
      { requested: browser.id, brand: browser.brand, candidates },
    );
  }
  return Object.freeze({ ...browser, candidates, executablePath: resolve(executablePath) });
}

export function identifyBrowser(version) {
  const userAgent = String(version?.userAgent ?? '');
  const product = String(version?.product ?? '');
  const brand = /\bEdg\//.test(userAgent) || /^Edg\//.test(product)
    ? BROWSER_DEFINITIONS.edge.brand
    : /\bChrome\//.test(userAgent) || /^Chrome\//.test(product)
      ? BROWSER_DEFINITIONS.chrome.brand
      : 'Unknown Chromium browser';
  const productVersion = product.match(/^[^/]+\/(.+)$/)?.[1] ?? '';
  const userAgentVersion = userAgent.match(/\b(?:Edg|Chrome)\/([^\s]+)/)?.[1] ?? '';
  return Object.freeze({
    brand,
    version: productVersion || userAgentVersion,
    product,
    revision: String(version?.revision ?? ''),
    userAgent,
    jsVersion: String(version?.jsVersion ?? ''),
  });
}
