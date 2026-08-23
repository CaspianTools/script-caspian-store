import { defineConfig, type Options } from 'tsup';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Sync `src/version.ts` with `package.json#version` so the library can export
// CASPIAN_STORE_VERSION (and the admin About page can compare installed vs
// latest on GitHub) without drifting. Runs on every tsup invocation — build,
// dev, and the `prepare` hook that fires on `npm install`.
const rootPkgVersion = JSON.parse(readFileSync('package.json', 'utf8')).version as string;
const versionFile = join('src', 'version.ts');
const versionContents =
  `// Auto-generated from package.json by tsup.config.ts. Do not edit.\n` +
  `export const CASPIAN_STORE_VERSION = '${rootPkgVersion}';\n`;
const existing = (() => {
  try {
    return readFileSync(versionFile, 'utf8');
  } catch {
    return '';
  }
})();
if (existing !== versionContents) {
  writeFileSync(versionFile, versionContents);
}

// Generate the deployable rules/indexes constants straight from the files
// consumers actually deploy, so the two can never diverge.
//
// This replaces a byte-for-byte *guard* that only covered storage.rules. The
// Firestore side had no guard, and by v9.26.1 `CASPIAN_FIRESTORE_RULES` had
// silently drifted 181 lines behind `firebase/firestore.rules` — missing
// taxonomyTerms, emailPluginInstalls, instagram, the entire page builder,
// contacts, searchTerms, errorLogs, adminTodos and pendingSuperAdmin. README
// tells consumers to deploy from that export, so anyone who followed it had
// rules that denied the setup wizard and half the admin panel.
//
// Generating removes the failure mode rather than detecting one instance of
// it, and JSON.stringify does the escaping that the old hand-maintained
// template literal (with its \\ / \` / \$ dance) got wrong. Output is
// committed — same as src/version.ts — so `tsc --noEmit` needs no prior build.
function writeIfChanged(file: string, contents: string): void {
  const current = (() => {
    try {
      return readFileSync(file, 'utf8');
    } catch {
      return '';
    }
  })();
  if (current !== contents) writeFileSync(file, contents);
}

const GENERATED_BANNER =
  '// Auto-generated from the files under firebase/ by tsup.config.ts. Do not edit.\n' +
  '// Edit firebase/firestore.rules, firebase/storage.rules, or\n' +
  '// firebase/firestore.indexes.json instead, then run `npm run build`.\n';

writeIfChanged(
  join('src', 'firebase', 'rules.generated.ts'),
  GENERATED_BANNER +
    `\nexport const CASPIAN_FIRESTORE_RULES = ${JSON.stringify(
      readFileSync(join('firebase', 'firestore.rules'), 'utf8'),
    )};\n` +
    `\nexport const CASPIAN_STORAGE_RULES = ${JSON.stringify(
      readFileSync(join('firebase', 'storage.rules'), 'utf8'),
    )};\n`,
);

writeIfChanged(
  join('src', 'firebase', 'indexes.generated.ts'),
  GENERATED_BANNER +
    `\nimport type { CaspianFirestoreIndexes } from './indexes-types';\n` +
    `\nexport const CASPIAN_FIRESTORE_INDEXES: CaspianFirestoreIndexes = ${JSON.stringify(
      JSON.parse(readFileSync(join('firebase', 'firestore.indexes.json'), 'utf8')),
      null,
      2,
    )};\n`,
);


// All three entries (`.`, `./firebase`, `./server`) ship from a single tsup
// config block. Earlier versions split them into three blocks, which made
// `clean: true` on the main entry race against the sibling entries' DTS
// writes — `dist/firebase/index.d.ts` and `dist/server/index.d.ts` would be
// produced and then wiped before the build settled. Consolidating fixes that:
// one clean, one DTS pass, one set of externals.
//
// The server entry assumes a Node runtime (firebase-admin, node:child_process),
// so those modules are externalised globally. They're harmless for the main
// and firebase entries because neither imports them.
function prependUseClient(format: 'esm' | 'cjs') {
  const ext = format === 'esm' ? 'mjs' : 'js';
  const file = join('dist', `index.${ext}`);
  const contents = readFileSync(file, 'utf8');
  if (!contents.startsWith("'use client'") && !contents.startsWith('"use client"')) {
    writeFileSync(file, `'use client';\n${contents}`);
  }
}

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'firebase/index': 'src/firebase/index.ts',
    'server/index': 'src/server/index.ts',
    'pwa/index': 'src/pwa/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  target: 'es2020',
  external: [
    'react',
    'react-dom',
    'firebase',
    'firebase/app',
    'firebase/auth',
    'firebase/firestore',
    'firebase/storage',
    'firebase/functions',
    'firebase-admin',
    'firebase-admin/app',
    'firebase-admin/auth',
    'node:child_process',
  ],
  // Prepend a raw `'use client';` to the main-entry bundles only. esbuild's
  // `banner` strips module-level directives during bundling ("Module level
  // directives cause errors when bundled"), so we patch post-write.
  // Only the main entry is client-only: `./firebase`, `./server` and
  // `./pwa` are callable from Node (deploy scripts, Cloud Functions,
  // route.ts handlers).
  async onSuccess() {
    prependUseClient('esm');
    prependUseClient('cjs');
  },
} satisfies Options);
