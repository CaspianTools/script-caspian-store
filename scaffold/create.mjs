#!/usr/bin/env node
/**
 * create-caspian-store — scaffolds a fresh Next.js consumer site wired up to
 * @caspian-explorer/script-caspian-store.
 *
 * Usage:
 *   node <path-to-package>/scaffold/create.mjs <project-dir>
 *     [--package-tag vX.Y.Z]        # defaults to the package's own version
 *     [--next-version <spec>]       # pin for next in generated package.json; default ^15.0.0
 *     [--use-create-next-app]       # delegate Next.js boilerplate to `npx create-next-app`
 *                                    # for drift-free tsconfig / next.config / next-env.d.ts
 *     [--with-stripe]               # also copy firebase/functions-stripe/ (Stripe checkout
 *                                    #   + webhook) — admin codebase is always scaffolded
 *     [--with-email]                # also copy firebase/functions-email/ (transactional
 *                                    #   email via SendGrid/Brevo plugins — configure at
 *                                    #   /admin/plugins/email-providers after deploy)
 *     [--with-pos]                  # also copy firebase/functions-pos/ (in-person register:
 *                                   #   server-priced sale commits, idempotent offline replay)
 *     [--pos-only]                  # implies --with-pos. NOTE: this only adds the register's
 *                                   #   Cloud Functions. It does NOT switch the storefront off --
 *                                   #   the scaffolder writes files and never touches Firestore.
 *                                   #   Register-only mode is a switch at /admin/pos, post-deploy.
 *     [--with-instagram]            # also copy firebase/functions-instagram/ (Instagram
 *                                    #   feed + comment moderation for store staff;
 *                                    #   set META_APP_ID / META_APP_SECRET then deploy)
 *     [--with-functions]            # deprecated alias for --with-stripe (back-compat)
 *     [--no-apphosting]             # suppress apphosting.yaml in the output (default: emit).
 *                                    #   Useful for Vercel deployments where the file would
 *                                    #   just sit unused.
 *     [--force]                     # scaffold into a non-empty dir (.git / .gitignore /
 *                                    #   README.md / LICENSE are preserved without --force)
 *
 * What you get:
 *   - Next.js App Router project in <project-dir>/ (default Next pin: ^15.0.0)
 *   - All storefront + admin + content routes pre-mounted as one-liners
 *   - Next.js adapter code (Link/Image/useNavigation) for the package
 *   - Real firestore.rules / firestore.indexes.json / storage.rules copied
 *     from the package (deployable immediately)
 *   - .env.example with Firebase + Stripe placeholders
 *   - Scripts in package.json for dev / typecheck / seed / grant-admin
 *
 * After scaffolding, `cd <project-dir> && npm install` and follow the README.
 */

import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, cpSync, unlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageRoot = resolve(__dirname, '..');
const ownVersion = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')).version;

const { positionals, values: args } = parseArgs({
  options: {
    'package-tag': { type: 'string', default: `v${ownVersion}` },
    'next-version': { type: 'string', default: '^15.0.0' },
    'use-create-next-app': { type: 'boolean', default: false },
    force: { type: 'boolean', default: false },
    'with-stripe': { type: 'boolean', default: false },
    'with-email': { type: 'boolean', default: false },
    'with-instagram': { type: 'boolean', default: false },
    'with-pos': { type: 'boolean', default: false },
    'pos-only': { type: 'boolean', default: false },
    'with-functions': { type: 'boolean', default: false },
    'no-apphosting': { type: 'boolean', default: false },
  },
  allowPositionals: true,
});

// --with-functions used to mean "copy the Stripe Cloud Functions tree"; it now
// only affects the Stripe codebase (admin codebase is always scaffolded), so
// treat it as an alias for --with-stripe to avoid breaking existing callers.
const includeStripe = args['with-stripe'] || args['with-functions'];
// --with-email opts into the caspian-email codebase. Mirrors --with-stripe's
// pattern: the email Cloud Functions (order/contact triggers + send-test)
// ship to a separate codebase so deploys without email don't need the
// @sendgrid/mail + @getbrevo/brevo SDKs, and the admin codebase keeps its
// zero-secrets invariant.
const includeEmail = args['with-email'];
// --with-instagram opts into the caspian-instagram codebase — the Facebook-Login
// OAuth exchange + feed/comment-moderation callables used by store staff.
// Mirrors --with-stripe/--with-email: it ships as a separate codebase so installs
// that don't use it don't deploy it, and the store owner connects Instagram at
// onboarding by setting META_APP_ID / META_APP_SECRET and deploying caspian-instagram.
const includeInstagram = args['with-instagram'];

// --pos-only is a register-only store: no public storefront. It implies
// --with-pos because the register cannot commit a sale without the callables,
// and a scaffold that produced a till which refuses to sell would be worse
// than refusing the flag.
const posOnly = args['pos-only'];
const includePos = args['with-pos'] || posOnly;
const suppressApphosting = args['no-apphosting'];

const targetDir = positionals[0];
if (!targetDir) {
  console.error(
    'Usage: node create.mjs <project-dir> [--package-tag vX.Y.Z] [--next-version <spec>]\n' +
    '                       [--use-create-next-app] [--with-stripe] [--with-email]\n' +
    '                       [--with-instagram] [--with-pos] [--pos-only]\n' +
    '                       [--no-apphosting] [--force]',
  );
  process.exit(1);
}

// Files a freshly-initialised repo might already contain — these are preserved
// as-is during scaffolding. Anything else forces --force.
const HARMLESS_FILES = new Set(['.git', '.gitignore', 'README.md', 'LICENSE']);

const root = resolve(process.cwd(), targetDir);
if (existsSync(root) && !args.force) {
  const unrecognized = readdirSync(root).filter((name) => !HARMLESS_FILES.has(name));
  if (unrecognized.length > 0) {
    console.error(
      `[create-caspian-store] ${root} contains files that would be overwritten: ${unrecognized.join(', ')}\n` +
      `  Safe files (${[...HARMLESS_FILES].join(', ')}) would be preserved; pass --force to scaffold anyway.`
    );
    process.exit(1);
  }
}
mkdirSync(root, { recursive: true });

const packageTag = args['package-tag'];
const packageSpec = `github:CaspianTools/script-caspian-store#${packageTag}`;
const nextVersion = args['next-version'];
const useCreateNextApp = args['use-create-next-app'];
const sourceFirebaseDir = join(packageRoot, 'firebase');

function write(relPath, content) {
  const abs = join(root, relPath);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content);
}

