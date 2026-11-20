import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const gymDirectory = join(process.cwd(), 'gym-module', '3s');
const requiredFiles = [
  'vite/bin/vite.js',
  'typescript/bin/tsc',
  '@vitejs/plugin-react/package.json',
  '@tailwindcss/vite/package.json',
];

if (requiredFiles.every((file) => existsSync(join(gymDirectory, 'node_modules', file)))) {
  process.exit(0);
}

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const result = spawnSync(npm, ['install', '--prefix', gymDirectory, '--ignore-scripts', '--no-audit', '--no-fund'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
