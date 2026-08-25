# CLAUDE.md — the standalone till

Orientation for AI sessions working on the **standalone register**. It is a
separate product from the store library that surrounds it: its own version, its
own changelog, and a release cycle that ends at `git push`.

The library's own rules are in [../CLAUDE.md](../CLAUDE.md) and still apply to
everything this file does not claim — strict TypeScript, the framework-adapter
contract, the i18n layer, the `"use client"` boundary, the style guide, and the
"never do without explicit user permission" list. What this file overrides is the
**release cycle**, and it names the **boundary** that decides which cycle a
change follows.

## What the till is

`<CaspianStoreProvider standalone>` boots the whole tree with **no Firebase
project**: catalogue, staff, sales and receipt numbers live in IndexedDB and the
till contacts nothing. The deployable product is this folder — a Vite app
(`caspian-pos-pwa`) that consumes the library through `file:..`, builds to
`pos/dist`, and is served under `/pos/` so the manifest scope and the service
worker scope match. See [scripts/build.mjs](scripts/build.mjs).

It ships as a PWA and only as a PWA. A shop installs it from Chrome or Edge with
the Install button in the register's own header. There is no desktop app and no
`.exe`; a Tauri shell shipped between v0.1.0 and v1.0.1 of the *library* and was
removed in v12.0.0. Do not reintroduce one without the owner asking.

A shop running the standalone till **never installs anything from npm**. That is
the whole reason this product versions separately: pinning it to the storefront's
release number told those shops nothing true.

## Versioning

