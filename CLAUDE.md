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
- [src/pos/](src/pos/) — the register. `standalone/` inside it is the no-Firebase mode (see below); `storage/` holds the `PosStorageAdapter` seam and its implementations; `theme/` holds the register’s own design system (see below)
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

**User manuals — [docs/](docs/).** Three self-contained HTML files (no build step, no external requests, they open from `file://`), documenting every screen a **shop owner or cashier** touches. They ship via the `files` list and the `./user-manual.html`, `./pos-manual.html` and `./manuals.html` exports.

| File | Owns |
| --- | --- |
| [docs/index.html](docs/index.html) | A picker. No content of its own; two cards and a language switch. |
| [docs/user-manual.html](docs/user-manual.html) | **The store** — catalog, orders, people, content, settings. |
| [docs/pos-manual.html](docs/pos-manual.html) | **The register** — install → hardware → cashiers → the counter → records → winding down. |

**Routing rule — which manual gets a change.** Anything reached at `/pos*`, plus the register-facing parts of `/admin/pos` (the two switches, receipt wording, recent sales, the licence table), belongs in `pos-manual.html`. Everything else belongs in `user-manual.html`. The boundary case is deliberate: `licences-you-have-sold` lives at `/admin/pos` inside the admin panel but documents the register's back office, so it is in the POS manual.

**The shell rule.** Everything outside the `DOC:HEAD`, `DOC` and `MANUAL` fences is the **shared shell and is byte-identical across both manuals** — CSS, sprite, markup, `resolved()`, the renderer. Change it in one file, copy it to the other, run `node scripts/check-manuals.mjs`. The `TOKENS` fence inside `<style>` is shared with `docs/index.html` as well. Do **not** refactor this into a build step: the shell has changed twice in its life while the content changes every release, so a build step taxes the frequent operation to protect against the rare one, and it would falsify the property that `docs/*.html` *is* the source. If a **third** manual is ever proposed, revisit that decision.

Per-file values live in exactly two fences: `DOC:HEAD` (the `<title>` and meta description) and `DOC` (the per-locale subtitle, and the sibling link shown in the header, on the intro cards and in the empty-search state).

Structure of the `MANUAL` block, identical in both files:

- `LANGS` / `UI` — the chrome strings, per locale.
- `MANUAL.en` — the canonical content: `intro` plus `parts[]`, each part carrying `{ id, icon, title, blurb, sections[] }`, and each section `{ id, title, audience, route, summary, steps[], fields[], notes[] }`. Only `id`, `title` and `summary` are required; a section renders whichever blocks it has.
- `MANUAL.az` / `MANUAL.ru` / `MANUAL.tr` — **overlays**, not copies. `resolved()` merges each over English section-by-section, so a missing translation renders the English text with a visible "not translated yet" note instead of vanishing. Same posture as the library's own `LocaleProvider` merge. A translation may therefore be partial and still safe to ship.
- Icons are an inline `<svg><defs>` sprite referenced by `<use href="#i-…">`. **No emoji anywhere** — add a new `<symbol id="i-…" viewBox="0 0 24 24">` to the sprite instead. The `viewBox` is not optional: artwork is drawn on a 24×24 grid and every reference is sized in CSS (13–22px), so a symbol without one is not scaled down, it is cropped to its top-left corner. v10.0.1 shipped every icon on the page clipped that way.

**Rule: any change that alters what an owner or cashier sees or does updates the *relevant* manual in the same change** — the routing rule above decides which. A new admin page, a new field on an existing screen, a renamed control, a changed default, a new role capability, a new setting, a new POS behaviour — all of it lands in that file's `MANUAL.en` in the same commit.

**Overlay parity is enforced.** When you change an English section, its `az`/`ru`/`tr` overlay is re-translated in the same change **or deleted** so the fallback notice shows. Never leave a stale overlay: a section that is present-but-stale renders as authoritative and silently hides the new English text, which is strictly worse than showing English with a notice. `scripts/check-manuals.mjs` fails the build when `steps`/`fields`/`notes` array lengths drift out of step with English.

