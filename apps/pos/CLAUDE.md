# CLAUDE.md — the standalone till

Orientation for AI sessions working on the **standalone register**. It is a
separate product from the store library that surrounds it: its own version, its
own changelog, its own design system, and a release cycle that ends at
`git push`.

**Everything about the register is decided here.** The root
[../../CLAUDE.md](../../CLAUDE.md) points at this file and says nothing more
about the till. What still applies from it is the house style that has nothing
to do with which product you are in — strict TypeScript, the framework-adapter
contract, the `"use client"` boundary, the commit-message style, and the "never
do without explicit user permission" list.

**What the till is built out of** — every `--cpos-*` token, every control, the
three page shapes to copy — is in [DESIGN.md](DESIGN.md). Read it before adding
a screen, and update it in the same change as any control, token or layout it
describes. Nothing enforces that in CI.

## What the till is

`<CaspianStoreProvider standalone>` boots the whole tree with **no Firebase
project**: catalogue, staff, sales and receipt numbers live in IndexedDB and the
till contacts nothing. `standalone` is passed explicitly and never inferred.

The deployable product is this folder — a Vite app (`caspian-pos-pwa`) that
builds to `apps/pos/dist` and is served under `/pos/` so the manifest scope and
the service-worker scope match. See [scripts/build.mjs](scripts/build.mjs).

It ships as a PWA and only as a PWA. A shop installs it from Chrome or Edge with
the Install button in the register's own header (`PosInstallButton`), which gives
it its own icon, its own window and its own service worker at scope `/pos`.
There is no desktop app and no `.exe`; a Tauri shell shipped between v0.1.0 and
v1.0.1 of the *library* and was removed in v12.0.0. Do not reintroduce one
without the owner asking.

A shop running the till **never installs anything from npm**. That is the whole
reason this product versions separately: pinning it to the storefront's release
number told those shops nothing true.

## The boundary

**It is this directory.** A change under `apps/pos/` is a till change and follows
the checklist at the foot of this file. A change anywhere else is a library
change and follows the root checklist. There is no third case, no shared-file
table, and no permitted overlap — which is the point of the v14.0.0 move. Before
then "standalone" was not a folder, so the line had to be written down as six
files a till change was allowed to touch additively, policed by whoever
remembered to read it.

**What crosses the line, and how.** The till depends on the library the way any
consumer does — `"@caspian-explorer/script-caspian-store": "file:../.."` — and
the dependency runs one way. Nothing under `../../src/` imports from here.

What it takes from the library is small and worth knowing, because growing it is
how the two products creep back together:

| From | What |
| --- | --- |
| the main entry | the provider tree and its hooks, `useT`, `useToast`, `cn`, the CSV helpers, `Button` / `Input` / `Select` / `DropdownMenu` / `FieldDescription`, and the shared domain types |
| `/firebase` | `caspianCollections` — the dormant cloud adapter only |

Two things deliberately did **not** come from the library:

- **Icons.** [src/icons.tsx](src/icons.tsx) is a copy of the 37 the register
  draws with. DESIGN.md's rule is that the till does not reach into the store's
  `src/ui/` for a control, and these were the last symbols holding the two
  together. They are static path data on a 24×24 grid; if one ever changes, both
  copies change.
- **Strings.** Every `pos.*` message lives in [src/i18n/](src/i18n/) and reaches
  the provider through `messagesByLocale`. Each overlay is composed onto English
  *there* rather than handed over bare — see the comment in
  [src/i18n/index.ts](src/i18n/index.ts) for why a bare overlay would put
  `pos.tender.due` on a cashier's tender screen.

**The cloud register is dormant, and it lives here too.**
[src/cloud-admin/](src/cloud-admin/) holds the two admin screens the cloud-backed
register used, and `src/pos/storage/cloud-adapter.ts`, `queued-cloud-adapter.ts`,
`offline/` and `license/` are its runtime. All of it type-checks; nothing mounts
any of it. The library routes no `/pos` and offers no switch to turn one on.
Leave it dormant rather than deleting it — switching it back on should be
re-adding a route, not an archaeology exercise.

## Versioning

