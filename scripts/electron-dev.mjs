import { spawn } from 'node:child_process';
import electron from 'electron';
import { createServer } from 'vite';

const server = await createServer({
  server: { host: '127.0.0.1', port: 0, strictPort: true },
});
await server.listen();
server.printUrls();
const env = { ...process.env, MCLD_DEV_URL: server.resolvedUrls.local[0] };
delete env.ELECTRON_RUN_AS_NODE;

// This launcher owns both processes, so closing the app also releases the Vite port.
const child = spawn(electron, ['.'], { env, stdio: 'inherit' });
let closing;
const close = () => closing ??= server.close();
child.on('error', async (error) => {
  console.error(error);
  await close();
  process.exitCode = 1;
});
child.on('exit', async (code) => {
  await close();
  process.exitCode = code ?? 1;
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    child.kill();
    void close();
  });
}
