#!/usr/bin/env node
/**
 * Build the Caspian POS PWA.
 *
 * Vite emits the bundle to `apps/pos/dist/` with `index.html` at the root.
 * The production deploy serves the register under `/pos/`, so this script
 * moves `dist/index.html` into `dist/pos/index.html` after the build.
 * Public assets (manifest, service worker, icons, offline fallback) are
 * copied to `dist/` root by Vite automatically.
 */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, rename } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(root, 'dist');
const posDir = join(dist, 'pos');

function run(command, args, options) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    cwd: root,
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(' ')}`);
  }
}

// 1. Let Vite build to dist/.
// Use the installed Vite binary directly so the script works even when
// lifecycle scripts (which create .bin symlinks) were skipped.
const viteBin = join(root, 'node_modules', 'vite', 'bin', 'vite.js');
if (!existsSync(viteBin)) {
  throw new Error(`Vite not found at ${viteBin}. Run npm install in the pos directory.`);
}
run(process.execPath, [viteBin, 'build']);

// 2. Move the entry document into /pos/ so the deployed path matches the
//    manifest scope and service-worker scope.
const sourceIndex = join(dist, 'index.html');
if (!existsSync(sourceIndex)) {
  throw new Error(`Vite did not produce ${sourceIndex}`);
}

await mkdir(posDir, { recursive: true });
await rename(sourceIndex, join(posDir, 'index.html'));

console.log('Caspian POS PWA built in', dist);
console.log('Deploy:', dist, 'with the register entry at /pos/');
