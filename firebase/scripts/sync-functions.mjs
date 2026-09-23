#!/usr/bin/env node
/**
 * sync-functions.mjs — refreshes the consumer's Cloud Functions sources from
 * the installed `@caspian-explorer/script-caspian-store` package.
 *
 * The scaffolder copies `firebase/functions-*` into the consumer project once,
 * so after a library upgrade those copies are stale: `firebase deploy` would
 * ship yesterday's Stripe or admin functions. This copies each codebase the
 * consumer's `firebase.json` lists (`functions[].source`) back over from the
 * package — `src/`, `package.json`, `package-lock.json`, `tsconfig.json` —
 * leaving `node_modules/` and `lib/` alone. A codebase that is not in
 * `firebase.json` is never created, so opting out of Stripe stays opted out.
 *
 * Usage (from the consumer project root):
 *   npm run firebase:sync-functions
 *
 * The Caspian deploy workflow (.github/workflows/caspian-firebase-deploy.yml)
 * runs this after every package bump, so the one-click update on
 * /admin/about also ships new functions.
 *
 * Exit code: 0 on success (including "nothing to sync"), 1 on a bad
 * firebase.json or a listed codebase the package does not ship.
 */

import { cpSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const libFirebaseDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const consumerRoot = process.cwd();
const configPath = join(consumerRoot, 'firebase.json');

if (!existsSync(configPath)) {
  console.log('[firebase:sync-functions] No firebase.json in this project — nothing to sync.');
  process.exit(0);
}

let config;
try {
  config = JSON.parse(readFileSync(configPath, 'utf8'));
} catch (err) {
  console.error(`[firebase:sync-functions] Could not parse firebase.json: ${err.message}`);
  process.exit(1);
}

const entries = Array.isArray(config.functions) ? config.functions : config.functions ? [config.functions] : [];
const FILES = ['package.json', 'package-lock.json', 'tsconfig.json'];
let failed = 0;
let synced = 0;

for (const entry of entries) {
  const source = typeof entry?.source === 'string' ? entry.source : '';
  const name = basename(source);
  // Only the library's own codebases; a consumer's custom functions dir is theirs.
  if (!/^functions-[a-z]+$/.test(name)) continue;
  const from = join(libFirebaseDir, name);
  const to = resolve(consumerRoot, source);
  if (!existsSync(from)) {
    console.error(`[firebase:sync-functions] ${name} is listed in firebase.json but this package version does not ship it.`);
    failed++;
    continue;
  }
  rmSync(join(to, 'src'), { recursive: true, force: true });
  cpSync(join(from, 'src'), join(to, 'src'), { recursive: true });
  for (const file of FILES) {
    if (existsSync(join(from, file))) cpSync(join(from, file), join(to, file));
  }
  synced++;
  console.log(`[firebase:sync-functions] ✔ ${source}`);
}

if (failed > 0) process.exit(1);
console.log(
  synced > 0
    ? `[firebase:sync-functions] Synced ${synced} codebase(s). Deploy with \`firebase deploy --only functions\`.`
    : '[firebase:sync-functions] firebase.json lists no caspian functions codebases — nothing to sync.',
);
