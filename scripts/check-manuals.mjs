#!/usr/bin/env node
// Drift guard for the two files in docs/.
//
// The manual is a hand-maintained single HTML file with no build step. That is
// deliberate — the shell has changed twice in its life while the content changes
// every release, so a build step would tax the frequent operation to protect
// against the rare one.
//
// It catches, in order of how much damage each one does:
//   A  the shared shell drifting — see the note on SHELL_SHA256 below
//   B  the picker's design tokens drifting from the manual's
//   C5 a translation overlay going stale — the failure that renders confidently
//      and wrongly, hiding newly-added English text with no warning at all
//   C4 the footer version string rotting (it sat at v10.0.0 through two releases)
//   C7 the install examples in README/INSTALL pinning a version three majors old
//   C3 a part icon with no <symbol> — how v10.0.1 shipped every icon clipped
//
// What it does NOT check, and cannot: whether the prose still describes the
// screen. Only opening the component does that. See the manual rules in
// CLAUDE.md — this script guards shape, never truth.
//
// Usage: node scripts/check-manuals.mjs
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = join(ROOT, 'docs');
const MANUAL = 'user-manual.html';
const ALL = ['index.html', MANUAL];
const LOCALES = ['az', 'ru', 'tr'];

// The shell — everything outside the DOC:HEAD, DOC and MANUAL fences, TOKENS
// included — is shared verbatim with docs/pos-manual.html, which now lives in
// the standalone till's own repo (CaspianTools/caspian-pos).
//
// While both manuals lived here this was checked by comparing the two files to
// each other, which is strictly better than a hash because it needs no upkeep
// and cannot go stale. v15.0.0 took that away: there is one manual in this repo
// now, so there is nothing to compare against.
//
// This is the replacement, and it is weaker on purpose rather than by accident.
// It cannot prove the two shells match — only that THIS one is what was last
// blessed. Copying a shell change between the repos is a human step; this
// catches the accidental half, where the shell is edited without anyone meaning
// to change it.
//
// When you deliberately change the shell: change it in one repo, copy it to the
// other verbatim, then update this constant in BOTH repos to the new hash the
// failure message prints. If the two repos ever hold different hashes, the
// shells have diverged.
//
// The hash is taken over CRLF-normalised text, so it holds on a Linux runner as
// well as on Windows.
const SHELL_SHA256 = '00cd14b66e9793646361120205e7a344d9950b35d712ce8c93f741d2475d5640';

const errors = [];
const fail = (msg) => errors.push(msg);

// --------------------------------------------------------------- load
for (const f of ALL) {
  if (!existsSync(join(DOCS, f))) fail(`docs/${f} is missing.`);
}
if (errors.length) {
  for (const e of errors) console.error('  ✗ ' + e);
  process.exit(1);
}

const text = Object.fromEntries(ALL.map((f) => [f, readFileSync(join(DOCS, f), 'utf8')]));
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));