// ---- optional: delegate Next.js boilerplate to create-next-app ----
// When enabled, `npx create-next-app@latest` writes tsconfig.json, next.config.*,
// next-env.d.ts, .gitignore, a starter src/app/ tree, public/ assets, and a
// package.json. We then overlay our pages, adapters, providers, firebase config,
// and merge our deps + scripts into the package.json it wrote. This insulates
// the tsconfig / next.config shape from drifting out of step with Next upstream
// without us having to chase every Next release.
if (useCreateNextApp) {
  // On Windows the npx wrapper is npx.cmd; spawning it directly bypasses
  // PATHEXT resolution and exits null. Using shell: true routes through
  // cmd.exe which handles the .cmd suffix. Elsewhere we spawn directly —
  // faster and avoids the "args + shell:true" deprecation.
  const isWindows = process.platform === 'win32';
  const cnaArgs = [
    '--yes',
    'create-next-app@latest',
    root,
    '--typescript',
    '--app',
    '--src-dir',
    '--no-tailwind',
    '--no-eslint',
    '--import-alias',
    '@/*',
    '--use-npm',
    '--yes',
    '--skip-install',
    '--disable-git',
  ];
  const result = isWindows
    ? spawnSync(
        `npx ${cnaArgs.map((a) => (/[\s*]/.test(a) ? `"${a}"` : a)).join(' ')}`,
        { stdio: 'inherit', shell: true },
      )
    : spawnSync('npx', cnaArgs, { stdio: 'inherit' });
  if (result.status !== 0) {
    console.error(
      '[create-caspian-store] create-next-app exited with status ' + result.status,
    );
    process.exit(result.status ?? 1);
  }
}

// ---- package.json ----
// When delegating to create-next-app, merge into what it wrote so we keep
// Next's current dep pins and scripts. Otherwise write a hand-rolled version.
const ourScripts = {
  // `predev` clears port 3000 before `next dev` mounts. Mitigates a
  // Windows-specific Turbopack zombie-worker bug: when the parent shell
  // exits without clean shutdown, Node.exe worker PIDs can hold :3000, so
  // the next `npm run dev` hangs on EADDRINUSE. `npx --yes kill-port 3000`
  // is a no-op on other platforms (or when nothing holds the port), and
  // `|| exit 0` keeps a "port free" exit-1 from aborting dev.
  predev: 'npx --yes kill-port 3000 || exit 0',
  typecheck: 'tsc --noEmit',
  'firebase:deploy': 'firebase deploy',
  'firebase:sync': 'node node_modules/@caspian-explorer/script-caspian-store/firebase/scripts/sync-rules.mjs',
  'deploy:admin': 'node node_modules/@caspian-explorer/script-caspian-store/firebase/scripts/deploy-functions.mjs --codebase caspian-admin',
  'deploy:email': 'node node_modules/@caspian-explorer/script-caspian-store/firebase/scripts/deploy-functions.mjs --codebase caspian-email',
  'deploy:stripe': 'node node_modules/@caspian-explorer/script-caspian-store/firebase/scripts/deploy-functions.mjs --codebase caspian-stripe',
  'deploy:instagram': 'node node_modules/@caspian-explorer/script-caspian-store/firebase/scripts/deploy-functions.mjs --codebase caspian-instagram',
  'deploy:pos': 'node node_modules/@caspian-explorer/script-caspian-store/firebase/scripts/deploy-functions.mjs --codebase caspian-pos',
  'firebase:seed': 'node node_modules/@caspian-explorer/script-caspian-store/firebase/seed/seed.mjs',
  'grant-admin': 'node node_modules/@caspian-explorer/script-caspian-store/firebase/seed/grant-admin.mjs',
};
const ourDeps = {
  '@caspian-explorer/script-caspian-store': packageSpec,
  firebase: '^12.0.0',
  // v13 drops the transitive @tootallnate/once / older @google-cloud/* chain
  // that triggers `npm audit` noise on fresh scaffolds. APIs used by seed.mjs,
  // grant-admin.mjs, and the /api/caspian-store/update route
  // (admin.initializeApp / firestore / auth) are stable from 12 → 13.
  // Kept under `dependencies` (not devDependencies) because
  // /api/caspian-store/update loads firebase-admin at runtime in production.
  // Floor raised to 13.8.0 in v7.0.1 — earlier 13.x carried a transitive
  // chain (jsonwebtoken <=8, protobufjs <=7.5.4, @google-cloud/firestore
  // <=6.8.0, uuid <14) flagged critical/high by `npm audit`. 13.8.0 pulls
  // patched versions of all four.
  'firebase-admin': '^13.8.0',
};
const ourDevDeps = {};

// npm `overrides` force transient deps to safe versions even when nested
// packages still pin old ones. Added in v7.0.1 after `npm audit` in
// consumer sites (luivante) flagged critical/high vulns under the
// firebase-admin tree — protobufjs pre-7.5.5 (RCE + prototype pollution),
// jsonwebtoken <=8 (signature bypass), @tootallnate/once (control-flow),
// uuid <14 (buffer bounds). These overrides are the belt that complements
// the 13.8.0 floor (the suspenders), so a fresh scaffold passes
// `npm audit` cleanly regardless of what the firebase-admin sub-tree
// happens to still pin nested.
const ourOverrides = {
  '@tootallnate/once': '^3.0.1',
  'http-proxy-agent': '^7.0.2',
  jsonwebtoken: '^9.0.2',
  protobufjs: '^7.5.5',
  uuid: '^14.0.0',
};

// Storefronts routinely reference product images from arbitrary hosts (seeded
// demos, Unsplash, Wikimedia, third-party CDNs). `next/image` rejects any host
// not listed under `images.remotePatterns`, so we ship a permissive default
// and show consumers how to tighten it. Shared between both generation paths
// (hand-rolled and create-next-app delegation) so the output stays identical.
//
// `turbopack.root` pins the workspace root to this file's dir so Next doesn't
// surface "Warning: Next.js inferred your workspace root" for any consumer
// whose home dir happens to contain a stray package-lock.json. Derived via
// fileURLToPath + dirname because __dirname is not a global in ESM.
const nextConfigSource = `import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const nextConfig = {
  turbopack: {
    root: __dirname,
  },
  images: {
    // Permissive default — storefront admins can paste image URLs from any
    // https host. To restrict, replace this entry with explicit per-host rules:
    //   { protocol: 'https', hostname: 'firebasestorage.googleapis.com' },
    //   { protocol: 'https', hostname: 'cdn.example.com' },
    // See https://nextjs.org/docs/messages/next-image-unconfigured-host
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
  async redirects() {
    return [
      // A locale-prefixed register URL must land on the real /pos route segment.
      // Without this /az/pos falls through to the root catch-all, which serves
      // the STOREFRONT manifest — so every non-English till would install the
      // wrong app. The register's own language is per-device, not per-URL, so
      // dropping the prefix here loses nothing.
      { source: '/:locale(az|ru|tr|en)/pos', destination: '/pos', permanent: false },
      { source: '/:locale(az|ru|tr|en)/pos/:rest*', destination: '/pos/:rest*', permanent: false },
    ];
  },
  async headers() {
    // Service workers must never be served from cache, or a till can be pinned
    // to a stale register for as long as the browser keeps the old copy.
    const noStore = [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }];
    return [
      { source: '/sw.js', headers: noStore },
      { source: '/sw-pos.js', headers: noStore },
    ];
  },
  env: {
    // Firebase App Hosting auto-injects FIREBASE_WEBAPP_CONFIG at build time.
    // Forwarding it through Next's env: block is what keeps it inlined into
    // the client bundle (it isn't NEXT_PUBLIC_-prefixed, so DefinePlugin
    // wouldn't otherwise expose it to the browser). No-op on Vercel/local
    // — undefined just falls through to NEXT_PUBLIC_FIREBASE_* values.
    FIREBASE_WEBAPP_CONFIG: process.env.FIREBASE_WEBAPP_CONFIG,
  },
};
export default nextConfig;
`;

