#!/usr/bin/env node
// Drift guard for the three files in docs/.
//
// The manuals are hand-maintained single HTML files with no build step. That is
// deliberate — the shell has changed twice in its life while the content changes
// every release, so a build step would tax the frequent operation to protect
// against the rare one. What a build step would *guarantee* (the two shells are
// identical) this script instead *verifies*, for about a thousandth of the cost.
//
// It catches, in order of how much damage each one does:
//   A  the two manuals' shared shell drifting apart
//   B  the picker's design tokens drifting from the manuals'
//   C5 a translation overlay going stale — the failure that renders confidently
//      and wrongly, hiding newly-added English text with no warning at all
//   C4 the footer version string rotting (it sat at v10.0.0 through two releases)
//   C7 the install examples in README/INSTALL pinning a version three majors old
//   C3 a part icon with no <symbol> — how v10.0.1 shipped every icon clipped
//   C6 the same section id landing in both files, breaking a deep link
//
// What it does NOT check, and cannot: whether the prose still describes the
// screen. Only opening the component does that. See the manual rules in
// CLAUDE.md — this script guards shape, never truth.
//
// Usage: node scripts/check-manuals.mjs
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = join(ROOT, 'docs');
const MANUALS = ['user-manual.html', 'pos-manual.html'];
const ALL = ['index.html', ...MANUALS];
const LOCALES = ['az', 'ru', 'tr'];

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

// --------------------------------------------------------------- A. shell equality
const stripped = {};
for (const f of MANUALS) {
  let s = text[f];
  for (const [name, re] of FENCES) {
    if (name === 'TOKENS') continue; // tokens are part of the shared shell
    if (fenceOnce(f, name, re) === null) continue;
    s = s.replace(new RegExp(re.source), '');
  }
  stripped[f] = s;
}

if (stripped[MANUALS[0]] && stripped[MANUALS[1]] && stripped[MANUALS[0]] !== stripped[MANUALS[1]]) {
  const a = stripped[MANUALS[0]].split('\n');
  const b = stripped[MANUALS[1]].split('\n');
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  fail(
    `The shared shell differs between the two manuals, first at stripped line ${i + 1}.\n` +
      `      user-manual.html: ${JSON.stringify((a[i] || '(end of file)').slice(0, 90))}\n` +
      `      pos-manual.html : ${JSON.stringify((b[i] || '(end of file)').slice(0, 90))}\n` +
      `      Fix: change the shell in one file, copy it to the other. Do not "improve" only one copy.`,
  );
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

const idsByFile = {};

for (const f of MANUALS) {
  const M = parseManual(f);
  if (!M) continue;
  const en = M.en;
  if (!en) {
    fail(`docs/${f}: MANUAL.en is missing.`);
    continue;
  }

  const symbols = new Set([...text[f].matchAll(/<symbol id="([^"]+)"/g)].map((m) => m[1]));
  for (const [, id, attrs] of text[f].matchAll(/<symbol id="([^"]+)"([^>]*)>/g)) {
    if (!/viewBox=/.test(attrs)) {
      fail(`docs/${f}: <symbol id="${id}"> has no viewBox — it will render cropped, not scaled.`);
    }
  }

  const partIds = new Set();
  const sectionIds = new Set();
  for (const p of en.parts || []) {
    if (partIds.has(p.id)) fail(`docs/${f}: duplicate part id "${p.id}".`);
    partIds.add(p.id);
    if (!(p.sections || []).length) {
      fail(`docs/${f}: part "${p.id}" has no sections — its intro card would link to #undefined.`);
    }
    if (p.icon && !symbols.has(p.icon)) {
      fail(`docs/${f}: part "${p.id}" uses icon "${p.icon}" but no matching <symbol> is defined.`);
    }
    for (const s of p.sections || []) {
      if (sectionIds.has(s.id)) fail(`docs/${f}: duplicate section id "${s.id}".`);
      sectionIds.add(s.id);
      if (!s.title || !s.summary) fail(`docs/${f}: section "${s.id}" is missing a title or summary.`);
    }
  }
  idsByFile[f] = sectionIds;

  const want = 'v' + pkg.version;
  if (en.intro?.version !== want) {
    fail(
      `docs/${f}: MANUAL.en.intro.version is ${JSON.stringify(en.intro?.version)}, expected "${want}" ` +
        `to match package.json. Bump it alongside the version (Pre-Commit Checklist step 5).`,
    );
  }

  // C5 — overlay integrity. A stale overlay renders as authoritative; an absent
  // one renders with the "not translated yet" notice. Only the second is safe.
  const enParts = new Map((en.parts || []).map((p) => [p.id, p]));
  for (const lang of LOCALES) {
    const over = M[lang];
    if (!over) continue;
    for (const tp of over.parts || []) {
      const bp = enParts.get(tp.id);
      if (!bp) {
        fail(`docs/${f}: ${lang} overlay has part "${tp.id}", which does not exist in English — its translations are dead.`);
        continue;
      }
      const bSections = new Map((bp.sections || []).map((s) => [s.id, s]));
      for (const ts of tp.sections || []) {
        const bs = bSections.get(ts.id);
        if (!bs) {
          fail(`docs/${f}: ${lang} section "${ts.id}" is not under English part "${tp.id}" — its translation is dead.`);
          continue;
        }
        for (const key of ['steps', 'fields', 'notes']) {
          const bn = (bs[key] || []).length;
          const tn = (ts[key] || []).length;
          if (bn !== tn) {
            fail(
              `docs/${f}: ${lang} section "${ts.id}" has ${tn} ${key} but English has ${bn}. ` +
                `Re-translate it, or delete the overlay section so the fallback notice shows. ` +
                `A stale overlay hides the new English text with no warning.`,
            );
          }
        }
        if (!ts.summary) fail(`docs/${f}: ${lang} section "${ts.id}" is present but has no summary.`);
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

// --------------------------------------------------------------- C6. cross-file ids
if (idsByFile[MANUALS[0]] && idsByFile[MANUALS[1]]) {
  const clash = [...idsByFile[MANUALS[0]]].filter((id) => idsByFile[MANUALS[1]].has(id));
  if (clash.length) {
    fail(`Section ids appear in BOTH manuals: ${clash.join(', ')}. Deep-link anchors must be unique across the set.`);
  }
}

// --------------------------------------------------------------- report
if (errors.length) {
  console.error(`[check-manuals] ${errors.length} problem${errors.length === 1 ? '' : 's'}:\n`);
  for (const e of errors) console.error('  ✗ ' + e + '\n');
  process.exit(1);
}

const counts = MANUALS.map((f) => {
  const M = parseManual(f);
  const n = (M.en.parts || []).reduce((a, p) => a + p.sections.length, 0);
  return `${f} ${M.en.parts.length} parts / ${n} sections`;
});
const shellLines = stripped[MANUALS[0]].split('\n').length;
console.log(
  `[check-manuals] OK — shell identical (${shellLines} lines), tokens identical across all 3 files, ` +
    `${counts.join(', ')}, 4 locales at parity, v${pkg.version} matches package.json.`,
);