const FENCES = [
  ['DOC:HEAD', /<!-- DOC:HEAD:START[\s\S]*?<!-- DOC:HEAD:END -->/g],
  ['DOC', /\/\* DOC:START[\s\S]*?\/\* DOC:END \*\//g],
  ['MANUAL', /\/\* MANUAL:START[\s\S]*?\/\* MANUAL:END \*\//g],
  ['TOKENS', /\/\* TOKENS:START[\s\S]*?\/\* TOKENS:END \*\//g],
];

function fenceOnce(file, name, re) {
  const hits = text[file].match(new RegExp(re.source, 'g')) || [];
  if (hits.length !== 1) {
    fail(`docs/${file}: expected exactly 1 ${name} fence, found ${hits.length}.`);
    return null;
  }
  return hits[0];
}

// --------------------------------------------------------------- A. shell hash
let shellLines = 0;
{
  let s = text[MANUAL];
  let ok = true;
  for (const [name, re] of FENCES) {
    if (name === 'TOKENS') continue; // tokens are part of the shared shell
    if (fenceOnce(MANUAL, name, re) === null) {
      ok = false;
      continue;
    }
    s = s.replace(new RegExp(re.source), '');
  }
  if (ok) {
    shellLines = s.split('\n').length;
    const got = createHash('sha256').update(s.replace(/\r\n/g, '\n'), 'utf8').digest('hex');
    if (got !== SHELL_SHA256) {
      fail(
        `The shared shell has changed (${shellLines} lines).\n` +
          `      expected ${SHELL_SHA256}\n` +
          `      got      ${got}\n` +
          `      If this was deliberate: copy the shell to docs/pos-manual.html in the\n` +
          `      caspian-pos repo verbatim, then set SHELL_SHA256 to the "got" value in\n` +
          `      BOTH repos' scripts/check-manuals.mjs. If it was not deliberate, revert it.`,
      );
    }
  }
}

// --------------------------------------------------------------- B. token equality
const tokens = {};
for (const f of ALL) tokens[f] = fenceOnce(f, 'TOKENS', FENCES[3][1]);
for (const f of ALL.slice(1)) {
  if (tokens[f] && tokens[ALL[0]] && tokens[f] !== tokens[ALL[0]]) {
    fail(`docs/${f}: the TOKENS block differs from docs/${ALL[0]}. Copy it across verbatim.`);
  }
}

// --------------------------------------------------------------- C. data checks
function parseManual(file) {
  const block = fenceOnce(file, 'MANUAL', FENCES[2][1]);
  if (!block) return null;
  const open = block.indexOf('{');
  const close = block.lastIndexOf('};');
  try {
    return JSON.parse(block.slice(open, close + 1));
  } catch (e) {
    fail(`docs/${file}: the MANUAL block does not parse as JSON — ${e.message}`);
    return null;
  }
}

const M = parseManual(MANUAL);
if (M) {
  const en = M.en;
  if (!en) fail(`docs/${MANUAL}: MANUAL.en is missing.`);

  if (en) {
    const symbols = new Set([...text[MANUAL].matchAll(/<symbol id="([^"]+)"/g)].map((m) => m[1]));
    for (const [, id, attrs] of text[MANUAL].matchAll(/<symbol id="([^"]+)"([^>]*)>/g)) {
      if (!/viewBox=/.test(attrs)) {
        fail(`docs/${MANUAL}: <symbol id="${id}"> has no viewBox — it will render cropped, not scaled.`);
      }
    }

    const partIds = new Set();
    const sectionIds = new Set();
    for (const p of en.parts || []) {
      if (partIds.has(p.id)) fail(`docs/${MANUAL}: duplicate part id "${p.id}".`);
      partIds.add(p.id);
      if (!(p.sections || []).length) {
        fail(`docs/${MANUAL}: part "${p.id}" has no sections — its intro card would link to #undefined.`);
      }
      if (p.icon && !symbols.has(p.icon)) {
        fail(`docs/${MANUAL}: part "${p.id}" uses icon "${p.icon}" but no matching <symbol> is defined.`);
      }
      for (const s of p.sections || []) {
        if (sectionIds.has(s.id)) fail(`docs/${MANUAL}: duplicate section id "${s.id}".`);
        sectionIds.add(s.id);
        if (!s.title || !s.summary) {
          fail(`docs/${MANUAL}: section "${s.id}" is missing a title or summary.`);
        }
      }
    }

    // C4 — the footer stamp, in English and in all three overlays. Only the
    // English one was ever checked, and the other three rot exactly the same
    // way: an az reader was told "v10.0.0" long after en said otherwise.
    const want = 'v' + pkg.version;
    for (const lang of ['en', ...LOCALES]) {
      const intro = M[lang]?.intro;
      if (!intro) continue;
      if (intro.version !== want) {
        fail(
          `docs/${MANUAL}: MANUAL.${lang}.intro.version is ${JSON.stringify(intro.version)}, expected ` +
            `"${want}" to match package.json. Bump all four stamps alongside the version.`,
        );
      }
    }

    // C5 — overlay integrity. A stale overlay renders as authoritative; an
    // absent one renders with the "not translated yet" notice. Only the second
    // is safe.
    const enParts = new Map((en.parts || []).map((p) => [p.id, p]));
    for (const lang of LOCALES) {
      const over = M[lang];
      if (!over) continue;
      for (const tp of over.parts || []) {
        const bp = enParts.get(tp.id);
        if (!bp) {
          fail(`docs/${MANUAL}: ${lang} overlay has part "${tp.id}", which does not exist in English — its translations are dead.`);
          continue;
        }
        const bSections = new Map((bp.sections || []).map((s) => [s.id, s]));
        for (const ts of tp.sections || []) {
          const bs = bSections.get(ts.id);
          if (!bs) {
            fail(`docs/${MANUAL}: ${lang} section "${ts.id}" is not under English part "${tp.id}" — its translation is dead.`);
            continue;
          }
          for (const key of ['steps', 'fields', 'notes']) {
            const bn = (bs[key] || []).length;
            const tn = (ts[key] || []).length;
            if (bn !== tn) {
              fail(
                `docs/${MANUAL}: ${lang} section "${ts.id}" has ${tn} ${key} but English has ${bn}. ` +
                  `Re-translate it, or delete the overlay section so the fallback notice shows. ` +
                  `A stale overlay hides the new English text with no warning.`,
              );
            }
          }
          if (!ts.summary) fail(`docs/${MANUAL}: ${lang} section "${ts.id}" is present but has no summary.`);
        }
      }
    }
  }
}

// ------------------------------------------------- C7. install-example versions
// Same rot as C4, different file. README told people to install v8.0.0 while the
// package was on v10.3.1. Only the two examples that claim to be CURRENT are
// checked -- historical migration notes legitimately name old versions.
{
  const want = pkg.version;
  const checks = [
    ['README.md', `script-caspian-store#v${want} firebase`],
    ['INSTALL.md', `# v${want} is the current release.`],
  ];
  for (const [file, needle] of checks) {
    const full = join(ROOT, file);
    if (!existsSync(full)) continue;
    if (!readFileSync(full, 'utf8').includes(needle)) {
      fail(
        `${file}: no install example pinning the current version. Expected to find ` +
          `${JSON.stringify(needle)}. Bump it alongside package.json (Pre-Commit Checklist step 5).`,
      );
    }
  }
}

// --------------------------------------------------------------- report
if (errors.length) {
  console.error(`[check-manuals] ${errors.length} problem${errors.length === 1 ? '' : 's'}:\n`);
  for (const e of errors) console.error('  ✗ ' + e + '\n');
  process.exit(1);
}

const sections = (M.en.parts || []).reduce((a, p) => a + p.sections.length, 0);
console.log(
  `[check-manuals] OK — shell hash matches (${shellLines} lines), tokens identical across ` +
    `${ALL.length} files, ${MANUAL} ${M.en.parts.length} parts / ${sections} sections, ` +
    `4 locales at parity, v${pkg.version} matches package.json.`,
);
