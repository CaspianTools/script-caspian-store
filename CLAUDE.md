# CLAUDE.md

Orientation for AI sessions working on this repo. User-facing setup lives in [README.md](README.md) and [INSTALL.md](INSTALL.md) — don't duplicate it here. Release history lives in [CHANGELOG.md](CHANGELOG.md).

## Project

`@caspian-explorer/script-caspian-store` — a framework-agnostic React e-commerce library published to npm. Installs into any React app (Next.js App Router, Vite + React Router, CRA). Ships storefront, cart, checkout, admin panel, auth, i18n, theming, Firestore schema, and Cloud Functions for Stripe. Consumers provide their own Firebase project (**BYOF**).

A turnkey consumer-site scaffolder lives at [scaffold/create.mjs](scaffold/create.mjs) — it generates a pre-wired Next.js App Router site.

## Triage incoming reports

When the user pastes an error, stack trace, screenshot, log, bug report, or feature request, **before proposing a fix** state which side the problem lives on:

- **Library bug** — reproduces from this repo's source (`src/`, `firebase/`, `scaffold/`, build config) on a clean install at the latest tag. Fix here, ship through the Pre-Commit Checklist.
- **Consumer-site bug** — the symptom is on the user's downstream Next.js / Vite / CRA site that `npm install`-ed the library. Common causes: pinned to an old tag, missing `firestore.rules`/`firestore.indexes.json` redeploy, miswired framework adapter, stale `.next/` cache, env vars, or local `dist/` drift. The library itself may be innocent.
- **Both** — a real library bug that *also* needs the consumer to redeploy/upgrade once fixed.

Open the response by naming the verdict and the evidence (file path, version, behaviour) that led there. If the evidence is genuinely ambiguous, ask one targeted question (e.g. *"is this from the live consumer site or while running `npm run dev` inside this repo?"*) rather than guessing.

When a bug surfaces on a consumer site but the library could have prevented it — via validation, a better error, a self-heal path, or a safer default — prefer fixing it in the library. Releases must never require consumer hand-edits (see the matching memory rule).

## Commands

```bash
npm run dev         # tsup --watch
npm run build       # tsup (ESM + CJS + .d.ts, two entries)
npm run typecheck   # tsc --noEmit
npm run clean       # rimraf dist
```

A `prepare` script also runs `tsup` on `npm install` — this is how `npm install github:CaspianTools/script-caspian-store` produces a usable `dist/` without a separate build step. Do not remove it.

**No test runner and no linter are configured.** Do not add Jest/Vitest/Playwright/ESLint/Biome/Prettier without asking the user first.

Cloud Functions under [firebase/functions/](firebase/functions/) are a separate Node 20 project with their own `package.json` and `tsconfig.json`; they are **not** part of the tsup build. Build them from inside that directory (`npm run build` there).

## Architecture

**Two public entries** — both must stay in sync with [tsup.config.ts](tsup.config.ts) and the `exports` map in [package.json](package.json):

- `.` → [src/index.ts](src/index.ts) — providers, hooks, components, admin pages, UI primitives, services, types, i18n, theme presets, utils
- `./firebase` → [src/firebase/index.ts](src/firebase/index.ts) — `initCaspianFirebase`, `caspianCollections`, stringified rules/indexes

Plus exports: `./styles.css` (side-effect CSS, imported once at app root), `./firestore.rules`, `./firestore.indexes.json` (consumers copy into their Firebase project).

**Source layout** — grow each directory in place; don't introduce parallel structures:

- [src/provider/](src/provider/) — root provider wiring
- [src/context/](src/context/) — context impls (auth, cart, script-settings, theme, font-loader, toast)
- [src/primitives/](src/primitives/) — framework-adapter contract + defaults
- [src/components/](src/components/) — storefront components (PLP, PDP, cart sheet, checkout, homepage, site shell, …)
- [src/admin/](src/admin/) — admin-panel pages and guards
- [src/ui/](src/ui/) — generic UI primitives (Button, Dialog, Tabs, Select, Table, Toast, …)
- [src/services/](src/services/) — Firestore/service-layer functions
- [src/i18n/](src/i18n/) — LocaleProvider, message tables, formatters, switcher
- [src/theme/](src/theme/) — theme presets + picker. Each preset lives in its own folder under [src/theme/themes/<id>/index.ts](src/theme/themes/) exporting a single `CatalogTheme` default; [src/theme/catalog.ts](src/theme/catalog.ts) is a barrel that imports each one and assembles `THEME_CATALOG`. To modify a preset, change only its folder — the per-theme `version: string` field combined with [`useThemeUpdateTracker`](src/theme/theme-update-tracker.ts) is what makes the admin Appearance page show an `Updated` pill on only the touched cards. Bumping a theme's version is the contract; if you change tokens/thumbnail/copy without bumping, admins won't see the badge
- [src/shipping/](src/shipping/) — shipping plugin catalog + per-plugin implementations
- [src/payments/](src/payments/) — payment plugin catalog + per-plugin implementations (v2.0+)
- [src/email/](src/email/) — email provider plugin catalog (metadata-only; server `send` impls live in `functions-email/`) (v3.0+)
- [src/firebase/](src/firebase/) — Firebase init, collection refs, rules/indexes exports
- [src/utils/](src/utils/) — pure helpers (e.g. [cn.ts](src/utils/cn.ts))
- [src/styles/](src/styles/) — globals.css
- [src/types.ts](src/types.ts) — shared domain types (Product, Order, UserProfile, CartItem, Review, PromoCode, SiteSettings, …). Add new cross-module types here, not per-module files.
- [scaffold/](scaffold/) — consumer-site generator (not bundled into the library)

**Provider nesting order** (defined in [src/provider/caspian-store-provider.tsx](src/provider/caspian-store-provider.tsx)) — do not reorder:

```
CaspianStoreProvider
  → LocaleProvider
  → ToastProvider
  → AuthProvider
  → CartProvider
  → ScriptSettingsProvider
  → ThemeInjector
  → FontLoader
  → children
```

`ThemeInjector` is a null-render component that writes live `--caspian-*` CSS custom properties to `:root` on settings change. `FontLoader` injects the configured font stylesheet at runtime.

**Framework-adapter contract** at [src/primitives/types.ts](src/primitives/types.ts): `{ Link, Image?, useNavigation }`. Consumers pass adapters to the provider; defaults in [src/primitives/](src/primitives/) use `<a>`, `<img>`, `window.location`. **No `next/*`, `react-router`, `react-router-dom`, or `@remix-run/*` imports may leak into `src/`.** If you need framework behaviour, extend the adapter contract — don't import directly.

`CaspianNavigation.searchParams` is the **reactive** query-string accessor and must be sourced from `useSearchParams()` (or the router equivalent) in any real framework adapter — `window.location.search` is not reactive. URL-driven components like `<SearchResultsPage>` read from it, so a stale/missing `searchParams` causes them to not re-render on client-side navigation. The field is typed `URLSearchParams | undefined` so older consumer adapters still compile, but omitting it in a real adapter re-introduces issue #43.

**Plugin catalogs — shipping, payments, and email.** All three follow the same shape: a static `CATALOG` record in [src/shipping/catalog.ts](src/shipping/catalog.ts) / [src/payments/catalog.ts](src/payments/catalog.ts) / [src/email/catalog.ts](src/email/catalog.ts) keyed by plugin id, each entry implementing a `{ id, name, description, defaultConfig, validateConfig, … }` contract defined in the sibling `types.ts`. Per-plugin implementations live in `plugins/` subdirectories. The admin page (`AdminShippingPluginsPage` / `AdminPaymentPluginsPage` / `AdminEmailPluginsPage`) browses the catalog and persists per-store **installs** (`shippingPluginInstalls` / `paymentPluginInstalls` / `emailPluginInstalls` Firestore collections) with merchant display name + config + `enabled` flag. The runtime reads enabled installs, resolves each to a catalog entry, validates config, and delegates to the plugin's methods. New providers land by PR into the catalog — there is no runtime registration hook and that is intentional.

