#!/usr/bin/env node
/**
 * Exports-drift smoke test.
 *
 * What: packs the library (uses an existing `*.tgz` in the repo root if one is
 * present, otherwise runs `npm pack`), installs the tarball into a scratch
 * directory, imports both public entries (main + ./firebase) via the exact
 * consumer resolution path, and diffs the runtime `Object.keys(...)` against
 * a committed snapshot at `.github/exports-snapshot.json`.
 *
 * Why: v2.3.0 shipped a new admin page that was re-exported from
 * `src/admin/index.ts` but missing from the main barrel `src/index.ts`. No
 * existing check caught it — the CHANGELOG told consumers to import it from
 * `@caspian-explorer/script-caspian-store`, and that crashed at build time
 * with "Export ... doesn't exist". A consumer-style smoke like this would
 * have tripped before tag.
 *
 * Usage:
 *   node scripts/check-exports.mjs            # verify against snapshot
 *   node scripts/check-exports.mjs --write    # overwrite snapshot with
 *                                             # whatever is currently exported
 *   node scripts/check-exports.mjs --tarball  # use existing tgz in repo root
 *                                             # without re-packing
 */

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const snapshotPath = join(repoRoot, '.github', 'exports-snapshot.json');

const args = new Set(process.argv.slice(2));
const write = args.has('--write');
const reuseTarball = args.has('--tarball');

function log(...parts) {
  console.log('[check-exports]', ...parts);
}

function findTarball() {
  const entries = readdirSync(repoRoot).filter((n) =>
    n.startsWith('caspian-explorer-script-caspian-store-') && n.endsWith('.tgz'),
  );
  return entries.length > 0 ? join(repoRoot, entries.sort().pop()) : null;
}

let tarball = reuseTarball ? findTarball() : null;
if (!tarball) {
  log('packing…');
  execSync('npm pack', { stdio: 'inherit', cwd: repoRoot });
  tarball = findTarball();
}
if (!tarball || !existsSync(tarball)) {
  console.error('[check-exports] Could not find a packed tarball.');
  process.exit(2);
}
log('using tarball', tarball);

const scratch = join(tmpdir(), 'caspian-exports-smoke');
rmSync(scratch, { recursive: true, force: true });
mkdirSync(scratch, { recursive: true });
writeFileSync(
  join(scratch, 'package.json'),
  JSON.stringify({ name: 'caspian-exports-smoke', version: '0.0.0', private: true, type: 'module' }, null, 2),
);

log('installing tarball into', scratch);
execSync(
  `npm install --no-audit --no-fund --ignore-scripts "${tarball.replace(/\\/g, '/')}"`,
  { cwd: scratch, stdio: 'inherit' },
);

const installedRoot = join(
  scratch,
  'node_modules',
  '@caspian-explorer',
  'script-caspian-store',
);
// Docs ship as files, not code: the `exports` map can name a path the `files`
// list no longer packs, and nothing else would notice until a consumer opened a
// dead link. Assert every .html export target exists in the real installed tree.
{
  const installedPkg = JSON.parse(readFileSync(join(installedRoot, 'package.json'), 'utf8'));
  const htmlTargets = Object.entries(installedPkg.exports || {}).filter(
    ([, target]) => typeof target === 'string' && target.endsWith('.html'),
  );
  const missing = htmlTargets.filter(([, target]) => !existsSync(join(installedRoot, target)));
  if (missing.length) {
    console.error('');
    console.error('Missing doc files in the packed tarball:');
    for (const [key, target] of missing) console.error(`  ${key} -> ${target}`);
    console.error('');
    console.error('Check the `files` list in package.json.');
    process.exit(1);
  }
  log(`${htmlTargets.length} doc export target(s) present in the tarball`);
}

const mainEntry = join(installedRoot, 'dist', 'index.mjs');
const firebaseEntry = join(installedRoot, 'dist', 'firebase', 'index.mjs');

log('importing main entry');
const main = await import(pathToFileURL(mainEntry).href);
log('importing firebase entry');
const firebase = await import(pathToFileURL(firebaseEntry).href);

const actual = {
  mainEntry: Object.keys(main).sort(),
  firebaseEntry: Object.keys(firebase).sort(),
};

if (write) {
  mkdirSync(dirname(snapshotPath), { recursive: true });
  writeFileSync(snapshotPath, JSON.stringify(actual, null, 2) + '\n');
  log(`wrote snapshot: ${actual.mainEntry.length} main + ${actual.firebaseEntry.length} firebase`);
  process.exit(0);
}

if (!existsSync(snapshotPath)) {
  console.error(
    `[check-exports] Snapshot missing at ${snapshotPath}. Run with --write to create it.`,
  );
  process.exit(2);
}
const expected = JSON.parse(readFileSync(snapshotPath, 'utf8'));

function diff(label, expectedArr, actualArr) {
  const expectedSet = new Set(expectedArr);
  const actualSet = new Set(actualArr);
  const missing = expectedArr.filter((n) => !actualSet.has(n));
  const extra = actualArr.filter((n) => !expectedSet.has(n));
  return { label, missing, extra };
}

const diffs = [
  diff('mainEntry', expected.mainEntry ?? [], actual.mainEntry),
  diff('firebaseEntry', expected.firebaseEntry ?? [], actual.firebaseEntry),
];

let failed = false;
for (const d of diffs) {
  if (d.missing.length || d.extra.length) {
    failed = true;
    console.error(`\n[check-exports] ${d.label} drifted vs snapshot:`);
    if (d.missing.length) console.error('  Missing (removed or never exported):', d.missing);
    if (d.extra.length) console.error('  Extra (new export not in snapshot):', d.extra);
  } else {
    log(`${d.label}: ${actual[d.label].length} exports match snapshot`);
  }
}

if (failed) {
  console.error(
    '\n[check-exports] Export surface drifted. If intentional, run:',
    '\n  node scripts/check-exports.mjs --write',
    '\nand commit the updated .github/exports-snapshot.json.',
  );
  process.exit(1);
}