The till's version is [`pos/package.json`](package.json) `#version`, and nothing
else. It started at **1.0.0** and moves by [semver](https://semver.org/) on the
till's own terms:

- **patch** — a fix a cashier would not have to be told about
- **minor** — a new screen, control, or capability at the counter
- **major** — a shop has to change how it works, or data moves

The library's `package.json#version` is a different number with a different
meaning. **A standalone-only change never touches it**, never adds an entry to
the root [../CHANGELOG.md](../CHANGELOG.md), and never cuts a `vX.Y.Z` tag.

Nothing renders the till's version — there is deliberately no
`CASPIAN_POS_VERSION` constant and no generation step, because generating a
string no screen displays is bookkeeping pretending to be code. The number is
read by people and by [../scripts/check-manuals.mjs](../scripts/check-manuals.mjs),
which pins the footer stamp in `docs/pos-manual.html` to it.

`pos/` is not in the library's `package.json#files`, so none of this ships in the
npm tarball. That is correct — do not add it.

## The boundary

"Standalone" is not a folder, so the line has to be written down. **The till's
own files:**

- `../src/pos/standalone/**` — all of it
- [../src/pos/storage/local-adapter.ts](../src/pos/storage/local-adapter.ts) — the local `PosStorageAdapter`
- `pos/**` — this folder
- [../scripts/check-standalone.mjs](../scripts/check-standalone.mjs) and `.github/workflows/standalone-smoke.yml`
- [../docs/pos-manual.html](../docs/pos-manual.html) — dual-owned; its version stamp tracks *this* product

Plus **five shared files a standalone change may touch** without becoming a
library change, provided the touch is additive and gated so a cloud-backed
register cannot tell the difference:

| File | Permitted touch |
| --- | --- |
| `../src/pos/index.ts`, `../src/index.ts` | Adding exports of standalone symbols |
| `../src/i18n/messages.ts` + `locales/{az,ru,tr}.ts` | Adding `pos.*` keys only standalone screens read |
| [../src/pos/pos-root.tsx](../src/pos/pos-root.tsx) | Mounting a standalone gate in `PosShell` that no-ops outside standalone |
| [../src/pos/pos-settings-page.tsx](../src/pos/pos-settings-page.tsx) | Controls rendered behind `local.standalone` |
| [../src/pos/pos-preferences.ts](../src/pos/pos-preferences.ts) | Device preferences only standalone code reads |

`.github/exports-snapshot.json` follows the barrels automatically — regenerate it
with `node scripts/check-exports.mjs --write`, never hand-edit it.

The worked example is v1.0.0's screen lock. `PosLockGate` computes
`active = standalone && !!user && minutes > 0`, and its settings control sits
behind `local.standalone ? … : null`. A cloud register mounts the same tree and
gets nothing.

**Escape hatch.** Anything that changes behaviour for a *cloud-backed* register —
any other file under `../src/pos/`, or anything outside the lists above — is a
library change and follows the root checklist. A change that does both needs both
bumps, and says so in its commit body.

Do not resolve a borderline case by widening the gate. If a standalone feature
wants something from a shared file that a cloud register would also see, that is
the signal it is a library change, not a signal to add a mode branch inside a
screen.

## The rules that hold standalone together

Moved here from the root file, so there is one source of truth.

1. **`standalone` is explicit, never inferred.** A missing or broken
   `firebaseConfig` throws at mount as it always did. Falling back automatically
   would mean a real shop whose credentials broke came up as an empty local
   register taking sales into a database nobody knows about — a failure that
   looks like a working till.
2. **`useCaspianFirebase()` / `useCaspianCollections()` stay strict** and throw in
   standalone. Ninety-odd storefront and admin call sites need a real project;
   widening their return type would push a null check into every one of them to
   serve a handful of screens. Those few use `useCaspianFirebaseOptional()`,
   `useCaspianCollectionsOptional()` and `useCaspianStandalone()`.
3. **`PosStorageAdapter` ([../src/pos/storage/types.ts](../src/pos/storage/types.ts))
   is the only seam.** `PosLocalAdapter` is an implementation of it, not a second
   copy of the register. Every register screen is written against the interface —
   keep it that way, and do not branch on the mode inside a screen.
4. **The mode is a property of the deployment, not a per-device toggle.**
   `resolvePosStorageMode` ignores the stored preference on purpose, and the
   `/pos/settings` radio is read-only. A per-device switch was a trap: a cloud
   shop that picked "this computer only" got a register backed by an empty local
   catalogue with no way to fill it, because the local back office is part of a
   standalone deployment.

**Local roles are not cloud roles.** `PosLocalRole` is **deliberately not** the
cloud `UserRole`, which is mirrored into Auth custom claims and named in
`firestore.rules`. The two models answer different questions; keep them apart.
Since v13.2.0 a local role is just a `string` id backed by a `RoleDefinition`
listing its capabilities — `POS_LOCAL_ROLES` (`staff`, `admin`, `superadmin`) are
the built-ins that ship with every till, not the whole set, because App admin can
define custom ones. Grant against `PosLocalCapability`, never against a hardcoded
role id; the People screen and the Add person dialog got that wrong once and a
custom role granted App admin could not hand out Support.

**The money arithmetic is a pure function.**
[../src/pos/standalone/price-local-sale.ts](../src/pos/standalone/price-local-sale.ts)
was split out of the IndexedDB transaction so it can be checked in CI without a
browser, which is exactly what `check-standalone.mjs` does. Anything that changes
what a customer is charged goes there, with a matching assertion.

**Standalone data is not rebuildable.** There are five cloud stores — `queue`,
`leases`, `catalog`, `openTicket`, `meta` — caches and outboxes whose truth lives
in Firestore, and `clearPosDb` wipes four of them. It spares `openTicket` on
purpose: a support engineer clearing a stuck queue must not wipe the sale the
cashier is standing there ringing up.

The **twelve** `local*` stores are the opposite. They hold a shop's only copy of
its catalogue, staff, trading history, stock lots and drawer counts; erasing them
is `factoryResetLocalStore`, a separate call. Never widen `clearPosDb` to cover
them. A new `local*` store joins `factoryResetLocalStore` and the backup in the
same change — `local-backup.ts` records what it cost the one time roles were left
out of the backup. That count moves; if you add one, correct it here rather than
leaving the next reader a stale number.

## The manual

Anything that changes what a cashier or owner sees or does updates
[../docs/pos-manual.html](../docs/pos-manual.html) in the same change. The full
manual rules — the shell rule, overlay parity, globally-unique section ids, the
no-emoji sprite and its mandatory `viewBox` — are in [../CLAUDE.md](../CLAUDE.md)
and are unchanged by this file.

Two things are specific to the till:

- Its **version stamp tracks this product.** All four `intro.version` occurrences
  (English plus the `az`/`ru`/`tr` overlays) read `v` + `pos/package.json#version`.
  The user manual's four stamps track the library. `check-manuals.mjs` enforces
  both.
- **Document only what the code renders, and keep deliberate gaps visible.** The
  standalone till has no returns screen, no shift, no cash drawer and no offline
  queue, and a POS licence problem never blocks a sale because `commitPosSale`
  does not consult licence state at all. Say so plainly rather than omitting it.

## Checklist for a standalone change

In order. If a step fails, fix it and re-run from that step.

```bash
npm run typecheck                                   # from the repo root
npm run build && node scripts/check-standalone.mjs  # money, CSV, auth assertions
node scripts/check-manuals.mjs                      # stamps + overlay parity
node scripts/check-exports.mjs                      # add --write if barrels changed
cd pos && npm run typecheck && npm run build        # the till builds against the library
```

Then:

1. **Review the diff against the boundary above.** If it crossed, stop and follow
   the root checklist instead — or both.
2. **Bump [`pos/package.json`](package.json).**
3. **Write the [`pos/CHANGELOG.md`](CHANGELOG.md) entry**, with exactly one of
   `### Nothing to do on a till` / `### Action needed on each till`.
4. **Update [../docs/pos-manual.html](../docs/pos-manual.html)** — content, and
   all four version stamps.
5. **Commit** in imperative mood, body explaining the why.
6. **Push.**

**Explicitly not part of this cycle**, and never done for a standalone-only
change: bumping the root `package.json`, adding a root `CHANGELOG.md` entry,
restamping `docs/user-manual.html`, updating the README/INSTALL version pins,
`npm pack`, an annotated `vX.Y.Z` tag, `gh release create`, the Announcements
Discussion, or anything to do with `create-caspian-store`.

`npm test` is the Firestore/Storage rules suite. A standalone change cannot reach
it — the till has no Firebase project — so it is **N/A** unless the change also
touched `firebase/*.rules`, which would make it a library change anyway.