**Email plugins differ from shipping + payments in two ways.** (1) Catalog entries in [src/email/plugins/](src/email/plugins/) are **metadata-only** (`{ id, name, description, defaultConfig, validateConfig }` — no `send` method). Delivery runs server-side from the `caspian-email` Cloud Functions codebase because the API key must stay out of the browser. The server-side `send` implementations live in [firebase/functions-email/src/email-sender.ts](firebase/functions-email/src/email-sender.ts) and are keyed on the same `pluginId` strings. When adding a new email provider, land both halves in the same PR or neither is usable. (2) `emailPluginInstalls` Firestore rules are **admin-only read AND write** (unlike shipping/payment installs which are publicly readable), because the install's `config.apiKey` is a provider secret. Cloud Functions read via the Admin SDK, which bypasses rules. This is the trade-off v3.0.0 made to keep `firebase deploy --only functions:caspian-email` running with zero `defineSecret` declarations — a future release could add an optional `secretName` field that the dispatcher resolves via Google Secret Manager for stores that want keys out of Firestore.

**Firestore collection refs** are centralized in [src/firebase/collections.ts](src/firebase/collections.ts). Services in [src/services/](src/services/) consume those refs — **do not call `collection(db, "foo")` ad-hoc** in services or components. When adding a collection:

1. Add the ref to [src/firebase/collections.ts](src/firebase/collections.ts)
2. Add access rules to [firebase/firestore.rules](firebase/firestore.rules)
3. Add composite indexes to [firebase/firestore.indexes.json](firebase/firestore.indexes.json) if the service queries it with filter + order combinations

Rules, indexes, and `collections.ts` move together.

**Import / Export catalog — [src/services/import-export/](src/services/import-export/).** The admin **Settings → Import / Export** page ([admin-settings-import-export-page.tsx](src/admin/admin-settings-import-export-page.tsx)) is catalog-driven: a `DATASET_CATALOG` ([catalog.ts](src/services/import-export/catalog.ts)) keyed by dataset id, one `DatasetDescriptor` ([types.ts](src/services/import-export/types.ts)) per store dataset (products, categories, collections, brands, promo codes, subscribers, plus export-only orders, users, reviews) under `datasets/`. Each descriptor declares its CSV `columns` (header + sample + help), an `exportMatrix(db)`, and — for importable datasets — `analyzeRows`/`applyRows` that reuse the existing entity services. The `columns` array is the **single source of truth** for export headers, the downloadable template, the import column reference, and field (de)serialization. CSV plumbing is in [src/utils/csv.ts](src/utils/csv.ts).

**Rule: any change to a catalog-backed entity updates its import/export descriptor — including the template — in the same change.** When you add, rename, or remove a field on Product, Category, Collection, Brand, PromoCode, Subscriber, Order, User, or Review, update the matching `datasets/*.ts` descriptor's `columns` (this updates the export, template, and column reference together), the export getter, and the import parse/validate, so an export → import round-trip still reproduces the record. A new exportable/importable entity = new descriptor file + register in `catalog.ts` + add `admin.importExport.dataset.<id>` i18n keys. A template missing a newly-added column silently drops that field on every import — never let a model change ship with a stale catalog. (Note: this catalog has no `tags` dataset and uses the library's single-`category` product shape.)

**Server Component boundary.** The library emits `"use client"` directives in client-heavy files (providers, contexts, interactive components, admin pages). Consumers mount the provider tree from a Server Component parent; the library *is* the client boundary. When adding a new component that uses React state/effects/refs, put `"use client"` at the top — match the surrounding files.

## Conventions

