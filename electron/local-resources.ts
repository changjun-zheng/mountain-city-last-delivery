import { isAbsolute, relative, resolve, sep } from 'node:path';

// A custom protocol must not turn renderer-supplied URLs into arbitrary file reads.
export function localResourcePath(root: string, address: string): string | undefined {
  try {
    const url = new URL(address);
    if (url.protocol !== 'app:' || url.host !== 'game' || url.username || url.password) {
      return undefined;
    }
    const pathname = decodeURIComponent(url.pathname);
    if (pathname.includes('\0')) return undefined;
    const file = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    const inside = relative(root, file);
    if (isAbsolute(inside) || inside.startsWith('..')) return undefined;
    if (inside !== 'index.html' && !inside.startsWith('assets' + sep)) return undefined;
    return file;
  } catch {
    return undefined;
  }
}

export function developmentURL(address: string): URL {
  const url = new URL(address);
  if (
    url.protocol !== 'http:' || url.hostname !== '127.0.0.1' ||
    url.pathname !== '/' || url.search || url.hash || url.username || url.password
  ) {
    throw new Error('Electron development requires a loopback Vite root URL.');
  }
  return url;
}
