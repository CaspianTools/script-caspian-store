#!/usr/bin/env node
/**
 * create-caspian-store — entry point for `npm create caspian-store@latest`.
 *
 * Works by cloning CaspianTools/script-caspian-store from GitHub into a
 * temporary directory (shallow, main branch), invoking the cloned
 * scaffold/create.mjs against the user's target directory, then removing the
 * clone. All user flags are forwarded through to the scaffolder unchanged.
 *
 * We clone rather than depend on the main package because the scaffolder
 * reads the real firestore rules/indexes/storage files from the package's
 * own firebase/ tree at scaffold time (see scaffold/create.mjs) — those files
 * need to exist on disk next to the scaffolder when it runs.
 */

import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const userArgs = process.argv.slice(2);
if (userArgs.length === 0 || userArgs[0].startsWith('-')) {
  console.error(
    'Usage: npm create caspian-store@latest <project-dir> [--package-tag vX.Y.Z] [--with-functions] [--force]',
  );
  console.error('');
  console.error('See https://github.com/CaspianTools/script-caspian-store for more.');
  process.exit(1);
}

// The scaffolder resolves the target dir relative to *its own* cwd, which
// will be the temp clone — that's wrong. Resolve it here against the user's
// original cwd and forward the absolute path.
const targetAbs = resolve(process.cwd(), userArgs[0]);
const forwardedArgs = [targetAbs, ...userArgs.slice(1)];

const tempDir = mkdtempSync(join(tmpdir(), 'create-caspian-store-'));

let exitCode = 1;
try {
  const clone = spawnSync(
    'git',
    [
      'clone',
      '--depth',
      '1',
      'https://github.com/CaspianTools/script-caspian-store.git',
      tempDir,
    ],
    { stdio: 'inherit' },
  );
  if (clone.status !== 0) {
    console.error('[create-caspian-store] git clone failed.');
    exitCode = clone.status ?? 1;
  } else {
    const scaffold = spawnSync(
      process.execPath,
      [join(tempDir, 'scaffold', 'create.mjs'), ...forwardedArgs],
      { stdio: 'inherit' },
    );
    exitCode = scaffold.status ?? 1;
  }
} finally {
  if (existsSync(tempDir)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

process.exit(exitCode);