- **Strict TypeScript** ([tsconfig.json](tsconfig.json)): `strict`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`. Path alias `@/*` → `src/*`.
- **Services signature** — service functions in [src/services/](src/services/) take `db: Firestore` as the first argument and use refs from [src/firebase/collections.ts](src/firebase/collections.ts). Match this pattern in new services so they compose with `useCaspianCollections()` cleanly.
- **Class merging** via [src/utils/cn.ts](src/utils/cn.ts) (`clsx` + `tailwind-merge`). Use it whenever you combine conditional classes.
- **Theming surface** is CSS custom properties (`--caspian-primary`, `--caspian-accent`, `--caspian-radius`, `--caspian-font-family`, …). Fallbacks in [src/styles/globals.css](src/styles/globals.css); live overrides written by the `ThemeInjector` (see [src/context/theme-context.tsx](src/context/theme-context.tsx)). Don't hard-code colors in components.
- **i18n** — user-facing strings go through the i18n layer in [src/i18n/](src/i18n/); don't hard-code English in components. Use `useT()` and add keys to the central message table rather than inlining.
- **Firestore rules** ([firebase/firestore.rules](firebase/firestore.rules)) enforce admin-only writes, public reads, and a `pending → approved` moderation workflow for reviews/questions. Reuse the helper predicates already defined in that file rather than rewriting auth checks inline.
- **Peer deps** are `firebase`, `react`, `react-dom`. They must not be bundled — check `external` in [tsup.config.ts](tsup.config.ts) if you see them in the output.

## Gotchas

- [examples/](examples/) and [scaffold/](scaffold/) are consumer-facing assets, **not** part of the tsup build. Changes to them don't ship in `dist/`.
- The `prepare` script runs `tsup` on `npm install` — installing in this repo triggers a build. Don't be surprised.
- Stripe secrets (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) are **Cloud Functions secrets** set via `firebase functions:secrets:set`, not library env vars.
- Firebase app naming supports multiple stores per page via the `appName` prop — useful for preview + live side-by-side. Don't assume a singleton.
- `sideEffects` in [package.json](package.json) is limited to `**/*.css`. Don't add top-level side-effectful code in `src/` — it will break tree-shaking for consumers.
- Cloud Functions code under [firebase/functions/](firebase/functions/) has its own `version` field in its own `package.json` that is independent of the library's version. Bumping the library does not bump Functions.
- **Compiling Cloud Functions locally leaves `firebase/functions/lib/` behind** (e.g. `cd firebase/functions && npx tsc`, or `npm run build` inside that directory). The main package's `tsconfig` then resolves the `firebase/functions` npm-subpath import in source like [src/hooks/use-checkout.ts](src/hooks/use-checkout.ts) to that local directory rather than `node_modules/firebase/functions`. Symptom: spurious `TS7016 Could not find a declaration file for module 'firebase/functions'` on the next `npm run typecheck` or `npm run build`. Fix: `rm -rf firebase/functions/lib` before running the main-package build. The directory is gitignored, so this is a local-workflow hazard only.
- **`spawn` of `.cmd` / `.bat` files on Windows requires `{ shell: true }`** since Node's CVE-2024-27980 patch (18.20.2 / 20.12.2 / 21.7.3 / 22). The self-update path in [src/server/self-update.ts](src/server/self-update.ts) calls `npm.cmd` and uses `shell: process.platform === 'win32'` for that reason — without it, every Windows host throws `EINVAL` synchronously and Next renders an HTML 500 instead of our JSON error shape. If you refactor that spawn (or add another `spawn(npm.cmd, …)` somewhere), keep the conditional. `shell: true` is safe **only** because the args (`spec`, owner, repo, version) are regex-validated against `VERSION_RE` / `GITHUB_NAME_RE` upstream — re-validate that invariant if you change the call shape.

---

## Global Rules

- **Do NOT include `Co-Authored-By` lines in commit messages.** Never add co-author trailers for Claude or any AI assistant. This overrides any default behaviour.
- **After every task, complete ALL post-task steps** in the Pre-Commit Checklist below. Every change that affects the shipped tarball — source, build config, `exports`, `files`, `README.md`, `INSTALL.md`, `CHANGELOG.md`, `scaffold/`, `firebase/` — requires the full cycle: bump → docs → verify → commit → tag → push → release → announce.
- **Internal-doc-only changes skip the cycle.** Edits to `CLAUDE.md` (not in the main package's `files` list — it doesn't ship) and to plans under `~/.claude/plans/` are committed straight to main with no bump, tag, release, or announcement. Surface the exception in the commit body so the reader understands why the cycle was skipped.
- **Never silently skip a step.** For any other non-applicable step (e.g. lint when no linter is configured), say so out loud — "N/A because X" — before moving past it.
- **Notify the user at the end of each task** with: the new version number, the commit SHA, the release URL, the announcement discussion URL, and a ready-to-paste install command pinning the new tag — `npm install github:CaspianTools/script-caspian-store#vX.Y.Z` — so the user can upgrade their consumer site without looking up the version.