**Section ids are the deep-link anchors and must be globally unique across both manuals.** Renaming one is a broken-link change. The guard asserts the two files' id sets are disjoint.

The sprite is shared verbatim, so a symbol used in one manual and unused in the other is expected — do not prune it.

Two hard constraints, both learned the expensive way:

1. **Document only what the code renders.** Until v10.0.0 the in-admin help page described a `Settings → API keys` screen, a `Locations` page, and a separate desktop POS app. None existed. Before writing a step, open the component and confirm the control is there. A type definition, a Firestore field, or a code comment is *not* evidence that a user-facing screen exists.
2. **Deliberate gaps must stay visible.** Where the UI ships a disabled control or a "coming in a later release" affordance (currently: the local-storage option and the non-browser printer transports at `/pos/settings`), the manual says so plainly. Never document a placeholder as if it works. The same applies to whole missing features — no returns screen, no shift, no cash drawer, no offline queue — and to enforcement that does not enforce: a POS licence problem never blocks a sale, because `commitPosSale` does not consult licence state at all.
3. **Do not trust this repo's own docs as evidence either.** v10.2.0 found `scaffold/create.mjs` claiming `--pos-only` "seeds the storefront-off feature flag" (it does not — it only implies `--with-pos`), and `INSTALL.md`, the scaffolder's generated README and the in-admin help page all routing owners to a "POS → Shops → Edit" screen that has never existed in this package. Verify against `src/`, not against prose.

**The register’s design system (v12.1.0).** The till is styled with classes, not inline styles, and
the sheet is a string in [src/pos/theme/pos-stylesheet.ts](src/pos/theme/pos-stylesheet.ts) that
`PosStyleScope` renders into the tree. Four things to know:

1. **It is not in `globals.css`, and must not be moved there.** That file ships as a passthrough the
   consumer imports once at their app root. Every other component is inline-styled, so a consumer who
   never added that import still gets a working storefront — moving the register onto classes in that
   file would have made the import load-bearing, and a shop upgrading would have opened the till to
   unstyled HTML. Releases must never require a consumer hand-edit.
2. **`PosStyleScope` dedupes through React context, not a module flag.** `PosGuard` and `PosShell` are
   both public exports and either can be mounted alone, so both carry it; the normal arrangement nests
   them. A module-level flag would leak between requests on a shared server.
3. **Tokens are `--cpos-*` on `:root`, and brand hues are derived, never restated.** `--cpos-brand` is
   whatever `--caspian-primary` resolves to, tinted with `color-mix()` behind an `@supports` fallback.
   The old chrome hardcoded `rgba(26,115,232,0.25)` — the RGB of the default blue — in four places, and
   those glows stayed blue on every other theme. Tokens live at the document root because `DropdownMenu`,
   `Dialog` and the toast stack all portal into `document.body`.
4. **Dark mode is `:root[data-cpos-theme="dark"]`**, written by `PosChromeProvider`. It is a device
   preference in `pos-preferences.ts`, beside the scanner gap, for the same reason: one counter faces a
   window and another is in a stockroom, and the shop has no opinion about either.

The nav lives in [src/pos/pos-sidebar.tsx](src/pos/pos-sidebar.tsx), not the top bar. The old comment on
`PosShell` argued a sidebar costs pixels the sale needs; that was true of the admin panel’s fixed column,
but the bar it defended had grown to six links plus a search box, two dropdowns, a status pill and an
install button, and `flexWrap` stacked all of it into two or three rows on a narrow till. Do not move nav
back into `PosTopbar` — the bar’s job is to say which screen you are on.

**There is no guard on the POS nav.** `check-scaffold-routes.mjs` protects the admin panel’s
`DEFAULT_ADMIN_NAV` against its dispatcher; the register’s `items` array and the `switch (head)` in
`PosRoot` can still drift silently. Keep them in step by hand.

**Standalone mode (v11.0.0).** `<CaspianStoreProvider standalone>` boots the whole tree with **no Firebase project**: catalogue, staff, sales and receipt numbers live in IndexedDB and the till contacts nothing. Four rules hold it together:

1. **`standalone` is explicit, never inferred.** A missing or broken `firebaseConfig` throws at mount as it always did. Falling back automatically would mean a real shop whose credentials broke came up as an empty local register taking sales into a database nobody knows about — a failure that looks like a working till.
2. **`useCaspianFirebase()` / `useCaspianCollections()` stay strict** and throw in standalone. Ninety-odd storefront and admin call sites need a real project; widening their return type would push a null check into every one of them to serve a handful of screens. Those few use `useCaspianFirebaseOptional()`, `useCaspianCollectionsOptional()` and `useCaspianStandalone()`.
3. **`PosStorageAdapter` ([src/pos/storage/types.ts](src/pos/storage/types.ts)) is the only seam.** `PosLocalAdapter` is an implementation of it, not a second copy of the register. Every register screen is written against the interface — keep it that way, and do not branch on the mode inside a screen.
4. **The mode is a property of the deployment, not a per-device toggle.** `resolvePosStorageMode` ignores the stored preference on purpose, and the `/pos/settings` radio is read-only. A per-device switch was a trap: a cloud shop that picked "this computer only" got a register backed by an empty local catalogue with no way to fill it, because the local back office is part of a standalone deployment.

Local roles (`PosLocalRole = 'superadmin' | 'admin' | 'staff'`) are **deliberately not** the cloud `UserRole`, which is mirrored into Auth custom claims and named in `firestore.rules`. The two models answer different questions; keep them apart.

The money arithmetic lives in [src/pos/standalone/price-local-sale.ts](src/pos/standalone/price-local-sale.ts) as a pure function, split out of the IndexedDB transaction so it can be checked in CI without a browser — `scripts/check-standalone.mjs` does exactly that. Anything that changes what a customer is charged goes there, with a matching assertion.

**Standalone data is not rebuildable.** `clearPosDb` wipes only the five cloud stores (caches and outboxes whose truth is in Firestore). The seven `local*` stores hold a shop's only copy of its catalogue, staff, trading history and drawer counts; erasing them is `factoryResetLocalStore`, a separate call. Never widen `clearPosDb` to cover them. A new `local*` store joins `factoryResetLocalStore` and the backup in the same change — `local-backup.ts` records what it cost the one time roles were left out of the backup.

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
- **Notify the user at the end of each task** with: the new version number, the commit SHA, the release URL, the announcement discussion URL, a ready-to-paste install command pinning the new tag — `npm install github:CaspianTools/script-caspian-store#vX.Y.Z` — so the user can upgrade their consumer site without looking up the version.
- **The register ships as a PWA, and only as a PWA.** There is no desktop app and no `.exe`.
  A shop installs the till from Chrome or Edge with the Install button in the register's own
  header (`PosInstallButton`, backed by `buildPosWebManifest()`), which gives it its own icon,
  its own window and its own service worker at scope `/pos`. A Tauri shell under `desktop/`
  shipped between v0.1.0 and v1.0.1 and was removed in v12.0.0; do not reintroduce one without
  the owner asking for it, and do not point a shop at the old `desktop/v*` releases.

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

**Do not add Jest / Vitest / Playwright for component or unit tests** without asking first. The rules tests are a narrow, deliberately scoped exception, as is [scripts/check-standalone.mjs](scripts/check-standalone.mjs) — plain `node:assert` against the built ESM, no runner and no dependency, in the same family as the other `scripts/check-*.mjs` guards.

```bash
npm run build && node scripts/check-standalone.mjs
```

Covers the standalone till's money arithmetic and its CSV round-trip. Both are pure by design; the IndexedDB layer around them needs a browser and is checked by hand.

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

**Bump the manuals' version stamp too.** `MANUAL.en.intro.version` in **both** `docs/user-manual.html` and `docs/pos-manual.html` must read `v` + the new `package.json` version. `scripts/check-manuals.mjs` fails CI otherwise — it exists because that string sat at `v10.0.0` through two releases with nothing checking it.

**No lock file to sync** — this repo does not commit `package-lock.json`. (If that changes, run `npm install --package-lock-only`.)

### 6. Update documentation

Update **all** documentation affected by the changes. Only skip if the file clearly doesn't touch what changed.

