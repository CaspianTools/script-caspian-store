#!/usr/bin/env node
/**
 * AdminRoot-vs-nav drift smoke test.
 *
 * What: v7.0.0 collapsed the consumer's admin route tree into a single
 * `<CaspianRoot>` mount that delegates `/admin/**` to `<AdminRoot>`. There
 * are no per-page route files left to drift; the failure mode instead is
 * "a new nav entry was added without a matching case in AdminRoot's
 * switch", which ships a sidebar link that dispatches to the dashboard
 * fallback. This script catches that.
 *
 * Why: v2.4 shipped with AdminSearchTermsPage missing from the main
 * barrel; v2.11 shipped with AdminEmailsPage missing a scaffolder route;
 * v3.1 shipped with 9 sidebar links 404ing in the example app (mod1189);
 * v5.0.0 shipped a plugins sidebar entry that 404'd in consumer sites
 * until they added a route file (mod1197 follow-up). All the same class
 * of bug — nav added on one side, dispatch forgotten on the other.
 *
 * v7.0.2 added a second check to the same script: the scaffolder's
 * generated `src/app/layout.tsx` must NOT wrap children in <LayoutShell>,
 * because CaspianRoot already mounts it for every storefront path.
 * v7.0.0 and v7.0.1 shipped with the double-wrap; every consumer site saw
 * two stacked headers and two stacked footers until the template was
 * fixed. The guard below catches any future regression.
 *
 * Usage:
 *   node scripts/check-scaffold-routes.mjs       # exit 0 on match, 1 on drift
 */

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

const SHELL_FILE = join(repoRoot, 'src', 'admin', 'admin-shell.tsx');
const ROOT_FILE = join(repoRoot, 'src', 'admin', 'admin-root.tsx');
const SCAFFOLD_FILE = join(repoRoot, 'scaffold', 'create.mjs');

function extractNavHrefs(src) {
  const match = src.match(/export const DEFAULT_ADMIN_NAV[^=]*=\s*\[([\s\S]*?)\];/);
  if (!match) {
    throw new Error(
      'Could not find `DEFAULT_ADMIN_NAV = [ ... ]` literal in admin-shell.tsx.\n' +
        'If the shape changed, update scripts/check-scaffold-routes.mjs.',
    );
  }
  const hrefs = [];
  const hrefRegex = /href:\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = hrefRegex.exec(match[1])) !== null) hrefs.push(m[1]);
  return hrefs;
}

function extractDispatchedHeads(src) {
  const heads = new Set();
  const re = /case\s+['"]([^'"]+)['"]\s*:/g;
  let m;
  while ((m = re.exec(src)) !== null) heads.add(m[1]);
  return heads;
}

// Map a nav href to the "head" segment AdminRoot's dispatcher switches on.
// `/admin` itself is the dashboard (empty-after fallthrough), no case needed.
function headFor(href) {
  if (href === '/admin') return null;
  const match = href.match(/^\/admin\/([^/]+)/);
  return match ? match[1] : null;
}

const shellSrc = readFileSync(SHELL_FILE, 'utf8');
const rootSrc = readFileSync(ROOT_FILE, 'utf8');

const navHrefs = extractNavHrefs(shellSrc);
const dispatched = extractDispatchedHeads(rootSrc);

const missing = [];
for (const href of navHrefs) {
  const head = headFor(href);
  if (head === null) continue;
  if (!dispatched.has(head)) missing.push({ href, head });
}

if (missing.length > 0) {
  console.error(
    '\n[check-scaffold-routes] DRIFT — nav entries without an AdminRoot dispatch:\n',
  );
  for (const { href, head } of missing) {
    console.error(`  ${href}   (needs case '${head}': in src/admin/admin-root.tsx)`);
  }
  console.error(
    "\n  Fix: add `case '<head>': return <SomePage />;` to the switch in\n" +
      '  src/admin/admin-root.tsx so the sidebar link actually renders.\n',
  );
  process.exit(1);
}

// v7.0.2 regression guard — only CaspianRoot may mount <LayoutShell>. The
// scaffolded root layout must NOT wrap children in it, or every storefront
// page renders two headers and two footers (the exact bug v7.0.2 fixed).
const scaffoldSrc = readFileSync(SCAFFOLD_FILE, 'utf8');
const layoutBlockMatch = scaffoldSrc.match(
  /write\(\s*['"]src\/app\/layout\.tsx['"]\s*,\s*`([\s\S]*?)`\s*\)/,
);
if (!layoutBlockMatch) {
  console.error(
    "\n[check-scaffold-routes] Could not locate the `write('src/app/layout.tsx', ...)` block in scaffold/create.mjs.\n" +
      '  If the scaffolder shape changed, update scripts/check-scaffold-routes.mjs.\n',
  );
  process.exit(1);
}
if (/<LayoutShell\b/.test(layoutBlockMatch[1])) {
  console.error(
    '\n[check-scaffold-routes] DRIFT — scaffolded src/app/layout.tsx wraps children in <LayoutShell>.\n\n' +
      '  CaspianRoot already mounts LayoutShell for every storefront path\n' +
      '  (src/components/caspian-root.tsx line 126). Wrapping again at the root\n' +
      '  layout produces duplicate headers and duplicate footers on every page.\n\n' +
      '  Fix: remove the <LayoutShell> wrapper from the template in scaffold/create.mjs\n' +
      '  so the root layout renders\n' +
      '  `<Providers>{children}<DynamicFavicon /><ServiceWorkerRegister /></Providers>`.\n',
  );
  process.exit(1);
}

// The scaffolder emits public/sw.js + public/offline.html, but a worker that
// nothing registers is dead weight: the generated layout must mount
// <ServiceWorkerRegister /> (examples/nextjs/app/layout.tsx does). v15.0
// shipped the files without the mount and no consumer site ever installed.
if (!/<ServiceWorkerRegister\s*\/>/.test(layoutBlockMatch[1])) {
  console.error(
    '\n[check-scaffold-routes] DRIFT — scaffolded src/app/layout.tsx does not mount <ServiceWorkerRegister />.\n\n' +
      '  The scaffolder writes public/sw.js and public/offline.html, and only that\n' +
      '  component registers the worker. Add `<ServiceWorkerRegister />` beside\n' +
      '  `<DynamicFavicon />` in the layout template in scaffold/create.mjs.\n',
  );
  process.exit(1);
}

console.log(
  `[check-scaffold-routes] OK — ${navHrefs.length} nav entries, ` +
    `${dispatched.size} cases dispatched in AdminRoot; ` +
    'scaffolded layout.tsx does not double-wrap in LayoutShell and mounts ServiceWorkerRegister.',
);