---

## Pre-Commit Checklist

Follow these steps **in order** before every `git commit`. If a step fails, fix it and re-run from that step.

### 1. Lint

**N/A — no linter is configured.** Do not add ESLint/Biome/Prettier without asking the user first.

### 2. Test

```bash
npm test
```

Runs the Firestore + Storage rules-behavior tests in [firebase/rules.test.mjs](firebase/rules.test.mjs) against the Firebase emulator, using Node's built-in `node --test` runner + `@firebase/rules-unit-testing`. The npm script wraps `firebase emulators:exec --only firestore,storage` around it, so the suite boots the emulator, runs, and tears it down.

**Requires:** `firebase-tools` on PATH (or via `npx firebase`), and a JRE (Firebase emulators are Java-based; Java 17+ recommended). Skip locally and rely on CI if you don't have Java installed — the workflow at [.github/workflows/rules.yml](.github/workflows/rules.yml) runs this on every PR that touches `firebase/*.rules`.

**Do not add Jest / Vitest / Playwright for component or unit tests** without asking first. The rules tests are a narrow, deliberately scoped exception.

### 3. Type-check

```bash
npm run typecheck
```

Runs `tsc --noEmit` under strict mode. Must pass before committing. If Cloud Functions were changed, also run `npm run build` (tsc) inside [firebase/functions/](firebase/functions/).

### 4. Review changed files

Scan `git diff --staged` and `git status` for:
- Accidental debug output (`console.log`, `debugger`, `console.warn` added for tracing)
- Leftover `TODO`/`FIXME` comments added in this change
- Hardcoded secrets, Firebase config values, Stripe keys, API tokens
- Unused imports or dead code introduced by this change
- `next/*` or router-specific imports leaking into `src/` (see Architecture — adapter contract)
- Ad-hoc `collection(db, "...")` calls outside [src/firebase/collections.ts](src/firebase/collections.ts)
- Hard-coded English strings in components that should go through i18n

Fix any issues before proceeding.

### 5. Bump version