if (useCreateNextApp) {
  const pkgPath = join(root, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  pkg.scripts = { ...(pkg.scripts ?? {}), ...ourScripts };
  pkg.dependencies = { ...(pkg.dependencies ?? {}), ...ourDeps };
  if (nextVersion) pkg.dependencies.next = nextVersion;
  pkg.devDependencies = { ...(pkg.devDependencies ?? {}), ...ourDevDeps };
  pkg.overrides = { ...(pkg.overrides ?? {}), ...ourOverrides };
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

  // create-next-app picks the `next.config` extension based on its own Next
  // version and the --typescript flag (recent versions emit .ts). Delete any
  // variant it wrote and replace with our .mjs so the images config is always
  // applied and the scaffolder's output shape is stable across CNA releases.
  for (const variant of ['next.config.ts', 'next.config.js', 'next.config.mjs']) {
    const p = join(root, variant);
    if (existsSync(p)) unlinkSync(p);
  }
  write('next.config.mjs', nextConfigSource);
} else {
  write('package.json', JSON.stringify({
    name: targetDir.split(/[\\/]/).pop(),
    version: '0.1.0',
    private: true,
    scripts: {
      dev: 'next dev',
      build: 'next build',
      start: 'next start',
      ...ourScripts,
    },
    dependencies: {
      ...ourDeps,
      next: nextVersion,
      react: '^19.0.0',
      'react-dom': '^19.0.0',
    },
    devDependencies: {
      '@types/node': '^20.0.0',
      '@types/react': '^19.0.0',
      '@types/react-dom': '^19.0.0',
      typescript: '^5.6.0',
      ...ourDevDeps,
    },
    overrides: { ...ourOverrides },
  }, null, 2) + '\n');

  // ---- tsconfig.json ----
  write('tsconfig.json', JSON.stringify({
    compilerOptions: {
      target: 'ES2022',
      lib: ['dom', 'dom.iterable', 'esnext'],
      allowJs: true,
      skipLibCheck: true,
      strict: true,
      noEmit: true,
      esModuleInterop: true,
      module: 'esnext',
      moduleResolution: 'bundler',
      resolveJsonModule: true,
      isolatedModules: true,
      jsx: 'preserve',
      incremental: true,
      plugins: [{ name: 'next' }],
      paths: { '@/*': ['./src/*'] },
    },
    include: ['next-env.d.ts', 'src/**/*.ts', 'src/**/*.tsx', '.next/types/**/*.ts'],
    exclude: ['node_modules'],
  }, null, 2) + '\n');

  // ---- next.config.mjs ----
  write('next.config.mjs', nextConfigSource);
}

// ---- .env.example ----
write('.env.example', `# Firebase web config (from Firebase console → Project settings → Your apps)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Web app manifest (both installable apps: the storefront and the register).
# Quote the colours. dotenv treats an unquoted # as the start of a comment, so
# NEXT_PUBLIC_BRAND_THEME_COLOR=#1d4ed8 silently reads as empty.
NEXT_PUBLIC_BRAND_NAME=
NEXT_PUBLIC_BRAND_THEME_COLOR="#111111"
NEXT_PUBLIC_BRAND_BACKGROUND_COLOR="#ffffff"

# Payment providers are installed + configured at runtime via Admin → Payments.
# Publishable keys (e.g. pk_live_...) live in Firestore, not env vars. Server-side
# secrets are *Cloud Functions secrets*:
#   firebase functions:secrets:set STRIPE_SECRET_KEY
#   firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
`);

// ---- .gitignore + next-env.d.ts ----
// create-next-app writes both; skip when delegating. Otherwise emit our own.
if (!useCreateNextApp) {
  write('.gitignore', `node_modules
.next
.env*.local
*.log
service-account*.json
functions-admin/lib/
functions-stripe/lib/
functions-instagram/lib/
`);
  write('next-env.d.ts', `/// <reference types="next" />
/// <reference types="next/image-types/global" />
`);
}

// ---- src/lib/caspian-adapters.tsx ----
write('src/lib/caspian-adapters.tsx', `'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import type {
  CaspianLinkProps,
  CaspianImageProps,
} from '@caspian-explorer/script-caspian-store';
import { readFirebaseConfigFromEnv } from '@caspian-explorer/script-caspian-store/firebase';

// Reads from FIREBASE_WEBAPP_CONFIG (Firebase App Hosting auto-injects it)
// first, then falls back to the six NEXT_PUBLIC_FIREBASE_* vars (Vercel / .env.local).
// next.config.mjs forwards FIREBASE_WEBAPP_CONFIG into the client bundle.
export const caspianFirebaseConfig = readFirebaseConfigFromEnv();

export function CaspianNextLink({ href, children, className, style, onClick, target, rel, 'aria-label': al }: CaspianLinkProps) {
  return (
    <Link href={href as any} className={className} style={style} onClick={onClick} target={target} rel={rel} aria-label={al}>
      {children}
    </Link>
  );
}

export function CaspianNextImage({ src, alt, width, height, fill, priority, className, sizes }: CaspianImageProps) {
  if (fill) {
    return <Image src={src} alt={alt} fill priority={priority} className={className} sizes={sizes} />;
  }
  return (
    <Image
      src={src}
      alt={alt}
      width={width ?? 600}
      height={height ?? 400}
      priority={priority}
      className={className}
      sizes={sizes}
    />
  );
}

export function useCaspianNextNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  return {
    pathname: pathname ?? '/',
    searchParams: new URLSearchParams(searchParams?.toString() ?? ''),
    push: (href: string) => router.push(href as any),
    replace: (href: string) => router.replace(href as any),
    back: () => router.back(),
  };
}
`);

// ---- src/app/providers.tsx ----
write('src/app/providers.tsx', `'use client';

import type { ReactNode } from 'react';
import { CaspianStoreProvider } from '@caspian-explorer/script-caspian-store';
import { describeFirebaseConfigSource } from '@caspian-explorer/script-caspian-store/firebase';
import {
  CaspianNextLink,
  CaspianNextImage,
  useCaspianNextNavigation,
  caspianFirebaseConfig,
} from '@/lib/caspian-adapters';

// Preflight: if a required Firebase config field is missing, throw a clear
// error rather than rendering a blank storefront and crashing later inside
// Firebase auth/cart hydration. The library's initCaspianFirebase will also
// throw with this same shape, but checking here surfaces the failure before
// the provider tree mounts so the source is the literal '@/lib/caspian-adapters'.
const REQUIRED: Array<keyof typeof caspianFirebaseConfig> = [
  'apiKey',
  'authDomain',
  'projectId',
  'appId',
];
const missing = REQUIRED.filter((k) => !caspianFirebaseConfig[k]);
if (missing.length > 0) {
  throw new Error(
    'Caspian Store: Firebase config missing field(s): ' +
      missing.join(', ') +
      '. Source detected: ' +
      describeFirebaseConfigSource() +
      '. Local dev: copy .env.example to .env.local and fill values from ' +
      'Firebase Console → Project settings → Your apps → Web app config. ' +
      'App Hosting: backends created via the Firebase Console auto-inject ' +
      'FIREBASE_WEBAPP_CONFIG — confirm next.config.mjs forwards it through ' +
      "the env: { FIREBASE_WEBAPP_CONFIG: process.env.FIREBASE_WEBAPP_CONFIG } block. " +
      'Vercel: set the six NEXT_PUBLIC_FIREBASE_* vars in Project Settings.',
  );
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <CaspianStoreProvider
      firebaseConfig={caspianFirebaseConfig}
      adapters={{
        Link: CaspianNextLink,
        Image: CaspianNextImage,
        useNavigation: useCaspianNextNavigation,
      }}
    >
      {children}
    </CaspianStoreProvider>
  );
}
`);

// ---- src/app/layout.tsx ----
//
// LayoutShell is NOT mounted here — CaspianRoot owns the shell for every
// storefront path ([src/components/caspian-root.tsx] line 126). Wrapping
// {children} in <LayoutShell> at the root layout double-wraps every page,
// producing two stacked headers and two stacked footers (v7.0.2 fix).
write('src/app/layout.tsx', `import type { ReactNode } from 'react';
import { DynamicFavicon } from '@caspian-explorer/script-caspian-store';
import '@caspian-explorer/script-caspian-store/styles.css';
import { Providers } from './providers';

export const metadata = {
  title: 'Store',
  description: 'A Caspian Store.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          {children}
          <DynamicFavicon />
        </Providers>
      </body>
    </html>
  );
}
`);


// Shared source for both service workers and both offline pages. Templated
// rather than duplicated so the two workers cannot drift apart.
//
// The cache-key PREFIX matters: two workers share one CacheStorage per origin,
// and a cleanup that deletes "every key that is not mine" would have the
// storefront worker wipe the register's shell out from under a live till.
const SW_SOURCE = `/* Caspian service worker — scope __SCOPE__ */
const PREFIX = '__PREFIX__';
const CACHE = PREFIX + '-v1';
const OFFLINE_URL = '__OFFLINE__';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll([OFFLINE_URL])));
  // Deliberately NO skipWaiting(): a new worker must never take over a page
  // that is in the middle of a sale. The page offers the update instead.
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      // Only ever delete OUR OWN old versions.
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'caspian-pos-skip-waiting') {
    self.skipWaiting();
    return;
  }
  // The page tells the worker what it is actually made of, so there is no
  // build-time asset manifest to keep in sync with the bundler.
  if (data.type === 'caspian-pos-precache' && Array.isArray(data.assets)) {
    event.waitUntil(
      caches.open(CACHE).then((cache) =>
        Promise.all(data.assets.map((url) => cache.add(url).catch(() => undefined))),
      ),
    );
  }
});

function isBypassed(url) {
  if (url.origin !== self.location.origin) return true; // Firestore, Google APIs, CDNs
  if (url.pathname.startsWith('/api/')) return true;
  if (url.pathname.endsWith('.webmanifest')) return true;
  if (url.pathname.startsWith('/icon/')) return true;
  return false;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (isBypassed(url)) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(request).then((hit) => hit || caches.match(OFFLINE_URL)),
      ),
    );
    return;
  }

  if (url.pathname.startsWith('/_next/static/') || request.destination === 'font' || request.destination === 'style' || request.destination === 'script') {
    event.respondWith(
      caches.open(CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          const network = fetch(request)
            .then((res) => {
              if (res && res.status === 200) cache.put(request, res.clone());
              return res;
            })
            .catch(() => cached);
          return cached || network;
        }),
      ),
    );
  }
});
`;

const OFFLINE_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>__TITLE__</title>
<style>
  body { margin:0; min-height:100dvh; display:grid; place-items:center; padding:24px;
         font:15px/1.6 system-ui,-apple-system,Segoe UI,Roboto,sans-serif; color:#18181b; background:#fff; }
  .box { max-width:420px; text-align:center; }
  h1 { font-size:20px; margin:0 0 8px; }
  p { color:#62626b; margin:0; }
  @media (prefers-color-scheme: dark) { body { background:#0b0b0d; color:#f4f4f5; } p { color:#a1a1aa; } }
</style>
</head>
<body><div class="box"><h1>__TITLE__</h1><p>__BODY__</p></div></body>
</html>
`;

// ---- Single-mount CaspianRoot (v7.0.0) ----
//
// One file owns every library URL — storefront, account, auth, content,
// admin, admin-preview, setup. New library pages land as internal cases
// in the library's dispatcher and reach consumers without a scaffolder or
// consumer code change. This is the contract v7 introduced.
//
// Server-side API routes (/api/**) are NOT client pages, so they stay as
// their own `route.ts` files below. The root layout + providers also stay
// consumer-owned so Firebase config + adapters don't disappear into the
// library.
write('src/app/[[...slug]]/page.tsx', `'use client';
import { CaspianRoot } from '@caspian-explorer/script-caspian-store';
export default function Page() { return <CaspianRoot />; }
`);

// ---- PWA: two installable apps on one origin (v10.3.0) ----
//
// The storefront installs at scope '/', the register at scope '/pos'. They are
// separate apps on purpose: a cashier's till should launch straight into the
// register, not into the shop with the register two taps away.
//
// The register needs a REAL route segment rather than the root catch-all,
// because <link rel="manifest"> has to be correct on a cold load of /pos. The
// catch-all is a client component dispatching on pathname, so the earliest it
// could swap the manifest is a post-hydration effect — which loses the race
// against the browser's own installability check, and has no equivalent at all
// on iOS.
write('src/app/_pwa-brand.ts', `/**
 * Brand values for both web manifests.
 *
 * Read from env rather than Firestore: a manifest route runs on the server with
 * no user session, so a Firestore read would need admin credentials and could
 * fail at request time. A manifest is near-static, and a wrong colour is a much
 * smaller problem than a route that 500s and makes the app uninstallable.
 */
/**
 * dotenv treats an unquoted # as the start of a comment, so a .env line reading
 * NEXT_PUBLIC_BRAND_THEME_COLOR=#1d4ed8 arrives here as an empty string and the
 * manifest silently falls back to the default colour. Accept a bare hex too
 * rather than making every consumer discover that the hard way.
 */
function hex(value: string | undefined, fallback: string): string {
  const raw = (value || '').trim();
  if (!raw) return fallback;
  if (raw.startsWith('#')) return raw;
  return /^[0-9a-fA-F]{3,8}$/.test(raw) ? '#' + raw : fallback;
}

export const PWA_BRAND = {
  name: process.env.NEXT_PUBLIC_BRAND_NAME || 'Store',
  themeColor: hex(process.env.NEXT_PUBLIC_BRAND_THEME_COLOR, '#111111'),
  backgroundColor: hex(process.env.NEXT_PUBLIC_BRAND_BACKGROUND_COLOR, '#ffffff'),
};
`);

write('src/app/manifest.webmanifest/route.ts', `import { buildWebManifest } from '@caspian-explorer/script-caspian-store/pwa';
import { PWA_BRAND } from '../_pwa-brand';

export const dynamic = 'force-static';

export function GET() {
  const manifest = buildWebManifest({
    name: PWA_BRAND.name,
    themeColor: PWA_BRAND.themeColor,
    backgroundColor: PWA_BRAND.backgroundColor,
  });
  return new Response(JSON.stringify(manifest), {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
`);

write('src/app/pos.webmanifest/route.ts', `import { buildPosWebManifest } from '@caspian-explorer/script-caspian-store/pwa';
import { PWA_BRAND } from '../_pwa-brand';

export const dynamic = 'force-static';

export function GET() {
  const manifest = buildPosWebManifest({
    name: PWA_BRAND.name,
    themeColor: PWA_BRAND.themeColor,
    backgroundColor: PWA_BRAND.backgroundColor,
  });
  return new Response(JSON.stringify(manifest), {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
`);

write('src/app/icon/[size]/route.tsx', `import { ImageResponse } from 'next/og';
import { PWA_BRAND } from '../../_pwa-brand';

export const dynamic = 'force-static';

export function generateStaticParams() {
  return [{ size: '192' }, { size: '512' }];
}

/**
 * Manifest icons, generated rather than shipped as binaries: the scaffolder
 * cannot author a PNG, and an install prompt will not appear without one.
 * Replace this route with real artwork before going live.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ size: string }> },
) {
  const { size: raw } = await params;
  const size = raw === '512' ? 512 : 192;
  const letter = (PWA_BRAND.name.trim()[0] || 'S').toUpperCase();
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: PWA_BRAND.themeColor,
          color: '#ffffff',
          fontSize: Math.round(size * 0.56),
          fontWeight: 700,
        }}
      >
        {letter}
      </div>
    ),
    { width: size, height: size },
  );
}
`);

// The register's own route segment. The layout is a server component purely so
// it can declare the register manifest; the page below it is the same one-line
// client mount as the root catch-all.
write('src/app/pos/layout.tsx', `import type { ReactNode } from 'react';

export const metadata = {
  title: 'Register',
  manifest: '/pos.webmanifest',
  appleWebApp: { capable: true, title: 'Register', statusBarStyle: 'default' as const },
};

export const viewport = {
  themeColor: '#111111',
  // A till is a fixed-purpose screen; a stray pinch-zoom mid-sale is a nuisance.
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function PosLayout({ children }: { children: ReactNode }) {
  return children;
}
`);

write('src/app/pos/[[...slug]]/page.tsx', `'use client';
import { CaspianRoot } from '@caspian-explorer/script-caspian-store';
export default function Page() { return <CaspianRoot />; }
`);

write('public/offline.html', OFFLINE_HTML.replace(/__TITLE__/g, 'You are offline').replace(/__BODY__/g, 'This page needs an internet connection. It will load once you are back online.'));
write('public/pos-offline.html', OFFLINE_HTML.replace(/__TITLE__/g, 'Register is offline').replace(/__BODY__/g, 'The till has lost its internet connection. Sales cannot be completed until it returns.'));

write('public/sw.js', SW_SOURCE.replace(/__PREFIX__/g, 'caspian-shell').replace(/__OFFLINE__/g, '/offline.html').replace(/__SCOPE__/g, '/'));
write('public/sw-pos.js', SW_SOURCE.replace(/__PREFIX__/g, 'caspian-pos-shell').replace(/__OFFLINE__/g, '/pos-offline.html').replace(/__SCOPE__/g, '/pos'));

write('src/app/api/setup/write-env/route.ts', `import { NextResponse } from 'next/server';
import { writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';

// Dev-only. Refuses to run in production so a deployed site can't overwrite
// its own env vars from a browser. Next.js also makes the filesystem
// effectively read-only on most hosts (Vercel, App Hosting), so this route
// would fail there anyway — the explicit guard returns a cleaner 403.
export async function POST(request: Request) {
  if (process.env.NODE_ENV !== 'development') {
    return new NextResponse('setup/init is dev-only', { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return new NextResponse('invalid body', { status: 400 });
  }

  const required = [
    'apiKey',
    'authDomain',
    'projectId',
    'storageBucket',
    'messagingSenderId',
    'appId',
  ] as const;
  for (const key of required) {
    if (!body[key] || typeof body[key] !== 'string') {
      return new NextResponse(\`missing \${key}\`, { status: 400 });
    }
  }

  const envPath = path.join(process.cwd(), '.env.local');
  let existing = '';
  try {
    existing = await readFile(envPath, 'utf8');
  } catch {
    // File absent — we create it below.
  }

  const lines: Record<string, string> = {
    NEXT_PUBLIC_FIREBASE_API_KEY: body.apiKey,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: body.authDomain,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: body.projectId,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: body.storageBucket,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: body.messagingSenderId,
    NEXT_PUBLIC_FIREBASE_APP_ID: body.appId,
  };

  const preserved = existing
    .split('\\n')
    .filter((line) => {
      const key = line.split('=')[0]?.trim();
      return key && !(key in lines);
    });

  const next = [
    ...preserved,
    ...Object.entries(lines).map(([k, v]) => \`\${k}=\${v}\`),
  ]
    .join('\\n')
    .replace(/\\n{3,}/g, '\\n\\n');

  await writeFile(envPath, next + '\\n', 'utf8');
  return NextResponse.json({ ok: true });
}
`);

// ---- Caspian self-update API route (v2.4.0+) ----
// Runs `npm install github:CaspianTools/script-caspian-store#v<version>`
// on the host when an admin clicks "Update to vX.Y.Z" in /admin/about.
// Verifies the caller is an admin via Firebase Admin SDK ID-token check,
// validates the version string, spawns npm, and on success schedules
// process.exit(0) so a process manager (or Next.js dev-server) restarts
// the Node process with the new dependency loaded. Production requires an
// explicit CASPIAN_ALLOW_SELF_UPDATE=true env var so self-update can't be
// turned on accidentally. Serverless platforms with read-only filesystems
// (Vercel, stock App Hosting) will get a clean EROFS error back.
// v7.4.0+ — the route's body lives in the library, so future fixes to
// projectId resolution / npm-spawn quoting / credential handling land via
// `npm install` instead of asking consumers to re-scaffold or hand-edit.
// Everything below is just the Next.js bindings (runtime + dynamic +
// maxDuration + the POST export).
write('src/app/api/caspian-store/update/route.ts', `import { caspianHandleSelfUpdate } from '@caspian-explorer/script-caspian-store/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: Request) {
  return caspianHandleSelfUpdate(req);
}
`);

// ---- Firebase config ----
// Copy the real rule files from the package's own firebase/ tree, so the user
// can `firebase deploy --only firestore:rules,firestore:indexes,storage`
// immediately after scaffolding. Previously these were comment-only stubs,
// which meant a user who ran `firebase deploy` before reading the file would
// deploy an empty rules file and lock the database down.
write('firestore.rules', readFileSync(join(sourceFirebaseDir, 'firestore.rules'), 'utf8'));
write('firestore.indexes.json', readFileSync(join(sourceFirebaseDir, 'firestore.indexes.json'), 'utf8'));
write('storage.rules', readFileSync(join(sourceFirebaseDir, 'storage.rules'), 'utf8'));

// Functions codebase split: caspian-admin is always scaffolded — it contains
// only the `onUserCreate` auto-promote trigger, `claimAdmin`, and the
// scheduled retention cleanup. No provider deps, no secrets, deployable
// without any `functions:secrets:set` step.
//
//   - caspian-stripe (v1.16.0+) — checkout + webhook + session lookup.
//     Requires STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET; opt in with --with-stripe.
//   - caspian-email (v2.14.0+) — transactional order + contact-form emails
//     + sendTestEmail callable. Reads the configured provider (SendGrid or
//     Brevo) from Firestore at runtime, so no secrets are declared at deploy
//     time. Opt in with --with-email.
//
// Pre-split behaviour (single `caspian-store` codebase; then v2.11's
// SENDGRID_API_KEY leak into functions-admin) forced installs to pre-configure
// provider secrets before deploying any function, even the admin trigger.
// Splitting lets a non-Stripe, non-email install deploy onUserCreate
// immediately, closing the admin-bootstrap chicken-and-egg loop.
const firebaseConfig = {
  firestore: {
    rules: 'firestore.rules',
    indexes: 'firestore.indexes.json',
  },
  storage: { rules: 'storage.rules' },
  functions: [
    {
      source: 'functions-admin',
      codebase: 'caspian-admin',
      runtime: 'nodejs22',
      predeploy: ['npm --prefix "$RESOURCE_DIR" run build'],
    },
  ],
};
if (includeEmail) {
  firebaseConfig.functions.push({
    source: 'functions-email',
    codebase: 'caspian-email',
    runtime: 'nodejs22',
    predeploy: ['npm --prefix "$RESOURCE_DIR" run build'],
  });
}
if (includeStripe) {
  firebaseConfig.functions.push({
    source: 'functions-stripe',
    codebase: 'caspian-stripe',
    runtime: 'nodejs22',
    predeploy: ['npm --prefix "$RESOURCE_DIR" run build'],
  });
}
if (includeInstagram) {
  firebaseConfig.functions.push({
    source: 'functions-instagram',
    codebase: 'caspian-instagram',
    runtime: 'nodejs22',
    predeploy: ['npm --prefix "$RESOURCE_DIR" run build'],
  });
}
if (includePos) {
  firebaseConfig.functions.push({
    source: 'functions-pos',
    codebase: 'caspian-pos',
    runtime: 'nodejs22',
    predeploy: ['npm --prefix "$RESOURCE_DIR" run build'],
  });
}
write('firebase.json', JSON.stringify(firebaseConfig, null, 2) + '\n');

// Always copy functions-admin; copy the other four codebases only on opt-in.
// Per-codebase .gitignore is written inline here (not relied on from cpSync):
// npm silently consumes `.gitignore` files in the tarball as ignore rules and
// does NOT ship them as regular files, so the ones that live in the package's
// firebase/functions-*/.gitignore won't survive `npm install`. Writing them
// from the scaffolder guarantees they land in the consumer's project.
cpSync(join(sourceFirebaseDir, 'functions-admin'), join(root, 'functions-admin'), { recursive: true });
write('functions-admin/.gitignore', 'node_modules\nlib/\n');
if (includeEmail) {
  cpSync(join(sourceFirebaseDir, 'functions-email'), join(root, 'functions-email'), { recursive: true });
  write('functions-email/.gitignore', 'node_modules\nlib/\n');
}
if (includeStripe) {
  cpSync(join(sourceFirebaseDir, 'functions-stripe'), join(root, 'functions-stripe'), { recursive: true });
  write('functions-stripe/.gitignore', 'node_modules\nlib/\n');
}
if (includeInstagram) {
  cpSync(join(sourceFirebaseDir, 'functions-instagram'), join(root, 'functions-instagram'), { recursive: true });
  write('functions-instagram/.gitignore', 'node_modules\nlib/\n');
}
if (includePos) {
  cpSync(join(sourceFirebaseDir, 'functions-pos'), join(root, 'functions-pos'), { recursive: true });
  write('functions-pos/.gitignore', 'node_modules\nlib/\n');
}

// ---- apphosting.yaml ----
// Firebase App Hosting is Firebase's current Next.js-native deploy target
// (git-based, Cloud Build -> Cloud Run). NEXT_PUBLIC_* vars must be available
// at BUILD time for Next.js to inline them into the client bundle; hence
// availability: [BUILD, RUNTIME]. Values left blank by design — consumers fill
// them via the Firebase console or `firebase apphosting:secrets:set` (for the
// sensitive ones). Emitted by default: harmless if the consumer deploys to
// Vercel instead, and keeps the "just deploy" path single-command for App
// Hosting users. Vercel-only consumers can suppress it with --no-apphosting.
if (!suppressApphosting) {
  write('apphosting.yaml', `# Firebase App Hosting config. Only read when deploying via Firebase App Hosting.
# Safe to delete if you deploy to Vercel or elsewhere.
#
# NEXT_PUBLIC_* vars must be inlined at build time, so availability must include BUILD.
# For sensitive values (none in this file by default), use Secret Manager + the
# \`secret: <name>\` form instead of \`value:\`.
runConfig:
  minInstances: 0
  maxInstances: 1
env:
  - variable: NEXT_PUBLIC_FIREBASE_API_KEY
    value: ""
    availability: [BUILD, RUNTIME]
  - variable: NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
    value: ""
    availability: [BUILD, RUNTIME]
  - variable: NEXT_PUBLIC_FIREBASE_PROJECT_ID
    value: ""
    availability: [BUILD, RUNTIME]
  - variable: NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    value: ""
    availability: [BUILD, RUNTIME]
  - variable: NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
    value: ""
    availability: [BUILD, RUNTIME]
  - variable: NEXT_PUBLIC_FIREBASE_APP_ID
    value: ""
    availability: [BUILD, RUNTIME]
`);
}

// ---- README ----
write('README.md', `# ${targetDir.split(/[\\/]/).pop()}

A storefront powered by [\`@caspian-explorer/script-caspian-store\`](https://github.com/CaspianTools/script-caspian-store) (pinned to \`${packageTag}\`).

## Getting started

\`\`\`bash
npm install
cp .env.example .env.local   # fill in Firebase config
npm run dev                  # http://localhost:3000
\`\`\`

## First-run checklist

> **Prefer a GUI?** Two wizard routes ship by default:
> - \`/setup/init\` — dev-only, unauth. Paste your Firebase web config; the wizard writes \`.env.local\` for you. Skip step 2 below if you use it.
> - \`/setup\` — admin-only, post-install. A 4-step wizard that walks you through brand / theme / features in one flow. Replaces steps 7–8 below once Firebase is connected and you're signed in as admin.

1. **Create a Firebase project** at <https://console.firebase.google.com>. Enable Authentication (Email/Password + Google), Firestore, Functions, Storage.
2. **Populate \`.env.local\`** with the web config object from Project settings → Your apps. *(Or run \`npm run dev\` and open \`/setup/init\` — paste the config there and the form writes \`.env.local\` for you, then restart dev.)*
3. **Deploy Firestore rules + indexes + Storage rules** (the scaffolder already dropped \`firestore.rules\`, \`firestore.indexes.json\`, and \`storage.rules\` alongside this README):
   \`\`\`bash
   firebase deploy --only firestore:rules,firestore:indexes,storage
   \`\`\`
4. **Deploy Cloud Functions.**
   \`\`\`bash
   cd functions-admin && npm install && cd ..
   npm run deploy:admin
   \`\`\`
   This deploys the \`onUserCreate\` auto-promote trigger (no secrets needed). **Do this before anyone registers** or auto-promote can't retroactively fire on an already-created user doc.

   The \`deploy:admin\` script wraps \`firebase deploy\` with two first-deploy smoothings: it auto-retries once if the Eventarc Service Agent hasn't finished propagating (the most common first-deploy failure), and it runs \`firebase functions:artifacts:setpolicy\` afterwards so you don't see \`Error: could not set up cleanup policy\` on your first deploy. That \`Error:\` is about old container-image retention in Artifact Registry, not your Function code — harmless either way.

   If you also scaffolded with \`--with-stripe\`, deploy the Stripe codebase separately once you have your keys:
   \`\`\`bash
   cd functions-stripe && npm install && cd ..
   firebase functions:secrets:set STRIPE_SECRET_KEY      # paste sk_test_... or sk_live_...
   firebase functions:secrets:set STRIPE_WEBHOOK_SECRET  # from Stripe dashboard → Webhooks
   npm run deploy:stripe
   \`\`\`

   Then go to \`/admin/plugins/payments\`, click **Browse providers → Install** on the Stripe card, paste your publishable (\`pk_...\`) key, save, and click **Enable**. The publishable key lives in Firestore under \`paymentPluginInstalls\`; only server-side secrets live in Cloud Functions secrets.

   If you also scaffolded with \`--with-email\`, deploy the email codebase. **No secrets to set** — the provider (SendGrid or Brevo) API key is stored in Firestore under \`emailPluginInstalls\` (admin-only read) and loaded by the dispatcher at runtime:
   \`\`\`bash
   cd functions-email && npm install && cd ..
   npm run deploy:email
   \`\`\`

   Then go to \`/admin/plugins/email-providers\`, click **Browse providers → Install** on SendGrid or Brevo, paste the API key, save, and click **Enable**. Order-lifecycle and contact-form emails will start firing the next time a shopper triggers one. Configure sender identity + templates at \`/admin/settings/emails\`.

   If you also scaffolded with \`--with-instagram\`, deploy the Instagram codebase — it lets store staff view the feed, moderate comments, **publish a product as a post**, and **delete posts** (the Meta app secret + token stay server-side). Set the Meta app credentials first, then deploy:
   \`\`\`bash
   cd functions-instagram && npm install && cd ..
   firebase functions:secrets:set META_APP_ID      # your Meta (Facebook) app id
   firebase functions:secrets:set META_APP_SECRET  # your Meta app secret
   npm run deploy:instagram
   \`\`\`
   Enable the **Cloud Scheduler** API (daily token refresh) and redeploy rules (\`firebase deploy --only firestore:rules\`) so the \`instagram/connection\` token doc stays server-only. Going live also needs a Meta app with **Facebook Login** + **Instagram** (loopback redirect \`http://127.0.0.1:47113/\`, the \`instagram_*\` + \`pages_*\` permissions, and **App Review**), and your IG as a **Professional** account linked to a **Facebook Page**. This package ships the Instagram Cloud Functions only -- there is no Instagram screen in the admin panel. Drive the \`linkInstagram\` OAuth exchange, and store the Meta **App ID**, from your own front end.
5. **Seed Firestore:**
   \`\`\`bash
   # After downloading a service-account JSON:
   npm run firebase:seed -- --project <projectId> --credentials ./service-account.json
   \`\`\`
6. **Grant yourself admin.** If you deployed \`caspian-admin\` in §4 *before* registering, the \`onUserCreate\` trigger auto-promotes the first-ever user — just sign up at \`/auth/register\`. If you registered before the deploy (or the auto-promote window has closed), use the CLI:
   \`\`\`bash
   npm run grant-admin -- --project <projectId> --credentials ./service-account.json --email you@example.com
   \`\`\`
   (If the auto-promote window has closed, this is the explicit path. The AdminGuard access-denied screen also shows your uid with a Copy button if you prefer \`--uid\`.)
7. **Configure your store.** Open \`/setup\` for the guided wizard (brand → theme → features → summary), or go straight to \`/admin/settings\` if you'd rather edit each section individually.
8. **Deploy the Next.js site.** Two supported hosts — pick one:

   **Vercel** (zero-config, native Next.js host):
   \`\`\`bash
   # Option A: push to GitHub, then import the repo at https://vercel.com/new
   # Option B: install the CLI and deploy directly:
   npx vercel@latest        # first run: links the project
   npx vercel@latest --prod # subsequent deploys
   \`\`\`
   After the first deploy, paste every variable from your local \`.env.local\` into **Project Settings → Environment Variables** in the Vercel dashboard, then redeploy. Firestore, Storage, and Cloud Functions stay on Firebase — Vercel only hosts the Next.js site.

   **Firebase App Hosting** (keeps everything on Firebase):
   \`\`\`bash
   firebase init apphosting       # creates a backend, links your GitHub repo
   firebase deploy --only apphosting
   \`\`\`
   Backends created via the Firebase Console auto-inject \`FIREBASE_WEBAPP_CONFIG\` (a JSON blob containing your full Firebase web config) at both build and runtime. The scaffolded \`next.config.mjs\` forwards it into the client bundle, and \`src/lib/caspian-adapters.tsx\` reads it via \`readFirebaseConfigFromEnv()\` — so App Hosting deploys work with **zero env-var setup** out of the box.

   The scaffolder also drops an \`apphosting.yaml\` with the six \`NEXT_PUBLIC_FIREBASE_*\` vars declared but empty as a fallback. They're consulted only when \`FIREBASE_WEBAPP_CONFIG\` is missing — useful if you want explicit control or are deploying to a non-Console-created backend. Fill them in **Firebase console → App Hosting → your backend → Environment variables**, or commit them to \`apphosting.yaml\`. For anything sensitive, use \`firebase apphosting:secrets:set <NAME>\` and switch the entry in \`apphosting.yaml\` from \`value:\` to \`secret: <NAME>\`.

   Either host works with the same Stripe webhook endpoint — the webhook points at a Cloud Function (\`https://<region>-<project-id>.cloudfunctions.net/stripeWebhook\`), not at your Next.js site, so you don't reconfigure it when switching hosts.

## Routes

### Storefront
- \`/\` — HomePage (hero + featured categories + trending)
- \`/product/[id]\` — product detail
- \`/collections\` — product list
- \`/cart\` — full-page cart (header has a drawer too)
- \`/checkout\`, \`/orders/success\` — Stripe Checkout flow
- \`/account\` — profile, addresses, orders, password, photo, danger zone
- \`/auth/login\`, \`/auth/register\`, \`/auth/forgot-password\`
- \`/about\`, \`/privacy\`, \`/terms\`, \`/sustainability\` — editable content pages
- \`/contact\` — public contact form; submissions land in \`/admin/users\`
- \`/journal\`, \`/journal/[id]\` — editorial
- \`/faqs\`, \`/shipping-returns\`, \`/size-guide\`

### Admin (requires \`users/{uid}.role === 'admin'\`)
- \`/admin\` — dashboard (includes collapsible Todo / Notifications / Search-terms sections)
- \`/admin/products\`, \`/admin/categories\`, \`/admin/collections\`, \`/admin/promo-codes\`
- \`/admin/users\`, \`/admin/subscribers\`
- \`/admin/orders\`, \`/admin/reviews\`
- \`/admin/pages\`, \`/admin/faqs\`, \`/admin/journal\`
- \`/admin/appearance\` — theme catalog grid (preview + activate)
- \`/admin-preview/appearance\` — dummy-data preview window (outside \`/admin\` so it escapes the admin shell)
- \`/admin/settings/general\` — brand / logo / favicon / social / privacy
- \`/admin/plugins/shipping\` — install / configure shipping providers
- \`/admin/plugins/payments\` — install / configure payment providers (Stripe, …)
- \`/admin/plugins/email-providers\` — install / configure email providers (SendGrid, Brevo)
- \`/admin/settings/emails\` — edit transactional email templates
- \`/admin/settings/languages\` — enable / disable locales
- \`/admin/about\` — library info + error-log triage surface

## Customizing

- **Theme, fonts, hero:** admin → Settings, or edit \`scriptSettings/site\` in Firestore.
- **Translations:** pass \`messagesByLocale\` to \`<CaspianStoreProvider>\` in \`src/app/providers.tsx\`.
- **Replace header/footer with your own:** wrap \`children\` in your own chrome and set \`<LayoutShell header={null} footer={null}>\`.

## Upgrade

Stop any running \`next dev\` first — swapping the package under a live dev server corrupts \`.next\` state and every route starts 500'ing with no obvious clue.

\`\`\`bash
# 1. Stop next dev (Ctrl+C).
# 2. Bump the dep:
npm install github:CaspianTools/script-caspian-store#vX.Y.Z
# 3. If the CHANGELOG for the target release mentions rule changes,
#    copy the updated rules and redeploy:
npm run firebase:sync              # copies updated rules/indexes from the library (v1.20.1+)
firebase deploy --only firestore:rules,firestore:indexes,storage
# 4. Clear the stale Next cache and restart:
rm -rf .next
npm run dev
\`\`\`

See [CHANGELOG](https://github.com/CaspianTools/script-caspian-store/blob/main/CHANGELOG.md) for release-specific notes.
`);

console.log(`[create-caspian-store] scaffolded ${targetDir}/ pinned to ${packageTag}`);
console.log('');
console.log('Next steps:');
console.log(`  cd ${targetDir}`);
console.log('  npm install');
console.log('  cp .env.example .env.local      # fill in Firebase config');
console.log('  npm run dev');
console.log('');
console.log('Then follow the first-run checklist in README.md.');