- [README.md](README.md) — user-facing overview, usage examples, current feature set
- [INSTALL.md](INSTALL.md) — consumer setup (scaffolder, Next.js/Vite/CRA), Firebase deployment, Stripe wiring
- [CHANGELOG.md](CHANGELOG.md) — covered in step 5
- [CLAUDE.md](CLAUDE.md) — this file, if an architecture invariant, convention, or workflow rule shifted
- `docs/*.html` — if what an owner or cashier sees or does changed (see the routing rule above)
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

**The catch:** this repo does **not** auto-ship on push to `main`. Pushing `main` only runs CI checks — the rules-behavior test ([rules.yml](.github/workflows/rules.yml)), the consumer-tarball exports smoke ([exports-smoke.yml](.github/workflows/exports-smoke.yml)), the scaffold-routes drift check ([scaffold-routes-smoke.yml](.github/workflows/scaffold-routes-smoke.yml)), and the manuals shell/translation drift check ([manuals-smoke.yml](.github/workflows/manuals-smoke.yml)) — none of which deploy or publish. A **release** happens only when you push an annotated **`vX.Y.Z` tag** and cut a GitHub Release with the `.tgz` (main package), and the sibling `create-caspian-store/` publishes to npm via OIDC **only on a `create-caspian-store/v*` tag** ([publish-create-caspian-store.yml](.github/workflows/publish-create-caspian-store.yml)). So the *release* is the tag + Release + Discussion cycle in the [Pre-Commit Checklist](#pre-commit-checklist), not the branch push. Inside a worktree that whole cycle **must be adapted** — do NOT blindly land from one:

1. **Commit, pause before landing.** Auto-commit finished work on the `worktree-<name>` branch, then **stop and report**. Never merge to `main`, push `main`, or push a release tag without the owner's explicit go-ahead. *(On `main` — the normal solo flow — the checklist is unchanged: bump → verify → commit → tag → push → Release → Discussion.)*
2. **Serialize landings — one at a time.** Never land two worktrees to `main` in parallel. If another worktree/session is still in flight, wait for it to land first. There's no live cross-session signal, so "wait" means: at land time `git fetch` and rebase onto whatever `origin/main` now is; if the owner says another is mid-flight, hold until told it's done.
3. **Resolve conflicts in the worktree, never on `main`.** At land time: `git fetch origin` → **rebase `worktree-<name>` onto the latest `origin/main`** → resolve every conflict *there*, so `main` only ever receives an already-merged, clean tree.
4. **Finalize the version + changelog bump last.** The `version` in [package.json](package.json) and the top entry in [CHANGELOG.md](CHANGELOG.md) (with its required `### Consumer action required on upgrade` / `### No consumer action required` heading) are the *guaranteed* collision between two shippable worktrees — and the `vX.Y.Z` git tag derived from them. Don't fix the number until after the rebase — take *current-main + 1* per semver, then rewrite the changelog entry and only tag once `main` is settled.
5. **Re-verify + rebuild after resolving.** Re-run the checklist's verify steps in the worktree: `npm run typecheck` (strict `tsc --noEmit`), `npm test` (the Firestore/Storage rules-behavior suite — needs Java + firebase-tools; else rely on CI), `npm run build` (tsup, both entries), `npm pack` (the release `.tgz`), and `node scripts/check-exports.mjs` / `node scripts/check-scaffold-routes.mjs` / `node scripts/check-manuals.mjs` if the public API, the scaffolder routes, or the manuals shifted. A conflict resolution that isn't re-verified is a bug waiting to ship to consumers.
6. **Only then ship.** Fast-forward `main` to the clean, verified branch → `git push origin main` → then run the release tail from the checklist: annotated `git tag -a vX.Y.Z` → `git push origin main --tags` → `gh release create` with the `.tgz` → Announcements Discussion → (if the sibling changed) republish `create-caspian-store` via its `create-caspian-store/v*` tag. **Never tag or cut a Release from a conflicted or failing tree.**

For solo, single-stream work, **skip worktrees and work on `main` directly** — the Pre-Commit Checklist needs no adaptation. Reserve worktrees for genuine parallelism (two tasks at once) or experiments you may not ship.