Increment the version in [package.json](package.json) for every release, following [semver](https://semver.org/):

- **patch** (`1.8.0` → `1.8.1`) — bug fixes, docs, internal refactors with no public API change
- **minor** (`1.8.x` → `1.9.0`) — new features, non-breaking additions to the public export surface
- **major** (`1.x.x` → `2.0.0`) — breaking changes: renaming/removing public exports, changing provider props, requiring consumer code changes

Then update [CHANGELOG.md](CHANGELOG.md): add a new `## vX.Y.Z — <short summary>` heading above the previous version, following [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) sections (`### Added`, `### Changed`, `### Fixed`, `### Removed`).

**Upgrade-notes heading is required.** Every entry must include *exactly one* of these two headings so customers can tell at a glance whether the release needs action:

- `### Consumer action required on upgrade` — followed by a fenced bash block of exact commands, or a numbered list of the steps.
- `### No consumer action required` — followed by a one-line explanation (e.g. "internal build config only; existing installs unaffected" or "scaffolder-only change; does not touch consumer sites").

Never omit the heading, rename it, or fold it into `### Notes`. The comment block at the top of [CHANGELOG.md](CHANGELOG.md) documents this rule in-tree.

**No lock file to sync** — this repo does not commit `package-lock.json`. (If that changes, run `npm install --package-lock-only`.)

### 6. Update documentation

Update **all** documentation affected by the changes. Only skip if the file clearly doesn't touch what changed.

- [README.md](README.md) — user-facing overview, usage examples, current feature set
- [INSTALL.md](INSTALL.md) — consumer setup (scaffolder, Next.js/Vite/CRA), Firebase deployment, Stripe wiring
- [CHANGELOG.md](CHANGELOG.md) — covered in step 5
- [CLAUDE.md](CLAUDE.md) — this file, if an architecture invariant, convention, or workflow rule shifted
- `description` field in [package.json](package.json) — if the project's scope changed
- [examples/nextjs/](examples/nextjs/) and [scaffold/](scaffold/) — if the public API or provider props changed
- [firebase/functions/](firebase/functions/) README/types — if Function signatures changed

**Wiki: N/A — no GitHub Wiki exists for this repo.** If one is created later, clone `https://github.com/CaspianTools/script-caspian-store.wiki.git` and edit affected pages there.

### 7. Build

```bash
npm run build    # tsup: dist/index.{js,cjs,d.ts} + dist/firebase/index.{js,cjs,d.ts}
npm pack         # produces caspian-explorer-script-caspian-store-X.Y.Z.tgz
```

Both must complete without errors. Keep the `.tgz` locally for the GitHub Release step — it is gitignored via `dist/` and the root-level `*.tgz` pattern.

### 8. Commit

Create a commit with a descriptive message in imperative mood ("Add X" not "Added X"). Body explains the *why*, not the *what*. **Never include `Co-Authored-By` trailers.**

Use a heredoc for multi-line messages to preserve formatting:

```bash
git commit -m "$(cat <<'EOF'
Short one-line summary under 72 chars

Paragraph explaining the why. Reference the problem this solves, the
constraint that forced the approach, or the incident that prompted it.
Do not narrate the diff.
EOF
)"
```

### 9. Tag

```bash
git tag -a vX.Y.Z -m "vX.Y.Z — <short summary>"
```

Always annotated (`-a`), never lightweight. The tag message should be a one-line summary suitable as the release title.

### 10. Push

```bash
git push origin main --tags
```

Pushes the commit and the new tag in one operation. Never force-push to `main`.

### 11. Create GitHub Release

```bash
gh release create vX.Y.Z caspian-explorer-script-caspian-store-X.Y.Z.tgz \
  --title "vX.Y.Z — <short summary>" \
  --notes "$(cat <<'EOF'
<changelog entries for this version, copied from CHANGELOG.md>
EOF
)"
```

Attach the `.tgz` from step 7.

### 12. Post to GitHub Discussions

After every release, create a Discussion in the **Announcements** category. The post must be **social-media-ready** — the user should be able to copy-paste it to Twitter/X, LinkedIn, or a dev blog without edits.

**Format requirements:**
- **Title** — action-oriented, under 100 characters (e.g. `script-caspian-store 1.9 — Faster admin dashboard`)
- **Body** — 1–3 sentence intro; 2–4 highlight bullets (sparing emoji OK for visual rhythm); install/upgrade one-liner; repo link `https://github.com/CaspianTools/script-caspian-store`.

**Create via GraphQL API:**

```bash
gh api graphql -F query=@- <<'EOF'
mutation {
  createDiscussion(input: {
    repositoryId: "R_kgDOSHQDJw",
    categoryId: "DIC_kwDOSHQDJ84C7XL9",
    title: "<TITLE>",
    body: "<BODY>"
  }) {
    discussion { url }
  }
}
EOF
```

**One-time lookup** for `<REPOSITORY_NODE_ID>` and `<ANNOUNCEMENTS_CATEGORY_NODE_ID>`:

```bash
gh api graphql -f query='
  query {
    repository(owner: "CaspianTools", name: "script-caspian-store") {
      id
      discussionCategories(first: 20) { nodes { id name } }
    }
  }
'
```

Copy the repo `id` and the category `id` whose `name` is `Announcements` back into this file, replacing the placeholders above, so future releases skip the lookup.

Prefer the heredoc form (`-F query=@-`) over bare `-f query=...`; apostrophes in the title or body will break shell quoting otherwise. For long bodies, write them to a file and use `gh api graphql -F query=@path/to/query.graphql`.

### 13. Update the `create-caspian-store` sibling on npmjs.com (if relevant)

`npm create caspian-store@latest` is powered by a **separate** npm-published package in [create-caspian-store/](create-caspian-store/) that shallow-clones this repo and invokes [scaffold/create.mjs](scaffold/create.mjs). Unlike the main package (which ships as a tarball attached to GitHub Releases — never to npmjs.com), the sibling **must** live on npmjs.com for `npm create` to work.

**Check whether this release needs the sibling republished.** The sibling is thin — it just orchestrates `git clone` + `node scaffold/create.mjs`. Changes to the *main* package's source, `firebase/`, or admin UI usually don't touch it. Bump and republish only when:

- The sibling's own code under [create-caspian-store/](create-caspian-store/) changed.
- The scaffolder's CLI surface changed in a way the sibling forwards or documents (new flag, renamed flag, changed default, new positional, removed arg). The sibling passes `process.argv` through to `scaffold/create.mjs`, so most flag additions are automatic — but if the sibling's own `README.md`, help text, or flag-forwarding logic mentions the flag explicitly, it needs a republish.
- The minimum supported Node version, `git` invocation, or clone strategy changed.

**If none of those apply, skip this step and say so in the commit body** (`"sibling unaffected — no change to create-caspian-store/ and no scaffolder CLI surface change"`).

**If a republish is needed:**

```bash
cd create-caspian-store
# 1. Bump create-caspian-store/package.json version (semver — usually patch).
# 2. Update create-caspian-store/README.md if consumer-facing flags/docs shifted.
# 3. Verify locally:
npm pack                    # produces create-caspian-store-X.Y.Z.tgz
# 4. Publish (requires `npm login` with an account on the scoped publishers allowlist):
npm publish --access public
cd ..
```

Then tag the sibling release separately (e.g. `create-caspian-store/v0.1.1`) to keep its history visible, and cross-link from the main package's GitHub Release notes (step 11) with a one-liner: *"`create-caspian-store` bumped to v0.1.1 — no consumer action beyond running `npm create caspian-store@latest` as usual."*

**This is the only `npm publish` allowed in this repo** — see "Never do without explicit user permission" for the main-package rule.

---

## Style guide

In addition to the Conventions section above:

- Commit messages: imperative mood ("Fix X", "Add Y"). First line ≤ 72 chars. Body explains *why*.
- Don't add comments that restate what well-named code already says. Only comment *why* something is non-obvious (a hidden constraint, a workaround for a specific bug, an invariant).
- Don't add error handling for conditions that can't happen. Validate at system boundaries only.
- Don't introduce new abstractions for hypothetical future needs. Three similar lines is better than a premature abstraction.
- Delete unused code outright rather than commenting it out or leaving `// removed` breadcrumbs.

---

## Never do without explicit user permission

- Force-push to `main`
- `git reset --hard` on a branch that has unpushed work
- Delete branches other than short-lived local ones you created in this session
- Publish the **main** package (`@caspian-explorer/script-caspian-store`) to the npm registry (`npm publish`) — only building locally (`npm pack`) and attaching to a GitHub Release is allowed. The **sibling** `create-caspian-store/` package IS allowed to be republished without asking, per checklist step 13, because `npm create caspian-store@latest` depends on it being on npmjs.com.
- Modify the remote repository's settings, branch protections, or secrets
- Commit with `--no-verify` or equivalent hook-bypass flags
- Add a `Co-Authored-By` trailer to any commit

---

## Worktrees & the ship rule

Claude Code can run parallel sessions in isolated **git worktrees** (`claude --worktree <name>`, or ask it to "work in a worktree" → the `EnterWorktree` tool). A worktree lives under `.claude/worktrees/<name>/` on branch `worktree-<name>`, branched **fresh from `origin/main`** by default (set `worktree.baseRef: "head"` in `.claude/settings.json` to carry local HEAD instead). `.claude/worktrees/` is gitignored and **`.worktreeinclude`** copies any local secrets (`.env*`, `serviceAccountKey*.json`, `credentials.json`) into new worktrees — see those two files. `node_modules` and `dist/` are *not* copied: run `npm install` in each new worktree (the `prepare` hook rebuilds `dist/`).

**The catch:** this repo does **not** auto-ship on push to `main`. Pushing `main` only runs CI checks — the rules-behavior test ([rules.yml](.github/workflows/rules.yml)), the consumer-tarball exports smoke ([exports-smoke.yml](.github/workflows/exports-smoke.yml)), and the scaffold-routes drift check ([scaffold-routes-smoke.yml](.github/workflows/scaffold-routes-smoke.yml)) — none of which deploy or publish. A **release** happens only when you push an annotated **`vX.Y.Z` tag** and cut a GitHub Release with the `.tgz` (main package), and the sibling `create-caspian-store/` publishes to npm via OIDC **only on a `create-caspian-store/v*` tag** ([publish-create-caspian-store.yml](.github/workflows/publish-create-caspian-store.yml)). So the *release* is the tag + Release + Discussion cycle in the [Pre-Commit Checklist](#pre-commit-checklist), not the branch push. Inside a worktree that whole cycle **must be adapted** — do NOT blindly land from one:

1. **Commit, pause before landing.** Auto-commit finished work on the `worktree-<name>` branch, then **stop and report**. Never merge to `main`, push `main`, or push a release tag without the owner's explicit go-ahead. *(On `main` — the normal solo flow — the checklist is unchanged: bump → verify → commit → tag → push → Release → Discussion.)*
2. **Serialize landings — one at a time.** Never land two worktrees to `main` in parallel. If another worktree/session is still in flight, wait for it to land first. There's no live cross-session signal, so "wait" means: at land time `git fetch` and rebase onto whatever `origin/main` now is; if the owner says another is mid-flight, hold until told it's done.
3. **Resolve conflicts in the worktree, never on `main`.** At land time: `git fetch origin` → **rebase `worktree-<name>` onto the latest `origin/main`** → resolve every conflict *there*, so `main` only ever receives an already-merged, clean tree.
4. **Finalize the version + changelog bump last.** The `version` in [package.json](package.json) and the top entry in [CHANGELOG.md](CHANGELOG.md) (with its required `### Consumer action required on upgrade` / `### No consumer action required` heading) are the *guaranteed* collision between two shippable worktrees — and the `vX.Y.Z` git tag derived from them. Don't fix the number until after the rebase — take *current-main + 1* per semver, then rewrite the changelog entry and only tag once `main` is settled.
5. **Re-verify + rebuild after resolving.** Re-run the checklist's verify steps in the worktree: `npm run typecheck` (strict `tsc --noEmit`), `npm test` (the Firestore/Storage rules-behavior suite — needs Java + firebase-tools; else rely on CI), `npm run build` (tsup, both entries), `npm pack` (the release `.tgz`), and `node scripts/check-exports.mjs` / `node scripts/check-scaffold-routes.mjs` if the public API or scaffolder routes shifted. A conflict resolution that isn't re-verified is a bug waiting to ship to consumers.
6. **Only then ship.** Fast-forward `main` to the clean, verified branch → `git push origin main` → then run the release tail from the checklist: annotated `git tag -a vX.Y.Z` → `git push origin main --tags` → `gh release create` with the `.tgz` → Announcements Discussion → (if the sibling changed) republish `create-caspian-store` via its `create-caspian-store/v*` tag. **Never tag or cut a Release from a conflicted or failing tree.**

For solo, single-stream work, **skip worktrees and work on `main` directly** — the Pre-Commit Checklist needs no adaptation. Reserve worktrees for genuine parallelism (two tasks at once) or experiments you may not ship.
