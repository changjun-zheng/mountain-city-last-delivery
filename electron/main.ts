import { app, BrowserWindow, dialog, Menu, protocol, session } from 'electron';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { developmentURL, localResourcePath } from './local-resources.js';

// Registration must precede app readiness. CSP remains enforced.
protocol.registerSchemesAsPrivileged([{
  scheme: 'app',
  privileges: { standard: true, secure: true, supportFetchAPI: true },
}]);

const failStartup = (error: unknown) => {
  console.error('Desktop startup failed.', error);
  dialog.showErrorBox('叠城大冒险 | Layered City Adventures', '游戏窗口加载失败，请检查应用资源或开发服务。');
  app.exit(1);
};

app.whenReady().then(async () => {
  // A packaged app never accepts a development server, even if this variable exists.
  const dev = !app.isPackaged && process.env.MCLD_DEV_URL
    ? developmentURL(process.env.MCLD_DEV_URL) : undefined;
  const entry = new URL(dev ?? 'app://game/index.html');
  entry.searchParams.set('platform', 'windows');
  const rendererRoot = join(app.getAppPath(), 'dist');
  const csp = [
    "default-src 'none'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    dev ? `connect-src 'self' ws://127.0.0.1:${dev.port}` : "connect-src 'none'",
    "object-src 'none'", "base-uri 'none'", "form-action 'none'", "frame-ancestors 'none'",
  ].join('; ');

  if (!dev) {
    protocol.handle('app', async (request) => {
      const path = localResourcePath(rendererRoot, request.url);
      if (!path || request.method !== 'GET') return new Response('Forbidden', { status: 403 });
      try {
        // Electron's fs reads ASAR files without exposing file:// to the renderer.
        const content = await readFile(path);
        const types: Record<string, string> = {
          '.html': 'text/html; charset=utf-8',
          '.js': 'text/javascript; charset=utf-8',
          '.css': 'text/css; charset=utf-8',
        };
        return new Response(new Uint8Array(content), {
          headers: {
            'Content-Type': types[extname(path)] ?? 'application/octet-stream',
            'Content-Security-Policy': csp,
            'X-Content-Type-Options': 'nosniff',
          },
        });
      } catch {
        return new Response('Not found', { status: 404 });
      }
    });
  }

  const desktopSession = session.defaultSession;
  desktopSession.setPermissionCheckHandler(() => false);
  desktopSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  desktopSession.webRequest.onBeforeRequest((details, callback) => {
    const url = new URL(details.url);
    const local = dev
      ? url.origin === dev.origin || (url.protocol === 'ws:' && url.host === dev.host)
      : Boolean(localResourcePath(rendererRoot, url.href));
    callback({ cancel: !local && url.protocol !== 'data:' && url.protocol !== 'blob:' });
  });
  if (dev) {
    desktopSession.webRequest.onHeadersReceived((details, callback) => callback({
      responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [csp] },
    }));
  }

  Menu.setApplicationMenu(null);
  app.setAppUserModelId('io.mountaincity.lastdelivery');
  const createWindow = async () => {
    const window = new BrowserWindow({
      title: '叠城大冒险 | Layered City Adventures',
      width: 1024, height: 720, minWidth: 480, minHeight: 360,
      backgroundColor: '#101921',
      webPreferences: {
        nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true,
        webviewTag: false,
      },
    });
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', (event) => {
      if (event.url !== entry.href) event.preventDefault();
    });
    window.webContents.on('will-frame-navigate', (event) => {
      if (!event.isMainFrame || event.url !== entry.href) event.preventDefault();
    });
    window.webContents.on('will-redirect', (event) => event.preventDefault());
    window.webContents.on('will-attach-webview', (event) => event.preventDefault());
    window.webContents.on('did-fail-load', (_event, code, description, url, isMainFrame) => {
      if (isMainFrame && code !== -3) failStartup(new Error(`${description}: ${url}`));
    });
    await window.loadURL(entry.href);
  };

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow().catch(failStartup);
  });
  await createWindow();
}).catch(failStartup);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