The till's version is [`apps/pos/package.json`](package.json) `#version`, and
nothing else. It started at **1.0.0** and moves by [semver](https://semver.org/)
on the till's own terms:

- **patch** — a fix a cashier would not have to be told about
- **minor** — a new screen, control, or capability at the counter
- **major** — a shop has to change how it works, or data moves

The library's `package.json#version` is a different number with a different
meaning. **A till change never touches it**, never adds an entry to the root
[../../CHANGELOG.md](../../CHANGELOG.md), and never cuts a `vX.Y.Z` tag.

Since v1.2.0 the till renders its own version, at the foot of `/pos/settings` and
of every App admin pane, so the number needs a constant: `CASPIAN_POS_VERSION` in
[src/pos/standalone/pos-version.ts](src/pos/standalone/pos-version.ts). That file
is **generated by the library's [`tsup.config.ts`](../../tsup.config.ts)** from
this `package.json`, and is committed so `tsc --noEmit` needs no prior build.
Do not hand-edit it, and do not export it from a barrel.

The generator living on the other side of the boundary is the one deliberate
exception to "nothing over there knows about the till", and it is there because
this app has no build step that runs before `tsc` — one generator beats two that
can disagree. Bumping this `package.json` is still a till change: the generator
reads the number rather than carrying it.

The number is also read by people and by
[../../scripts/check-manuals.mjs](../../scripts/check-manuals.mjs), which pins the
footer stamp in `docs/pos-manual.html` to it.

`apps/pos/` is not in the library's `package.json#files`, so none of this ships
in the npm tarball. That is correct — do not add it.

## The rules that hold the till together

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
3. **`PosStorageAdapter` ([src/pos/storage/types.ts](src/pos/storage/types.ts))
   is the only seam.** `PosLocalAdapter` is an implementation of it, not a second
   copy of the register. Every register screen is written against the interface —
   keep it that way, and do not branch on the mode inside a screen.
4. **The mode is a property of the deployment, not a per-device toggle.**
   `resolvePosStorageMode` ignores the stored preference on purpose, and the
   `/pos/settings` radio is read-only. A per-device switch was a trap: a cloud
   shop that picked "this computer only" got a register backed by an empty local
   catalogue with no way to fill it, because the local back office is part of a
   standalone deployment.

**App admin is switches, and two of them are load-bearing.** Every control on
`/pos/app-admin` writes on the flip, with no Save button anywhere on the page,
and a failed write is reported rather than silently reverted (the knob follows
the stored record, so a rejected write leaves it where it was on its own). The
two that must never move are `appAdmin.view` and `appAdmin.roles`: they cannot
be taken off `superadmin`, and they cannot be taken off whichever role the
signed-in account holds. Both are the same trap seen from two sides, and a
standalone till has no server-side override to undo either. `LOCKED_IDS` guards
the role's own enable switch for the same reason.

**Local roles are not cloud roles.** `PosLocalRole` is **deliberately not** the
cloud `UserRole`, which is mirrored into Auth custom claims and named in
`firestore.rules`. The two models answer different questions; keep them apart.
Since v13.2.0 of the library a local role is just a `string` id backed by a
`RoleDefinition` listing its capabilities — `POS_LOCAL_ROLES` (`staff`, `admin`,
`superadmin`) are the built-ins that ship with every till, not the whole set,
because App admin can define custom ones. Grant against `PosLocalCapability`,
never against a hardcoded role id; the People screen and the Add person dialog
got that wrong once and a custom role granted App admin could not hand out
Support.

**The money arithmetic is three pure functions**, each split out of the layer
that stores or renders it so it can be checked in CI without a browser, which is
exactly what `check-standalone.mjs` does:

- [src/pos/money.ts](src/pos/money.ts) — the primitives. `toMinor`/`fromMinor`,
  cash rounding, the `-0` guard, currency validation. React-free and with no
  `standalone/` import, because the tender dialog and the receipt model are
  shared files a cloud register renders too. It exists because these had **four**
  copies across four files and the one that drifted was the change a customer is
  handed.
- [src/pos/standalone/price-local-sale.ts](src/pos/standalone/price-local-sale.ts)
  — what a customer is **charged**.
- [src/pos/tender-allocation.ts](src/pos/tender-allocation.ts) — what they are
  **handed back**, and what each tender is recorded as having covered. That last
  part is not cosmetic: `shift-totals.ts` reads a tender'''s `amount` as the cash
  that netted into the drawer, so writing through what a cashier typed rather
  than what it covered is a drawer that closes over.

Anything that changes any of the three goes there, with a matching assertion.

**Till data is not rebuildable.** There are five cloud stores — `queue`,
`leases`, `catalog`, `openTicket`, `meta` — caches and outboxes whose truth lives
in Firestore, and `clearPosDb` wipes four of them. It spares `openTicket` on
purpose: a support engineer clearing a stuck queue must not wipe the sale the
cashier is standing there ringing up.

The **fourteen** `local*` stores are the opposite. They hold a shop's only copy
of its catalogue, staff, trading history, stock lots, counters and drawer counts;
erasing them is `factoryResetLocalStore`, a separate call. Never widen
`clearPosDb` to cover them. A new `local*` store joins `factoryResetLocalStore`
and the backup in the same change — `local-backup.ts` records what it cost the
one time roles were left out of the backup. That count moves; if you add one,
correct it here rather than leaving the next reader a stale number.

## The look

The till is styled with classes, not inline styles, and the sheet is a string in
[src/pos/theme/pos-stylesheet.ts](src/pos/theme/pos-stylesheet.ts) that
`PosStyleScope` renders into the tree. Four things to know:

1. **It is not in the library's `globals.css`, and must not be moved there.**
   That file ships as a passthrough the consumer imports once at their app root.
   Every storefront component is inline-styled, so a consumer who never added
   that import still gets a working shop — putting the register's classes there
   would have made the import load-bearing.
2. **`PosStyleScope` dedupes through React context, not a module flag.**
   `PosGuard` and `PosShell` can each be mounted alone, so both carry it; the
   normal arrangement nests them. A module-level flag would leak between requests
   on a shared server.
3. **Tokens are `--cpos-*` on `:root`, and brand hues are derived, never
   restated.** `--cpos-brand` is whatever `--caspian-primary` resolves to, tinted
   with `color-mix()` behind an `@supports` fallback. The old chrome hardcoded
   `rgba(26,115,232,0.25)` — the RGB of the default blue — in four places, and
   those glows stayed blue on every other theme. Tokens live at the document root
   because `DropdownMenu`, `Dialog` and the toast stack all portal into
   `document.body`.
4. **Dark mode is `:root[data-cpos-theme="dark"]`**, written by
   `PosChromeProvider`. It is a device preference in `pos-preferences.ts`, beside
   the scanner gap, for the same reason: one counter faces a window and another
   is in a stockroom, and the shop has no opinion about either.
5. **The register has its own switch.** `.cpos-switch` (rendered by
   [src/pos/standalone/admin/pos-switch.tsx](src/pos/standalone/admin/pos-switch.tsx))
   is built to the 44px touch floor and resolves through the `--cpos-*` tokens.
   The library's `<Switch>` is 38×22 and hardcodes `rgba(0,0,0,0.22)` and `#fff`,
   so on a till in dark mode it is near-black on near-black. Don't reach for it
   here — the two surfaces have different floors.

The nav lives in [src/pos/pos-sidebar.tsx](src/pos/pos-sidebar.tsx), not the top
bar. An older comment on `PosShell` argued a sidebar costs pixels the sale needs;
that was true of the admin panel's fixed column, but the bar it defended had
grown to six links plus a search box, two dropdowns, a status pill and an install
button, and `flexWrap` stacked all of it into two or three rows on a narrow till.
Do not move nav back into `PosTopbar` — the bar's job is to say which screen you
are on.

**Routing is in the URL fragment**, in
[src/pos-navigation.tsx](src/pos-navigation.tsx). It used to be a module
variable in `memory-navigation.tsx`, which kept the shop's static host out of
the routing problem but cost the register every URL it had: no bookmarks, no
deep links, Back left the app, and a reload always landed on the register no
matter where the cashier had been.

The fragment answers the original worry and returns the rest. The document
requested is always `/pos/`, and the part after `#` is never sent to a server,
so no host needs a rewrite rule — which History routing would have needed, and
which the service worker cannot stand in for, because a first visit, cleared
site data or a private window has no controlling worker. It also lines up with
the offline shell: `/pos/` is the one document the cache reliably holds, so
reloading a deep link works offline too.

Route strings are unchanged — `/pos/store/abc` throughout — so `PosRoot`'s
switch, `screenOf` and `stripLocalePrefix` know nothing about it. Moving to
History routing later is this one file plus host configuration.

**Two nav arrays have nothing checking them.** `PosSidebar`'s `items` and the
`switch (head)` in `PosRoot` are two halves of one thing and can drift silently;
so can the `NAV` array in
[pos-app-admin-page.tsx](src/pos/standalone/admin/pos-app-admin-page.tsx) and the
ternary chain that renders its panes. Keep each pair in step by hand.

## The manual

Anything that changes what a cashier or owner sees or does updates
[../../docs/pos-manual.html](../../docs/pos-manual.html) in the same change.

The manual stayed in the library's `docs/` when the till moved out, and that is
deliberate: it shares a byte-identical shell with `user-manual.html`, is reached
through the picker at `docs/index.html`, and both ship in the tarball via
`package.json#exports`. Moving one out would break the picker's second card for
every consumer and split the shell guard across two roots. The file's *content*
is this product's; its *location* is the library's.

The full manual rules — the shell rule, overlay parity, globally-unique section
ids, the no-emoji sprite and its mandatory `viewBox` — are in
[../../CLAUDE.md](../../CLAUDE.md) and are unchanged. Two things are specific to
the till:

- Its **version stamp tracks this product.** All four `intro.version`
  occurrences (English plus the `az`/`ru`/`tr` overlays) read `v` +
  `apps/pos/package.json#version`. The user manual's four track the library.
  `check-manuals.mjs` enforces both.
- **Document only what the code renders, and keep deliberate gaps visible.** The
  till has no returns screen and no offline queue, the local-storage option and
  the non-browser printer transports at `/pos/settings` are disabled placeholders,
  and a POS licence problem never blocks a sale because `commitPosSale` does not
  consult licence state at all. Say so plainly rather than omitting it.

## Checklist for a till change

In order. If a step fails, fix it and re-run from that step.

```bash
# from the repo root -- the till links the library's dist/, so build it first
npm run typecheck && npm run build

cd apps/pos
npm run typecheck        # strict tsc --noEmit over the whole till
npm run check            # money, CSV, auth, roles, backup pruner
npm run build            # the PWA, entry document moved down into /pos/

cd ../.. && node scripts/check-manuals.mjs   # stamps + overlay parity
```

`npm run check` builds `src/check-entry.ts` into `.check/` and runs
[scripts/check-standalone.mjs](scripts/check-standalone.mjs) against it. That
entry is the guard's surface and nothing else's — add to it when a check needs
something, delete from it when one stops.

Then:

1. **Review the diff against the boundary above.** If it touched anything outside
   `apps/pos/`, stop: that is a library change and follows the root checklist —
   or both, and the commit body says so.
2. **Bump [`apps/pos/package.json`](package.json).**
3. **Write the [`apps/pos/CHANGELOG.md`](CHANGELOG.md) entry**, with exactly one
   of `### Nothing to do on a till` / `### Action needed on each till`.
4. **Update [../../docs/pos-manual.html](../../docs/pos-manual.html)** — content,
   and all four version stamps.
5. **Commit** in imperative mood, body explaining the why.
6. **Push.**

**Explicitly not part of this cycle**, and never done for a till-only change:
bumping the root `package.json`, adding a root `CHANGELOG.md` entry, restamping
`docs/user-manual.html`, updating the README/INSTALL version pins, `npm pack`, an
annotated `vX.Y.Z` tag, `gh release create`, the Announcements Discussion, or
anything to do with `create-caspian-store`.

`npm test` at the root is the Firestore/Storage rules suite. A till change cannot
reach it — the till has no Firebase project — so it is **N/A** unless the change
also touched `firebase/*.rules`, which would make it a library change anyway.
