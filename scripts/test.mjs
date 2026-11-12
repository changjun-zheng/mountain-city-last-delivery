import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const route = args.length === 0 ? 'test:unit' : 'test:platform';
const npmCli = process.env.npm_execpath;

if (!npmCli) {
  console.error('npm_execpath is unavailable; run this entry through npm.cmd test.');
  process.exit(1);
}

const npmArgs = ['run', route, ...(args.length ? ['--', ...args] : [])];
const result = spawnSync(process.execPath, [npmCli, ...npmArgs], {
  env: process.env,
  stdio: 'inherit',
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}
process.exit(result.status ?? 1);
