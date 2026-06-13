# Changelog

All notable changes will be documented in this file.

<!--
Every entry MUST include exactly one of these two headings:

  ### Consumer action required on upgrade
  (followed by a fenced bash block of exact commands, or a numbered list)

  ### No consumer action required
  (followed by a one-line explanation, e.g. "internal build config only; existing
  installs unaffected" or "scaffolder-only change; does not touch consumer sites")

Do not omit the heading, rename it, or fold it into `### Notes`. This is how
customers tell at a glance whether an upgrade needs attention.
-->

## v9.10.3 — Make the admin row-action kebab (⋯) visible

The per-row **⋯ action menu** on admin list pages (products, orders, users, categories, …) — which
carries **Edit**, **View on storefront**, and **Delete** — was hard to see: `MoreHorizontalIcon`
inherited the shared stroke-icon defaults (`fill: none`, `stroke: currentColor`), so its three dots
drew as thin hollow rings rather than solid dots. At small sizes they read as nearly invisible, so the
row actions looked missing even though hovering and clicking the trigger opened the menu. The dots now
fill with `currentColor` (and bump `r` 1.5 → 2), so the kebab is crisp at any size.

### No consumer action required

Visual-only fix to a shared icon; no public API, schema, rules, or index change. Existing installs get
a clearer kebab on upgrade.

### Fixed
- [src/ui/icons.tsx](src/ui/icons.tsx) — `MoreHorizontalIcon` renders solid dots (`fill="currentColor" stroke="none"`, `r="2"`) instead of faint stroked rings.

## v9.10.2 — Fix product editor dropdowns blanking on projects without the brands index

The admin **product editor** could load with its Category (and Brand) dropdowns empty — a selected
category rendered as a raw doc id and the lists showed no options. The editor loaded its reference
data in one atomic `Promise.all`, and `listActiveBrands` ran `where('isActive','==',true) +
orderBy('name')`, which requires a `productBrands` composite index. On a project where that index was
never created the query throws `failed-precondition`, the whole `Promise.all` rejects, and *categories
were never set either* (the `catch` only reset brands).

- `listActiveBrands` is now **index-free** — equality-only query plus a client-side sort, so it works
  on any project with no composite index to deploy.
- The editor loads each reference source independently (`Promise.allSettled` + per-source logging), so
  one failing query can no longer blank the others.

### No consumer action required

Fixes a runtime query; no schema, rules, or index change. Existing installs improve on upgrade — and
the editor no longer depends on a hand-created `productBrands` composite index.

### Fixed
- [src/services/brand-service.ts](src/services/brand-service.ts) — `listActiveBrands` queries by `isActive` only and sorts by name in memory (no composite index).
- [src/admin/admin-product-editor.tsx](src/admin/admin-product-editor.tsx) — reference-data effect uses `Promise.allSettled`; categories and brands are each set from their own result.

## v9.10.1 — Fix Switch label/description layout

The `Switch` component rendered its `label` and `description` in a single inline span, so a toggle
with helper text showed both on one line at the same size (e.g. `ActiveWhen off…`). The text area
is now a column: the label sits on its own line (medium weight when a description is present) and
the helper text renders beneath it. Label-only switches are unchanged.

### No consumer action required
Presentational fix to a shipped UI primitive; no API, rules, or data changes.

### Fixed
- `src/ui/switch.tsx` — stack the label above the description (was inline) and give the label medium
  weight only when a description is supplied.

## v9.10.0 — Mobile bottom-drawer nav + installable PWA

Ported from the luivante standalone fork. Makes the storefront chrome mobile-friendly and gives
consumers the pieces to ship an installable PWA, adapted to this library's framework-agnostic,
inline-styled model (no `app/` dir, no BEM CSS — so the luivante diff couldn't be copied).

**Mobile nav.** A new reusable `<BottomSheet>` primitive (dimmed veil, slide-up via the shared
`caspian-drawer-slide-up` keyframe, drag handle, Escape + body-scroll lock, focus-on-open/restore).
`<SiteHeader>` now renders a **hamburger** below 820px that opens a `<MobileNavSheet>` (the primary
nav links + account + wishlist + an "Install app" entry); the inline `.caspian-site-nav` is hidden
there via CSS. `<ShopFilterDrawer>` was refactored to sit on top of `<BottomSheet>` (no behavior
change).

**PWA.** New framework-agnostic exports consumers wire into their own app: `<ServiceWorkerRegister>`
(registers a worker in production), `<InstallAppPrompt>` + the shared `useInstallPrompt()` hook
(Android `beforeinstallprompt` + an iOS Add-to-Home-Screen hint), and `buildWebManifest(input)` — a
pure helper that returns a manifest object from a brand input, so a consumer route handler can read
`settings/site` and serve a dynamic manifest. `examples/nextjs` is wired end-to-end: a dynamic
`/manifest.webmanifest` route, a logo-derived square `/icon/[size]` route (`next/og`), `public/sw.js`
+ `offline.html`, and the layout metadata/viewport.

### Consumer action required on upgrade

To make an existing site installable (all optional — nothing breaks if you skip it):

```
1. Mount <ServiceWorkerRegister /> and <InstallAppPrompt /> in your root layout.
2. Add a public/sw.js + public/offline.html (copy examples/nextjs/public/).
3. Add an app/manifest.webmanifest route that returns buildWebManifest({ name, themeColor, ... })
   and reference it from your layout metadata (manifest: '/manifest.webmanifest').
4. (Optional) Add an app/icon/[size] route to derive icons from your logo — see examples/nextjs.
```

The mobile hamburger + `<MobileNavSheet>` are automatic once you import the library's CSS — no API
change to `<SiteHeader>`. Cart and search were already mobile-usable (full-width sheet / centered
dialog) and are unchanged.

### Added
- `src/ui/bottom-sheet.tsx` — reusable `BottomSheet` primitive.
- `src/components/mobile-nav-sheet.tsx` — header mobile nav drawer.
- `src/components/service-worker-register.tsx` — `ServiceWorkerRegister`.
- `src/components/install-app-prompt.tsx` — `InstallAppPrompt` + `useInstallPrompt()`.
- `src/pwa/build-manifest.ts` — pure `buildWebManifest()` helper.
- `examples/nextjs`: `app/manifest.webmanifest/route.ts`, `app/icon/[size]/route.tsx`, `app/_pwa-brand.ts`, `public/sw.js`, `public/offline.html`.

### Changed
- `src/components/site-header.tsx` — hamburger + `menuOpen` + mounts `<MobileNavSheet>`.
- `src/components/shop-filter-drawer.tsx` — now wraps `<BottomSheet>`.
- `src/styles/globals.css` — `.caspian-hdr-burger` + 820px header collapse; reduced-motion now targets `.caspian-bottom-sheet`.
- `src/i18n/messages.ts` — `navigation.menu`/`closeMenu`/`signOut` + `pwa.*` keys.
- `src/index.ts` — exports the new components/hook/helper.
- `examples/nextjs/app/layout.tsx` — manifest/viewport metadata + mounts SW + install prompt.

## v9.9.0 — Products: optional SKU field

Products can now carry an optional **SKU** (stock-keeping unit). Added `sku?: string` to the
`Product` type, read it in `docToProduct`, and gave the admin product editor an **SKU** input
(under the URL-slug field). Free text, admin-entered, not enforced unique — `createProduct` /
`updateProduct` already persist it via the `ProductWriteInput` (`Omit<Product, …>`) and
`stripUndefined`. Ported from the luivante standalone fork, where the field was needed for the
Quick-Add create flow.

### No consumer action required

Purely additive: `sku` is a new optional field on existing `products` documents, never queried, so
there is no Firestore rules or index change and no migration. Existing products simply have no SKU
until one is entered.

### Added
- [src/types.ts](src/types.ts) — `Product.sku?: string`.
- [src/admin/admin-product-editor.tsx](src/admin/admin-product-editor.tsx) — SKU `<Input>` in the editor; `FormState`/hydration/payload thread `sku`.

### Changed
- [src/services/product-service.ts](src/services/product-service.ts) — `docToProduct` reads `sku`.

## v9.8.0 — Dedicated category editor page, with image upload + toggles

Categories were the last catalog surface still edited in an in-list modal `<Dialog>` with a
paste-only image-URL field and checkboxes. `<AdminProductCategoriesPage>` now navigates to a
**dedicated full-page editor** (`<AdminCategoryEditor>`) at `/admin/categories/new` and
`/admin/categories/{id}/edit` — mirroring how products edit. The new editor adds a featured-image
**upload** (`ImageUploadField`, Firebase Storage, with URL fallback), **toggle switches** for
Active/Featured (via a new `Switch` UI primitive), and the parent picker now excludes the category
itself **and its descendants** to prevent cycles. In the list, the category **name** and the Edit
action navigate to the editor, and **+ New category** opens the create page. The Parent column was
already present.

### Consumer action required on upgrade

Category image uploads write to a new `categories/` Storage path. Redeploy Storage rules:

```bash
npm run firebase:sync   # copies the updated storage.rules into your project (if you use it)
firebase deploy --only storage
```

If you don't deploy the new rule, uploading a category image fails with `storage/unauthorized`
(everything else works unchanged). No data migration is needed.

### Added
- `src/ui/switch.tsx` — self-styled on/off `Switch` primitive (used by the category editor; the
  storefront primary token drives the "on" colour).
- `src/admin/admin-category-editor.tsx` — full-page category create/edit component.
- A `categories/{path=**}` block in `firebase/storage.rules` (public read, admin write, 10 MB,
  raster only).

### Changed
- `src/admin/admin-root.tsx` — `categories` route dispatches `new` / `{id}/edit` to
  `AdminCategoryEditor`, list otherwise (mirrors `products`).
- `src/admin/admin-product-categories-page.tsx` — the name + Edit navigate to the editor page,
  **+ New category** opens `/admin/categories/new`, and the in-list edit `<Dialog>` (with its
  draft state) is removed.

## v9.7.1 — Fluid Masonry grid on the admin products list

The Masonry view added in v9.6.0 (`<AdminProductsList>`) left an empty band of space on the
right — cards filled only the left portion of the page instead of the full content width. It used
a fixed `column-count: 4` with **viewport-based** `@media` breakpoints, so the column count keyed
off the viewport rather than the actual content area, and the multi-column balancer stranded a
trailing column when several product images are tall portraits.

`.caspian-pmasonry` now uses **`column-width: 260px`** (the viewport breakpoints are removed).
`column-width` is container-relative — the browser fits as many ~260px columns as the content
area allows and stretches them to fill the full width, so the grid is fluid at every size with no
empty right-hand band. The staggered look is unchanged.

### No consumer action required

CSS-only fix; the rule ships in the already-imported `styles.css`. Existing installs pick it up on
upgrade.

## v9.7.0 — `<MultiSelect>` admin primitive (portaled, overflow-proof multi-select dropdown)

Adds a new public admin primitive, **`<MultiSelect>`** — a pill-trigger, searchable, multi-check dropdown with
removable chips and an optional "Create new" footer. Items support optional parent/child indentation and a
right-aligned `meta` slot (e.g. a count).

The defining property is its **portaled menu**: the dropdown renders into `document.body` with `position: fixed`,
positioned from the trigger's bounding rect (reposition on scroll/resize, flips upward near the viewport bottom,
width derived from the trigger), mirroring the existing `<DropdownMenu>` pattern. That means it can be dropped
inside a scroll container or a modal with `overflow: hidden` and the menu still renders above everything,
un-clipped — instead of being cut off or overlapping nearby controls. The row checkbox is reset
(`width/flex/padding/margin`) so an ambient full-width form-input rule can never stretch it and shove the label.

This lands as **groundwork** for a future admin overhaul (a multi-category product editor and Quick-Add flows);
nothing in the shipped admin consumes it yet, so it is purely additive.

New exports: `MultiSelect`, `MultiSelectItem`, `MultiSelectProps` (from the package root and `./admin`), plus a
`PlusIcon` added to the icon set. New `.caspian-msel*` / `.caspian-catpick*` rules ship in `styles.css` (accent
follows the themeable `--caspian-accent`; other colors are concrete neutrals).

### No consumer action required

Additive: a new optional component + icon + CSS in the already-imported `styles.css`. No existing export, type, or
behaviour changed; existing installs are unaffected and gain the component on upgrade.

## v9.6.0 — Masonry view for the admin products list

The admin Products page (`<AdminProductsList>`) could only display products as a table. This release adds a
**Table | Masonry** toggle to the page header (mirroring the existing Table | Board toggle on the orders list).
**Table stays the default.** Masonry renders the same filtered set as a Pinterest-style staggered card grid via
CSS multi-column — each card is `break-inside: avoid` and product images keep their natural aspect ratio, so
card heights vary; the grid is 4 columns wide, collapsing to 3/2/1 as the viewport narrows.

Each card shows the product image (or a placeholder), an Active/Hidden status badge, the name, a
"N colors · N sizes" line, brand, category, price, and the same `DropdownMenu` actions as the table
(Edit / View on storefront / Delete); the image and title navigate to the product editor. All existing filters
(search, status, category, brand) stay visible and functional in both views, since Masonry is purely a
different display of the same set.

No new public exports — `<AdminProductsList>` gains the view internally. New `.caspian-pmasonry` /
`.caspian-pcard*` rules ship in `styles.css`.

### No consumer action required

Admin-only UI addition rendered from existing styles + components; existing installs are unaffected and pick up
the new view on upgrade. The new masonry CSS ships in the already-imported `styles.css`.

## v9.5.0 — Admin per-user detail view (`<AdminUserDetail>`) with tabbed sections + Messages

The admin Users page (`<AdminUsersPage>`) previously rendered only a flat list with no way to drill into a
single account. This release adds a per-user **detail view**, mounted by `<AdminRoot>` at `/admin/users/:uid`
(clicking a user's name in the list opens it). The view loads the account's profile, order history, live cart,
wishlist, saved addresses, and contact messages, and lays them out as **tabbed white cards**:
**Details → Orders → Cart → Wishlist → Addresses → Messages** (identity → buying activity → logistics →
communication). A persistent header carries the avatar, role badge, and account actions (Email / Copy email /
Copy UID / Promote-Demote via the existing `promoteUserToAdmin` / `demoteAdminToCustomer` callables).

The new **Messages** tab surfaces that account's contact-form submissions, matched both by the stored `userId`
*and* by the profile email (so messages sent while signed out still appear) — two single-equality reads merged
client-side, so **no new Firestore composite index is required**.

The Users list also gains a **Staff / Customers / All** role filter alongside the existing search box, and each
row's name now links to the detail view.

New public exports: `AdminUserDetail` + `AdminUserDetailProps`. New service helpers: `getUserById`
(user-service) and `getContactsByUser` (contact-service). New `admin.users.detail.*`, `admin.users.role.*`,
and `admin.users.filter.*` message keys.

### Consumer action required on upgrade

The Cart tab reads other users' carts as an admin, which requires a **`firestore.rules` redeploy** — this
release relaxes the `carts` read rule to also allow admins (`request.auth.uid == uid || isAdmin()`); writes
remain owner-only. Without the redeploy the rest of the view works, but the Cart tab shows empty for every user.

```bash
firebase deploy --only firestore:rules
```

No index changes; no code changes required on the consumer site beyond pulling the new version.

### Added
- `src/admin/admin-user-detail.tsx` — the `<AdminUserDetail>` page (tabbed profile / orders / cart / wishlist / addresses / messages).
- `getUserById` in `src/services/user-service.ts`; `getContactsByUser` in `src/services/contact-service.ts`.
- `admin.users.detail.*`, `admin.users.role.staff` / `customer`, and `admin.users.filter.*` keys in `src/i18n/messages.ts`.

### Changed
- `src/admin/admin-root.tsx` — the `users` route now renders `<AdminUserDetail userId={a} />` when a uid segment is present.
- `src/admin/admin-users-page.tsx` — added a Staff/Customers role filter and linked each row's name to `/admin/users/:uid`.
- `src/admin/index.ts`, `src/index.ts` — export `AdminUserDetail` / `AdminUserDetailProps`.
- `firebase/firestore.rules` — `carts` read now also allows `isAdmin()`.

---

## v9.4.0 — Orders admin gains a drag-and-drop Kanban board view

The admin Orders page (`<AdminOrdersList>`) previously rendered only a flat, newest-first table — fine for scanning but poor for fulfillment, where you want to see the whole pipeline at a glance and move orders between stages. This release adds a **Board** view alongside the existing table, toggled from a segmented control in the page header (Table stays the default). The board lays out one column per order status — `pending → on-hold → paid → processing → shipped → delivered → cancelled` — each with a colored header, a live count, and one draggable card per order (order number, customer email, date, item count, total).

**Dragging a card to another column changes that order's status.** The move is applied optimistically (the card jumps immediately), persisted via the existing `updateOrderStatus` service, and rolled back with a destructive toast if the Firestore write fails. Drag-and-drop uses the browser's native HTML5 DnD API — no new runtime dependency is added; peer deps remain `firebase`, `react`, `react-dom`. Clicking a card's order number still navigates to the order detail page exactly as the table rows do.

This release also fixes a long-standing gap: the Orders **status filter** dropdown was missing the `on-hold` status (added in v2.8 for manual-payment orders awaiting confirmation), so on-hold orders could not be filtered to. The filter and the board now both cover all seven statuses.

`<AdminOrdersList>` gains an optional, non-breaking `defaultView?: 'table' | 'board'` prop (defaults to `'table'`). Existing usage is unchanged — `<AdminRoot>` mounts the component with no props and gets the table-first behavior it always had.

### No consumer action required

`npm install github:CaspianTools/script-caspian-store#v9.4.0` and redeploy — the Board toggle appears automatically on `/admin/orders`. No schema, rules, or index changes; the board reuses the existing `listAllOrders` query and `updateOrderStatus` write.

### Added

- [src/admin/admin-orders-list.tsx](src/admin/admin-orders-list.tsx): Board (Kanban) view with native drag-and-drop status changes; `OrderView` type and optional `defaultView` prop on `AdminOrdersListProps`. Order rendering split into internal `OrdersTable` / `OrdersBoard` / `OrderCard` / `ViewToggle` helpers within the same file.

### Fixed

- [src/admin/admin-orders-list.tsx](src/admin/admin-orders-list.tsx): the status filter dropdown now includes `on-hold` (was omitted), so manual-payment orders awaiting confirmation are filterable.

---

## v9.3.0 — Luivante: new default theme

A new theme preset — **Luivante** — ships at the top of the theme catalog and becomes the project default. White canvas, Google blue (`#1a73e8`) accent, generous 1rem rounded corners, Poppins everywhere. Comes from the design handoff in the bundle of the same name: an everything-shop storefront with rounded pills, white pages, and a single confident action color across buttons, active states, focus rings, and selected swatches.

This is purely an additive theme + default-token change. Existing stores keep their saved `theme` settings — only fresh installs and stores that haven't customized the tokens pick up the new defaults. Admins can preview / activate Luivante from the Appearance page like any other catalog preset; it carries `isNew: true` so its card shows the New pill until first interaction.

### Added

- **[src/theme/themes/luivante/index.ts](src/theme/themes/luivante/index.ts)** — `CatalogTheme` preset. Primary + accent `#1a73e8`, foreground `#ffffff`, radius `1rem`, background `#ffffff`, `fontFamily: 'Poppins'`, `googleFamilies: ['Poppins:wght@300;400;500;600;700']`. Categories: `shop`, `minimal`, `corporate`, `marketing`. Thumbnail: white background with the wordmark "Luivante" in `#1f1f1f` and the Google-blue accent dot.

### Changed

- **[src/theme/catalog.ts](src/theme/catalog.ts)** — Luivante is now the first entry in `THEME_CATALOG`, putting its card first in the Appearance admin grid.
- **[src/types.ts](src/types.ts)** — `DEFAULT_SCRIPT_SETTINGS.theme` updated to Luivante's tokens; `fonts.googleFamilies` widened to include `Poppins:wght@300` for the lighter editorial weights the design uses. New installs and `Restore defaults` from the Appearance page now seed Luivante.
- **[src/styles/globals.css](src/styles/globals.css)** — `:root` first-paint fallbacks updated to Luivante tokens. Affects only the brief window between mount and the first `<ThemeInjector>` write — stores with saved tokens get those instead, unchanged.
- **[src/components/setup/setup-types.ts](src/components/setup/setup-types.ts)** — doc comment on `BrandingDraft.themePreset` now references `'luivante'` instead of `'cleanWhite'`.

### Consumer action required on upgrade

```bash
npm install github:CaspianTools/script-caspian-store#v9.3.0
```

No Firestore rules, indexes, or Cloud Functions changed. **Existing stores keep their current theme** — their `siteSettings.theme` document was saved at first run and overrides the new defaults. To adopt Luivante on an existing store, open **Admin → Appearance**, find the **Luivante** card at the top of the grid, and click Activate (or click **Restore defaults** to reset every branding token at once). Fresh installs pick up Luivante automatically on first boot.

---

## v9.2.1 — Preserve anonymous cart on sign-in

Shoppers no longer lose their cart when they sign in. Previously the cart provider did a hard switch on every auth-state change — when a buyer transitioned from anonymous (localStorage cart) or guest-checkout-anonymous (Firestore cart under the anon UID) to a real account, the new account's empty `carts/{uid}` doc immediately clobbered whatever they had added.

The cart provider now mirrors the existing wishlist merge pattern: on sign-in it reads the local (anon) cart, optionally pulls the in-memory cart snapshot from the prior anonymous Firebase session, sums quantities for matching `(productId, size, color)` lines, writes the merged result into the real account's `carts/{uid}` doc, and clears the localStorage seed so it can't bleed back in on a subsequent sign-out → sign-in cycle.

### Fixed

- **Anonymous-to-authenticated cart loss.** [src/context/cart-context.tsx](src/context/cart-context.tsx): hydrate-on-auth-change effect tracks the previous user and an in-memory cart snapshot via `useRef`, calls `mergeCartOnSignIn` instead of replacing state with `loadUserCart`, and folds the in-memory anon snapshot in when v9.1.0's `signInAsGuest()` had been called earlier in the session. The in-memory snapshot is used — not a Firestore read of the orphan anon UID — because the `/carts/{uid}` rule requires `request.auth.uid == uid`, so a real-user session can't read the orphan doc. The orphan doc is left in place; pruning old anon carts is left to an out-of-band Cloud Function (out of scope for this patch).

### Added

- [src/services/cart-service.ts](src/services/cart-service.ts): exports `combineCartItems` and `mergeCartOnSignIn`. The combine helper sums quantities for matching cart lines (same productId + size + color) and appends non-matching ones; the merge helper reads the server cart, folds in any locally-supplied items, writes back only when the merge actually changes the cart, and returns the merged array so the caller doesn't need a second read. The merge function is the cart analogue of `mergeWishlistOnSignIn`.

### Changed

- [src/context/wishlist-context.tsx](src/context/wishlist-context.tsx): the comment that called out cart as "the deliberate improvement over cart, which does a hard switch" is now stale — updated to read as a shared pattern.

### No consumer action required

```bash
npm install github:CaspianTools/script-caspian-store#v9.2.1
```

No Firestore rules, indexes, or Cloud Functions changed. Existing storefronts get the fix on the next deploy with no further wiring. Stores upgrading directly from v9.0.x still need the v9.1.0 Functions redeploy (`firebase deploy --only functions:caspian-admin,functions:caspian-stripe`) per that release's notes.

---

## v9.2.0 — LayoutShell chrome variants: header + footer decorations per template

The v9 per-template component dispatcher gains its **fifth and final** wired slot. `<LayoutShell>`'s chrome (the header + content + footer composition) is now template-dispatched, completing the surface set introduced across v9.0.0-alpha.1 through v9.0.0 and joining `<Hero>`, `<HomePage>`, `<ProductCard>`, and `<ProductDetailPage>`.

Chrome variants only choose how the standard `<SiteHeader>` and `<SiteFooter>` are *composed* — they don't replace them. Bypass-prefix routing (`/admin/*`), the coming-soon splash, the double-mount sentinel, and locale-prefix stripping all stay in the outer `<LayoutShell>` dispatcher so individual templates don't re-implement framework-level concerns.

### Variants

- **`<LayoutShellChromeDefault>`** — `fashion-minimal` + default storefront. Byte-equivalent to the v8.x / v9.1.x composition: header, content, footer.
- **`<LayoutShellChromeTech>`** — `electronics-tech`. Adds two monospace decorative bands. **Top announcement bar** (`// FREE SHIPPING $50+  //  12mo warranty  //  Hand-tested`) above the header reinforces the spec-sheet identity in the first 8px of the viewport. **Pre-footer spec strip** with `// Built for daily use.` and a `Every product tested for ≥30 days before launch.` sub-line just above the footer.
- **`<LayoutShellChromeEditorial>`** — `home-goods`. Adds an editorial **sign-off section** between the content and the footer: a serif italic pull-quote ("Pieces sourced from independent makers — fewer, better, made to outlast their fashions.") with `— Workshop Six` attribution. No announcement bar at the top — the editorial identity reads better when the page opens straight into navigation + brand rather than a transactional strip.

### No consumer action required

Pin the new tag and reinstall:

```bash
npm install github:CaspianTools/script-caspian-store#v9.2.0
```

Existing storefronts render identically until an admin (re-)applies a v9.2.0 template that registers `components.LayoutShell`. The three bundled templates now do.

### Added

- [src/components/variants/layout-shell-chrome-default.tsx](src/components/variants/layout-shell-chrome-default.tsx) — extracted v8.x chrome.
- [src/components/variants/layout-shell-chrome-tech.tsx](src/components/variants/layout-shell-chrome-tech.tsx) — electronics-tech announce bar + spec prefooter.
- [src/components/variants/layout-shell-chrome-editorial.tsx](src/components/variants/layout-shell-chrome-editorial.tsx) — home-goods editorial signoff.
- [src/index.ts](src/index.ts): re-exports the three chrome variants + `LayoutShellChromeProps`.

### Changed

- [src/components/layout-shell.tsx](src/components/layout-shell.tsx): the outer `<LayoutShell>` now resolves a chrome variant via `useTemplateComponent('LayoutShell', LayoutShellChromeDefault)` and delegates the header + content + footer composition to it. Bypass routing, coming-soon gating, the double-mount sentinel, locale-prefix stripping all stay in the dispatcher. Direct uses of `<SiteHeader>` and `<SiteFooter>` moved into the default chrome variant; the dispatcher no longer imports the value forms (only their prop types).
- [src/templates/templates/{fashion-minimal,electronics-tech,home-goods}/index.ts](src/templates/templates/): each template registers its `components.LayoutShell` override.

## v9.1.0 — Guest checkout (WooCommerce-style): inline, optional sign-in, account-linking

Shoppers can now complete checkout without creating an account. The flow is modeled on WooCommerce: the checkout form is the landing view, with sign-in and "create an account" offered inline as optional affordances — neither is required, and prior guest orders auto-attach to the customer's account if they register later with the same email.

### What changed

- **Inline guest checkout.** The `if (!user)` interstitial in `<CheckoutPage>` is gone. The form renders for everyone, and when the buyer has no auth session the page silently calls `signInAnonymously()` so cart writes, shipping queries, and order creation all pass Firestore rules. The interstitial is preserved only for stores that explicitly turn `accounts.allowGuestCheckout` off in admin Site Settings.
- **Inline sign-in panel.** Anonymous buyers see `Already have an account? Sign in` at the top of the contact card. Expanding it shows email/password + "Continue with Google" — both delegate to the existing `useAuth().signIn` / `signInWithGoogle`. Successful sign-in re-populates the form from the now-real user's profile.
- **"Create an account for faster checkout" checkbox** below the email field, only shown for anonymous buyers when `accounts.allowAccountCreationAtCheckout` is on (default `true`). No password is collected at checkout — the library calls `signUpWithSetupLink()` which mails a password-setup link to the buyer post-purchase. Email-already-in-use is non-fatal: the order still completes as a guest order and the account-linking trigger picks it up when the buyer eventually signs in.
- **Form email is the source of truth.** Previously the order doc's `userEmail` was stamped from `ctx.user.email` — which is empty for anonymous buyers. Now it's the form email (`StartCheckoutOptions.email`), threaded through both manual-payment plugins and the Stripe Cloud Function (so Stripe Checkout no longer asks the buyer to re-enter their email).
- **`Order.isGuest`.** New optional field. `true` when the order was placed by an anonymous user. Cleared by the auth-trigger when the buyer registers later.
- **`linkGuestOrdersOnUserCreate` Cloud Function** (`functions-admin`). Fires on `users/{uid}` create. For every new (non-anonymous) account, finds prior guest orders matching the same email and re-stamps `userId` + clears `isGuest`. Batched, capped at 450 docs per fire.
- **`getGuestOrder` HTTPS callable** (`functions-admin`). Unauthenticated. Takes `{ orderId, email }`, returns a sanitized order projection when the supplied email matches the order's `userEmail` (case-insensitive). Returns 404 for both not-found and email-mismatch so it can't be used to enumerate order ids.
- **`<GuestOrderLookupPage />`** — new exported component (WooCommerce's `[woocommerce_order_tracking]` equivalent). Mounted at `/order-status` in `<CaspianRoot>`. Two-field form (order #, email), pre-fills from `?id=...&email=...` query params for direct deep-linking from order confirmation emails.

### Default change

`accounts.allowGuestCheckout` now defaults to **`true`** for new stores (`DEFAULT_ACCOUNTS` in `admin-site-settings-page.tsx`). Existing stores with the field already written to Firestore keep their value.

### Consumer action required on upgrade

```bash
npm install github:CaspianTools/script-caspian-store#v9.1.0
firebase deploy --only functions:caspian-admin,functions:caspian-stripe
```

The `functions-admin` redeploy is required for the two new functions (`linkGuestOrdersOnUserCreate`, `getGuestOrder`). The `functions-stripe` redeploy is required for the Stripe Checkout email pass-through. To get the "Track your order" link into your order confirmation email, add a line like the following to the **Customer: processing order** template body in **Admin → Email → Templates**:

```
Track your order: https://your-storefront.example.com/order-status?id={order_number}&email={customer_email}
```

(Both placeholders already exist; only the URL prefix needs to match your live domain.)

### Added

- [src/components/guest-order-lookup-page.tsx](src/components/guest-order-lookup-page.tsx) and its `/order-status` route in [src/components/caspian-root.tsx](src/components/caspian-root.tsx).
- [firebase/functions-admin/src/link-guest-orders.ts](firebase/functions-admin/src/link-guest-orders.ts) and [firebase/functions-admin/src/get-guest-order.ts](firebase/functions-admin/src/get-guest-order.ts), exported from [firebase/functions-admin/src/index.ts](firebase/functions-admin/src/index.ts).
- `Order.isGuest?: boolean` field in [src/types.ts](src/types.ts).
- `StartCheckoutOptions.email` and `StartCheckoutOptions.createAccount` in [src/payments/types.ts](src/payments/types.ts).

### Changed

- [src/components/checkout-page.tsx](src/components/checkout-page.tsx): interstitial gate removed; auto-anon-signin effect added; inline sign-in panel + create-account checkbox; `handlePay` promotes anonymous → real account via `signUpWithSetupLink` when the checkbox is set; `saveAddressToProfile` is now hidden for anonymous buyers.
- [src/hooks/use-checkout.ts](src/hooks/use-checkout.ts): reads `auth.currentUser` rather than the React `user` state so the post-promotion user is seen immediately by `startCheckout`.
- [src/payments/plugins/manual-base.ts](src/payments/plugins/manual-base.ts): writes `userEmail` from `options.email` and stamps `isGuest` for anonymous buyers.
- [src/payments/plugins/stripe.ts](src/payments/plugins/stripe.ts): forwards `email` in the callable payload.
- [firebase/functions-stripe/src/stripe-checkout.ts](firebase/functions-stripe/src/stripe-checkout.ts): accepts `email`, uses it as `customer_email`, stamps `metadata.isGuest` from the anonymous sign-in provider.
- [firebase/functions-stripe/src/stripe-webhook.ts](firebase/functions-stripe/src/stripe-webhook.ts): persists `isGuest` on the order doc when `metadata.isGuest === '1'`.
- [src/admin/admin-site-settings-page.tsx](src/admin/admin-site-settings-page.tsx): `DEFAULT_ACCOUNTS.allowGuestCheckout` flipped from `false` to `true`.

## v9.0.0 — Per-template component overrides: templates ship complete looks

**Stable.** Promotes the v9.0.0-alpha.1 through v9.0.0-alpha.4 pre-release series to a stable release. The v8.23 templates feature shipped **content + theme tokens**; v9.0.0 generalises that to **content + theme + complete component overrides**. Applying a template now visibly changes the storefront's React components — not just the colors and copy.

This is a major version because the public API surface gains a registry contract: any storefront primitive may be replaced by the active template's `components.<SlotId>` registration. Default behaviour is preserved (back-compat at the consumer call site), but the internal contract is genuinely new.

### What v9 ships, end-to-end

- **Component override registry** ([src/templates/components.ts](src/templates/components.ts)). `TemplateComponents` slot map for the five primary storefront surfaces: `Hero`, `HomePage`, `ProductCard`, `ProductDetailPage`, `LayoutShell`. Slot ids are stable; templates declare the subset they override; missing slots fall through to defaults.
- **`<TemplateProvider>` + `useTemplateComponent()` hook** ([src/provider/template-provider.tsx](src/provider/template-provider.tsx)). Provider mounted automatically inside `<CaspianStoreProvider>`. Hook returns the registered override (typed against the fallback's props) or the fallback.
- **Per-template CSS bundle.** `TemplateDefinition.css?: string` mounted by `<ThemeInjector>` as `<style id="caspian-template-css">`. `<html data-caspian-template="<id>">` data attribute lets template CSS scope rules cleanly. `prefers-reduced-motion` opt-outs respected throughout.
- **`scriptSettings.activeTemplateId`** ([src/types.ts](src/types.ts)). Optional field. Written by `applyTemplate()` on every apply; read by `<TemplateProvider>`. Pre-v9 docs without the field resolve to the default storefront.
- **Storefront primitives wrapped through dispatchers.** `<Hero>`, `<HomePage>`, `<ProductCard>`, `<ProductDetailPage>` are now thin wrappers that resolve via `useTemplateComponent()` and fall back to byte-equivalent v8.x implementations.
- **Three bundled templates with full component overrides.** fashion-minimal keeps the v8.x identity. electronics-tech ships dark-mode spec-sheet layouts (full-bleed ken-burns hero, monospace `// SKU` eyebrows, inverted PDP, hover accent lines). home-goods ships magazine-style editorial layouts (50/50 split hero with slide-in animation, serif italic typography, editorial pull-quote on homepage, centred PDP with story column).
- **`useProductDetailState()` hook** ([src/components/variants/use-product-detail-state.ts](src/components/variants/use-product-detail-state.ts)). Extracted from the 382-line monolithic PDP — variants are pure JSX wrappers. Adding a state field flows to all three with no per-variant edits.

### Consumer action required on upgrade

Minimal. Most consumers reinstall and redeploy:

```bash
npm install github:CaspianTools/script-caspian-store#v9.0.0
```

The storefront renders identically to v8.23.x until an admin applies a v9 template that registers component overrides. The three bundled templates do register them — re-applying any of them in Replace mode produces the new look.

### Subtle behaviour change

`<HomePage>`'s slot-injection props (`afterHero`, `afterFeaturedCategories`, `afterTrendingProducts`, `afterNewsletter`) now land at the semantic position dictated by the active variant's section order, not the v8.x order. Consumers relying on a slot landing at a specific visual position should switch to rendering their own composition from the individual section exports. See [INSTALL.md → v9.0.0 migration](INSTALL.md#760-v900--per-template-component-overrides).

### What's stable from each alpha

- **alpha.1** — registry foundation: types, provider, hook, `activeTemplateId`, CSS injection. Zero visible change.
- **alpha.2** — `<Hero>` dispatcher + three variants (`HeroCentered`, `HeroFullBleed`, `HeroSplit`). First visibly different storefront on apply.
- **alpha.3** — `<ProductCard>` + `<HomePage>` dispatchers + variants (Standard / Editorial / Compact cards; Default / Spotlight / Editorial homepage flows). Whole homepage feels template-specific.
- **alpha.4** — `<ProductDetailPage>` dispatcher + three variants (Default / Tech / Editorial). PDP completes the per-template surface set.

Each alpha was a focused pre-release Discussion: [#131](https://github.com/CaspianTools/script-caspian-store/discussions/131) (alpha.1), [#132](https://github.com/CaspianTools/script-caspian-store/discussions/132) (alpha.2), [#133](https://github.com/CaspianTools/script-caspian-store/discussions/133) (alpha.3), [#134](https://github.com/CaspianTools/script-caspian-store/discussions/134) (alpha.4).

### Migration guide

See [INSTALL.md → v9.0.0 — Per-template component overrides](INSTALL.md#760-v900--per-template-component-overrides) for the full migration walkthrough including back-compat guarantees, the slot-id list, the subtle homepage-slot behaviour change, and an example of authoring component overrides on a custom template.

### Added

Cumulative across alphas:
- [src/templates/components.ts](src/templates/components.ts), [src/provider/template-provider.tsx](src/provider/template-provider.tsx), [src/components/home/variants/](src/components/home/variants/) (hero + homepage variants), [src/components/variants/](src/components/variants/) (product-card + product-detail variants), [src/components/variants/use-product-detail-state.ts](src/components/variants/use-product-detail-state.ts).
- [INSTALL.md](INSTALL.md) gains a new §7.6 migration guide.

### Changed

- [src/components/home/hero.tsx](src/components/home/hero.tsx), [src/components/home/home-page.tsx](src/components/home/home-page.tsx), [src/components/product-card.tsx](src/components/product-card.tsx), [src/components/product-detail-page.tsx](src/components/product-detail-page.tsx): now thin dispatchers.
- [src/templates/types.ts](src/templates/types.ts): `TemplateDefinition` gains `components?` and `css?`.
- [src/types.ts](src/types.ts): `ScriptSettings.activeTemplateId?` optional field.
- [src/context/theme-context.tsx](src/context/theme-context.tsx), [src/provider/caspian-store-provider.tsx](src/provider/caspian-store-provider.tsx): `<ThemeInjector>` mounts template CSS + data attribute; `<TemplateProvider>` inserted in the provider tree.
- [src/templates/templates/{fashion-minimal,electronics-tech,home-goods}/index.ts](src/templates/templates/): each template registers its `components` + `css`.

## v9.0.0-alpha.4 — ProductDetailPage variants: PDP completes the per-template surface set (pre-release)

**Pre-release.** Phase 4 of the v9.0.0 theme rearchitecture — the last visible-content phase. Every primary storefront surface is now template-dispatched: hero (alpha.2), product card + homepage (alpha.3), and now product detail page. Phase 5 will stabilise and ship v9.0.0 stable with migration docs.

Three PDP layouts share their state — fetching, selected size, quantity, add-to-cart, review summary — via a new `useProductDetailState()` hook, so variants are pure JSX wrappers. New fields automatically flow to every variant without per-variant edits.

### Variants

- **`<ProductDetailDefault>`** — fashion-minimal + default. The v8.x layout extracted into its own file: gallery on the left, info column on the right, tabs (Details / Reviews / Questions) below. Byte-equivalent to v8.x behaviour when no template is active.
- **`<ProductDetailTech>`** — electronics-tech. **Inverted layout:** info column LEFT (sticky), gallery RIGHT. Monospace `// brand · SKU` eyebrow, dark-mode spec-sheet typography, price block bordered top/bottom with "// In stock · 12mo warranty" stamp, prominent `Add to cart →` CTA. Details and Reviews scroll inline (no tab collapse) so spec-scanning buyers see everything in one pass.
- **`<ProductDetailEditorial>`** — home-goods. Magazine-style flow: gallery centred above the fold, info column below in a narrow centred column with italic serif name + soft brown palette, then a `Story & Details` section in 600px-wide editorial column, then a quiet `From buyers` reviews block. Treats the product page like a feature spread, not a transactional form.

### State hook

[`useProductDetailState(props)`](src/components/variants/use-product-detail-state.ts) — extracted from the 382-line monolithic PDP. Returns `{ product, loading, brandName, blurb, selectedSize, setSelectedSize, quantity, setQuantity, avg, totalReviews, setAvg, setTotalReviews, activeTab, setActiveTab, handleAddToCart, inventory, cartBehavior, derived, t }`. Variants accept the same `ProductDetailPageProps` and call the hook — no per-variant business logic.

`derived` collapses the computed booleans (`hasSizes`, `hasDetails`, `hasLongDescription`, `detailsTabHasContent`, `inventoryActive`, `outOfStockSizes`, `allOut`) so variants don't re-derive them.

### No consumer action required (yet)

Pre-release. luivante is bumped alongside this ship.

```bash
npm install github:CaspianTools/script-caspian-store#v9.0.0-alpha.4
```

### Added

- [src/components/variants/use-product-detail-state.ts](src/components/variants/use-product-detail-state.ts): shared state hook for every PDP variant.
- [src/components/variants/product-detail-default.tsx](src/components/variants/product-detail-default.tsx): default PDP variant (v8.x layout extracted).
- [src/components/variants/product-detail-tech.tsx](src/components/variants/product-detail-tech.tsx): electronics-tech variant.
- [src/components/variants/product-detail-editorial.tsx](src/components/variants/product-detail-editorial.tsx): home-goods variant.
- [src/index.ts](src/index.ts): re-exports the three variants + `useProductDetailState` + `ProductDetailTabKey`.

### Changed

- [src/components/product-detail-page.tsx](src/components/product-detail-page.tsx): collapses from 382 LoC to a ~60-LoC dispatcher that resolves via `useTemplateComponent('ProductDetailPage', ProductDetailDefault)`. Same `<ProductDetailPage>` export, same props, same back-compat — no consumer API change.
- All three template files register their `ProductDetailPage` override.

## v9.0.0-alpha.3 — ProductCard + HomePage variants: full homepage feels template-specific (pre-release)

**Pre-release.** Phase 3 of the v9.0.0 theme rearchitecture. The hero became template-specific in alpha.2; this release does the same for product cards and the homepage section composition. The whole homepage — not just the hero — now feels different per template.

Three product-card designs and three homepage layouts wired through the registry. The `<ProductCard>` and `<HomePage>` import paths are unchanged on the consumer side; the active template's `components.ProductCard` and `components.HomePage` decide what renders.

### ProductCard variants

- **`<ProductCardStandard>`** — fashion-minimal + default. The v8.x card extracted into its own file: 3:4 portrait image, brand eyebrow, name, price, optional wishlist + quick-add icons. Hover lifts the card 2px and gently scales the image (1.04× over 600ms).
- **`<ProductCardCompact>`** — electronics-tech. Dark plinth card with a 1:1 image and a monospace accent eyebrow. Hover slides a 40px accent line in under the name (280ms ease-out), tints the border green, lifts 2px. Reads like a product spec sheet.
- **`<ProductCardEditorial>`** — home-goods. 4:5 image with no rounded corners, serif name in larger type, price as a quiet eyebrow. Hover scales the image (700ms cubic-bezier) and fades in a "View product →" CTA bar at the bottom. No quick-add icon — the editorial look favors a single primary action.

### HomePage variants

- **`<HomePageDefault>`** — fashion-minimal + default. Hero → Featured Categories → Trending Products → Newsletter. Identical composition to v8.x's `<HomePage>`.
- **`<HomePageSpotlight>`** — electronics-tech. Hero → **spec strip** ("// Hand-tested  // Daily-use  // No fluff  // 12mo warranty") → Trending Products → Featured Categories → Newsletter. Tech buyers see the catalog immediately instead of categories first.
- **`<HomePageEditorial>`** — home-goods. Hero → Featured Categories → **editorial pull-quote** (large italic blockquote in serif) → Trending Products → Newsletter. Adds a magazine-style typography break between catalog sections.

Each variant respects the slot-injection props (`afterHero`, `afterFeaturedCategories`, ...) — but the *semantic position* of each slot follows its variant's section order, not the v8.x order. Documented in the `<HomePage>` JSDoc.

### Motion still pure CSS

No motion library added. All hover micro-interactions and entrance animations are CSS, shipped through each template's `css` field, scoped to `[data-caspian-template="<id>"]`, with `prefers-reduced-motion: reduce` opt-outs in every template.

### No consumer action required (yet)

Pre-release. luivante is bumped alongside this ship so the variants are verifiable end-to-end on a deployed site.

```bash
npm install github:CaspianTools/script-caspian-store#v9.0.0-alpha.3
```

### Added

- [src/components/variants/product-card-standard.tsx](src/components/variants/product-card-standard.tsx), [product-card-editorial.tsx](src/components/variants/product-card-editorial.tsx), [product-card-compact.tsx](src/components/variants/product-card-compact.tsx): the three card variants.
- [src/components/home/variants/home-page-default.tsx](src/components/home/variants/home-page-default.tsx), [home-page-spotlight.tsx](src/components/home/variants/home-page-spotlight.tsx), [home-page-editorial.tsx](src/components/home/variants/home-page-editorial.tsx): the three homepage layouts.
- [src/index.ts](src/index.ts) re-exports all six new variants.

### Changed

- [src/components/product-card.tsx](src/components/product-card.tsx): `<ProductCard>` is now a thin dispatcher (`useTemplateComponent('ProductCard', ProductCardStandard)`). Back-compat: when no template is active or none registers `components.ProductCard`, the fallback is byte-equivalent to v8.x.
- [src/components/home/home-page.tsx](src/components/home/home-page.tsx): `<HomePage>` is now a thin dispatcher (`useTemplateComponent('HomePage', HomePageDefault)`). Same back-compat shape.
- All three template files register their `ProductCard` + `HomePage` overrides and extend their `css` blocks with hover micro-interactions (card lift, image scale, accent underline slide-in, CTA fade-in, editorial pull-quote fade-in).

## v9.0.0-alpha.2 — Hero variants: three visibly different heroes per template (pre-release)

**Pre-release.** Phase 2 of the v9.0.0 theme rearchitecture. First phase where applying a template visibly changes the storefront — each of the three bundled templates now ships its own hero implementation, registered via `components.Hero` (the registry slot added in alpha.1) and paired with a `css` field carrying the keyframes for the variant's entrance / motion choreography.

The hero dispatcher introduced in alpha.1's foundation now resolves to one of three variants at render time. No more "same site with different content" — fashion-minimal looks like an editorial boutique, electronics-tech looks like a product launch page, home-goods looks like a magazine spread. Same `<Hero>` import on the consumer side — the active template determines what renders.

### Motion strategy

No motion library added. Animations are pure CSS, shipped via each template's `css` field (mounted by `<ThemeInjector>` from alpha.1 as `<style id="caspian-template-css">`). Selectors are scoped to `[data-caspian-template="<id>"]` so rules never leak across templates or to default-template installs. Every animation declares a `@media (prefers-reduced-motion: reduce)` opt-out.

Skipping a motion library (framer-motion / motion) was a conscious choice: alpha.2 needs entrance fades, slide-ins, and a ken-burns zoom — pure CSS handles all of them at zero bundle cost. Phase 3+ may need orchestrated viewport-triggered reveals (cards animating in as they scroll into view); we revisit the motion library question if it does.

### Variants

- **`<HeroCentered>`** ([variants/hero-centered.tsx](src/components/home/variants/hero-centered.tsx)) — extracted from v8.x's `<Hero>` implementation. Full-bleed background, centered headline + subtitle + CTA, dark overlay. Default fallback; used by **fashion-minimal**. Entrance: 0.9s rise-with-letter-spacing fade on the inner content column.
- **`<HeroFullBleed>`** ([variants/hero-full-bleed.tsx](src/components/home/variants/hero-full-bleed.tsx)) — used by **electronics-tech**. 80vh slab, bottom-left typography, monospace eyebrow ("// Now shipping"), bottom-fading gradient overlay. Entrance: 22s ken-burns zoom on the background image (loops alternate) + staggered 0.8s rise on eyebrow/title/subtitle (0.10s / 0.18s / 0.28s delays).
- **`<HeroSplit>`** ([variants/hero-split.tsx](src/components/home/variants/hero-split.tsx)) — used by **home-goods**. 50/50 desktop split (copy left, image right) that stacks vertically below 840px. Editorial serif typography (Cormorant Garamond from the template's font tokens). Entrance: 0.85s slide-from-left on each copy element with 0.10s stagger + 1.1s scale-in on the image.

### No consumer action required (yet)

Pre-release; consumers pinning `^8.x` are not auto-upgraded. luivante bumped to v9.0.0-alpha.2 alongside this ship — that's where the "applying a template visibly changes the site" behaviour will be verifiable end-to-end on a deployed site.

```bash
npm install github:CaspianTools/script-caspian-store#v9.0.0-alpha.2
```

### Added

- [src/components/home/variants/hero-centered.tsx](src/components/home/variants/hero-centered.tsx): default hero, extracted from `hero.tsx`.
- [src/components/home/variants/hero-full-bleed.tsx](src/components/home/variants/hero-full-bleed.tsx): electronics-tech hero.
- [src/components/home/variants/hero-split.tsx](src/components/home/variants/hero-split.tsx): home-goods hero.
- [src/index.ts](src/index.ts): re-exports `HeroCentered`, `HeroFullBleed`, `HeroSplit` so consumers can compose them directly.

### Changed

- [src/components/home/hero.tsx](src/components/home/hero.tsx): `<Hero>` is now a thin dispatcher that resolves via `useTemplateComponent('Hero', HeroCentered)`. Back-compat: when no template is active or a template registers no `components.Hero`, the dispatcher falls back to `HeroCentered` which is byte-equivalent to v8.x's implementation. Consumers get the same `<Hero>` import; the API surface is unchanged.
- [src/templates/templates/fashion-minimal/index.ts](src/templates/templates/fashion-minimal/index.ts): registers `components.Hero = HeroCentered` and ships a `css` block with the centered-content entrance keyframes.
- [src/templates/templates/electronics-tech/index.ts](src/templates/templates/electronics-tech/index.ts): registers `components.Hero = HeroFullBleed` and ships ken-burns + staggered-rise keyframes.
- [src/templates/templates/home-goods/index.ts](src/templates/templates/home-goods/index.ts): registers `components.Hero = HeroSplit` and ships slide-in + scale-in keyframes.

## v9.0.0-alpha.1 — Per-template component override foundation (pre-release)

**Pre-release.** First alpha of the v9.0.0 theme rearchitecture. Ships the infrastructure that makes per-template React components possible; **no storefront primitive is wrapped yet**, no template registers any override, and runtime behaviour is identical to v8.23.2. Phase 2 (alpha.2) wraps `<Hero>` and adds three hero variants — the first phase with visible storefront differences.

This release is tagged `9.0.0-alpha.1` so consumers pinning `^8.x` are not auto-upgraded. luivante stays on v8.23.2 until Phase 2 ships something visible.

### Why v9 instead of v8.24

The v9 work changes the public API surface: existing components (Hero, HomePage, ProductCard, ProductDetailPage, LayoutShell) become **resolved through a registry** rather than rendered directly. This is backward-compatible at the consumer-facing level (the exported component identifiers are unchanged, default behaviour is preserved when no template is active), but the internal contract — "any storefront primitive may be overridden by the active template" — is genuinely new. Semver-major communicates that.

### No consumer action required (yet)

Pre-release; not picked up by `^8.x` pins. Stable consumers should stay on v8.23.2. Early adopters who want to try the foundation:

```bash
npm install github:CaspianTools/script-caspian-store#v9.0.0-alpha.1
```

Migration guide ships with v9.0.0 stable.

### Added

- [src/templates/components.ts](src/templates/components.ts): new file. `TemplateComponentSlotId` union (`'Hero' | 'HomePage' | 'ProductCard' | 'ProductDetailPage' | 'LayoutShell'`), `TemplateComponents` registry type, `TemplateRegistryValue` shape carried by the context, `EMPTY_TEMPLATE_REGISTRY` default. Slot-id strings are stable across versions; renaming one is a breaking change for templates referencing the old name.
- [src/provider/template-provider.tsx](src/provider/template-provider.tsx): new `<TemplateProvider>` reads `settings.activeTemplateId`, looks up the template in `TEMPLATE_CATALOG`, exposes its `components` map + `css` string via React context. Companion hooks `useTemplateRegistry()` (low-level, returns the full registry value) and `useTemplateComponent<TProps>(slotId, fallback)` (typed override resolver — returns the registered component or the fallback). Unknown `activeTemplateId` falls through to the default storefront rather than throwing.
- [src/templates/types.ts](src/templates/types.ts): `TemplateDefinition` gains optional `components?: TemplateComponents` and `css?: string` fields. Templates that omit them keep current data-only-seeding behaviour.
- [src/types.ts](src/types.ts): `ScriptSettings.activeTemplateId?: string` — written by `applyTemplate()`, read by `<TemplateProvider>`. Optional + back-compat — pre-v9 settings docs without the field resolve to the default storefront.

### Changed

- [src/templates/apply-template.ts](src/templates/apply-template.ts): `applySettings()` now writes `activeTemplateId: template.id` to `scriptSettings/site` on every apply (both merge and replace modes). Applying a template is an explicit "use this look" act, so the active id always reflects the most recent apply.
- [src/context/theme-context.tsx](src/context/theme-context.tsx): `<ThemeInjector>` now also mounts the active template's `css` string as a `<style id="caspian-template-css">` tag in `<head>`, and writes the active id to `<html data-caspian-template="<id>">` so templates can scope selectors. Tag is created/updated/removed idempotently on template change; unmount cleanup removes both the tag and the data attribute. Existing CSS-custom-property emission is unchanged.
- [src/provider/caspian-store-provider.tsx](src/provider/caspian-store-provider.tsx): `<TemplateProvider>` inserted between `<ScriptSettingsProvider>` and `<ThemeInjector>` in the provider tree, so the injector can read `activeTemplateId` and `css` from the template registry.
- [src/index.ts](src/index.ts): re-exports `TemplateProvider`, `useTemplateRegistry`, `useTemplateComponent`, and the new types from `templates/components`.

### Not yet (Phase 2+)

- Hero / HomePage / ProductCard / ProductDetailPage / LayoutShell are **not yet wrapped** with the resolver. They render their default implementations regardless of `activeTemplateId`. Wrapping happens phase by phase so each release ships a focused, visible improvement.
- No template registers any `components` or `css` in alpha.1. fashion-minimal / electronics-tech / home-goods are unchanged from v8.23.2.

## v8.23.2 — Templates ship brand docs + switch product imagery to Picsum placeholders

Two real bugs in v8.23.0 / v8.23.1 templates surfaced as soon as the first owner applied one:

1. **Every product tripped the "legacy free-text brand" warning** on the admin Products page. Templates wrote products with `brand: "Common Thread"` as a literal string instead of a doc id referencing the `productBrands` collection. The admin UI warns when `brandNameById.has(p.brand)` returns false ([admin-products-list.tsx:289](src/admin/admin-products-list.tsx#L289)) — and a clean apply was guaranteed to hit it because no brand doc existed.

2. **Product images were wrong.** I picked Unsplash photo IDs from memory and several pointed at unrelated photos — "Suede Penny Loafers" rendered a Nike sneaker, "Heavyweight Canvas Tote" rendered a Birkin, "Heavyweight Cotton Crew Tee" rendered a graphic-print streetwear tee. Considered fallback was the Unsplash Source API (`source.unsplash.com/featured/?keyword`), but it has been deprecated by Unsplash and now returns 503.

Fix shape: each template now ships a `brands: TemplateBrand[]` array, and `applyTemplate()` writes brand docs to `productBrands` before writing products. Product images switched from `unsplashUrl(photoId)` (risk of guessed-wrong IDs) to `placeholderImage(seed)` (Picsum CDN — deterministic, generic, always loads, clearly a placeholder rather than impersonating a specific product). Category and hero shots keep their curated Unsplash IDs.

This is **Phase 0 of the v9.0.0 theme rearchitecture roadmap** — it stops the bleeding so the storefront is usable while the per-template component system is being built. The "templates feel visually the same" feedback is addressed in v9.0.0-alpha.* releases, not here.

### No consumer action required

Pin the new tag and reinstall. Re-applying a template (especially in **replace** mode) cleans up products that already shipped with free-text brands; merge mode is a no-op on those existing docs but writes the missing brand documents.

```bash
npm install github:CaspianTools/script-caspian-store#v8.23.2
```

### Added

- [src/templates/types.ts](src/templates/types.ts): new `TemplateBrand` type, new required `brands: TemplateBrand[]` field on `TemplateDefinition`, new `placeholderImage(seed, width, height)` helper. `ApplyTemplateResult.written` / `.skipped` gain a `brands: number` field. `IMAGE_URL_HELP` rewritten to document both image sources.
- [src/templates/apply-template.ts](src/templates/apply-template.ts): writes `productBrands/{id}` docs before products. `wipeTemplateCollections()` now also clears `productBrands` in replace mode. `countWipeImpact()` and the dry-run path both include brand counts.
- [src/admin/admin-templates-page.tsx](src/admin/admin-templates-page.tsx): apply dialog includes count surfaces brand count in both the merge diff and the replace wipe-impact line. Toast description mentions brands written.
- [src/index.ts](src/index.ts): re-exports `TemplateBrand` + `placeholderImage`.

### Changed

- [src/templates/templates/fashion-minimal/index.ts](src/templates/templates/fashion-minimal/index.ts), [electronics-tech/index.ts](src/templates/templates/electronics-tech/index.ts), [home-goods/index.ts](src/templates/templates/home-goods/index.ts): each template adds a single `brands` entry (`common-thread`, `northstack`, `workshop-six`). All product `brand` fields switched from the free-text name to the doc id. All product image URLs switched from `unsplashUrl(...)` to `placeholderImage(slug)`. Hero + category imagery unchanged.

### Fixed

- [src/admin/admin-products-list.tsx](src/admin/admin-products-list.tsx) (no code change here) — the "legacy free-text brand" warning will stop firing for template-seeded products once a template is re-applied.

## v8.23.1 — Register /admin/templates in the route dispatcher

v8.23.0 shipped `<AdminTemplatesPage>`, exposed it from `src/index.ts`, and added a **Templates** entry to the admin Settings nav — but missed adding the corresponding `case 'templates':` to the `<AdminRoot>` switch in [src/admin/admin-root.tsx](src/admin/admin-root.tsx). Symptom: clicking **Settings → Templates** in the admin nav (or visiting `/admin/templates` directly) fell through to the `default:` branch and rendered the dashboard instead. Local-dev users on v8.23.0 saw this immediately.

### No consumer action required

Pin the new tag and reinstall — the fix is a two-line change inside the dispatcher and ships in the bundled `dist/`. No env vars, no Firestore migration, no UI prop changes.

```bash
npm install github:CaspianTools/script-caspian-store#v8.23.1
```

### Fixed

- [src/admin/admin-root.tsx](src/admin/admin-root.tsx): `case 'templates': return <AdminTemplatesPage />;` added between the `appearance` and `about` cases (alphabetical placement). Import of `AdminTemplatesPage` added alongside the other admin-page imports at the top of the file. `/admin/templates` now renders the templates page that v8.23.0 already shipped in `dist/`.

## v8.23.0 — Storefront templates: three industry presets with curated imagery, applied from /admin/templates or the setup wizard

A fresh install of the script previously produced an empty storefront — the chosen theme applied to zero products, zero categories, blank pages. The owner had to either find sample content elsewhere or stare at an empty grid until they\'d written their own. This release ships **three complete storefront templates** the owner can apply with one click, ending up with a populated site immediately.

Each template bundles a theme + hero copy + 8–9 sample products + 3 categories + four editorial pages (about / privacy / terms / shipping-returns) + 2 journal articles + branding hints + a feature-flag preset. Imagery uses **Unsplash CDN URLs** (free for any commercial use, no attribution required, hand-picked per template for visual coherence). The npm tarball stays lean — no binary images bundled — and admins can replace any sample image after applying.

The v1 lineup is industry-diverse so the picker covers three common verticals:

1. **Fashion Minimal** — apparel & accessories on a clean white palette with editorial photography. Theme: neutral, Inter wordmark, soft radius.
2. **Electronics Tech** — audio, wearables, and desk gear with a dark studio palette and green accent. Theme: dark mode, Space Grotesk wordmark.
3. **Home Goods** — kitchen / living / workspace pieces in warm earth tones with lifestyle interior photography. Theme: cream + brown, Cormorant Garamond wordmark.

Two surfaces for applying:

- **`/admin/templates`** — new admin page (Settings → Templates in the nav). Grid of preview cards, click for the full apply dialog with mode selector (Merge / Replace), live diff preview, and a confirmed apply.
- **Setup wizard** — a new template-picker step lands between Site Info and Branding. Owners pick a template (or "Start blank") before continuing; the choice pre-populates the branding step\'s theme + hero, and `applyTemplate()` runs on wizard completion in merge mode.

Apply semantics: **merge mode** (default, idempotent) writes only docs whose id is unused — safe to re-apply, no destruction. **Replace mode** (UI confirmation required) wipes the four template-managed collections (productCategories, products, pageContents, journal) before writing — used by the "reset to sample data" affordance for owners who want to start fresh.

Also fixes a stale comment in [src/components/setup/steps/summary-step.tsx](src/components/setup/steps/summary-step.tsx) referencing the v8.7.x six-step indices; updated to reflect the v8.23.0 seven-step ordering.

### Consumer action required on upgrade

Pin the new tag and reinstall:

```bash
npm install github:CaspianTools/script-caspian-store#v8.23.0
```

If you scaffolded before this release and want the new `/admin/templates` page, add a route file at `src/app/admin/templates/page.tsx`:

```tsx
import { AdminTemplatesPage } from '@caspian-explorer/script-caspian-store';
export default function Page() { return <AdminTemplatesPage />; }
```

Or skip the route file — the setup wizard\'s template-picker step works without it; the standalone admin page is only needed for the post-wizard "browse and apply later" entry point.

No data migration required. Existing installs are unaffected until an admin clicks Apply.

### Added

- [src/templates/types.ts](src/templates/types.ts): `TemplateDefinition` interface and supporting types (`TemplateVertical`, `TemplatePreview`, `TemplateBrandingDefaults`, `ApplyTemplateMode`, `ApplyTemplateOptions`, `ApplyTemplateResult`). `unsplashUrl()` helper for canonical Unsplash CDN URL construction; `IMAGE_URL_HELP` documentation constant.
- [src/templates/apply-template.ts](src/templates/apply-template.ts): `applyTemplate(db, templateId, options)` writes the template\'s bundled content to Firestore in merge or replace mode; `countWipeImpact()` for the replace-mode confirmation UI; `nowTimestamp()` helper for consumer one-off templates.
- [src/templates/catalog.ts](src/templates/catalog.ts): `TEMPLATE_CATALOG` (record), `TEMPLATE_LIST` (ordered array), `getTemplate(id)` lookup.
- [src/templates/templates/fashion-minimal/index.ts](src/templates/templates/fashion-minimal/index.ts), [src/templates/templates/electronics-tech/index.ts](src/templates/templates/electronics-tech/index.ts), [src/templates/templates/home-goods/index.ts](src/templates/templates/home-goods/index.ts): the three bundled templates. Each is one file containing theme + hero + features + branding + categories + products + pages + journal + preview metadata.
- [src/admin/admin-templates-page.tsx](src/admin/admin-templates-page.tsx): new `<AdminTemplatesPage>` — preview card grid, full-detail apply dialog with mode selector, live dry-run diff, and `countWipeImpact` confirmation for replace mode.
- [src/components/setup/steps/template-picker-step.tsx](src/components/setup/steps/template-picker-step.tsx): new wizard step. Renders the three template tiles plus a "Start blank" tile; the chosen template\'s theme + hero pre-populate the branding step.

### Changed

- [src/components/setup/setup-types.ts](src/components/setup/setup-types.ts): `WizardDraft` gains a `template: TemplateDraft` field (`{ templateId: string }`, empty string for "Start blank").
- [src/components/setup/setup-wizard.tsx](src/components/setup/setup-wizard.tsx): step count bumped from 6 to 7; new `STEP_TEMPLATE = 3` inserted between site-info and branding; remaining indices shifted by +1. The `finish()` callback now runs `applyTemplate(db, templateId, { mode: 'merge' })` before redirecting when a template was picked.
- [src/components/setup/steps/summary-step.tsx](src/components/setup/steps/summary-step.tsx): adds a Template row showing the picked template name (or "Start blank"); `onEdit` indices updated for the new step ordering.
- [src/admin/admin-shell.tsx](src/admin/admin-shell.tsx): adds a `Templates` child entry to the Settings nav group, pointing at `/admin/templates`. Uses `BookmarkIcon`.
- [src/admin/index.ts](src/admin/index.ts) + [src/index.ts](src/index.ts): re-export `AdminTemplatesPage`, `TEMPLATE_CATALOG`, `TEMPLATE_LIST`, `getTemplate`, `applyTemplate`, `countWipeImpact`, `unsplashUrl`, and all template types so consumers can mount the page and call the apply helpers directly.

## v8.22.0 — GitHub-commit self-update mode for serverless hosts (App Hosting, Vercel)

The in-app **Update** button on `/admin/about` previously only worked on hosts where the running Node process had access to `git`, a writable `node_modules`, and a process supervisor that would respawn on `process.exit(0)` — VPS, Docker, local `npm run dev`. On serverless hosts the same flow fails three different ways: Firebase App Hosting runtime containers ship without `git` on PATH (npm install → `spawn git ENOENT`), the filesystem layer is read-only (EROFS even past the spawn), and `process.exit(0)` causes the platform to respawn from the unmodified deployed image rather than the freshly-installed one — so even a hypothetically-successful install would evaporate on the next request. This release adds a second update path that works exactly the way these platforms expect: push a `package.json` bump to the repo via the GitHub REST API and let the host's normal git-trigger redeploy handle the rest.

When `CASPIAN_GITHUB_TOKEN` and `CASPIAN_CONSUMER_REPO` are both set on the server, the **Update** button switches to **GitHub-commit mode** — it fetches the storefront's `package.json` from GitHub, bumps the script dependency's tag, best-effort updates `package-lock.json` (rewrites the `resolved` SHA for the script entry against the new tag's commit, leaving transitive deps alone), and pushes a single commit to the configured branch (`main` by default). The admin gets a green panel back with a link to the commit and a "your host should redeploy in 3–5 minutes" note. The original npm-install mode stays available for VPS / Docker / local dev — leave the env vars unset and the route behaves exactly as in v8.21.0.

This is also a good time to fix a stale default: `ALLOWED_OWNER` and `DEFAULT_REPO_OWNER` both said `Caspian-Explorer`, but the actual GitHub org is `CaspianTools` (the `@caspian-explorer/` npm scope is a separate identifier — left alone). Existing consumers passing explicit `owner` props on `<AdminAboutPage>` or `<AdminShell>` are unaffected; only callers relying on the built-in default change behaviour.

### Consumer action required on upgrade

On VPS / Docker / local dev nothing changes — pin the new tag and reinstall:

```bash
npm install github:CaspianTools/script-caspian-store#v8.22.0
```

On Firebase App Hosting / Vercel / any serverless host, you also need a fine-grained GitHub Personal Access Token scoped to your storefront repo (Contents: read and write). See [INSTALL.md → Self-update → GitHub-commit mode setup](INSTALL.md#github-commit-mode-setup-firebase-app-hosting--vercel--serverless) for the full walkthrough. After creating the token and exposing it as the `CASPIAN_GITHUB_TOKEN` secret on your host (alongside `CASPIAN_CONSUMER_REPO=<owner>/<storefront-repo>`), the **Update** button on `/admin/about` will work end-to-end. Without these env vars the button still appears but falls back to the v7-era npm-install behaviour, which fails on serverless with `spawn git ENOENT`.

### Added

- [src/server/self-update.ts](src/server/self-update.ts): `tryGithubCommitMode()` — fetches `package.json` (and best-effort `package-lock.json`) via the GitHub REST API, bumps the script dep spec to the new tag, resolves the tag → commit SHA for the lockfile's `resolved` field, and pushes a single commit to `CASPIAN_CONSUMER_BRANCH` (default `main`) via the Git Trees + Refs APIs. Validation: `CONSUMER_REPO_RE` enforces `<owner>/<repo>` format; the existing `VERSION_RE` and `GITHUB_NAME_RE` still gate the version and owner/repo overrides. Token is never logged or echoed back; npm-style env-ref redaction continues to apply to the `stderr` field that npm-install mode populates.
- [src/services/self-update-service.ts](src/services/self-update-service.ts): `SelfUpdateResult` extended with optional `mode` (`'npm-install' | 'github-commit'`), `commitSha`, `commitUrl`, `lockfileUpdated`, and `message` fields. `mode` is forward-compatible: older servers don't tag the response and are treated as npm-install.
- [src/admin/admin-about-page.tsx](src/admin/admin-about-page.tsx): new `<GithubCommitDetails>` sub-panel renders the linked commit SHA and the lockfile-updated marker when `result.mode === 'github-commit'`. Toast text switches from "Server is restarting" to "Pushed a package.json bump to GitHub. Your host should redeploy in 3–5 minutes." for the new mode.
- [INSTALL.md](INSTALL.md): new "GitHub-commit mode setup" subsection under "Self-update from `/admin/about`" — fine-grained PAT walkthrough, env-var table, App Hosting + Vercel + self-hosted Node snippets, token rotation, security model.

### Changed

- [src/server/self-update.ts](src/server/self-update.ts): default `ALLOWED_OWNER` updated from `Caspian-Explorer` to `CaspianTools` to match the actual GitHub org. JSDoc on the threat-model block updated to reflect the two modes. npm-install mode now returns `mode: 'npm-install'` in both success and failure JSON so clients can disambiguate; previously the field was absent and the client had to infer mode from `restarting` / `stdout` presence.
- [src/services/github-updates-service.ts](src/services/github-updates-service.ts): `DEFAULT_REPO_OWNER` updated from `Caspian-Explorer` to `CaspianTools`. Consumers passing explicit `owner` props are unaffected.
- [src/admin/admin-shell.tsx](src/admin/admin-shell.tsx), [src/services/error-log-service.ts](src/services/error-log-service.ts): stale `Caspian-Explorer` mentions in JSDoc corrected to `CaspianTools`.

## v8.21.0 — Mobile-friendly filter bottom drawer on the product listing page

On screens ≤720px wide, the left filter sidebar on `<ProductListPage>` (and any page mounted under `/shop/[category]`) previously stacked above the product grid and pushed the grid down by ~400–600px of filter chrome before the first product was reachable. This release replaces the stacked sidebar on mobile with a compact toolbar — a "Filters (N)" button showing the count of active filter dimensions, plus the live result count — that opens a bottom drawer containing the same filter form. The drawer slides up from the bottom (220ms, respects `prefers-reduced-motion`), takes `max-height: 85vh`, has a grab-handle, and ends in a sticky footer with **Reset** + **Show {n} results** so picking filters then dismissing the drawer is one tap. Desktop layout is unchanged — sticky 240px sidebar exactly as before.

### No consumer action required

Pin the new tag and reinstall — the mobile behaviour activates from the existing CSS in `@caspian-explorer/script-caspian-store/styles.css` (already imported once at the app root), and `<ProductListPage>` automatically mounts the new drawer. No props changed; `hideFilters` still hides both surfaces.

```bash
npm install github:CaspianTools/script-caspian-store#v8.21.0
```

### Added

- [src/components/shop-filter-drawer.tsx](src/components/shop-filter-drawer.tsx): new public `<ShopFilterDrawer>` — bottom-anchored modal that wraps the shared filter form, with overlay-click + Escape + sticky footer (Reset / Show results). Reuses the same body-overflow + Escape conventions as `<CartSheet>`.
- [src/components/shop-filter-sidebar.tsx](src/components/shop-filter-sidebar.tsx): new public `<ShopFilterFields>` (the body-only filter form, no outer container — drop into a sidebar, dialog, or drawer) and `countActiveShopFilters(state)` helper for badge UIs.
- [src/components/product-list-page.tsx](src/components/product-list-page.tsx): inline mobile toolbar (filter button with active-count badge + result count) rendered above the grid, hidden on desktop via CSS.
- [src/i18n/messages.ts](src/i18n/messages.ts): `shop.filters.openMobile`, `shop.filters.openMobileWithCount`, `shop.filters.apply`, `shop.filters.applyWithCount`, `shop.filters.close`.

### Changed

- [src/components/shop-filter-sidebar.tsx](src/components/shop-filter-sidebar.tsx): refactored `<ShopFilterSidebar>` to delegate its body to the new `<ShopFilterFields>`. Public props are unchanged — existing consumers calling `<ShopFilterSidebar state={…} onChange={…} … />` get identical output.
- [src/styles/globals.css](src/styles/globals.css): at `≤720px`, `.caspian-shop-filter-sidebar` is hidden and `.caspian-shop-mobile-toolbar` is revealed. Added `caspian-drawer-slide-up` keyframes and a `prefers-reduced-motion` opt-out.

## v8.20.2 — PDP image gallery no longer renders a horizontal scrollbar under the thumbnail rail

The vertical thumbnail rail on `<ProductGallery>` (the column of small previews shown next to the main image when a product has multiple photos) was painting a thin horizontal scrollbar under the rail on browsers that report a non-zero X scrollWidth for the column, even though there was nothing to scroll horizontally. The rail used `overflowY: 'auto'` to enable vertical scrolling past the fifth thumbnail, but that property only constrains the Y axis — X is left at the default `visible`, so a 1–2px X overflow can still produce a scrollbar slot. Switching to the shorthand `overflow: 'hidden auto'` (X hidden, Y auto) eliminates the artefact while preserving vertical scrolling for galleries with more than five photos.

### No consumer action required

Pin the new tag and reinstall — the fix is a styling-only one-line change inside `<ProductGallery>` and ships in the bundled `dist/`.

```bash
npm install github:CaspianTools/script-caspian-store#v8.20.2
```

### Fixed

- [src/components/product-gallery.tsx](src/components/product-gallery.tsx): thumbnail rail uses `overflow: 'hidden auto'` instead of `overflowY: 'auto'` so the column no longer renders a spurious horizontal scrollbar.

## v8.20.1 — Firestore composite indexes for the three plugin install collections

Storefront checkout was throwing `FirebaseError: The query requires an index` on freshly-deployed projects, because `listPaymentPluginInstalls(db, { onlyEnabled: true })` (and the parallel shipping / email helpers) issues a `where('enabled', '==', true) + orderBy('order', 'asc')` query that requires a composite index Firestore does not autocreate. Existing projects worked because the index had been created out-of-band via the "create here" link in the console error, but a fresh `firebase deploy --only firestore:indexes` would still leave the project broken until that one-off click. This release ships the index definitions in the package so the consumer's `npm run firebase:sync && firebase deploy --only firestore:indexes` flow produces working installs out of the box.

### Consumer action required on upgrade

```bash
npm install github:CaspianTools/script-caspian-store#v8.20.1
npm run firebase:sync
firebase deploy --only firestore:indexes
```

The third command is the one that matters — App Hosting / Vercel deploys do not push Firestore indexes. Index builds take 2–10 minutes depending on collection size; queries will return the `index is currently building` error until they finish, then succeed.

### Added

- [firebase/firestore.indexes.json](firebase/firestore.indexes.json): three composite indexes on `enabled ASC, order ASC` for `paymentPluginInstalls`, `shippingPluginInstalls`, and `emailPluginInstalls`.

## v8.20.0 — Product cards now expose wishlist + quick-add icons (with admin toggles)

`<ProductCard />` previously rendered only image, badges, brand, name, and price — to save to wishlist or add to cart a customer had to open the PDP. This release adds two icons directly on each card: a **heart** at the top-right of the image (toggles wishlist via the existing `useWishlist().toggle()`) and a **shopping-bag** at the bottom-right of the card (quick-adds one unit via `useCart().addToCart()`). For products with `sizes`, the quick-add auto-picks `sizes[0]`; products without sizes add as-is.

Two new admin toggles in `/admin/appearance` let merchants enable/disable each icon independently. Both default to **on**, so existing stores get the new icons immediately on upgrade. The wishlist heart is additionally gated on `ScriptSettings.features.wishlist` — turning wishlist off globally hides the heart on cards too, even when `productCard.showWishlistIcon` is true.

Both icon buttons call `e.preventDefault(); e.stopPropagation()` inside their click handlers so they don't bubble up to the card's wrapping `<Link>` and trigger PDP navigation.

### No consumer action required

Pin the new tag and reinstall — the icons render automatically and existing Firestore `scriptSettings/site` docs fall through to default-on behaviour because the new `productCard` field is optional.

```bash
npm install github:CaspianTools/script-caspian-store#v8.20.0
```

### Added

- [src/components/quick-add-to-cart-button.tsx](src/components/quick-add-to-cart-button.tsx): new public `<QuickAddToCartButton>` (exported alongside `WishlistButton`). Single circular icon button, picks `product.sizes?.[0]` for variant products, shows `cart.added` / `cart.addFailed` toasts.
- [src/types.ts](src/types.ts): new `ProductCardSettings` interface (`showWishlistIcon`, `showQuickAddIcon`) and optional `ScriptSettings.productCard` field with both defaults `true` in `DEFAULT_SCRIPT_SETTINGS`.
- [src/admin/admin-appearance-page.tsx](src/admin/admin-appearance-page.tsx): new "Product card" section below the theme catalog with two checkboxes persisted via `useScriptSettings().save({ productCard })`.
- [src/i18n/messages.ts](src/i18n/messages.ts): `cart.added`, `cart.addFailed`, `cart.aria.quickAdd`, and `admin.appearance.productCard.*` keys.

### Changed

- [src/components/product-card.tsx](src/components/product-card.tsx): reads `useScriptSettings()` and renders `<WishlistButton>` (absolutely positioned top-right inside the image container, sibling of the badges row) and `<QuickAddToCartButton>` (right-aligned next to the price block via a flex `space-between` wrapper). Card layout otherwise unchanged.
- [src/components/wishlist-button.tsx](src/components/wishlist-button.tsx): `handleClick` now accepts a `React.MouseEvent` and calls `e.preventDefault(); e.stopPropagation()` so the button works inside a wrapping `<Link>`. Behaviour outside a link is unchanged.

## v8.18.0 — Newly-installed payment / email plugins now reach storefront checkout without a manual Enable step

Closes a v8.17.0 regression where a merchant who installed Stripe (or any payment / email plugin) saw it as "installed" in the admin but the storefront `/checkout` still showed "Checkout is not available — The store owner hasn't set up a payment provider yet." Root cause: new payment + email installs were created with `enabled: false` (the deliberate "force admin to verify" pattern), and the storefront checkout gate (`listPaymentPluginInstalls(db, { onlyEnabled: true })` at [src/hooks/use-checkout.ts](src/hooks/use-checkout.ts#L37-L45)) treats disabled installs as nonexistent. The v8.17.0 post-install redirect to `/admin/plugins` removed the prior visibility merchants had on `/admin/plugins/manage/<category>` (where the install table surfaces an Enable toggle), so the new install became invisible everywhere — both in admin and on the storefront.

This release auto-enables the **first** install of each `(category, pluginId)` pair when the merchant saves the configure dialog. The merchant's Save click is itself the verification step, so making them flip a separate toggle was just busywork that broke checkout silently. Additional instances of the same plugin (e.g. a second Stripe sandbox account) still default to `enabled: false` so the merchant can verify the new config before swapping live traffic. Shipping plugins were already enabled-by-default and are unchanged.

As a defense-in-depth measure for any disabled install (including pre-existing ones merchants disabled by hand), the unified `/admin/plugins` page now also renders disabled installs — previously it filtered to enabled-only via `useEnabledPluginInstalls()`, which combined with v8.17.0's catalog-card dedup meant a disabled install rendered nothing at all. Disabled installs now show with the existing "Installed" badge alongside a new outline "Disabled" badge. Clicking Configure still routes to the install detail page where the existing Enable toggle lives. The admin sidebar's dynamic plugin children continue to show only enabled installs (no change there).

### Consumer action required on upgrade

```bash
npm install github:CaspianTools/script-caspian-store#v8.18.0
```

Existing installs that are currently disabled stay disabled — auto-enable only applies on new install creation, not retroactively. Merchants who installed a payment or email plugin on v8.17.0 and haven't fixed it manually should visit `/admin/plugins/manage/payments` (or `.../email-providers`) once and click Enable on the install they want live. After that, the storefront checkout will pick it up.

### Changed

- [src/admin/admin-payment-plugins-page.tsx](src/admin/admin-payment-plugins-page.tsx), [src/admin/admin-email-plugins-page.tsx](src/admin/admin-email-plugins-page.tsx): `handleSave` computes `isFirstInstanceOfPlugin = !editingId && !installs.some(i => i.pluginId === draft.pluginId)` and writes `enabled: editingInstall?.enabled ?? isFirstInstanceOfPlugin`. Edits to existing installs preserve their previous enabled state exactly as before.
- [src/admin/use-enabled-plugin-installs.ts](src/admin/use-enabled-plugin-installs.ts): the hook now accepts an optional `{ onlyEnabled?: boolean }` parameter (default `true` for back-compat with the sidebar consumer) and returns `enabled: boolean` on each row.
- [src/admin/admin-plugins-page.tsx](src/admin/admin-plugins-page.tsx): passes `{ onlyEnabled: false }` to the hook so disabled installs render too. `PluginEntry` (kind: `'install'`) carries an `enabled` field; `<PluginCard>` shows an outline "Disabled" badge alongside the "Installed" badge when `!enabled`.
- [src/i18n/messages.ts](src/i18n/messages.ts): added `admin.plugins.badge.disabled` = "Disabled".

## v8.17.0 — Admin /plugins shows installed plugins as installed; new installs return to the unified list

The unified `/admin/plugins` page was rendering two cards per installed plugin — one "Configure" card from the install (kind: `'install'`) and a duplicate "Install" card from the static catalog (kind: `'catalog'`) for the same `pluginId`. After installing e.g. Stripe, merchants still saw a "Install" card for Stripe and concluded the install had failed. Clicking that "Install" card navigated to `/admin/plugins/manage/payments` — a category install page that isn't linked from the admin sidebar — leaving merchants stranded on a page they couldn't find again.

This release suppresses the catalog card for any plugin that already has at least one install. After installing Stripe the merchant sees a single Stripe card with a "Configure" CTA and the "Installed" badge, matching the mental model of "install = installed." Installing a second instance (e.g. a second Stripe account) is still possible from `/admin/plugins/manage/<category>`; that page just isn't surfaced from the unified list anymore.

A successful new install also now redirects the merchant back to `/admin/plugins` (the unified list reachable from the sidebar) instead of leaving them on `/admin/plugins/manage/payments`. Edits to existing installs still stay on the same page so the merchant can keep tweaking.

### Consumer action required on upgrade

```bash
npm install github:CaspianTools/script-caspian-store#v8.17.0
```

No code changes on consumer sites.

### Changed

- [src/admin/admin-plugins-page.tsx](src/admin/admin-plugins-page.tsx): the `entries` memo now tracks `${category}:${pluginId}` keys for installs and skips catalog entries that match. Multi-instance install paths (`/admin/plugins/manage/<category>`) are unaffected.
- [src/admin/admin-payment-plugins-page.tsx](src/admin/admin-payment-plugins-page.tsx), [src/admin/admin-shipping-plugins-page.tsx](src/admin/admin-shipping-plugins-page.tsx), [src/admin/admin-email-plugins-page.tsx](src/admin/admin-email-plugins-page.tsx): `handleSave` now calls `nav.push('/admin/plugins')` after a successful CREATE (new install). The UPDATE branch keeps the prior behavior of reloading in place.

## v8.16.0 — Product detail page now capped at 1200px to match the rest of the storefront

The product detail page was the only top-level page in the storefront without an outer width constraint. On wide displays (≥1440px) the gallery + info grid stretched to whatever container it was mounted in, and the Details / Reviews / Questions tab strip and its panels did the same — leaving the PDP visually misaligned next to the cart, checkout, account, and search pages, which already centre their content in a 1200px column.

This release wraps both the loaded and loading states of `ProductDetailPage` with the same `style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 24px 0' }}` container the other pages use. The top half (gallery + info) and the bottom half (tabs + Details / Reviews / Questions) are now centred and capped together, with 24px side gutters that match `cart-page.tsx`, `checkout-page.tsx`, `account-page.tsx`, and `search-results-page.tsx`. The not-found state is unchanged — it was already a centred paragraph and didn't need a container.

### Consumer action required on upgrade

```bash
npm install github:CaspianTools/script-caspian-store#v8.16.0
```

## v8.15.0 — No underlines on any link or link-styled control across the storefront

The storefront previously rendered link underlines in two distinct places. Real `<a>` tags inside `<LayoutShell>` were already underline-free via `.caspian-root a { text-decoration: none }`, but any anchor mounted outside the root (custom consumer headers, embedded marketing fragments) still picked up the browser default underline. Separately, four buttons that visually present as text links — "Reset filters" in the shop sidebar, "View all results" in the header search popup, "Edit" in the setup-wizard summary, and "Delete" on an applied cart promo code — carried inline `textDecoration: 'underline'` that bypassed the CSS rule entirely. This release removes both sources of underlines so the rendered storefront is uniformly underline-free regardless of element type or mount location.

The anchor rules in `globals.css` are now unscoped from `.caspian-root`, so they apply globally. `color: inherit`, the hover opacity, the `:focus-visible` keyboard ring, and the transition are all preserved — only the underline behaviour is gone. The four button styles drop the inline `textDecoration: 'underline'` property; their other styling (color, cursor, padding, fontSize) is unchanged, so they remain visually distinct from regular text.

### Consumer action required on upgrade

```bash
npm install github:CaspianTools/script-caspian-store#v8.15.0
```

No code changes on consumer sites. Any consumer that was relying on the browser default underline for anchors mounted outside `<LayoutShell>` will see those underlines disappear after the pin is bumped.

### Changed

- [src/styles/globals.css](src/styles/globals.css): `.caspian-root a`, `.caspian-root a:hover`, and `.caspian-root a:focus-visible` are now plain `a`, `a:hover`, and `a:focus-visible` so every anchor on the page is underline-free regardless of mount.
- [src/components/shop-filter-sidebar.tsx](src/components/shop-filter-sidebar.tsx): "Reset filters" button drops inline `textDecoration: 'underline'` and the now-unused `textUnderlineOffset: 3`.
- [src/components/search-dialog.tsx](src/components/search-dialog.tsx): "View all results" button in the search popup drops inline `textDecoration: 'underline'`.
- [src/components/setup/steps/summary-step.tsx](src/components/setup/steps/summary-step.tsx): `editLink` shared style drops `textDecoration: 'underline'`.
- [src/components/cart-page.tsx](src/components/cart-page.tsx): applied-promo "Delete" button drops inline `textDecoration: 'underline'`.

## v8.14.0 — Admin can promote/demote users from the Admin > Users page

The Admin > Users page was previously read-only — admins could see the list and the role badge, but had no in-app way to change a user's role. The only paths to promote someone were the `claimAdmin` callable (bootstrap-only; refuses once any admin exists), the `grant-admin` CLI (requires service-account credentials on a workstation), or a direct edit in the Firestore console. This release adds first-class **Promote to admin** and **Demote to customer** buttons in the user table, gated by a `confirm()` dialog, with server-enforced guards: only admins can invoke either action, an admin cannot demote themselves (use a different admin account), and the last remaining admin cannot be demoted (avoids locking the site out).

Both actions are server-side callables — the existing `firestore.rules` already block client writes to the `role` field, so the callables are the only path. The demote callable additionally calls `revokeRefreshTokens(targetUid)` so the cleared role takes effect immediately rather than ~1 h later when the existing ID token expires; without revocation the security rules would still trust the stale `role: 'admin'` claim on the target's session.

### Consumer action required on upgrade

```bash
npm install github:CaspianTools/script-caspian-store#v8.14.0
cd firebase/functions-admin && npm install && cd ../..
firebase deploy --only functions:caspian-admin
```

The new `promoteUserToAdmin` and `demoteAdminToCustomer` callables ship in `caspian-admin-functions@0.7.0`; redeploying the codebase is required for the new buttons to work. No firestore rules changes.

### Added

- [firebase/functions-admin/src/promote-user-to-admin.ts](firebase/functions-admin/src/promote-user-to-admin.ts): new admin-only callable. Verifies the caller is admin via both the Auth claim AND a Firestore re-read (defense-in-depth against a freshly-demoted caller whose token claim still says admin). Sets `users/{target}.role = 'admin'` and the Auth custom claim inline (mirroring the `claimAdmin` pattern to avoid eventual-consistency lag with the `syncAdminClaim` trigger).
- [firebase/functions-admin/src/demote-admin-to-customer.ts](firebase/functions-admin/src/demote-admin-to-customer.ts): new admin-only callable. Same caller check, plus self-demote guard and last-admin guard. Clears `role` from the target's custom claims and calls `revokeRefreshTokens(targetUid)` to force re-auth.
- [src/i18n/messages.ts](src/i18n/messages.ts): `admin.users.col.actions`, `admin.users.action.promote`, `admin.users.action.demote`, `admin.users.action.busy`, `admin.users.action.confirmPromote`, `admin.users.action.confirmDemote`, `admin.users.action.self`, `admin.users.action.errorGeneric`.

### Changed

- [src/admin/admin-users-page.tsx](src/admin/admin-users-page.tsx): adds an Actions column. Each row renders a Promote (for customers) or Demote (for other admins) button; the current admin's own row shows "— (you)" instead. Buttons confirm via `window.confirm`, invoke the callable, and optimistically update local state on success. Per-row error messages render inline under the button on failure.
- [firebase/functions-admin/src/index.ts](firebase/functions-admin/src/index.ts): exports `promoteUserToAdmin` and `demoteAdminToCustomer`.
- [firebase/functions-admin/package.json](firebase/functions-admin/package.json): `0.6.0` → `0.7.0`.

## v8.13.0 — Product images: 10-image cap, drag-to-reorder, admin-chosen featured image

Each product can now carry up to 10 images, and the admin explicitly chooses which one is the featured image (the large image on the product detail page, and the thumbnail on product cards / search results / category grids). The implicit `images[0] = featured` contract that the storefront already honored is unchanged — the new controls just give the admin a real way to set it.

In the product editor (`/admin/products/new` and `/admin/products/{id}/edit`):

- The "Images" section heading now shows a live counter: `Images (n / 10)`.
- Each thumbnail tile is `draggable` and accepts drops from other tiles, so the admin can drag a thumbnail anywhere in the grid to reorder. The dragged tile dims to 40% opacity during the drag.
- The thumbnail at index 0 carries a `★ Featured` badge (top-left) and a `var(--caspian-primary)` outline. All other thumbnails get a `Make featured` button (bottom-left) that promotes that image to index 0 with a single click.
- Once the gallery hits 10 images, the `<ImageUploadField>` and "or paste image URL" row are replaced with a single helper line: "Maximum of 10 images reached. Remove one to add another." A belt-and-suspenders guard in `handleAddImageUrl` also rejects (with a destructive toast) any paste-then-Enter race that would otherwise sneak in an 11th.

No schema change. `Product.images: ProductImage[]` is unchanged; only the order written by the editor changes. `<ProductCard>` already pulls `product.images?.[0]` and `<ProductGallery>` already initialises its active slot to `images[0]`, so the admin's chosen featured image flows through automatically with no edits to consumer code or storefront components. Existing products keep their current first image as the featured image (which was already the de-facto behavior).

### Consumer action required on upgrade

```bash
npm install github:CaspianTools/script-caspian-store#v8.13.0
```

No code changes on consumer sites. Existing products and gallery rendering are unaffected; the new controls only show up in the admin product editor.

### Changed

- [src/admin/admin-product-editor.tsx](src/admin/admin-product-editor.tsx): new `MAX_PRODUCT_IMAGES = 10` cap enforced in both `handleAddImageUrl` (guard + destructive toast) and the JSX (the upload UI is replaced with a "Maximum of 10 images reached" line at the cap). Each thumbnail tile is now `draggable` with `onDragStart` / `onDragOver` / `onDrop` / `onDragEnd` handlers that splice-move within `form.images`. Index 0 renders a `★ Featured` badge + primary-color outline; every other tile renders a `Make featured` button that promotes via `handleMakeFeatured(id)`. Section heading shows `Images (n / 10)` counter. Hand-rolled HTML5 drag-and-drop (no new dependency).

## v8.12.0 — Public /wishlist works for anonymous shoppers; anon list merges into the account on sign-in

The `/wishlist` route was previously a placeholder that read "Your wishlist lives inside the account page." This release turns it into a real page that works for everyone. Anonymous shoppers can now add products to their wishlist (the heart button on product cards no longer rejects them with a "Sign in to save" toast); the saved IDs persist in `localStorage` (`caspian-wishlist-v1`) for the session. When an anonymous shopper signs in, their local list is **merged** (union, dedup) into their server-side wishlist on `users/{uid}.wishlist` rather than being thrown away — the deliberate improvement over `<CartProvider>`'s hard-switch behavior.

The shared grid (product cards + add-to-cart + remove buttons + empty state) lives in a new `<WishlistGrid>` component used by both `<WishlistPage>` (mounted at `/wishlist`) and `<WishlistPanel>` (inside `<AccountPage>` at `/account?section=wishlist`). The two access points stay in sync — items removed in one show as removed in the other after the wishlist refreshes.

Anonymous shoppers see a dismissible soft banner above the grid: "Sign in to save your wishlist across devices." It's stashed per-tab via `sessionStorage` so dismissing once doesn't re-show on every navigation but does re-show in a fresh tab.

### Consumer action required on upgrade

```bash
npm install github:CaspianTools/script-caspian-store#v8.12.0
```

No code changes on consumer sites. `useWishlist()` keeps the same shape (`{ wishlist, isSaved, add, remove, toggle, signedIn }`) plus new fields (`products`, `loading`, `count`, `clear`); existing call sites continue to work.

### Added

- [src/context/wishlist-context.tsx](src/context/wishlist-context.tsx): new `<WishlistProvider>` + `useWishlist()` modeled on `<CartProvider>`. Two-tier state (id list + lazy-hydrated product map), dual-storage (`localStorage` when anon, Firestore `users/{uid}.wishlist` when signed-in), and a merge-on-sign-in hydration step.
- [src/components/wishlist/wishlist-page.tsx](src/components/wishlist/wishlist-page.tsx): new `<WishlistPage>` standalone route at `/wishlist`. Renders the shared grid plus a dismissible sign-in banner for anon shoppers.
- [src/components/wishlist/wishlist-grid.tsx](src/components/wishlist/wishlist-grid.tsx): shared product-grid UI used by both the page and the account panel — empty state, loading state, product cards with add-to-cart + remove actions.
- [src/services/wishlist-service.ts](src/services/wishlist-service.ts): new `loadUserWishlist`, `saveUserWishlist`, and `mergeWishlistOnSignIn` helpers alongside the existing `addToWishlist`/`removeFromWishlist`.
- [src/i18n/messages.ts](src/i18n/messages.ts): `wishlist.page.anonBanner`, `wishlist.page.anonBannerCta`, `common.dismiss`.

### Changed

- [src/components/caspian-root.tsx](src/components/caspian-root.tsx): `/wishlist` now renders `<WishlistPage>` instead of the placeholder.
- [src/components/auth/wishlist-panel.tsx](src/components/auth/wishlist-panel.tsx): now wraps the shared `<WishlistGrid>` in the account-card chrome. The "Sign in required" fallback was removed — the panel only renders inside `<AccountPage>`, which already gates on auth.
- [src/components/wishlist-button.tsx](src/components/wishlist-button.tsx): no longer shows a "Sign in to save" toast for anon shoppers. The heart button now toggles for everyone; `<WishlistProvider>` routes the write to local or server depending on auth state.
- [src/provider/caspian-store-provider.tsx](src/provider/caspian-store-provider.tsx): mounts `<WishlistProvider>` inside `<CartProvider>` so wishlist consumers can also call `useCart()` (the grid's "Add to cart" button uses both).
- [src/index.ts](src/index.ts): `useWishlist` is now re-exported from `./context/wishlist-context`; the old `./hooks/use-wishlist` location is gone. New public exports: `WishlistPage`, `WishlistPageProps`, `WishlistGrid`, `WishlistGridProps`, `loadUserWishlist`, `saveUserWishlist`, `mergeWishlistOnSignIn`.

### Removed

- [src/hooks/use-wishlist.ts](src/hooks/use-wishlist.ts): deleted. Superseded by `<WishlistProvider>` + `useWishlist()` in `src/context/wishlist-context.tsx`. The `useWishlist` named export still resolves at the same path from the package root.

## v8.11.0 — Default 100px breathing room between header/footer and page content

Internal storefront pages (Shop, Sign in, Register, Forgot password, Account, Cart, Checkout, Collections, FAQs, Contact, Shipping & Returns, Size Guide, Journal, Search, Order Confirmation, static content pages, 404) previously rendered their first content block flush against the bottom of the sticky `<SiteHeader>`, so page titles like "Shop" or "Sign in" visually touched the header. They were similarly flush against the top border of `<SiteFooter>`. `<LayoutShell>` now wraps its `{children}` in a `<div>` with `paddingTop: 100` and `paddingBottom: 100` so every internal route gets uniform breathing room without each page component having to opt in.

The homepage opts out: `<CaspianRoot>` passes `contentPaddingY={0}` when the path is `/` so the full-bleed `<Hero>` continues to sit flush against the header (unchanged appearance). Admin routes, the appearance-preview popup, and the setup wizard all bypass `<LayoutShell>` entirely and are unaffected. The Coming Soon splash short-circuits before the padding wrapper and is also unaffected.

Consumers who want a different gap (or no gap) on a custom mount can pass `contentPaddingY` directly to `<LayoutShell>` — it accepts any number of pixels. The `LayoutShellMountedContext` self-heal sentinel still short-circuits nested mounts so double-wrapping doesn't stack to 200px.

### Consumer action required on upgrade

```bash
npm install github:CaspianTools/script-caspian-store#v8.11.0
```

No code changes on consumer sites. Internal pages will visually shift down by 100px once the pin is bumped and the package is reinstalled.

### Added

- [src/components/layout-shell.tsx](src/components/layout-shell.tsx): new `contentPaddingY?: number` prop on `LayoutShellProps` (default `100`) — vertical padding inserted between the header / footer and the page content. Set to `0` for full-bleed pages.

### Changed

- [src/components/layout-shell.tsx](src/components/layout-shell.tsx): `{children}` is now wrapped in a `<div style={{ paddingTop, paddingBottom }}>` between the `<SiteHeader>` and `<SiteFooter>` siblings.
- [src/components/caspian-root.tsx](src/components/caspian-root.tsx): passes `contentPaddingY={path === '/' ? 0 : 100}` to `<LayoutShell>` so the homepage hero stays flush while every other storefront route gets the default 100px gap.

## v8.10.0 — Header search is now an icon button + popup with live product results

The storefront `<SiteHeader>` previously embedded a 320px-wide inline search input that competed with the brand, nav, wishlist, cart, and account chips for horizontal space — uncomfortable on tablet widths and forced consumers with longer brand wordmarks to set `showSearch={false}` to get a clean header. This release replaces the inline input with a single icon button. Clicking it opens a centred dialog (`<SearchDialog>`) containing the search input, a close (X) button, and a live list of matching products that updates as the user types. Pressing Enter (or clicking "View all N results" when matches exceed eight) navigates to the existing `/search?q=...` results page, preserving the canonical full-results UX. Clicking a result navigates straight to that product's page and dismisses the dialog. Escape, click-on-overlay, and the X button all close the dialog.

The matching algorithm is the same lowercase `name + brand + category` substring filter used by `<SearchResultsPage>` (no extra Firestore queries beyond loading the active catalog once on first dialog open), so popup and full-page results stay consistent. The product catalog and brand/category label maps are fetched lazily and cached for the dialog's lifetime — closing and reopening the dialog does not refetch.

The `showSearch` prop on `<SiteHeader>` is unchanged in name and type; it now controls whether the icon-button + popup affordance renders (previously: whether the inline input rendered). Existing consumers passing `showSearch={false}` see no change. Existing consumers relying on `showSearch={true}` (or its default) will see the new icon-only UI after upgrading.

### Consumer action required on upgrade

```bash
npm install github:CaspianTools/script-caspian-store#v8.10.0
```

No code changes on consumer sites. The new UI ships automatically once the pin is bumped and the package is reinstalled.

### Added

- [src/components/search-dialog.tsx](src/components/search-dialog.tsx): new `<SearchDialog>` component (`SearchDialogProps`) — controlled dialog with live product results. Re-exported from the main barrel.
- [src/hooks/use-product-search.ts](src/hooks/use-product-search.ts): new `useProductSearch(query, { enabled, max })` hook (`UseProductSearchOptions`, `UseProductSearchResult`) — lazy catalog + client-side filter shared by the dialog and any future search surface.
- [src/ui/icons.tsx](src/ui/icons.tsx): new `XIcon` (close glyph) re-exported from `src/ui` and the main barrel.
- [src/i18n/messages.ts](src/i18n/messages.ts): four new keys — `navigation.openSearch`, `navigation.closeSearch`, `search.loading`, `search.viewAllResults`.

### Changed

- [src/components/site-header.tsx](src/components/site-header.tsx): replaced the inline `<form>` + `<input>` block with an icon button that toggles `<SearchDialog>`. JSDoc on `showSearch` updated to "Whether to show the search button (opens a popup with live product search)." `logSearchTerm` import moved to `<SearchDialog>` (where the submission now happens). `useCaspianNavigation` and `FormEvent` imports removed from this file (no longer used here).

---

## v8.9.2 — App Hosting auto-heal works without consumer file edits

v8.9.0 fixed App Hosting build failures *if* the consumer applied a two-line change to `src/lib/caspian-adapters.tsx` and `next.config.mjs`. That violated this repo's "releases must never require consumer hand-edits" rule, and in practice consumers were upgrading the package version without applying the file edits — leaving them stuck on the same `auth/invalid-api-key` prerender crash that v8.9.0 was supposed to solve. This release closes the loop so a plain `npm install github:Caspian-Explorer/script-caspian-store#v8.9.2` is sufficient — no `caspian-adapters.tsx` edit, no `next.config.mjs` env: block. Two changes:

1. **`initCaspianFirebase` merges its incoming `config` with `readFirebaseConfigFromEnv()`** before initializing Firebase. So when the scaffold-generated `caspianFirebaseConfig` literal resolves to `{apiKey: undefined, ...}` (because the consumer didn't set the six `NEXT_PUBLIC_FIREBASE_*` vars), the missing fields auto-fill from `FIREBASE_WEBAPP_CONFIG`. Server-side prerender (where `process.env.FIREBASE_WEBAPP_CONFIG` is available on App Hosting) now succeeds.

2. **`<CaspianStoreProvider>` injects an SSR-only `<script>` tag** that serializes the resolved config into `window.__CASPIAN_FIREBASE_CONFIG__`. The browser executes that script at HTML-parse time, before React hydration, so the client provider's `useMemo` can read the same config the server saw — without consumers needing to forward `FIREBASE_WEBAPP_CONFIG` through `next.config.mjs`'s `env:` block. The window global takes precedence over `process.env` on the client (where non-`NEXT_PUBLIC_*` vars don't exist anyway). Firebase web client API keys are public by design — embedding them in the HTML is no different from the standard `NEXT_PUBLIC_FIREBASE_API_KEY` pattern.

The pre-check guard from v8.9.0 stays in place but now fires only when *all* sources (passed config, `FIREBASE_WEBAPP_CONFIG`, `NEXT_PUBLIC_*`, window global) come up empty — which is essentially "you've configured no Firebase project at all." The error message is updated to match.

### No consumer action required

`npm install github:Caspian-Explorer/script-caspian-store#v8.9.2` and redeploy — the `/_not-found` prerender now succeeds on App Hosting backends created via the Firebase Console (which auto-inject `FIREBASE_WEBAPP_CONFIG`). The two-line change documented in v8.9.0's changelog is no longer needed; sites still on the v8.8.x scaffold's inline `caspianFirebaseConfig` literal work without modification.

The v8.9.0 path (consumer-side `readFirebaseConfigFromEnv()` + `next.config.mjs` env: forward) remains valid and is still emitted by new `npm create caspian-store@latest` scaffolds. It's now an optional belt-and-suspenders rather than a requirement.

### Changed

- [src/firebase/client.ts](src/firebase/client.ts): `initCaspianFirebase` merges its `config` argument with `readFirebaseConfigFromEnv()`. Passed values always win; missing fields fall back to env. Pre-check error message updated to reference all sources auto-heal consulted.
- [src/provider/caspian-store-provider.tsx](src/provider/caspian-store-provider.tsx): `<CaspianStoreProvider>` resolves the Firebase config from passed → SSR window global → `process.env`, and emits an SSR-only `<script>` tag that mirrors the resolved config to `window.__CASPIAN_FIREBASE_CONFIG__` so client-side hydration sees the same values. Hydration-warning-suppressed because the script content is identical between SSR and client renders.

---

## v8.9.1 — Diagnostic toast commands compatible with PowerShell 5.1 (#store-1210)

Final cleanup on the long `#store-1210` chain. Three diagnostic toast strings (`imageUpload.errors.rulesStale.description`, `imageUpload.errors.unauthorized.description`, `setup.superAdmin.errors.permissionDenied`) instructed users to run `X && Y` chained commands. PowerShell 5.1 — the default Windows PowerShell that ships with Win10/11 and the most common shell our consumer-store admins run in — doesn't support `&&` (it's a PowerShell 7 / bash feature), so following those toasts on Windows produced a parser error and left the admin stuck without a clear next step.

This release rephrases each chained command to "Run `X`, then `Y`" prose, which works identically in cmd, PowerShell 5.1, PowerShell 7+, bash, and zsh — no shell-version detection needed.

### No consumer action required

Pure copy change in three i18n strings + one JSDoc comment. No public API change, no Functions changes (`functions-admin` stays at 0.6.0). Existing v8.9.0 installs see the new text wherever the toasts fire on the next library refresh; no deploy, no migration.

### Changed

- [src/i18n/messages.ts](src/i18n/messages.ts) — `imageUpload.errors.rulesStale.description`, `imageUpload.errors.unauthorized.description`, and `setup.superAdmin.errors.permissionDenied` now use "run X, then Y" prose instead of `X && Y` chains.
- [src/services/storage-service.ts](src/services/storage-service.ts) — `diagnoseUploadDenial` JSDoc updated for the same reason (cosmetic; doesn't affect runtime).

---

## v8.9.0 — Firebase App Hosting deploys "just work" via FIREBASE_WEBAPP_CONFIG auto-pickup

Closes a class of build failures where Next.js sites scaffolded by `npm create caspian-store@latest` and deployed to **Firebase App Hosting** crashed `next build` at `Generating static pages → /_not-found` with `Firebase: Error (auth/invalid-api-key)`. The default scaffold read the six `NEXT_PUBLIC_FIREBASE_*` vars only; App Hosting injects `FIREBASE_WEBAPP_CONFIG` (a JSON blob containing the same values) instead, so unless the consumer redundantly populated all six vars in their backend env, prerender saw `apiKey === undefined` and Firebase threw inside the `<CaspianStoreProvider>` `useMemo` that wraps `/_not-found` from the root layout.

The library now exports `readFirebaseConfigFromEnv()` from `@caspian-explorer/script-caspian-store/firebase`. It prefers `FIREBASE_WEBAPP_CONFIG` (App Hosting), falls back to the six `NEXT_PUBLIC_FIREBASE_*` vars (Vercel / manual / local). New scaffolds use the helper out of the box and forward `FIREBASE_WEBAPP_CONFIG` into the client bundle via `next.config.mjs`'s `env:` block.

`initCaspianFirebase` also gains a pre-check that throws an actionable error naming the missing field(s) and detected platform, instead of bubbling Firebase's opaque `auth/invalid-api-key`.

### Consumer action required on upgrade

**Vercel and local-dev consumers**: no action — your existing `NEXT_PUBLIC_FIREBASE_*` vars continue to work.

**Firebase App Hosting consumers**: two-line change to switch over to auto-pickup:

1. [src/lib/caspian-adapters.tsx](src/lib/caspian-adapters.tsx) — replace the inline `caspianFirebaseConfig = { ... }` literal with the helper:
   ```ts
   import { readFirebaseConfigFromEnv } from '@caspian-explorer/script-caspian-store/firebase';
   export const caspianFirebaseConfig = readFirebaseConfigFromEnv();
   ```
2. [next.config.mjs](next.config.mjs) — add inside the `nextConfig` object:
   ```js
   env: {
     FIREBASE_WEBAPP_CONFIG: process.env.FIREBASE_WEBAPP_CONFIG,
   },
   ```

Then:

```bash
npm install github:Caspian-Explorer/script-caspian-store#v8.9.0
firebase deploy --only apphosting
```

Alternatively, keep the v8.8.1 setup unchanged and just populate the six `NEXT_PUBLIC_FIREBASE_*` vars in your App Hosting backend env — the path the v8.8.1 README already documents. Both approaches work; auto-pickup just removes the manual env-var step.

### Added

- New file [src/firebase/env-config.ts](src/firebase/env-config.ts): `readFirebaseConfigFromEnv()` and `describeFirebaseConfigSource()` exports from the `./firebase` subpath. The first resolves Firebase web config from `FIREBASE_WEBAPP_CONFIG` with `NEXT_PUBLIC_FIREBASE_*` fallback; the second returns a human-readable label of the detected source for diagnostic error messages.

### Changed

- [src/firebase/client.ts](src/firebase/client.ts): `initCaspianFirebase` pre-checks `apiKey`, `authDomain`, `projectId`, and `appId` before reaching the Firebase SDK, throwing a diagnostic error that names the missing field(s) and platform (App Hosting / Vercel / unknown) when any are absent. Replaces Firebase's opaque `auth/invalid-api-key`.
- [scaffold/create.mjs](scaffold/create.mjs): generated `src/lib/caspian-adapters.tsx` now calls `readFirebaseConfigFromEnv()` instead of inlining six `process.env.NEXT_PUBLIC_FIREBASE_*!` reads. Generated `next.config.mjs` adds `env: { FIREBASE_WEBAPP_CONFIG: process.env.FIREBASE_WEBAPP_CONFIG }` to forward the App Hosting blob into the client bundle. Generated `src/app/providers.tsx` preflight switches to checking the resolved config object's fields and surfaces the detected source in the error message.
- Scaffolded README: App Hosting deploy section now leads with auto-pickup as the default path; manual `NEXT_PUBLIC_*` population becomes the fallback.

---

## v8.8.1 — Bare `/login`, `/register`, `/forgot-password` routes now resolve

The route dispatcher in [src/components/caspian-root.tsx](src/components/caspian-root.tsx) only matched the `/auth/...` form, but every component default targeted the bare form: `AdminGuard.signInHref = '/login'`, `LoginPage.registerHref = '/register'` and `forgotPasswordHref = '/forgot-password'`, `RegisterPage.loginHref = '/login'`, `ForgotPasswordPage.loginHref = '/login'`, `AccountPage.signInHref = '/login'`, plus the hard-coded checkout sign-in CTA. Result: the "Sign in" link rendered by `AdminGuard` on every signed-out admin URL (e.g. `/admin/products/<id>/edit`) hit NotFound, and visitors landing on `http://localhost:3000/login` from external links saw the same 404.

The dispatcher now accepts both forms — `/login` and `/auth/login`, `/register` and `/auth/register`, `/forgot-password` and `/auth/forgot-password`. Locale-prefixed URLs (`/en/login`, `/fr/register`, …) already worked through the existing `stripLocalePrefix` step and continue to work; this release just adds the bare aliases the rest of the library was already pointing at.

The two outliers (`AdminProfileMenu.afterSignOutHref` and `SiteHeader.accountHref`) that previously defaulted to `/auth/login` are normalized to `/login` so the entire library converges on one canonical URL convention. Both forms remain valid at runtime — stores that explicitly passed `/auth/login` keep working unchanged.

### No consumer action required

`npm install github:Caspian-Explorer/script-caspian-store#v8.8.1` and rebuild — both URL forms route correctly. Stores that overrode the auth hrefs explicitly are unaffected.

### Fixed

- [src/components/caspian-root.tsx](src/components/caspian-root.tsx): dispatcher now matches `/login`, `/register`, `/forgot-password` in addition to the pre-existing `/auth/...` aliases.
- [src/admin/admin-profile-menu.tsx](src/admin/admin-profile-menu.tsx): default `afterSignOutHref` is `/login` (was `/auth/login`).
- [src/components/site-header.tsx](src/components/site-header.tsx): default `accountHref` is `/login` (was `/auth/login`).
- [src/i18n/messages.ts](src/i18n/messages.ts) `setup.superAdmin.email.hint` and [src/services/admin-todo-service.ts](src/services/admin-todo-service.ts) `grant-admin-role` description: in-text references to `/auth/register` updated to `/register` to match the canonical form.

---

## v8.8.0 — Auto-heal stale admin claims via `ensureAdminClaim` callable (#store-1210)

Closes the third (and final) iteration of `#store-1210`. v8.6.0 fixed the *diagnostic* (precise toast naming the right command); v8.8.0 fixes the *recovery* (no command needed at all).

The remaining failure mode after v8.6.0: an admin whose `users/{uid}.role` was set in Firestore **before** the `syncAdminClaim` trigger was deployed. The trigger only fires on new writes, so the claim was never set server-side. Token refresh has nothing to pick up. The v8.6.0 toast told them to redeploy Functions and sign out + in — which doesn't help because no trigger fires for existing docs. The only working remediation was the `firebase/seed/sync-admin-claims.mjs` CLI script, which violates the "releases must never require consumer hand-edits" rule.

This release adds a server-side self-heal callable `ensureAdminClaim` that any signed-in user can invoke. It reads `users/{caller.uid}.role` and mirrors it to a custom claim — never escalating privilege beyond what Firestore already says. The library auto-invokes it from two places:

1. **AuthContext proactive refresh** ([src/context/auth-context.tsx](src/context/auth-context.tsx)) — on admin sign-in, if Firestore says admin but the cached ID token's claim is missing, call `ensureAdminClaim` (sets the claim + force-refreshes the token). Bounded to once per uid via the existing `useRef` gate so consumers on undeployed Functions don't loop.
2. **`uploadAdminImage` retry** ([src/services/storage-service.ts](src/services/storage-service.ts)) — on `storage/unauthorized`, the v8.6.0 plain token-refresh retry is now upgraded to call `ensureAdminClaim` first when `Functions` is available, then retry the upload. Older v8.6.0 fallback (plain refresh, no heal) is preserved when `Functions` isn't passed or the callable isn't deployed.

Net effect: stale-claim cases self-heal silently. The first admin upload after upgrading to v8.8.0 + redeploying Functions just works — no toast, no script, no manual steps.

The `claimNotSet` i18n message is updated to reflect that auto-heal already tried and failed by the time the toast fires (so the user is on an older Functions deployment, not just stale).

### Consumer action required on upgrade

Auto-heal only kicks in after consumers redeploy `caspian-admin`:

```bash
npm install github:Caspian-Explorer/script-caspian-store#v8.8.0
cd firebase/functions-admin && npm install && cd ../..
firebase deploy --only functions:caspian-admin
```

After deploying, every existing admin's first sign-in heals automatically — no service-account script, no Firestore edit, no re-sign-in dance. Stores that don't redeploy still see the v8.6.0 toast, with copy now naming the right command.

### Added

- New file [firebase/functions-admin/src/ensure-admin-claim.ts](firebase/functions-admin/src/ensure-admin-claim.ts): the `ensureAdminClaim` callable. Idempotent, no-payload. Returns `{ ok, role, claimSet, requiresTokenRefresh }`.
- New exported helper `tryEnsureAdminClaim({ functions, auth })` in [src/services/storage-service.ts](src/services/storage-service.ts) — wraps the callable + token refresh, swallows all errors, returns a boolean. Safe to call on every admin sign-in or every upload retry.
- `functions?: Functions` optional param on `uploadAdminImage` so the upload retry path can run server-side heal before retrying.

### Changed

- [src/context/auth-context.tsx](src/context/auth-context.tsx): proactive refresh now calls `tryEnsureAdminClaim` instead of bare `getIdToken(true)`. Same once-per-uid gate.
- [src/ui/image-upload-field.tsx](src/ui/image-upload-field.tsx): passes `functions` to `uploadAdminImage` so the v8.8.0 server-side heal path is wired by default.
- [src/i18n/messages.ts](src/i18n/messages.ts): `imageUpload.errors.claimNotSet.description` updated to reflect that auto-heal already tried — the toast now means "Functions older than v0.6.0 OR not deployed at all."
- [firebase/functions-admin/package.json](firebase/functions-admin/package.json): `0.5.0` → `0.6.0` since `index.ts` now exports an additional callable.

---

## v8.7.0 — Multi-step install wizard with pre-flight checklist + super-admin designation (#store-1224)

The wizard at `/setup` (originally shipped as `v1.24` parallel work and never released under that name) gains two leading steps so the install becomes a true installation guide rather than a configuration form:

1. **Pre-flight checklist** — a static "step zero" that lists everything an installer needs to gather *before* clicking Begin: Firebase project + web config, service-account JSON, Node 18 + Java 17 + firebase CLI, contact email, brand assets (optional), Stripe keys (optional). All required items must be ticked before Begin enables. No backend, no Firestore reads — pure UI gate so the rest of the wizard can assume preconditions are met.

2. **Super-admin designation** — a tabbed step with two paths to set the very first admin:
   - **Sign in as admin** — email+password (with a "create account" toggle) or Google. After auth succeeds we call `claimAdmin`, force-refresh the ID token, and the user is admin from this session forward.
   - **Designate by email** — enter `someone@example.com`. We write to `pendingSuperAdmin/{lowercase-email}` and the modified `onUserCreate` trigger promotes that exact account on its first signup. Closes the legacy "first user wins" race window where any accidental signup before the installer's own would steal the role.

The legacy first-user-wins promotion path is preserved as a fallback when the `pendingSuperAdmin` collection is empty, so v8.6.x consumers who never visit the new step still bootstrap exactly as before.

`onUserCreate` semantics change: when any pending entries exist, it ONLY promotes accounts whose email matches a pending entry, and deletes the matched doc on success. Stale entries cannot escalate privilege — the "no admin already exists" check still gates the entire function.

### Consumer action required on upgrade

The v8.7.0 features only kick in for stores that redeploy:

```bash
# 1. Pull the library + sync rules + redeploy Firestore rules (new pendingSuperAdmin block)
npm install github:Caspian-Explorer/script-caspian-store#v8.7.0
npm run firebase:sync
firebase deploy --only firestore:rules

# 2. Redeploy the caspian-admin Cloud Functions codebase (onUserCreate now reads pendingSuperAdmin)
cd firebase/functions-admin && npm install && cd ../..
firebase deploy --only functions:caspian-admin
```

Stores that don't redeploy: the wizard's email-designation tab will toast "permission-denied" (because the new `pendingSuperAdmin` rules block isn't in the deployed rules yet), but the sign-in tab continues to work since it uses the existing `claimAdmin` callable.

### Added

- New file [src/components/setup/steps/prereqs-step.tsx](src/components/setup/steps/prereqs-step.tsx): pre-flight checklist UI + `isPrereqsComplete()` gate.
- New file [src/components/setup/steps/super-admin-step.tsx](src/components/setup/steps/super-admin-step.tsx): tabbed sign-in vs. email-designation UI + `isSuperAdminComplete()` gate. Calls existing `claimAdmin` callable for the sign-in path.
- New `pendingSuperAdmin/{email}` Firestore collection — see [firebase/firestore.rules](firebase/firestore.rules) for shape rules. `caspianCollections().pendingSuperAdmin` ref added to [src/firebase/collections.ts](src/firebase/collections.ts).
- 26 new i18n keys under `setup.prereqs.*` and `setup.superAdmin.*` in [src/i18n/messages.ts](src/i18n/messages.ts).
- 7 new tests in [firebase/rules.test.mjs](firebase/rules.test.mjs) covering the `pendingSuperAdmin` rule (create-allowed, shape-rejected, re-create blocked, public-read, non-admin-delete-denied, admin-delete-allowed, etc.).
- [src/components/setup/setup-types.ts](src/components/setup/setup-types.ts): new `PrereqsDraft` and `SuperAdminDraft` types added to `WizardDraft`.

### Changed

- [firebase/functions-admin/src/on-user-create.ts](firebase/functions-admin/src/on-user-create.ts): two-path promotion logic — checks `pendingSuperAdmin` first, falls back to legacy first-user-wins if empty. Function version 0.4.0 → 0.5.0.
- [src/components/setup/setup-wizard.tsx](src/components/setup/setup-wizard.tsx): step indices shifted (was 0–3, now 0–5) to accommodate prereqs + super-admin at the front. CTA text on step 0 reads "Begin installation" rather than "Next step."
- [src/components/setup/steps/summary-step.tsx](src/components/setup/steps/summary-step.tsx): added super-admin row; Edit-link `onEdit(i)` indices updated to match the new step layout.
- [src/i18n/messages.ts](src/i18n/messages.ts): `setup.init.successBody` now points at `/setup` instead of `/auth/register`.

---

## v8.6.0 — Self-healing admin uploads + precise upload-denial diagnostics (#store-1210)

Closes the third (and we believe final) iteration of `#store-1210`. The earlier two iterations — v8.3.1's `CASPIAN_STORAGE_RULES` self-diagnostic toast and v8.5.1's move to Auth custom claims — left one residual failure: an admin whose ID token was issued *before* the `role: 'admin'` claim was set still saw `storage/unauthorized` on their first upload. The toast told them to redeploy storage rules; redeploying didn't help, because the rules were correct. The actual fix was to refresh the ID token, which the admin had no way to discover from the diagnostic.

This release fixes that on three layers:

1. **Auto-heal at the upload site.** [src/services/storage-service.ts](src/services/storage-service.ts)'s `uploadAdminImage` now accepts an optional `auth` and, on `storage/unauthorized`, force-refreshes the ID token and retries the upload exactly once. The most common failure mode (claim was set after token issuance) self-heals invisibly — no toast, no user action.
2. **Pre-emptive refresh on sign-in.** [src/context/auth-context.tsx](src/context/auth-context.tsx) now compares Firestore `users/{uid}.role` to the cached ID token's `role` claim on every admin sign-in. If Firestore says admin but the token doesn't carry the claim, fire one `getIdToken(true)`. Bounded to once per uid via `useRef` so consumers whose `caspian-admin` Cloud Functions are undeployed don't loop. Every admin write — Storage upload, Firestore admin doc — now sees the claim from the first action.
3. **Precise diagnostic when retry fails.** New exported helper `diagnoseUploadDenial({ auth, db })` returns one of three discriminated kinds (`notAdmin` / `claimNotSet` / `rulesStale`) by combining the freshest ID token with the Firestore role doc. [src/ui/image-upload-field.tsx](src/ui/image-upload-field.tsx) calls it after the §1 retry also fails and surfaces a kind-specific toast that names the right command — `firebase deploy --only functions` for case b/e, the AccessDenied flow for case c, the existing `firebase:sync && deploy --only storage` line for case d.

Test coverage: [firebase/rules.test.mjs](firebase/rules.test.mjs) gains four positive "admin (custom claim) write allowed" tests — one per Storage rule (`siteSettings/`, `products/`, `journal/`, `pageContents/`) — using `authenticatedContext(uid, { role: 'admin' })` to inject the claim and exercise the JWT short-circuit in `isAdmin()` without touching the still-untestable Firestore-fallback path. Closes the gap noted in the limitation comment that's been there since v1.21.

### No consumer action required

The auto-heal works against existing v8.5.x deployments without redeploying anything — the new behavior fires whenever the upload path is exercised. The deployed storage rules and `caspian-admin` Functions from v8.5.1 still satisfy this release. If the underlying deployment really IS stale (rules drift, undeployed functions), the new diagnostic now names the right fix instead of always blaming "stale storage rules."

### Added

- [src/services/storage-service.ts](src/services/storage-service.ts): exported `diagnoseUploadDenial()` and `UploadDenialDiagnosis` type. `uploadAdminImage` now accepts optional `auth` and self-heals `storage/unauthorized` once per call.
- [src/i18n/messages.ts](src/i18n/messages.ts): three new diagnosis-keyed message pairs — `imageUpload.errors.{notAdmin,claimNotSet,rulesStale}.{title,description}`.
- [src/context/auth-context.tsx](src/context/auth-context.tsx): pre-emptive admin-claim token refresh inside the `onAuthStateChanged` block, gated to once per uid.
- [firebase/rules.test.mjs](firebase/rules.test.mjs): `adminClaimStorage(uid)` helper plus four positive write-allowed tests covering all four admin storage rules.

### Deprecated

- `imageUpload.errors.unauthorized.title` and `imageUpload.errors.unauthorized.description` keys remain as aliases pointing at the new `rulesStale.*` text. Slated for removal in v8.7.x. If you maintain a custom message dict, migrate to the diagnosis-keyed names; if you read the keys at runtime, they continue to resolve.

### Changed

- [firebase/rules.test.mjs](firebase/rules.test.mjs) limitation comment updated: the JWT path is now covered, only the Firestore-fallback path remains manual-only.

---

## v8.5.2 — Self-update works on Windows again (#store-1213)

The `<AdminAboutPage>` "Update available → Update" button has been silently broken on Windows hosts since v7.4.0 (April 2025). Clicking it returned `Unexpected non-JSON response (HTTP 500)` and the consumer's Next.js dev/server log showed `Error: spawn EINVAL { errno: -4071 }`. The bug is invisible on Linux, which is why every production deployment (Vercel / Cloud Run / Firebase App Hosting) shipped fine — but local Windows development and self-hosted Windows servers couldn't self-update at all.

Root cause is Node's CVE-2024-27980 hardening (Node 18.20.2 / 20.12.2 / 21.7.3 / 22, April 2024): spawning `.cmd` or `.bat` files via `child_process.spawn` now requires `{ shell: true }` on Windows. Our [src/server/self-update.ts](src/server/self-update.ts) hardcoded `shell: false` while invoking `npm.cmd`, so every modern Node-on-Windows process threw `EINVAL` synchronously — *before* `child.on('error', …)` was registered, escaping the Promise and producing Next's default HTML error page instead of our JSON shape.

The fix is one parameter: `shell: process.platform === 'win32'`. POSIX behavior is bit-for-bit unchanged. `shell: true` is safe on Windows here because every component of the `npm install` spec is already regex-validated upstream — `allowedOwner` / `allowedRepo` against `/^[A-Za-z0-9._-]{1,100}$/` and `version` against `/^[0-9]+\.[0-9]+\.[0-9]+$/`. None of those character classes overlap with shell metacharacters, so injection is impossible.

### Consumer action required on upgrade

This is the awkward release where the broken endpoint *is* the self-update mechanism, so Windows admins on v8.4.0 / v8.5.0 / v8.5.1 cannot use the in-app Update button to install v8.5.2. One-time manual install:

```powershell
npm install github:Caspian-Explorer/script-caspian-store#v8.5.2
```

After that, future updates work from the in-app button as designed. Linux/Mac admins can install v8.5.2 either way (their button has been working fine all along).

### Fixed

- [src/server/self-update.ts](src/server/self-update.ts): `spawn(npm.cmd, …, { shell: false })` → `{ shell: process.platform === 'win32' }`. Resolves `Error: spawn EINVAL` on every Node ≥ 18.20.2 Windows host. Adds an inline comment citing CVE-2024-27980 and the validated-allowlist invariant that makes `shell: true` safe so a future refactor doesn't reintroduce the regression.

### Changed

- [CLAUDE.md](CLAUDE.md): added a Gotchas entry pointing future contributors at the spawn-shell-true Windows requirement.

---

## v8.5.1 — Admin via Auth custom claims; storage uploads stop tripping cross-service Firestore reads (#store-1210)

Admins still couldn't upload a logo from `<AdminSiteSettingsPage>` after v8.3.1 + v8.4.x — the toast told them to redeploy storage rules, they did, the rules were correct on disk, and they STILL got `storage/unauthorized`. Root cause across reported installs: the rules' `isAdmin()` predicate calls `firestore.get(/databases/(default)/documents/users/$(uid))` from inside Storage rules — a cross-service lookup that fails for any of a dozen project-config reasons (Firestore not in the `(default)` database, IAM grants missing for the rules service agent, permissions propagation delay, the user's `users/{uid}` doc carrying a typo or stale role field). Every one of those eats every admin write silently and the admin's only remediation was "fiddle with Firebase project settings until it works."

This release moves the primary admin signal off cross-service Firestore reads and onto Firebase Auth **custom claims**. The claim is baked into the JWT, so storage.rules + firestore.rules authorize without leaving the rules engine — no IAM, no Firestore propagation, no project config. The Firestore field stays as a fallback so admins promoted before v8.5.1 keep working until their token rotates and the new claim becomes visible.

The library wires up the claim in three places: the `claimAdmin` callable now also calls `setCustomUserClaims({ role: 'admin' })` after the Firestore write; the `onUserCreate` trigger does the same for the first-user auto-promote path; and a new `syncAdminClaim` Firestore trigger reconciles the claim with `users/{uid}.role` on every users-doc write — so the Firebase console, `grant-admin.mjs`, and any future admin CRUD UI also propagate the claim without each having to remember. `<AdminGuard>`'s "Claim admin" button now force-refreshes the ID token after the callable returns (`auth.currentUser.getIdToken(true)`) so the new claim is visible immediately instead of after the next ~1h rotation.

### Consumer action required on upgrade

```bash
# 1. Pull the new library + sync rules + redeploy storage and Firestore rules
npm install github:Caspian-Explorer/script-caspian-store#v8.5.1
npm run firebase:sync
firebase deploy --only firestore:rules,storage

# 2. Redeploy the caspian-admin Cloud Functions codebase (now sets custom claims)
cd firebase/functions-admin && npm install && cd ../..
firebase deploy --only functions:caspian-admin

# 3. Backfill custom claims for ALL existing admins. One-time, idempotent.
node firebase/seed/sync-admin-claims.mjs \
  --project <your-firebase-project-id> \
  --credentials ./service-account.json

# 4. Each affected admin must sign out + back in (or call
#    auth.currentUser.getIdToken(true) from the client) to pick up the
#    new claim on their ID token. Without this, the rules will still fall
#    through to the Firestore field — slower but functional, so this is
#    a "should do" not a "must do."
```

Step 3 fixes the immediate logo-upload outage: setting the claim on every existing admin makes storage.rules short-circuit on the JWT and never read Firestore. Step 4 makes the new path live for that admin's session; without it, they keep using the Firestore-fallback path that's been failing.

### Fixed

- [firebase/storage.rules](firebase/storage.rules) / [firebase/firestore.rules](firebase/firestore.rules): `isAdmin()` now reads `request.auth.token.role == 'admin'` first; the `firestore.get()` / `get()` lookup is the fallback, not the primary. Admins who pick up the new claim on their next token refresh stop tripping the cross-service path entirely.

### Added

- [firebase/functions-admin/src/sync-admin-claim.ts](firebase/functions-admin/src/sync-admin-claim.ts): new `syncAdminClaim` Firestore `onDocumentWritten` trigger keyed on `users/{uid}` that reconciles the Auth custom claim with the `role` field on every write. Promotion → set claim. Demotion → clear claim. Idempotent. Catches the Firestore-console / `grant-admin.mjs` / future-admin-CRUD paths that don't go through the callable.
- [firebase/seed/sync-admin-claims.mjs](firebase/seed/sync-admin-claims.mjs): one-time backfill for admins who had `role: 'admin'` in Firestore before v8.5.1 (their Firestore field was set, but no claim ever fired). Iterates every `users/*` doc with role admin and sets the matching custom claim. Idempotent (claim already set → no-op), `--dry-run` supported, prints a summary of `set / already-ok / missing / errored`.
- [tsup.config.ts](tsup.config.ts): drift guard upgraded to handle JS template-literal escapes for backticks (`` \` ``) and `$` in addition to `\\`. The collapse uses a NUL placeholder dance so escape order doesn't matter (`` \\\` `` correctly evaluates to `\` + `` ` ``, not `\\` + `` ` ``).

### Changed

- [firebase/functions-admin/src/claim-admin.ts](firebase/functions-admin/src/claim-admin.ts): after the Firestore role write, the callable now also calls `getAuth().setCustomUserClaims(uid, { ...existing, role: 'admin' })`, preserving any pre-existing claims. Returns `{ ok: true, claimSet: true, requiresTokenRefresh: true }` so the client knows to force-refresh the ID token.
- [firebase/functions-admin/src/on-user-create.ts](firebase/functions-admin/src/on-user-create.ts): same `setCustomUserClaims` call on the first-user auto-promote path.
- [firebase/functions-admin/src/index.ts](firebase/functions-admin/src/index.ts): exports the new `syncAdminClaim` trigger so it deploys with the codebase.
- [firebase/functions-admin/package.json](firebase/functions-admin/package.json): bumped to `0.4.0` (minor, new export).
- [firebase/seed/grant-admin.mjs](firebase/seed/grant-admin.mjs): after the Firestore write the CLI also calls `setCustomUserClaims`, so promotions made via the CLI work immediately even if the `syncAdminClaim` trigger isn't deployed (or hasn't fired yet). Logs the token-refresh requirement for the affected admin.
- [src/admin/admin-guard.tsx](src/admin/admin-guard.tsx): the "Claim admin role" button now force-refreshes `auth.currentUser.getIdToken(true)` after the callable returns and before `refreshProfile()`, so the new claim is visible immediately instead of after the ID token rotates (~1h).
- [src/firebase/rules.ts](src/firebase/rules.ts): `CASPIAN_STORAGE_RULES` + `CASPIAN_FIRESTORE_RULES` updated to match the new claim-first + Firestore-fallback `isAdmin()` predicate. The build's drift guard asserts `CASPIAN_STORAGE_RULES` matches `firebase/storage.rules` byte-for-byte (including the new escaped backticks in comments).

### Known limitation

`CASPIAN_FIRESTORE_RULES` (the constant exported from `@caspian-explorer/script-caspian-store/firebase`) lags `firebase/firestore.rules` (the on-disk file) for collections added after v3.x — `emailPluginInstalls`, `contacts`, `searchTerms`, `adminTodos`, `emailSettings`, `emailTemplates`, `errorLogs`. The `isAdmin()` change in this release is mirrored in both halves, but the trailing collections aren't. **In practice this only matters if your deploy tooling reads from the `CASPIAN_FIRESTORE_RULES` constant; consumers using `npm run firebase:sync` get the on-disk file directly and are unaffected.** A drift guard for `CASPIAN_FIRESTORE_RULES` is a planned follow-up.

---

## v8.5.0 — People menu split: Users / Contacts / Subscribers (#store-1212)

The admin sidebar's **People** group used to read *Users → Subscribers*, but `/admin/users` was actually the contact-form inbox in disguise — there was no surface anywhere that listed customers who had signed up to the site, even though that data was sitting in the `users` Firestore collection. This release straightens out the labels and the data: **Users**, **Contacts**, and **Subscribers** are now three independent pages, each backed by its own collection.

`/admin/users` is now a real customer list — name, email, role badge, joined date — sorted newest-first, with a name/email search box. Read-only on purpose: editing roles or deleting Firebase Auth users is a separate concern that needs its own design pass. The contacts inbox keeps every feature it had (status filter, mark read / archive / delete, detail dialog, header unread count) — it just lives at `/admin/contacts` instead of behind a single-tab wrapper, and shows up as its own sidebar entry with the `Mail` icon.

### No consumer action required

`npm install github:Caspian-Explorer/script-caspian-store#v8.5.0` is enough — the `users` collection rule already grants admins broad read/write (no `firebase deploy` needed), the new `listUsers()` query uses a single-field `orderBy('createdAt')` that Firestore auto-indexes (no composite index to add), and the route dispatcher absorbs `/admin/contacts` automatically because it's a switch case inside the library's `AdminRoot`. Anyone who bookmarked the old `/admin/users` finds the contacts inbox one click away in the sidebar — no redirect needed, the URL is repurposed in place.

### Added

- [src/admin/admin-contacts-page.tsx](src/admin/admin-contacts-page.tsx): new thin page wrapper that hosts `<AdminContactsList>` with the title + unread count header that used to live inside `AdminUsersPage`. Registered at `/admin/contacts` via [src/admin/admin-root.tsx](src/admin/admin-root.tsx) and added to the People group in [src/admin/admin-shell.tsx](src/admin/admin-shell.tsx) between Users and Subscribers. Exported as `AdminContactsPage` + `AdminContactsPageProps` from [src/admin/index.ts](src/admin/index.ts) and [src/index.ts](src/index.ts).
- [src/services/user-service.ts](src/services/user-service.ts): `listUsers(db)` — admin-side query against `caspianCollections(db).users` ordered by `createdAt desc`, returning `UserProfile[]`.

### Changed

- [src/admin/admin-users-page.tsx](src/admin/admin-users-page.tsx): rewritten from a single-tab Contacts wrapper into a real signed-up-users list (search by name/email, table of Name / Email / Role badge / Joined). Read-only.
- [src/i18n/messages.ts](src/i18n/messages.ts): rescoped `admin.users.subtitle` to *"Customers who have signed up to the site."*; added `admin.users.col.{name,email,role,joined}`, `admin.users.empty`, `admin.users.searchPlaceholder`, `admin.contacts.title`, `admin.contacts.subtitle`. Removed the now-unreferenced `admin.users.tabs.contacts`.

---

## v8.4.0 — Brands admin page + brand dropdown on Product CRUD

A new **Brands** sub-menu under Catalog gives admins full CRUD on a `productBrands` Firestore collection — list, create, edit, delete. The product editor's free-text Brand input becomes a `<Select>` populated from active brands, and the products-list filter switches from substring text to a brand `<Select>`. Two products typed `"Acme"` vs `"ACME"` no longer count as different brands.

`Product.brand` semantics shift from "free-text brand name" to "brand document id" — consistent with how `Product.category` already references `productCategories` doc ids. Display sites resolve id → name via the new `useBrandName` hook (raw-string fallback so legacy products keep rendering correctly until migrated). The Brands admin page surfaces a yellow banner when it detects products that still hold legacy free-text brand strings, with a one-click **Migrate now** button that creates matching brand records and updates each product in place. Idempotent — clicking it again on a clean store reports `0 created, 0 updated`.

Order receipts (`OrderItem.brand`) capture the resolved brand **name** at the moment of purchase — not the id — so historical orders keep reading "Nike" forever, even if the brand is later renamed or deleted. The library's manual-payment plugin and the `caspian-stripe` Cloud Function both apply this lookup at order creation.

### No consumer action required

The library is self-healing — `npm install github:Caspian-Explorer/script-caspian-store#v8.4.0` is enough on its own. The brands collection ref, Firestore rules, and `ProductBrandDoc` type already shipped with the package; this release only adds the admin UI on top. Legacy products with free-text brand values keep displaying their stored value via the read-side fallback, so storefronts work the moment the new tag is installed. The first time an admin visits **Catalog → Brands**, the migration banner offers a one-click sweep — that's the cleanup path, run by the admin in the UI, not a manual data step. The `caspian-stripe` Cloud Function bumped to `0.1.3` to capture brand names on Stripe orders; redeploy with `firebase deploy --only functions:caspian-stripe` if you want post-migration Stripe orders to store names rather than ids in `OrderItem.brand` (pre-migration orders are unaffected, and either form continues to render correctly via the read-side fallback).

### Added

- [src/services/brand-service.ts](src/services/brand-service.ts): `listActiveBrands`, `listAllBrands`, `createBrand`, `updateBrand`, `deleteBrand`, plus `resolveBrandName(value, brandsById)` for callers who already hold a brand map. `migrateLegacyBrandStrings(db)` does the one-shot self-healing sweep — for every distinct legacy brand string on the products collection, creates a `productBrands` doc (deterministic id from `slugify(name)`, "Nike" + "nike" coalesce) and updates each product's `brand` field to the new id. Idempotent. `countLegacyBrandStrings(db, sampleSize = 200)` is the cheap detector that decides whether to render the banner. `BrandWriteInput = Omit<ProductBrandDoc, 'id' | 'createdAt'>`.
- [src/hooks/use-brands.ts](src/hooks/use-brands.ts): `useBrands()` returns `{ brands, brandsById, loaded }` with a module-level cache so a grid of product cards mounted on the same page does a single Firestore read for the whole tree. `useBrandName(value)` is the convenience wrapper — id → name with raw-string fallback. `refreshBrandsCache()` invalidates the cache; the Brands admin page calls it after every create / update / delete / migrate so storefront tabs see fresh data on next mount.
- [src/admin/admin-product-brands-page.tsx](src/admin/admin-product-brands-page.tsx): list table + dialog form, `+ New brand` button, migration banner. New page registered at `/admin/brands` via [src/admin/admin-root.tsx](src/admin/admin-root.tsx) and surfaced as a sidebar leaf under the Catalog group in [src/admin/admin-shell.tsx](src/admin/admin-shell.tsx).
- [src/ui/icons.tsx](src/ui/icons.tsx): `BookmarkIcon` for the new sidebar leaf.

### Changed

- [src/admin/admin-product-editor.tsx](src/admin/admin-product-editor.tsx): Brand `<Input>` becomes a `<Select>` of `[{ value: '', label: '— Select brand —' }, ...activeBrands]`. Stale-value preservation: if a product's stored `brand` isn't a known brand id, the editor synthesises a `"<value> (legacy — not migrated)"` option so saving other fields doesn't wipe the value, with a yellow hint pointing to the Brands page's Migrate now button.
- [src/admin/admin-products-list.tsx](src/admin/admin-products-list.tsx): the "Brand contains…" text input becomes a Brand `<Select>` (with an "Unresolved (legacy text)" option mirroring the categories filter). The Brand column resolves id → name with a `⚠` legacy hint, and the search haystack uses the resolved name so admins can still find products by typing the brand name.
- [src/components/product-card.tsx](src/components/product-card.tsx), [src/components/product-detail-page.tsx](src/components/product-detail-page.tsx): brand text rendered through `useBrandName(product.brand)` — id resolved to name, raw value as fallback for legacy data.
- [src/components/search-results-page.tsx](src/components/search-results-page.tsx): the search haystack resolves brand id → name (same pattern as the existing category-id resolution) so storefront search by brand name keeps working post-migration.
- [src/payments/plugins/manual-base.ts](src/payments/plugins/manual-base.ts) + [firebase/functions-stripe/src/stripe-checkout.ts](firebase/functions-stripe/src/stripe-checkout.ts): on order creation, both manual-payment plugins (Cash on delivery, Cheque, BACS) and the Stripe Cloud Function now resolve `Product.brand` (an id) to the human-readable name before writing it to `OrderItem.brand`. Order data is historical — captured names survive future brand renames/deletes. Stripe Cloud Function bumped to `0.1.3`.
- [src/index.ts](src/index.ts) / [src/admin/index.ts](src/admin/index.ts): new exports — `AdminProductBrandsPage`, `useBrands`, `useBrandName`, `refreshBrandsCache`, `listActiveBrands`, `listAllBrands`, `createBrand`, `updateBrand`, `deleteBrand`, `resolveBrandName`, `migrateLegacyBrandStrings`, `countLegacyBrandStrings`, `BrandWriteInput`.

---

## v8.3.1 — Self-diagnosing storage upload errors + ship `CASPIAN_STORAGE_RULES` (#store-1210)

Admins reported `Firebase Storage: User does not have permission to access 'siteSettings/logo/...' (storage/unauthorized)` when trying to upload a logo from `<AdminSiteSettingsPage>`, with the toast just echoing the long FirebaseError string and no actionable next step. Root cause across reported installs: stale deployed Storage rules. The `siteSettings/**` rule block was added in v3.0.0, but consumers who upgraded the library since then never re-ran `firebase deploy --only storage`, so the bucket still runs on pre-v3.0.0 rules and default-denies every write to `siteSettings/`. A close second is `firebase deploy --only firestore` from §4 of INSTALL.md skipping the `,storage` flag.

The library can't deploy rules on the consumer's behalf, but it can make the failure self-diagnosing: from this release the toast switches on the Firebase `error.code` and tells admins the exact command to run (`npm run firebase:sync && firebase deploy --only storage`). And `CASPIAN_STORAGE_RULES` is now exported from `@caspian-explorer/script-caspian-store/firebase`, alongside `CASPIAN_FIRESTORE_RULES` — full parity, so consumers can build their own deploy tooling without `cp`-ing from `node_modules`.

### Consumer action required on upgrade

```bash
npm install github:Caspian-Explorer/script-caspian-store#v8.3.1
npm run firebase:sync
firebase deploy --only storage
```

If logo / avatar / page-image uploads were already failing on your install, the deploy above is the fix. From now on, the same toast that flagged the error tells the next admin who trips this what to do — so you shouldn't have to rediscover it on the next upgrade.

### Fixed

- [src/ui/image-upload-field.tsx](src/ui/image-upload-field.tsx): the catch branch now switches on Firebase `error.code` and surfaces an actionable, i18n-keyed toast per code. `storage/unauthorized` reads *"Upload denied by Firebase Storage rules"* with the description containing the exact `npm run firebase:sync && firebase deploy --only storage` fix command. `storage/unauthenticated`, `storage/quota-exceeded`, `storage/retry-limit-exceeded`, and `storage/canceled` get their own targeted copy. Storage-error toasts use `durationMs: 8000` so the instructions are readable. Local validation errors (size / type) keep their existing short messages. The follow-up to also route the component's still-untranslated literals (`Upload`, `Replace`, `Remove`, `No image`, `or paste URL`) through `useT()` is intentionally out of scope here.

### Added

- [src/firebase/rules.ts](src/firebase/rules.ts) / [src/firebase/index.ts](src/firebase/index.ts) / [package.json](package.json): `CASPIAN_STORAGE_RULES` is now exported from `@caspian-explorer/script-caspian-store/firebase`, and `./storage.rules` is now a subpath import — both mirroring the existing `CASPIAN_FIRESTORE_RULES` constant and `./firestore.rules` subpath. `import { CASPIAN_STORAGE_RULES } from '@caspian-explorer/script-caspian-store/firebase'` works in deploy scripts; `firebase.json` configs that reference the file directly still work via `node_modules/.../firebase/storage.rules`.
- [src/i18n/messages.ts](src/i18n/messages.ts): new `imageUpload.*` namespace — `success`, plus `errors.{unauthorized,unauthenticated,quotaExceeded,network,generic}.{title,description}`. Override individual keys via `<CaspianStoreProvider messages={{ ... }}>` if you want different wording.
- [tsup.config.ts](tsup.config.ts): build-time drift guard — `CASPIAN_STORAGE_RULES` is asserted to match `firebase/storage.rules` byte-for-byte on every build (extracts the template-literal contents from `src/firebase/rules.ts`, undoes the source-level backslash doubling, and compares to the file on disk). Hand-editing one without the other now fails the build with a clear error instead of silently shipping diverged rules.

### Changed

- [INSTALL.md](INSTALL.md): §12 Upgrade is now unconditional — every upgrade should resync rules + indexes, not just upgrades whose CHANGELOG calls it out. Troubleshooting gains a `storage/unauthorized` entry recapping the symptom + fix command.
- [README.md](README.md): "what ships" feature row updated to list `firebase/storage.rules` alongside `firebase/firestore.rules` and `firebase/firestore.indexes.json`. The `./firebase` import example now includes `CASPIAN_STORAGE_RULES`.
- [src/services/storage-service.ts](src/services/storage-service.ts): `uploadAdminImage` JSDoc now lists the `storage/*` error codes callers should handle, and the "what paths the package ships rules for" list is brought up to date (was missing `siteSettings/**` and `products/**` since v3.0.0 / v4.0.0).

---

## v8.3.0 — SEO-friendly product URLs + Write-a-Review star fix

Two storefront issues addressed in one minor release.

**Product URLs now use a slug** derived from the product name. Before: `/product/ZSVNBOkVKSf214KxxSKd` (the Firestore document id). After: `/product/black-leather-jacket`. New products created through the admin editor get a slug auto-generated from the name on save, with collision suffixes (`-2`, `-3`, …) when two products share a name. Existing products created before this release have no `slug` field — the route resolver transparently falls back to id-based lookup, so old links keep working forever. The next time an admin opens and saves a legacy product through the editor, a slug is generated and persisted; from then on, listings link to the slug URL. Renaming a product after the slug is set deliberately leaves the slug alone, so SEO and external links survive copy edits. Admins can override the auto-generated slug in a new "URL slug" field in the product editor.

**The "Write a review" modal now shows visible star icons.** Previously the star input rendered as 5 empty boxes — the inline SVG was sized via Tailwind utility classes (`caspian-w-8 caspian-h-8`) passed through `className`, which fell back to a 0-sized render in the dialog context. The display variants on the same page worked because they pass numeric `width`/`height` SVG attributes directly. Switched the input to the same numeric-attribute approach, so the icons render regardless of which CSS layers the consumer has loaded.

### No consumer action required

Drop-in upgrade. The slug lookup is a single-equality query (`where('slug', '==', x)`) which Firestore auto-indexes — **no `firebase deploy --only firestore:indexes` needed**. Old `/product/{id}` URLs keep resolving via the id fallback, so search-engine cached links and customer bookmarks survive the upgrade. Reinstalling the new tag picks up both fixes.

### Added

- [src/utils/slugify.ts](src/utils/slugify.ts): shared `slugify(input, maxLen = 80)` helper, also re-exported from the package root for consumer use. Replaces the duplicated inline implementations previously in `admin-product-categories-page.tsx` and `admin-product-collections-page.tsx`.
- [src/services/product-service.ts](src/services/product-service.ts): new `getProductBySlug(db, slug)` and `getProductBySlugOrId(db, slugOrId)`. The latter is what the route handler uses — slug first, document-id fallback. Internal `ensureUniqueSlug` handles collision suffixes on write.
- [src/types.ts](src/types.ts): `Product.slug?: string` (optional — legacy docs without the field remain valid).
- [src/admin/admin-product-editor.tsx](src/admin/admin-product-editor.tsx): "URL slug" field. Auto-fills from the name on blur when empty; admin can edit; helper text warns that changing an existing slug breaks old links.

### Changed

- [src/components/caspian-root.tsx](src/components/caspian-root.tsx): the `/product/:param` route now passes the captured segment as `productSlugOrId` to `<ProductDetailPage>`. The regex is unchanged (`[^/]+` matches both slugs and ids).
- [src/components/product-detail-page.tsx](src/components/product-detail-page.tsx): added `productSlugOrId` prop alongside the existing `productId` (kept for one minor cycle to avoid breaking direct mounts). Lookup now uses `getProductBySlugOrId`.
- Link callsites switched to `product.slug ?? product.id`: [product-card.tsx](src/components/product-card.tsx), [cart-page.tsx](src/components/cart-page.tsx), [cart-sheet.tsx](src/components/cart-sheet.tsx), [auth/wishlist-panel.tsx](src/components/auth/wishlist-panel.tsx), [admin/admin-products-list.tsx](src/admin/admin-products-list.tsx).
- [src/services/product-service.ts](src/services/product-service.ts): `createProduct` always persists a slug (auto-generated from `name` if the caller didn't provide one). `updateProduct` regenerates the slug only when the caller explicitly passes one or the existing doc has no slug — preserves SEO across renames while lazily backfilling legacy products.

### Fixed

- [src/components/star-rating-input.tsx](src/components/star-rating-input.tsx): replaced the Tailwind-class size map with a numeric `SIZE_PX` map applied as `<svg width>` / `<svg height>` attributes. Star icons now render reliably inside the Write-a-Review modal regardless of consumer Tailwind config. Also bumped the inactive star color from `rgba(100,100,100,0.4)` to `rgba(0,0,0,0.3)` to match the existing display-only stars in [reviews/review-summary.tsx](src/components/reviews/review-summary.tsx).

---

## v8.2.4 — Product detail tabs: centered row + always-visible Details

The product detail page tab row was left-aligned, and the `Details` tab was hidden whenever the product had no `details` HTML and no `description` distinct from the auto-generated blurb. On a freshly-created test product this collapsed the row to just `Reviews | Questions` flush against the left margin — visually unbalanced against the rest of the storefront (Collection page header centered, Shop page symmetric) and read as missing structure.

### No consumer action required

Visual-only fix in [src/components/product-detail-page.tsx](src/components/product-detail-page.tsx) and one new i18n key. Reinstalling the new tag picks it up. No exports, props, or schema changed.

### Changed

- [src/components/product-detail-page.tsx](src/components/product-detail-page.tsx): `<nav role="tablist">` now uses `justifyContent: 'center'` with `gap: 32` (up from `24`). The `Details` tab renders unconditionally as the first item in the row regardless of whether the product has `details` HTML or a long-form `description`. When activated on a product with no detail content, the tab body shows a small `No additional details.` empty-state placeholder (centered, muted) rather than collapsing to nothing.
- [src/i18n/messages.ts](src/i18n/messages.ts): new `product.tabs.detailsEmpty` key driving the empty-state copy.

`Details` was already the default active tab on first load (existing `useState<TabKey>('details')`), so no state change was needed there.

---

## v8.2.3 — Defer LocationChangeBridge dispatch to escape React's commit phase (#43 / mod1183)

v8.2.2 introduced `<LocationChangeBridge />` which patches `history.pushState` / `replaceState` to dispatch a `caspian:locationchange` event after the URL updates. The event was dispatched *synchronously* from inside the patched function. That broke when Next.js's App Router calls `history.pushState` from inside a `useInsertionEffect` during React's commit phase: the synchronous event triggered `<SearchResultsPage>`'s listener, which called `useReducer`'s dispatch to bump a tick — and React threw `useInsertionEffect must not schedule updates`. The error fires on every search submission on consumer sites running v8.2.2 under Next.js 14+ App Router.

The fix defers the `dispatchEvent` call to a microtask via `queueMicrotask`. Microtasks run after the commit phase completes, so listeners' state updates land outside the insertion-effect window and React processes them as normal post-commit updates. This does **not** reintroduce the v8.1.4 race (where the microtask fired before the URL was updated), because the microtask is queued from inside the patched `pushState` *after* the original `pushState` has already updated the URL — by the time the microtask runs, `window.location.search` is guaranteed to reflect the new query.

### No consumer action required

Drop-in patch. Reinstalling the new tag silences the React error and restores the expected behaviour: typing a new search term while on `/search` updates results without a reload, with no console warnings.

### Fixed

- [src/provider/caspian-store-provider.tsx](src/provider/caspian-store-provider.tsx): `<LocationChangeBridge />`'s patched `history.pushState` / `replaceState` now defer the `caspian:locationchange` event delivery to `queueMicrotask`, escaping React's commit phase. Closes the regression introduced in v8.2.2 where Next.js App Router's commit-phase call to `pushState` triggered a synchronous listener state update inside a `useInsertionEffect`.

---

## v8.2.2 — SearchResultsPage: real self-heal via History API patch (#43 / mod1183)

The v8.1.4 self-heal wrapped `useCaspianNavigation()`'s `push`/`replace` to dispatch a `caspian:locationchange` event from a `queueMicrotask` callback after delegating to the consumer's adapter. That assumed the underlying router updated `window.location.search` synchronously. Next.js App Router does **not**: `router.push` is scheduled inside a React transition, so the URL is updated some time later. The microtask dispatched the event before the URL changed, the listener re-read `window.location.search`, and got the **old** query string — which is why the bug kept reproducing on consumer sites that had already upgraded.

This release replaces the wrapping with a one-time patch on `window.history.pushState` and `window.history.replaceState`, installed by a new null-render `<LocationChangeBridge />` mounted inside `<CaspianStoreProvider>`. The patches dispatch `caspian:locationchange` **synchronously after** the History API updates the URL, so the listener always reads the fresh `window.location.search`. No microtasks, no router-internal timing assumptions, and it catches navigation from anywhere on the page — including direct `router.push` calls that bypass the library.

`<SearchResultsPage>`'s listener (added in v8.1.4) is unchanged; only the event source has moved from "wrapped hook + microtask" to "patched History API". `useCaspianNavigation()` is back to a thin pass-through, which removes a small layer of indirection.

### No consumer action required

Drop-in patch. Reinstalling the new tag fixes the `/search?q=` regression on every consumer site, including those whose custom `useNavigation` adapter doesn't supply `searchParams`. No provider-prop changes, no new public exports, no removed exports.

Idempotent: a `__caspianHistoryPatched` flag on `window` prevents double-patching across HMR reloads or apps that mount more than one `<CaspianStoreProvider>` per page.

### Fixed

- [src/provider/caspian-store-provider.tsx](src/provider/caspian-store-provider.tsx): `<LocationChangeBridge />` (new internal component) patches `history.pushState`/`replaceState` once per window to dispatch `caspian:locationchange` synchronously after the URL updates. Closes [#43](https://github.com/Caspian-Explorer/script-caspian-store/issues/43) for real this time — the v8.1.4 attempt was racy under Next.js App Router.

### Changed

- [src/provider/caspian-store-provider.tsx](src/provider/caspian-store-provider.tsx): `useCaspianNavigation()` is back to a one-line pass-through — the v8.1.4 wrapping that called `queueMicrotask(emit)` after delegating to the adapter is removed. The `<LocationChangeBridge />` now owns the event dispatch end-to-end, which is more reliable and catches navigation paths that don't go through the hook.

---

## v8.2.1 — Product detail page: top padding + 450px-capped detail column

The product detail page (`<ProductDetailPage>`) shipped without any top padding, so on storefronts where it mounts directly under the sticky `<SiteHeader>` the brand label and badges butted right against the header's bottom edge with no breathing room. The two-column grid was also `1fr / 1fr`, which on wide viewports stretched the right-hand details column (title, price, size selector, quantity, add-to-cart) far wider than it needs to be — making the line lengths uncomfortable to read and the Add-to-cart button look like a banner.

### No consumer action required

Visual-only fix in [src/components/product-detail-page.tsx](src/components/product-detail-page.tsx). Reinstalling the new tag picks it up. No exports, props, or schema changed.

### Changed

- [src/components/product-detail-page.tsx](src/components/product-detail-page.tsx): outer wrapper gains `paddingTop: 40` (applied to both the loading-skeleton return and the loaded return) for a consistent gap below the header.
- `gridStyle` becomes `gridTemplateColumns: 'minmax(0, 1fr) minmax(280px, 450px)'` with `gap: 48` and `alignItems: 'start'`. The image gallery takes the flexible left column; the details column flexes between 280px and 450px maximum on any viewport — comfortable line lengths, button no longer stretches the full half-width.

---

## v8.2.0 — Appearance promoted to a Settings sidebar child

Issue store-1208 — the admin Settings page's in-page left rail packed five tabs (General, Appearance, Shipping options, Emails, Languages) into one screen, but Appearance is the most-edited surface and burying it behind a sub-tab made it slower to reach than its peers in Catalog or People. v8.2.0 promotes Appearance out of the Settings sub-rail and into the main admin sidebar as a child of a new **Settings** group — same pattern Catalog/People/Plugins already use. The remaining four tabs (General, Shipping options, Emails, Languages) keep the in-page rail unchanged.

The URL reverts to top-level `/admin/appearance` (where it lived pre-v7.1.0). The v7.1.0-introduced `/admin/settings/appearance` keeps redirecting for one release so existing bookmarks don't 404.

### No consumer action required

Drop-in upgrade. Reinstalling the new tag promotes Appearance to the sidebar automatically. Old `/admin/settings/appearance` URLs redirect for one release. No new exports, no removed exports, no provider-prop changes. Sites that pass a custom `navItems` prop to `<AdminShell>` keep their custom nav untouched.

### Changed

- [src/admin/admin-shell.tsx](src/admin/admin-shell.tsx) — the `Settings` entry in `DEFAULT_ADMIN_NAV` is now an `AdminNavGroup` (`id: 'settings'`, `href: '/admin/settings'`) with a single `Appearance` child at `/admin/appearance`. `SETTINGS_SUB_NAV` no longer includes the Appearance row; the in-page Settings rail now shows General / Shipping options / Emails / Languages.
- [src/admin/admin-settings-shell.tsx](src/admin/admin-settings-shell.tsx) — the `'appearance'` slug is removed from `SettingsSlug`, `KNOWN_SLUGS`, and the `SettingsPanel` switch. Hitting `/admin/settings/appearance` now redirects to `/admin/appearance` via a new `legacyAppearance` `RawSlug` variant.
- [src/admin/admin-root.tsx](src/admin/admin-root.tsx) — `case 'appearance'` renders `<AdminAppearancePage />` directly (it was a redirect to `/admin/settings/appearance` from v7.1.0 through v8.1.x). File-header docstring updated to describe the v8.2.0 reshuffle.

### Trade-offs

- Sidebar `Appearance` label is hardcoded English, matching the rest of `DEFAULT_ADMIN_NAV` (no other top-level sidebar label is i18n-routed today). The page heading inside `<AdminAppearancePage>` continues to drive off the existing `admin.appearance.title` i18n key, so localized admins still see a localized header on the page itself. A full sidebar i18n pass is a separate effort.

---

## v8.1.4 — Storefront category filter shows names; search re-renders on client navigation

Two bugs fixed together. The visible one: on `/admin/categories`, seeded categories rendered correctly as "Apparel" and "T-Shirt", but on `/shop` the left-rail Category filter listed `LWzDYddyskad6jamRP32`, `XcEnK9slvetPOTaM7E34`, and a stray `cat 1` — the literal Firestore auto-IDs that the admin product editor stores on `product.category`, plus one legacy free-text value from a pre-categories-collection product. Root cause: the storefront's `<ProductListPage>` built the filter list directly from `product.category` strings without ever joining against the `productCategories` collection, so the human-readable name was nowhere on screen. The admin **products list** page already had the resolver pattern (load active categories, build an `id → name` map, fall back to the raw value); the storefront just never adopted it. This release lifts that pattern verbatim into [src/components/product-list-page.tsx](src/components/product-list-page.tsx) and [src/components/search-results-page.tsx](src/components/search-results-page.tsx), and adds an additive `categoryLabels?: ReadonlyMap<string, string>` prop on `<ShopFilterSidebar>` so the resolved labels render. Filter state still keys on the underlying ID, so URL state and click-to-filter behaviour are unchanged. Legacy free-text categories (like `cat 1`) keep falling through unchanged via the same `?? raw` fallback.

A second symptom rode along: `<SearchResultsPage>` concatenated `p.category` into the search haystack, so searching for "apparel" returned no products (the haystack contained the ID). The same map-resolve trick fixes it as a one-line change.

The other fix in this release self-heals issue #43: `<SearchResultsPage>` did not re-render on client-side URL changes when the consumer's framework adapter didn't expose a reactive `searchParams` (the field is documented as required for real adapters but typed `URLSearchParams | undefined` for backward compatibility, and many older consumer adapters omit it). The library now wraps `useCaspianNavigation()`'s `push` and `replace` to dispatch a `caspian:locationchange` window event after the underlying router updates history, and `<SearchResultsPage>` listens for that event plus `popstate` to bump a render tick. Consumers running stale adapter code get search-results reactivity back without editing their adapter.

### No consumer action required

Drop-in patch. Reinstalling the new tag makes the storefront filter list and the search haystack render category names, and unblocks search-results client-side reactivity for any consumer whose navigation adapter omits a reactive `searchParams`. The new `categoryLabels` prop on `<ShopFilterSidebar>` is optional with a raw-value fallback, so any third-party usage that imports the sidebar directly keeps compiling and rendering unchanged.

### Fixed

- [src/components/product-list-page.tsx](src/components/product-list-page.tsx): added a `useEffect` that calls `listActiveCategories(db)`, a `categoryLabels` `Map<id, name>`, and reworked `availableCategories` to sort by resolved label (so "Apparel" precedes a long auto-ID alphabetically). The new map is forwarded to `<ShopFilterSidebar>`.
- [src/components/search-results-page.tsx](src/components/search-results-page.tsx): same category-load + map. The search haystack now resolves `p.category` to the human label before lowercasing — searching for "apparel" matches the Apparel category again. Also added a `popstate` + `caspian:locationchange` listener that bumps a `useReducer` tick so URL changes re-render the page even when the navigation adapter's `searchParams` isn't reactive.
- [src/provider/caspian-store-provider.tsx](src/provider/caspian-store-provider.tsx): `useCaspianNavigation()` now returns a wrapper whose `push` and `replace` dispatch a `caspian:locationchange` window event after delegating to the consumer's adapter (microtask-deferred so the underlying router has a chance to update history first). Self-heals issue #43 without requiring consumer adapter edits.

### Added

- [src/components/shop-filter-sidebar.tsx](src/components/shop-filter-sidebar.tsx): optional `categoryLabels?: ReadonlyMap<string, string>` prop on `ShopFilterSidebarProps`. When omitted (or when a key is missing), the raw value is rendered as before — preserves backward compatibility for any consumer that imports the sidebar directly.

---

## v8.1.3 — Self-update no longer needs Application Default Credentials

v8.1.1 fixed *which* admin definition the Update button uses but unintentionally exposed a host-portability issue: the Firestore role lookup went through the Firebase Admin SDK, which requires Application Default Credentials at request time. Cloud Run / App Engine / Cloud Functions get ADC for free from the GCP metadata server, but Vercel, Netlify, and generic Node hosts don't — and that's where most consumer Next.js sites live. So clicking Update on those hosts hit `Could not load the default credentials. Browse to https://cloud.google.com/docs/authentication/getting-started for more information.`

The pre-v8.1.1 endpoint accidentally avoided the issue because `verifyIdToken()` doesn't need ADC — it verifies JWT signatures against Google's public JWKS endpoint over plain HTTPS. Adding the Admin-SDK Firestore call broke that streak.

This release does the role lookup via Firestore REST using the caller's own ID token instead of the Admin SDK. The library's own [firebase/firestore.rules:41-42](firebase/firestore.rules#L41-L42) already permit `request.auth.uid == uid` to read `users/{uid}`, so the user's ID token is sufficient — no service-account credentials, no `GOOGLE_APPLICATION_CREDENTIALS` env var, no consumer hand-edit. The endpoint now works on every host that can make HTTPS requests.

Token verification still uses `firebase-admin/auth` (which is also ADC-free), so the route's threat-model stays the same: signed token required, Firestore-role admin required, then the existing four layers (env opt-in, version regex, owner/repo allowlist, `--ignore-scripts` + 10-minute rate limit).

### No consumer action required

Drop-in patch. Reinstalling the new tag fixes the Update button on Vercel/Netlify/etc. without any environment-variable changes or service-account JSON files.

### Fixed

- [src/server/self-update.ts](src/server/self-update.ts): `requireAdmin()` now reads `users/{uid}.role` via Firestore REST API (`https://firestore.googleapis.com/v1/projects/{projectId}/databases/(default)/documents/users/{uid}`) using the caller's already-verified ID token in the `Authorization` header, instead of `getFirestore().collection(...).get()` from the Admin SDK. Threat-model layer 2 in the file's header comment was extended to note the route is now ADC-free. Error string (`'Caller is not an admin'`) unchanged.

---

## v8.1.2 — Remove the Pages dropdown from the storefront header

Issue mod1205 — `<SiteHeader>` carried a "Pages ▾" dropdown next to Shop and Collections that opened a hardcoded list of seven content pages (About, Journal, Sustainability, Contact, FAQs, Size guide, Shipping & returns). Consumer sites have wildly different page sets, so the library shouldn't be prescribing IA. v8.1.2 removes the dropdown trigger, the flyout, and the `DEFAULT_MORE` default list. Sites that need extra header links should add them to the `nav` prop instead.

### No consumer action required

The `moreNav` prop on `<SiteHeader>` is kept in the public type as a `@deprecated` no-op — sites that still pass `moreNav={[…]}` (whether the old default or a customized list) keep typechecking and just stop rendering a dropdown. The prop will be removed in the next major version.

### Removed

- [src/components/site-header.tsx](src/components/site-header.tsx): the "Pages" dropdown trigger button, its flyout `<div>`, the `DEFAULT_MORE` default list, the `moreOpen` state, and the `▾` glyph.
- [src/i18n/messages.ts](src/i18n/messages.ts): `'navigation.pages'` message key (now unreferenced; the i18n layer falls back to the key name for any orphan reference, so removal is safe).

### Deprecated

- `moreNav` prop on `SiteHeaderProps`: still accepted, now ignored. JSDoc updated with `@deprecated` tag pointing to `nav` as the replacement.

---

## v8.1.1 — Fix self-update Update button: align admin check with the rest of the library

The About admin page's **Update to vX.Y.Z** button has been failing for every consumer since v8.0.0 with `Caller is not an admin`, even when the signed-in user clearly *is* an admin. Root cause: the `/api/caspian-store/update` route checked for an `admin: true` Firebase Auth **custom claim**, but no code path in the library or its Cloud Functions ever set that claim. Every other admin gate in the library — `firestore.rules` `isAdmin()`, `storage.rules`, `functions-admin/onUserCreate`, `functions-admin/claimAdmin`, `<AdminGuard>`, every admin UI page — keys on the Firestore field `users/{uid}.role == 'admin'` instead, so consumers reached the Update button by being a Firestore-role admin and then bounced off a stricter, undocumented second check.

This release deletes that second check. The self-update endpoint now resolves admin status the same way every other gate does — verify the ID token, look up `users/{uid}.role` via Firebase Admin SDK, accept iff `role === 'admin'`. Token verification is still mandatory (so the endpoint cannot be hit by an unauthenticated request), and the four other layers of the threat model are unchanged: `CASPIAN_ALLOW_SELF_UPDATE=true` opt-in, `X.Y.Z` version regex, GitHub owner/repo allowlist, `--ignore-scripts` + 10-minute rate limit.

### No consumer action required

Drop-in patch. Existing admins (anyone whose `users/{uid}` doc has `role: 'admin'`) gain the working Update button as soon as they upgrade. No custom claims to set, no token refresh required, no `functions-admin` redeploy.

### Fixed

- [src/server/self-update.ts](src/server/self-update.ts): `requireAdmin()` now reads the Firestore `users/{uid}.role` field via the Admin SDK instead of checking a custom claim that nothing in the library or scaffold ever wrote. Threat-model layer 2 in the file's header comment was reworded to match. Error string (`'Caller is not an admin'`) is unchanged so anything matching against it keeps working.

---

## v8.1.0 — Per-theme code structure + Clean default theme redesign

Two improvements that ride together. The first is structural: each theme preset now lives in its own folder under [src/theme/themes/<id>/](src/theme/themes/). Combined with a per-theme `version: string` field and a new [`useThemeUpdateTracker`](src/theme/theme-update-tracker.ts) hook that remembers each admin's last-acknowledged version per theme in `localStorage`, the Appearance admin page now flags an `Updated` pill only on theme cards that actually changed since the admin last engaged with them — bumping one theme no longer makes every card look like it changed. The second is a polish pass on the default Clean theme so a fresh install looks finished out of the box: pure white page background (new optional `ThemeTokens.background` field), Poppins as the body + headline font (auto-loaded from Google Fonts when the theme activates — no consumer hand-edit needed), no underline on link hover, centered Collection page titles + tagline, and a 240px filter sidebar on the Shop page with Category, Price, Size, and Quick filter sections plus a Reset all button.

### No consumer action required

Reinstalling the new tag picks everything up. The new `ThemeTokens.background` field is optional with a `#ffffff` fallback, and the catalog file refactor preserves the existing `THEME_CATALOG` export shape — both `import { THEME_CATALOG } from '@caspian-explorer/script-caspian-store'` and the admin Appearance page keep working unchanged. Existing stores already running the Clean theme keep their current page background until an admin re-activates the theme from `/admin/appearance`, at which point the new tokens (white bg + Poppins) get written to Firestore and applied.

### Added

- [src/theme/themes/](src/theme/themes/) — one folder per preset (`clean-white`, `minimal-dark`, `boutique`, `editorial`, `neon-shop`, `pastel-studio`, `academy`, `kitchen-table`, `forum-blue`, `runway`). Each exports a single `CatalogTheme` default. Modifying one preset now touches one file.
- [src/theme/types.ts](src/theme/types.ts) — extracted `CatalogTheme`, `ThemeCategory`, `ThemeThumbnail`, `THEME_CATEGORY_LABELS` from the old monolithic catalog. Adds two new fields to `CatalogTheme`: `version: string` (per-theme semver, bumped only when that theme changes) and `googleFamilies?: string[]` (Google Fonts to auto-load when the theme activates).
- [src/theme/theme-update-tracker.ts](src/theme/theme-update-tracker.ts) — new `useThemeUpdateTracker()` hook backed by `localStorage['caspian:seen-theme-versions']`. Returns `{ isUpdated, markSeen }`. Seeds first-ever visits at the v8.0 baseline (`1.0.0`) so the v8.1 release shows `Updated` only on the cards actually bumped above baseline.
- [src/components/shop-filter-sidebar.tsx](src/components/shop-filter-sidebar.tsx) — new exported `<ShopFilterSidebar>` with `ShopFilterState` and `EMPTY_SHOP_FILTERS` helpers. Sections: Category (radio list, derived from loaded products), Price (min/max inputs), Size (chip checkboxes, derived), Quick filters (New arrivals + Limited toggles), with a Reset filters action that appears only when something is active.
- New i18n keys under `shop.filters.*` in [src/i18n/messages.ts](src/i18n/messages.ts) and `admin.appearance.badgeUpdated`.
- New optional field `ThemeTokens.background` in [src/types.ts](src/types.ts) — written to `--caspian-background` by `<ThemeInjector>`, applied to `.caspian-root` in [src/styles/globals.css](src/styles/globals.css). Falls back to `#ffffff`.

### Changed

- **Clean white preset** (now at [src/theme/themes/clean-white/index.ts](src/theme/themes/clean-white/index.ts), `version: '1.1.0'`) — adds `background: '#ffffff'` and `fontFamily: "'Poppins', system-ui, …"` to its tokens, plus `googleFamilies: ['Poppins:wght@400;500;600;700']`. The other 9 presets stay at `version: '1.0.0'` baseline; their tokens, thumbnails, and copy are byte-for-byte identical.
- **Activating a theme** — [src/admin/admin-appearance-page.tsx](src/admin/admin-appearance-page.tsx) now also writes `settings.fonts` (body, headline, googleFamilies) when the catalog theme declares `googleFamilies` and/or `fontFamily`, so [`<FontLoader>`](src/context/font-loader.tsx) injects the Google Fonts `<link>` on next render. Activating Clean white = white background + Poppins, automatically.
- **Storefront link hover** — [src/styles/globals.css](src/styles/globals.css) replaces `text-decoration: underline` on `.caspian-root a:hover` with `opacity: 0.7`. Cleaner against minimal themes; still gives a hover affordance.
- **Collection detail page header** — [src/components/collection-detail-page.tsx](src/components/collection-detail-page.tsx) centers the title (now 36px / -0.02em letter-spacing) and the description (acting as the tagline) inside a 640px max-width column. Hero image stays full-bleed.
- **Shop page (`<ProductListPage>`)** — [src/components/product-list-page.tsx](src/components/product-list-page.tsx) wraps the product grid in `.caspian-shop-grid` (240px sidebar + flex-1 grid, 32px gap, collapses to single column under 720px). Adds a `hideFilters` prop for embedding the listing in tighter layouts. Sidebar filtering is purely additive client-side; the existing `filters` prop (server-side narrowing) still applies on top.
- **`DEFAULT_SCRIPT_SETTINGS`** in [src/types.ts](src/types.ts) now matches the redesigned Clean theme (white background + Poppins) so first-paint on a fresh install before Firestore loads already shows the new look instead of system-ui on a transparent background.

---

## v8.0.1 — Move storefront avatar to the far right of the header

Issue [#88](https://github.com/Caspian-Explorer/script-caspian-store/issues/88) noted that the storefront header's account control (avatar when signed in, "Sign in" button when signed out) sat in the middle of the right-side icon cluster — search, language switcher, **avatar/sign-in**, wishlist, cart — wedged between two square icon buttons. This release moves the avatar/sign-in slot to the very end of the row so the cart and wishlist icons sit together as a visual group and the account control anchors the far edge of the header.

In RTL locales the avatar likewise becomes the visual far-left item, since the header's row uses `justifyContent: 'flex-end'` which respects logical direction — no RTL-specific code path was needed.

### No consumer action required

Visual-only reorder of items inside [src/components/site-header.tsx](src/components/site-header.tsx). Reinstalling the new tag picks it up; no provider props, exported types, Firestore rules, or Cloud Function signatures changed.

### Changed

- [src/components/site-header.tsx](src/components/site-header.tsx): the avatar/sign-in conditional moves from between the language switcher and the wishlist button to after the cart button, so it is the last item in the right-side flex row.

---

## v8.0.0 — End the v7.x firefighting cycle: hardened deploy, Secret Manager email keys, build race fixed

The v7.0–v7.3.3 release cadence was eleven patches in roughly forty-eight hours, every one of them a self-healing follow-up to a different deploy footgun. A three-perspective audit (build correctness, security, consumer experience) surfaced the three classes of problems that compound: a parallel-clean race in tsup that silently dropped `dist/firebase/index.d.ts` and `dist/server/index.d.ts` so consumer typecheck broke without a clear error; a self-update HTTP endpoint that ran `npm install` from any admin token without `--ignore-scripts` and wasn't gated outside production; email-provider API keys living in Firestore (`emailPluginInstalls.config.apiKey`) where a leaked Cloud Function or Firestore export would expose them; documentation pinning extinct version numbers and resurrecting the v7.0.2 double-header bug for manual installs. v8.0.0 ships a coordinated fix for all of them.

### Consumer action required on upgrade

```bash
# 1. Bump the library version pin
npm install github:Caspian-Explorer/script-caspian-store#v8.0.0

# 2. Set CASPIAN_ALLOW_SELF_UPDATE=true on EVERY environment that should
#    accept self-update POSTs (dev, preview, staging, production). v7.x
#    only enforced this in production; v8.0.0 enforces it everywhere so
#    accidental enablement isn't possible.
#    Vercel: Project Settings → Environment Variables.
#    Firebase App Hosting: apphosting.yaml under env.
#    Self-hosted Node: export in your process supervisor.

# 3. If you use the email Cloud Functions: move provider API keys from
#    Firestore (config.apiKey) into Google Cloud Secret Manager. You only
#    need the secret(s) for the providers you actually use.
firebase functions:secrets:set CASPIAN_EMAIL_SENDGRID_API_KEY   # if SendGrid
firebase functions:secrets:set CASPIAN_EMAIL_BREVO_API_KEY      # if Brevo

# 4. Redeploy the email codebase so it picks up the new defineSecret() refs.
firebase deploy --only functions:caspian-email

# 5. (Optional, cleanup) Open /admin/plugins/email-providers, edit each
#    install, and clear the legacy "API key" field. The new dispatcher
#    ignores it — but removing it tightens the audit trail. Existing
#    installs keep working unchanged either way.
```

If you do not use the email functions, only steps 1 + 2 apply. If you have a fork that overrides the self-update GitHub allowlist, the new validation requires both `allowedOwner` and `allowedRepo` to match `[A-Za-z0-9._-]{1,100}` — almost certainly already true, but confirm before deploying.

The `disableProductionGuard` option on `caspianHandleSelfUpdate(req, opts)` is **removed**. Anyone who depended on it should set `CASPIAN_ALLOW_SELF_UPDATE=true` in the corresponding environment instead — same outcome, fewer foot-shaped guns.

The `EmailPlugin` config types (`SendGridConfig`, `BrevoConfig`) are now empty objects (`Record<string, never>`); `defaultConfig` is `{}`. Custom code that read `install.config.apiKey` should switch to relying on the Secret Manager secret, which is what the dispatcher now uses.

### Added

- [src/server/self-update.ts](src/server/self-update.ts): per-process rate limit (one install per ten minutes per warm Node instance, returns HTTP 429 with `retryInSec` if invoked sooner). Stderr / stdout responses are redacted of patterns matching `/\$\{?[A-Z_][A-Z0-9_]*\}?/` so npm errors that echo unset env-var names cannot leak through. `allowedOwner` / `allowedRepo` overrides are validated against GitHub's naming rules before the npm spawn.
- [firebase/functions-email/src/secrets.ts](firebase/functions-email/src/secrets.ts): `defineSecret('CASPIAN_EMAIL_SENDGRID_API_KEY')` and `defineSecret('CASPIAN_EMAIL_BREVO_API_KEY')`. Exported as `EMAIL_SECRETS` so every emitting trigger attaches the same list.
- [src/email/types.ts](src/email/types.ts): `EmailPlugin.secretName` field. Plugin metadata now declares which Secret Manager name it expects.
- Scaffolded `providers.tsx` (via [scaffold/create.mjs](scaffold/create.mjs)) now runs an env-var preflight that throws a clear, actionable error if any `NEXT_PUBLIC_FIREBASE_*` is missing on first run — saves consumers ~20 minutes of debugging a blank-page-with-no-error.

### Changed

- [tsup.config.ts](tsup.config.ts): consolidated three separate entries into a single config block. The split caused `clean: true` on the main entry to race against the sibling DTS writes — `dist/firebase/index.d.ts` and `dist/server/index.d.ts` would be written and immediately wiped. With one config, one clean, one DTS pass: all three entries ship `.d.ts` and `.d.mts`.
- [src/server/self-update.ts](src/server/self-update.ts): `CASPIAN_ALLOW_SELF_UPDATE=true` required in **all** environments, not just production. npm spawn now passes `--ignore-scripts` so a compromised tarball cannot run a postinstall hook under the server's process identity.
- [firebase/functions-email/src/email-sender.ts](firebase/functions-email/src/email-sender.ts): provider API keys read via `SENDGRID_API_KEY.value()` / `BREVO_API_KEY.value()` instead of `install.config.apiKey`. Per-provider `sendVia*` functions no longer take a `config` argument — the secret is looked up by provider id at the dispatcher layer.
- [firebase/functions-email/src/order-email-triggers.ts](firebase/functions-email/src/order-email-triggers.ts), [firebase/functions-email/src/contact-email-triggers.ts](firebase/functions-email/src/contact-email-triggers.ts), [firebase/functions-email/src/send-test-email.ts](firebase/functions-email/src/send-test-email.ts): every trigger declares `secrets: EMAIL_SECRETS` in its options so `secret.value()` resolves at runtime.
- [firebase/functions-email/package.json](firebase/functions-email/package.json): `@getbrevo/brevo` bumped from `^2.2.0` to `^5.0.4`. The 2.x line transitively pulled the deprecated `request` library flagged with SSRF (CVE-2024-6225); 5.x dropped it entirely. The Brevo SDK API surface changed (no more `TransactionalEmailsApi` / `SendSmtpEmail`); call sites in [email-sender.ts](firebase/functions-email/src/email-sender.ts) updated to the new `BrevoClient.transactionalEmails.sendTransacEmail({...})` shape.
- [src/firebase/collections.ts](src/firebase/collections.ts) plus 21 service files + the admin dashboard + the admin-notifications hook + the manual-payment plugin: all 55 ad-hoc `collection(db, "name")` call sites now go through `caspianCollections(db).<name>`. Adding a new collection is one diff in one file; centralized refs make rule + index migrations tractable. Added `adminTodos` to the helper (it was used by `admin-todo-service.ts` but missing from the canonical list).
- [src/admin/admin-email-plugins-page.tsx](src/admin/admin-email-plugins-page.tsx): API-key input replaced by a Secret Manager setup notice that prints the exact `firebase functions:secrets:set <SECRET_NAME>` command for the chosen provider.
- [src/admin/admin-site-settings-page.tsx](src/admin/admin-site-settings-page.tsx): inline warning under the logo + favicon upload reminding admins that SVG can embed JavaScript and to upload only from trusted sources. Storefront product / journal / page-content uploads continue to reject SVG via storage rules.
- [firebase/functions-stripe/src/stripe-webhook.ts](firebase/functions-stripe/src/stripe-webhook.ts): `JSON.parse` failures now log which metadata field (`shippingInfo` vs `items`) failed and tag `errorLogs` with the session id. HTTP response stays opaque (`Malformed metadata`) so a malicious caller cannot enumerate expected fields.
- [README.md](README.md), [INSTALL.md](INSTALL.md), [create-caspian-store/README.md](create-caspian-store/README.md): version pins realigned from extinct `v1.18.2` / `v1.9.0` to `v8.0.0`. INSTALL §3 layout snippet drops the `<LayoutShell>` wrapper that resurrected the v7.0.2 double-header bug for manual installs; now mirrors what the scaffolder actually emits. INSTALL §5 + §12 document the Secret Manager + self-update changes.
- [create-caspian-store/package.json](create-caspian-store/package.json): bumped to `0.2.0` for the README + flag-doc changes (Next.js 15, deprecated `--with-functions`, prominent `--no-apphosting`).
- [firebase/functions-email/package.json](firebase/functions-email/package.json): bumped to `0.2.0` to track the Secret Manager migration.
- [.gitignore](.gitignore) extended to cover `.vscode/`, `package-lock.json` (the main package deliberately doesn't commit a lockfile per CLAUDE.md), `examples/**/next-env.d.ts`, and `firebase/functions-email/lib/`.

### Removed

- `disableProductionGuard` option on `caspianHandleSelfUpdate`. Use `CASPIAN_ALLOW_SELF_UPDATE=true` in the environment instead.
- `apiKey` field from `SendGridConfig` / `BrevoConfig` (and from the admin install dialog). Provider keys live in Cloud Secret Manager; legacy `config.apiKey` values in existing Firestore docs are ignored by the v8.0.0 dispatcher.

### Fixed

- `dist/firebase/index.d.ts` and `dist/server/index.d.ts` are now produced and survive the build. The previous behaviour caused `TS7016 Could not find a declaration file for module '@caspian-explorer/script-caspian-store/server'` on consumer typecheck even after a clean install.
- Tarball hygiene: removed an empty `firebase/firestore-debug.log` that was being shipped to consumers, and confirmed via `npm pack --dry-run` that no `node_modules/`, `.env`, or service-account JSON ever reaches the published archive.

---

## v7.4.0 — Self-update route moves into the library (`@caspian-explorer/script-caspian-store/server`)

The scaffolded `app/api/caspian-store/update/route.ts` used to be a 150-line, hand-rolled handler that did its own `firebase-admin` init, project-ID detection, admin-token verification, and `spawn(npm install)`. Every fix to project-ID detection or credential fallback required consumers to re-scaffold or hand-edit that file — exactly the friction the v7 single-mount architecture eliminated everywhere else.

The smoking gun: a consumer's `.env.local` had `NEXT_PUBLIC_FIREBASE_PROJECT_ID` set correctly, the about-page's "How to fix" panel said to add that variable, but their pre-v7.4.0 route called `applicationDefault()` directly — and `applicationDefault()` only auto-detects from `GOOGLE_CLOUD_PROJECT` / `GCLOUD_PROJECT`, not the `NEXT_PUBLIC_*` form. The route never read `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, so the help text was lying.

v7.4.0 moves the whole handler into the library at `@caspian-explorer/script-caspian-store/server` (a new server-only entry point). Consumers' route.ts files become a 7-line shim:

```ts
import { caspianHandleSelfUpdate } from '@caspian-explorer/script-caspian-store/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: Request) {
  return caspianHandleSelfUpdate(req);
}
```

Future fixes to project-ID resolution, credential fallback, npm-spawn quoting, etc. land via `npm install`. No re-scaffolding. No hand-editing. Same contract the v7 single-mount `<CaspianRoot />` made for client routing — now applied to API routes.

The library helper reads the project ID from `GOOGLE_CLOUD_PROJECT`, `GCLOUD_PROJECT`, `FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, and `CASPIAN_FIREBASE_PROJECT_ID` (in that order), passes it explicitly to `initializeApp({ projectId })`, mirrors it back into `process.env.GOOGLE_CLOUD_PROJECT` so any nested Google client lib inherits it, and falls back through credentialed and uncredentialed init paths. Same logic the latest scaffold's route had — just owned by the library now.

### Consumer action required on upgrade

Existing consumers (scaffolded pre-v7.4.0) must replace the body of their `src/app/api/caspian-store/update/route.ts` with the 8-line shim above. After this one-time migration, no future library version touches the file. The about page's "How to fix" panel now displays this snippet inline when it detects the failure mode.

Fresh scaffolds (`npm create caspian-store@latest`) get the new shim automatically.

Also bumps the floor for `firebase-admin` to `^13.8.0` in the library's devDependencies (was implicit; now explicit) so the library's own DTS build can resolve admin types.

### Added

- **New entry point: `@caspian-explorer/script-caspian-store/server`.** Server-only — uses `node:child_process` and `firebase-admin`; importing from client/storefront code pulls those into the browser bundle.
- [src/server/self-update.ts](src/server/self-update.ts), [src/server/index.ts](src/server/index.ts): `caspianHandleSelfUpdate(req, opts?)` with options `{ allowedOwner, allowedRepo, disableProductionGuard }`. Public exports: `caspianHandleSelfUpdate`, `CaspianHandleSelfUpdateOptions`.
- [tsup.config.ts](tsup.config.ts): third entry for `server/index` that externalizes `firebase-admin` + `firebase-admin/app` + `firebase-admin/auth` + `node:child_process`.
- [package.json](package.json): new `./server` exports map entry.

### Changed

- [scaffold/create.mjs](scaffold/create.mjs): the 150-line `route.ts` template collapses to the 8-line shim. Fresh scaffolds use the library helper.
- [src/admin/admin-about-page.tsx](src/admin/admin-about-page.tsx): the "How to fix" panel now offers `GOOGLE_CLOUD_PROJECT` as the first env-var option (always works, even with stale routes), keeps `NEXT_PUBLIC_FIREBASE_PROJECT_ID` as second (works on v7.4.0+ routes), and inlines the migration snippet for consumers stuck on the in-lined route version.
- [package.json](package.json) `devDependencies`: `firebase-admin@^13.8.0` added so the library's own DTS build resolves `firebase-admin/app` + `firebase-admin/auth` types. Externalized at runtime — not bundled.

---

## v7.3.3 — Cart hydration no longer crashes when Firestore is offline

`<CartProvider>` hydrates the user's cart on auth change by calling `loadUserCart(db, uid)`. The hydration block was wrapped in `try { … } finally { setLoading(false) }` — no `catch`. When Firestore threw (most often *"Failed to get document because the client is offline"*, which happens any time the consumer's Firebase config is incomplete — e.g. missing `projectId` — or the user is genuinely offline), the rejection escaped as an unhandled promise rejection: `Uncaught (in promise) FirebaseError: Failed to get document because the client is offline.` Visible in the console, but otherwise silent — and on a clean dev session it could mask broken Firebase config behind a noisy log instead of surfacing it as a user-facing error.

Added a `catch` that logs via `reportServiceError(db, 'cart-context.hydrateRefs', error)` (so the failure surfaces on `/admin/about`'s error log) and falls back to `readLocal()` — the same path a signed-out shopper takes. Result: the cart degrades gracefully instead of throwing an unhandled rejection, and an admin can see the underlying Firestore error on the about page.

### No consumer action required

Pure resilience patch. No API change, no behavior change for the happy path.

### Fixed

- [src/context/cart-context.tsx](src/context/cart-context.tsx): wrap `loadUserCart` hydration in a `catch` that reports via the existing `reportServiceError` channel and falls back to the localStorage cart so the page keeps rendering. Same recovery shape the second effect at line 89-109 already used for `getProductsByIds` failures.

---

## v7.3.2 — Self-update "How to fix" covers localhost dev too

The `<AdminAboutPage>` self-update flow shows a "How to fix" panel when the API route fails because `firebase-admin` can't detect a project id (`Unable to detect a Project Id in the current environment`). The panel told consumers how to fix this on Vercel / Firebase App Hosting / self-hosted Node — but it never mentioned **localhost Next.js dev**, which is where most consumers hit the error first while smoke-testing the update flow.

The localhost case has a specific gotcha: Next.js reads `.env.local` only at server startup, so adding the variable while `next dev` is running doesn't help — the dev server has to be fully stopped (Ctrl+C, not just hot-reload) and restarted. The help bullet now spells that out.

### No consumer action required

UX-only patch to a help message in the admin About page. No API change, no consumer code change. Existing scaffolds pick up the new bullet on the next library upgrade.

### Changed

- [src/admin/admin-about-page.tsx](src/admin/admin-about-page.tsx): the "How to fix" `<ul>` for the missing-Project-Id error gains a `Local development (Next.js)` bullet pointing at `.env.local` plus the dev-server restart requirement. Vercel / App Hosting / Self-hosted Node bullets unchanged.

---

## v7.3.1 — Unified plugins grid + filter dropdowns

The v7.1.0 `/admin/plugins` page split the list into two sections — an **Installed** table above an **Available plugins** card grid — and offered a chip row (`All / Shipping / Payments / Email`) for filtering. A merchant searching for "stripe" had to visually scan both sections and re-run the chip filter to know the result set.

v7.3.1 folds both into a single card grid. Status becomes a badge (`Installed`) on the card, not a section boundary. The chip row becomes two dropdowns next to the search input:

- **Status** — All / Installed / Available
- **Category** — All / Shipping / Payments / Email

Enabled installs appear as cards with the `Installed` badge + `Configure` button (linking to `/admin/plugins/<pluginId>/<installId>`). Catalog entries appear as cards with an `Install` button. A catalog entry is listed whether or not it already has installs — merchants with a Flat Rate install can still install a second Flat Rate with different rates, so the catalog card remains reachable.

### No consumer action required

Pure UX patch. Single-mount `<CaspianRoot />` still dispatches `/admin/plugins` the same way; no scaffold change; no public API change. Consumers who linked to the v7.1.0 `?filter=<category>` query parameter keep working — the category dropdown seeds from it. A new `?status=installed|available|all` query parameter is also supported so links to a pre-filtered view work out of the box.

### Changed

- [src/admin/admin-plugins-page.tsx](src/admin/admin-plugins-page.tsx): rewrote the body. New `PluginEntry` discriminated union (`install | catalog`), one `useMemo` builds the merged list, one card grid renders it. Chip `<button>`s replaced with two `<Select>` dropdowns. The separate installed-table and catalog-grid sections are gone. New `PluginCard` component inside the same file renders both install and catalog entries with the right badge + action.

- [src/i18n/messages.ts](src/i18n/messages.ts): added `admin.plugins.status.{label,all,installed,available}`, `admin.plugins.filter.label`, `admin.plugins.badge.installed`, `admin.plugins.empty.all`. Removed obsolete keys: `admin.plugins.installed.{title,empty}`, `admin.plugins.catalog.{title,empty}`, `admin.plugins.col.{category,name,plugin,actions}`.

---

## v7.3.0 — Surface v7.1.1 plugins sidebar fix above v7.2.0

Version realignment. v7.1.1 shipped a fix so the `Plugins` sidebar header navigates to `/admin/plugins` (not just toggles the submenu), but v7.2.0's "Self-healing LayoutShell" release followed right after and pushed v7.1.1 off the top of the release list — even though v7.2.0's history includes v7.1.1's commit, consumers scanning the releases page saw v7.2.0 and assumed plugin-sidebar behavior came from it. This release puts the plugin-sidebar fix at the visible top without duplicating any code: every consumer on v7.2.0 already has the fix, but upgrading to v7.3.0 confirms it and makes the release ordering match what shipped first.

Pure version realignment — no source changes relative to v7.2.0.

### No consumer action required

Upgrading from v7.2.0 to v7.3.0 is a no-op in behavior. Upgrading from v7.1.x rolls in both v7.2.0's LayoutShell self-heal and v7.1.1's Plugins sidebar navigation (already included in v7.2.0's tree).

```bash
npm install github:Caspian-Explorer/script-caspian-store#v7.3.0
```

---

## v7.2.0 — Self-healing LayoutShell: single header + footer regardless of double-mount

v7.0.2 fixed the scaffolder template that was double-wrapping `{children}` in `<LayoutShell>`, but that only protected *new* scaffolds. Every consumer site generated by v7.0.0 or v7.0.1 already had the buggy `src/app/layout.tsx` on disk, and upgrading the library to v7.0.2 didn't fix it — we told customers to hand-edit the file, which is exactly the kind of release friction a library shouldn't ship.

v7.2.0 fixes that properly. `<LayoutShell>` now carries a React context sentinel: the first mount in a tree sets it to `true`, any nested mount reads it as `true` and renders just `{children}` (no header, no footer, no duplicate `getSiteSettings` fetch). The outermost `<LayoutShell>` wins; every inner one is an inert pass-through. A v7.0.0-scaffolded consumer layout that still wraps `{children}` in `<LayoutShell>` is now visually indistinguishable from a clean one — the inner mount inside `CaspianRoot` dedupes itself.

### No consumer action required

`npm install github:Caspian-Explorer/script-caspian-store#v7.2.0` is the complete fix. No edits to `src/app/layout.tsx`, no Firebase redeploy, no dependency bump. Works for sites originally scaffolded with v7.0.0, v7.0.1, v7.0.2, or v7.1.x — the context sentinel is idempotent.

### Changed

- [src/components/layout-shell.tsx](src/components/layout-shell.tsx): new internal `LayoutShellMountedContext`. `LayoutShell` reads it at the top of the component; if a parent `LayoutShell` already claimed the shell, the component short-circuits to `<>{children}</>` (and skips the `getSiteSettings` effect so inner mounts don't issue duplicate Firestore reads). The normal render path now wraps children in `<LayoutShellMountedContext.Provider value={true}>`, replacing the previous top-level fragment. No props changed, no public API added — the dedup is fully internal.

### Why the sentinel on top of v7.0.2's template fix

v7.0.2 is still the right fix for the scaffolder template (fresh sites shouldn't double-wrap in the first place). v7.2.0 is the *defensive* fix for sites that were already scaffolded wrong before v7.0.2 shipped — those file edits live in the consumer's repo and a library bump can't rewrite them. Both ship together now: templates are clean, and the library self-heals when past templates drifted.

### Not touched

- No scaffolder changes. v7.0.2's template is still correct.
- No other source files. Pure `LayoutShell` internal change.

---

## v7.1.1 — Plugins sidebar header navigates to the unified list

v7.1.0 turned the Plugins sidebar entry into an `AdminNavGroup` so enabled installs could appear as dynamic children. The regression: clicking the `Plugins` header itself only toggled the submenu — it no longer navigated to `/admin/plugins`. Merchants with zero plugins enabled hit a dead click (no children to expand *and* no navigation).

Fix: `AdminNavGroup` gains an optional `href` field. When set, the group's label + icon become a link (click navigates), while the chevron on the right remains a separate button (click toggles). Existing container-only groups (`Catalog`, `People`, `Sales`, `Content`) stay click-to-toggle — backwards compatible. The `Plugins` group in `DEFAULT_ADMIN_NAV` now sets `href: '/admin/plugins'` so clicking the label opens the unified list.

### No consumer action required

Pure UX patch; single-mount `<CaspianRoot />` dispatches the URL the same way as before. Consumers who built custom `navItems` with their own groups are untouched.

### Changed

- [src/admin/admin-shell.tsx](src/admin/admin-shell.tsx): `AdminNavGroup` extended with optional `href`. `GroupNode` renders a `<Link>` for the label row when `href` is set, with the chevron in a sibling `<button>` so toggle and navigate are independent surfaces. `DEFAULT_ADMIN_NAV`'s `Plugins` group gains `href: '/admin/plugins'`. `groupActive` highlighting now also considers the group's own href, not just its children's.

---

## v7.1.0 — Plugins consolidation + dynamic sidebar (mod1197 follow-up)

Four coordinated admin-UX changes, all internal to CaspianRoot + the library's single-mount dispatcher. No consumer route edits — upgrading the library picks up every change automatically.

**1. Shipping options → Settings.** The site-wide "Hide rates until address" / "Hide paid options when free available" card moved out of `/admin/plugins/shipping` (where it was about the wrong thing — shipping-checkout behavior, not shipping plugins) into `/admin/settings/shipping-options`. Lifted verbatim into a new `<AdminShippingOptionsPage>`.

**2. Appearance → Settings.** `Appearance` is no longer a top-level sidebar leaf. It's now a Settings sub-nav entry alongside General / Emails / Languages / Shipping options. The top-level sidebar shortens by one row; configuration surfaces cluster sensibly. Old `/admin/appearance` URLs keep working for one release — they redirect to `/admin/settings/appearance`.

**3. Unified Plugins page.** The three plugin-category tabs (Shipping, Payments, Email providers) merge into one searchable + filterable page. Merchants no longer tab-swap to find plugins they want. Header has a search input + `All / Shipping / Payments / Email` chip filter. Two sections: Installed (live across all three categories) and Available (the merged catalog). Legacy category URLs redirect: `/admin/plugins/shipping` → `/admin/plugins?filter=shipping`, etc. The Install buttons link to per-category surfaces at `/admin/plugins/manage/<category>` so existing install flows stay unchanged.

**4. Dynamic sidebar children.** The `Plugins` top-level sidebar item became an `AdminNavGroup` with children populated at runtime from enabled installs across all three collections. Before any plugin is enabled: the group renders with zero children. Enable Flat Rate + Stripe: two children appear under Plugins, each a one-click shortcut to that install's configure view at `/admin/plugins/<pluginId>/<installId>`. Clicking a child mounts the existing category page with the configure dialog auto-opened for that specific install — no duplicated dialog code, no behavior drift. Sidebar refreshes on window focus so enabling a plugin in another tab shows up when you return.

### No consumer action required

All changes land through the v7 single-mount `<CaspianRoot />` dispatcher — consumer route files are untouched. Old URLs redirect for one release, then the redirects drop in the next major. Scaffold output is unchanged (still one catch-all route + server API routes).

### Added

- [src/admin/admin-plugins-page.tsx](src/admin/admin-plugins-page.tsx): new `<AdminPluginsPage>` — unified list + search + filter chips + merged catalog grid. Mounted at `/admin/plugins`.
- [src/admin/admin-plugin-install-page.tsx](src/admin/admin-plugin-install-page.tsx): new `<AdminPluginInstallPage>` — per-install configure view at `/admin/plugins/:pluginId/:installId`. Dispatches to the right category page with `autoConfigureInstallId` set so the existing configure dialog opens for the named install. Thin router; reuses every line of existing configure UX.
- [src/admin/admin-shipping-options-page.tsx](src/admin/admin-shipping-options-page.tsx): new `<AdminShippingOptionsPage>` — the site-wide shipping toggles, lifted verbatim from `<AdminShippingPluginsPage>` and mounted at `/admin/settings/shipping-options`.
- [src/admin/use-enabled-plugin-installs.ts](src/admin/use-enabled-plugin-installs.ts): new `useEnabledPluginInstalls()` hook. Parallel-fetches enabled installs from shipping + payment + email collections, merges them, sorts by category+order, re-fetches on window focus. Powers both the unified page's Installed section and the dynamic sidebar children in `<AdminShell>`.
- Public exports: `AdminPluginsPage`, `AdminPluginInstallPage`, `AdminShippingOptionsPage`, `useEnabledPluginInstalls`, `EnabledPluginInstall`, `EnabledPluginCategory`, `AdminShippingPluginsPageProps`, `AdminPaymentPluginsPageProps`.
- i18n keys: `admin.plugins.search.placeholder`, `admin.plugins.filter.{all,shipping,payment,email}`, `admin.plugins.installed.{title,empty}`, `admin.plugins.catalog.{title,empty}`, `admin.plugins.col.{category,name,plugin,actions}`, `admin.plugins.{configure,install}`.

### Changed

- [src/admin/admin-shell.tsx](src/admin/admin-shell.tsx): `Appearance` leaf removed from `DEFAULT_ADMIN_NAV`; `Plugins` converted from leaf to `AdminNavGroup` with `id: 'plugins'` + empty initial children. `SETTINGS_SUB_NAV` gains `Appearance` + `Shipping options` entries. New `injectPluginChildren()` helper + `iconForPluginCategory()` inside the component body replace the group's children at render time with enabled installs. Consumers passing a custom `navItems` prop get the same behavior as long as they include a group with `id: 'plugins'`.
- [src/admin/admin-settings-shell.tsx](src/admin/admin-settings-shell.tsx): dispatches `appearance` → `<AdminAppearancePage>` and `shipping-options` → `<AdminShippingOptionsPage>`. `SettingsSlug` union + `KNOWN_SLUGS` updated.
- [src/admin/admin-root.tsx](src/admin/admin-root.tsx): `appearance` case now redirects to `/admin/settings/appearance`. `plugins` case dispatches via new `PluginsDispatch` helper: bare → unified list; `manage/<category>` → per-category page; legacy `shipping|payments|email-providers` → redirect-with-filter; `<pluginId>/<installId>` → per-install page.
- [src/admin/admin-shipping-plugins-page.tsx](src/admin/admin-shipping-plugins-page.tsx): shipping-options card + supporting state + `saveSiteSettings` import removed (moved to `<AdminShippingOptionsPage>`). New `autoConfigureInstallId` prop opens the configure dialog on mount for a named install.
- [src/admin/admin-payment-plugins-page.tsx](src/admin/admin-payment-plugins-page.tsx), [src/admin/admin-email-plugins-page.tsx](src/admin/admin-email-plugins-page.tsx): same new `autoConfigureInstallId` prop.

### Removed

- `<AdminPluginsShell>` + `AdminPluginsShellProps` type + `PLUGINS_SUB_NAV` export. These were v5 internals — the three-tab shell has no purpose under the unified list, and the scaffold stopped mounting it independently in v7. Any consumer still importing them was working against the v5 layout; migrate to `<AdminPluginsPage>` or the individual category pages.

---

## v7.0.2 — Fix duplicate header/footer in scaffolded consumer sites

v7.0.0's scaffolder shipped with a double-mount bug in the generated root layout. Every page of a freshly scaffolded store — storefront, PDP, cart, checkout, account — rendered the site chrome twice: two stacked headers (logo + nav + search + cart icons), two stacked footers (LUIVANTE + ABOUT + CUSTOMER CARE + NEWSLETTER). The library's `CaspianRoot` already wraps every storefront path in `<LayoutShell>` internally ([src/components/caspian-root.tsx:126](src/components/caspian-root.tsx#L126)), but the scaffolder's `src/app/layout.tsx` template was *also* wrapping `{children}` in `<LayoutShell>`, producing the double mount.

The first-party example at [examples/nextjs/app/layout.tsx](examples/nextjs/app/layout.tsx) was already correct — this was purely the scaffolder template having drifted from the intended v7.0.0 design ("one file owns every page, forever"). The regression test at [scripts/check-scaffold-routes.mjs](scripts/check-scaffold-routes.mjs) now asserts that the generated `layout.tsx` does not mount `<LayoutShell>`, so this specific drift cannot regress silently again.

### Consumer action required on upgrade

Sites scaffolded with v7.0.0 or v7.0.1 already have the buggy `src/app/layout.tsx` on disk. Upgrading the library does not rewrite your existing file, so apply this one-line fix by hand:

```tsx
// src/app/layout.tsx — BEFORE (buggy)
import { LayoutShell, DynamicFavicon } from '@caspian-explorer/script-caspian-store';
// ...
<Providers>
  <LayoutShell>{children}</LayoutShell>
  <DynamicFavicon />
</Providers>

// src/app/layout.tsx — AFTER (correct)
import { DynamicFavicon } from '@caspian-explorer/script-caspian-store';
// ...
<Providers>
  {children}
  <DynamicFavicon />
</Providers>
```

No Firebase redeploy, no dependency bump, no Cloud Functions work. Just the one file.

### Changed

- [scaffold/create.mjs](scaffold/create.mjs): `src/app/layout.tsx` template no longer imports or wraps children in `<LayoutShell>`. `CaspianRoot` owns the shell for every storefront path, so the root layout stays a plain `<Providers>{children}<DynamicFavicon /></Providers>`.
- [scripts/check-scaffold-routes.mjs](scripts/check-scaffold-routes.mjs): added a regression guard that fails the smoke test if the scaffolder's generated `layout.tsx` ever wraps children in `<LayoutShell>` again.

### Not touched

- No source code changes in `src/` beyond the version bump. `CaspianRoot` and `LayoutShell` were already correct — this was a scaffolder template bug.

---

## v7.0.1 — Patch vulnerable transients under firebase-admin (npm audit cleanup)

`npm audit` on fresh scaffolds was reporting 5 critical + 3 high + several moderate vulnerabilities under the `firebase-admin` tree — `@google-cloud/firestore <=6.8.0` (credential logging), `protobufjs <=7.5.4` (prototype pollution + RCE), `jsonwebtoken <=8.5.1` (signature validation bypass), `@grpc/grpc-js <1.8.22` (memory allocation), `@tootallnate/once` (control-flow), `uuid <14` (buffer bounds). All resolvable by pushing the tree past `firebase-admin@13.8.0`, which pulls patched transients.

Belt **and** suspenders: floor raised everywhere the library pins `firebase-admin`, plus npm `overrides` added so vulnerable transients can't sneak back in even if a nested package still pins an old version.

### Consumer action required on upgrade

Library-side change protects **fresh scaffolds** automatically. Existing consumer apps still need to update their own `package.json` pins — a library bump doesn't rewrite the consumer's `node_modules`:

```powershell
# From your consumer app root (e.g. C:\Users\fuadj\GitHub\luivante)

# 1. Bump your root firebase-admin pin + add overrides
npm pkg set dependencies.firebase-admin='^13.8.0'
npm pkg set overrides.@tootallnate/once='^3.0.1'
npm pkg set overrides.http-proxy-agent='^7.0.2'
npm pkg set overrides.jsonwebtoken='^9.0.2'
npm pkg set overrides.protobufjs='^7.5.5'
npm pkg set overrides.uuid='^14.0.0'

# 2. Nuke the lockfile + node_modules so every transient re-resolves
Remove-Item -Recurse -Force node_modules, package-lock.json -ErrorAction SilentlyContinue
npm install

# 3. Same thing in each Cloud Functions codebase you scaffolded
foreach ($dir in 'functions-admin','functions-stripe','functions-email') {
  if (Test-Path $dir) {
    Push-Location $dir
    npm pkg set dependencies.firebase-admin='^13.8.0'
    Remove-Item -Recurse -Force node_modules, package-lock.json -ErrorAction SilentlyContinue
    npm install
    Pop-Location
  }
}

npm audit    # expect: 0 vulnerabilities
```

Why the PowerShell `npm update firebase-admin` approach didn't work: it updates top-level direct deps at the tip of their pinned range, but the vulnerable packages were under `node_modules/@google-cloud/firestore/node_modules/protobufjs` etc. — deeply nested lockfile entries npm respects until you rebuild the tree. Deleting `package-lock.json` + `node_modules` forces fresh resolution of every transient.

### Changed

- [scaffold/create.mjs](scaffold/create.mjs): `firebase-admin` scaffold pin raised from `^13.0.0` to `^13.8.0`. New `overrides` block added to both the hand-rolled and `--use-create-next-app` package.json emission paths. The overrides force `@tootallnate/once@^3.0.1`, `http-proxy-agent@^7.0.2`, `jsonwebtoken@^9.0.2`, `protobufjs@^7.5.5`, `uuid@^14.0.0` regardless of what nested packages pin.
- [firebase/functions-admin/package.json](firebase/functions-admin/package.json), [firebase/functions-email/package.json](firebase/functions-email/package.json), [firebase/functions-stripe/package.json](firebase/functions-stripe/package.json): `firebase-admin` bumped to `^13.8.0`, existing `overrides` block extended with `jsonwebtoken` and `protobufjs`. Each codebase's own version bumped (0.3.1 → 0.3.2, 0.1.1 → 0.1.2, 0.1.1 → 0.1.2).

### Not touched

- No source code changes. `npm audit` on the library itself was already clean (0 vulns) — this is scaffold + Cloud Functions template hygiene only.

---

## v7.0.0 — Single-mount CaspianRoot: one file owns every page, forever

Consumer admin routing has been a pain point every time the library adds a page — v5.0.0 (the Plugins page) made it concrete: add a sidebar entry, ship it, and every consumer gets a silent 404 until they create a new route file and restart `next dev`. Telling customers to edit their own app on every library upgrade is not a supportable product, so v7 moves the library to a pattern where that never has to happen again.

**One dispatcher, one mount, every URL.** New `<CaspianRoot />` is a top-level pathname dispatcher that owns every library URL — storefront (`/`, `/cart`, `/checkout`, `/product/:id`, `/collections`, `/collections/:slug`, `/journal`, `/journal/:id`, `/search`, `/faqs`, `/contact`, `/about`, `/privacy`, `/terms`, `/sustainability`, `/shipping-returns`, `/size-guide`), account + auth (`/account`, `/auth/login`, `/auth/register`, `/auth/forgot-password`), orders confirmation, admin-gated setup wizard, the admin-preview theme popup, and the entire `/admin/**` tree (via a delegated `<AdminRoot>` that internally wraps in `<AdminGuard>` + `<AdminShell>`). Consumers mount it once at `app/[[...slug]]/page.tsx` and stop touching routes.

**Scaffolder collapses from 20+ route files to 1.** Fresh scaffolds now emit `src/app/[[...slug]]/page.tsx` plus the two server-side API routes that can't be client-dispatched. Every future library page lands as an internal case in `<CaspianRoot>` or `<AdminRoot>` — no scaffolder bump, no consumer code change.

**Customizing the single mount.** `<CaspianRoot>` accepts `homepage` (override `<HomePage />`), `fallback({ pathname })` (render custom pages for unknown paths), `header` / `footer` (pass-through to the storefront `LayoutShell`), `checkoutSuccessUrl` / `checkoutCancelUrl`, `setupFinishHref`, `adminHeaderRight`. Full admin + storefront page components stay public exports, so hand-rolled custom routing is still available if a consumer wants it.

### Consumer action required on upgrade

One-time route collapse. After this, no library version will ever ask you to touch routes again.

```bash
# 1. Bump
npm install github:Caspian-Explorer/script-caspian-store#v7.0.0

# 2. Delete the old per-page tree
rm -rf src/app/admin src/app/admin-preview src/app/cart src/app/checkout \
       src/app/collections src/app/product src/app/search src/app/shop \
       src/app/wishlist src/app/journal src/app/orders src/app/account \
       src/app/auth src/app/login src/app/register src/app/forgot-password \
       src/app/contact src/app/faqs src/app/shipping-returns src/app/size-guide \
       src/app/about src/app/privacy src/app/terms src/app/sustainability \
       src/app/settings src/app/setup src/app/page.tsx

# 3. Add the one catch-all that replaces them all
mkdir -p "src/app/[[...slug]]"
cat > "src/app/[[...slug]]/page.tsx" <<'EOF'
'use client';
import { CaspianRoot } from '@caspian-explorer/script-caspian-store';
export default function Page() { return <CaspianRoot />; }
EOF

# 4. Fully stop `next dev` (Ctrl+C, not just save) and restart
npm run dev
```

Keep your `src/app/layout.tsx` with `<Providers>` + global CSS import as-is. Keep any `src/app/api/**/route.ts` server routes you have. If you want a custom homepage, pass `<CaspianRoot homepage={<MyHomepage />} />`. If you have custom client-side routes (a `/blog` page you wrote), they keep working — Next.js prefers a more specific route over the catch-all — or pass a `fallback` render prop to plug them into CaspianRoot.

### Added

- [src/components/caspian-root.tsx](src/components/caspian-root.tsx): new `<CaspianRoot>` top-level dispatcher + `CaspianRootProps`. Owns every library URL via pathname-based routing. Wraps `/admin/**` in `AdminGuard` + `AdminShell`, `/admin-preview` without, storefront paths in `LayoutShell`, and `/setup` + `/setup/init` in `AdminGuard` for the admin-gated wizard.
- [src/admin/admin-root.tsx](src/admin/admin-root.tsx): new `<AdminRoot>` — internal switch that `<CaspianRoot>` delegates to for `/admin/**`. Dispatches to every admin page component and delegates `/admin/settings/**` + `/admin/plugins/**` to their existing subshells. The v5 legacy-slug redirect from `/admin/settings/{shipping,payments,email-providers}` to `/admin/plugins/*` keeps working end-to-end.
- Public exports: `CaspianRoot`, `CaspianRootProps`, `AdminRoot`.

### Changed

- [scaffold/create.mjs](scaffold/create.mjs): the 20+ per-page client-route writes are replaced with one `write('src/app/[[...slug]]/page.tsx', …)` emitting `<CaspianRoot />`. Server API routes (`src/app/api/setup/write-env/route.ts`, `src/app/api/caspian-store/update/route.ts`) are unchanged. The `admin/layout.tsx` write is gone — CaspianRoot handles the wrapping.
- [examples/nextjs/app/](examples/nextjs/app/): the entire per-route tree is deleted and replaced by a single `[[...slug]]/page.tsx` catch-all. The example app now contains exactly three files: `layout.tsx`, `providers.tsx`, `[[...slug]]/page.tsx`.
- [scripts/check-scaffold-routes.mjs](scripts/check-scaffold-routes.mjs): repurposed. The nav-vs-scaffolder-vs-example three-way drift check is obsolete under a single catch-all. The script now verifies every href in `DEFAULT_ADMIN_NAV` has a matching `case '<head>':` in `AdminRoot`'s switch — the real invariant going forward. Same failure class as before (nav entry without dispatch) caught at the same CI step.
- [README.md](README.md), [INSTALL.md](INSTALL.md): the "Mount routes" section rewrites around the single-file install — no more 20-example per-page block.

### Tradeoff

All client-side pages ship in one Next.js route bundle rather than per-route chunks. For small-to-medium stores this is fine (total JS is similar, just delivered up front). If bundle size grows painful, `React.lazy` + `Suspense` inside `CaspianRoot` restores per-page splitting without changing the public contract.

---

## v6.0.0 — React 19 + Firebase 12 + tailwind-merge 3

Coordinated major-version dep upgrade. The library compiles cleanly against React 19, Firebase 12, and tailwind-merge 3 with no source changes — `peerDependencies` ranges are widened so consumers still on React 18 or Firebase 10/11 keep working. Also hardens `.gitignore` against accidental commits of Firebase service-account JSON files.

### Consumer action required on upgrade

To move your own app to the React 19 + Firebase 12 stack:

```bash
npm install react@^19 react-dom@^19 firebase@^12
npm install github:Caspian-Explorer/script-caspian-store#v6.0.0
```

Newly scaffolded sites (`npm create caspian-store@latest`) get React 19 + Firebase 12 automatically.

If you intentionally stay on React 18 or Firebase 10/11, no action is required — `peerDependencies` accept `react ^18 || ^19` and `firebase ^10 || ^11 || ^12`.

### Changed

- [package.json](package.json): bumped devDeps `react`/`react-dom` 18→19, `@types/react`/`@types/react-dom` 18→19, `firebase` 11→12; bumped runtime dep `tailwind-merge` 2→3; expanded `peerDependencies.firebase` to `^10 || ^11 || ^12`.
- [scaffold/create.mjs](scaffold/create.mjs): generated consumer-site `package.json` template now uses `react@^19`, `react-dom@^19`, `firebase@^12`, and matching `@types/react@^19` / `@types/react-dom@^19`.
- [examples/nextjs/package.json](examples/nextjs/package.json): bumped to match.
- [INSTALL.md](INSTALL.md): peer-deps line updated; added an "Upgrading from 5.x to 6.0" note with the exact commands.

### Security

- [.gitignore](.gitignore): added `service-account.json`, `serviceAccountKey*.json`, `credentials.json` so the [firebase/seed/grant-admin.mjs](firebase/seed/grant-admin.mjs) and [firebase/seed/seed.mjs](firebase/seed/seed.mjs) workflows can't accidentally commit a Firebase service-account JSON file (CRED007a). The repo had no committed secrets to begin with — this is forward-looking developer hygiene.

---

## v5.0.0 — Plugins get their own admin page (mod1197)

Shipping, payment, and email plugin management move out of Settings into a dedicated top-level admin area at `/admin/plugins`. Three changes land together:

**New sidebar item.** The main admin sidebar grows a `Plugins` entry between `Appearance` and `Settings`, backed by a new `<AdminPluginsShell>` catch-all component that mirrors the existing `<AdminSettingsShell>` pattern — two-column layout with its own sticky sub-nav (Shipping / Payments / Email providers). The three plugin admin page components themselves (`AdminShippingPluginsPage`, `AdminPaymentPluginsPage`, `AdminEmailPluginsPage`) are unchanged — they just mount under the new shell.

**Settings slims down.** `/admin/settings` now holds only General / Emails / Languages. The three plugin entries are removed from `SETTINGS_SUB_NAV` and the matching panel cases from `<AdminSettingsShell>`. Plugin management being a first-class area is a better fit for how shops actually grow — merchants install providers once at setup time, then live in Settings.

**Old URLs keep working for one release.** `<AdminSettingsShell>` still matches the legacy `shipping`, `payments`, `email-providers` slugs — but instead of rendering, it redirects to `/admin/plugins/*`. So bookmarks, email-to-admin deep links, and the onboarding-todo copy keep working until a future major removes the redirect.

### Consumer action required on upgrade

Consumers must add a new Next.js catch-all route to mount the new shell. Drop this file into your app:

```tsx
// src/app/admin/plugins/[[...slug]]/page.tsx
'use client';
import { AdminPluginsShell } from '@caspian-explorer/script-caspian-store';
export default function Page() { return <AdminPluginsShell />; }
```

Fresh scaffolds (`npm create caspian-store@latest`) already include it — this only affects stores created before v5.0.0.

If your app has hardcoded links to `/admin/settings/shipping`, `/admin/settings/payments`, or `/admin/settings/email-providers` (e.g. in docs, onboarding scripts, or helpdesk macros), update them to `/admin/plugins/*`. The old URLs keep redirecting for one release, then will 404.

### Added

- [src/admin/admin-plugins-shell.tsx](src/admin/admin-plugins-shell.tsx): new `<AdminPluginsShell>` component + `AdminPluginsShellProps`. Catch-all shell at `/admin/plugins/<slug>`; landing redirects to `/admin/plugins/shipping`. Mirrors `<AdminSettingsShell>`'s two-column layout.
- [src/admin/admin-shell.tsx](src/admin/admin-shell.tsx): new `PLUGINS_SUB_NAV` export (Shipping / Payments / Email providers leaves), new `Plugins` top-level entry in `DEFAULT_ADMIN_NAV`.
- [src/ui/icons.tsx](src/ui/icons.tsx): new `PlugIcon` stroke-based inline SVG used by the Plugins sidebar leaf.
- [src/i18n/messages.ts](src/i18n/messages.ts): new keys `admin.plugins.title`, `admin.plugins.subtitle`, `admin.plugins.categories`.
- Public exports: `AdminPluginsShell`, `AdminPluginsShellProps`, `PLUGINS_SUB_NAV`.
- Scaffolder + example app: new `app/admin/plugins/[[...slug]]/page.tsx` route.

### Changed

- [src/admin/admin-shell.tsx](src/admin/admin-shell.tsx): `SETTINGS_SUB_NAV` trimmed to `general`, `emails`, `languages` — the three plugin entries moved to `PLUGINS_SUB_NAV`.
- [src/admin/admin-settings-shell.tsx](src/admin/admin-settings-shell.tsx): the shell no longer renders shipping/payment/email-provider panels. If the URL still carries one of those legacy slugs, it issues a client-side redirect to the matching `/admin/plugins/*` URL.
- [src/components/checkout-page.tsx](src/components/checkout-page.tsx), [src/hooks/use-checkout.ts](src/hooks/use-checkout.ts), [src/services/admin-todo-service.ts](src/services/admin-todo-service.ts), [firebase/functions-email/src/email-sender.ts](firebase/functions-email/src/email-sender.ts): all admin-facing path strings and comments updated from `/admin/settings/{shipping,payments,email-providers}` to `/admin/plugins/*`.
- [README.md](README.md), [INSTALL.md](INSTALL.md), [scaffold/create.mjs](scaffold/create.mjs) (scaffolded README): admin route listings and setup instructions updated to the new paths.
- [scripts/check-scaffold-routes.mjs](scripts/check-scaffold-routes.mjs): recognizes `plugins` as a `[[...slug]]` catch-all alongside `settings` when validating example-app routes.

### Fixed

- **Account page: section panel didn't swap on click for some Next.js App Router setups.** The sidebar drove section changes through `nav.push('/account?section=orders')` and assumed the resulting query-string change would re-render `<AccountPage>`. That only works when the consumer's `useNavigation` adapter subscribes to query-string changes (via `useSearchParams()` or equivalent) — on adapters that don't, the URL updated but the panel stayed frozen. `AccountSidebar` now fires `onSelect(sectionId)` instead of navigating internally; `AccountPage` owns `active` as local state, updates it synchronously on click, and mirrors to the URL via `nav.push` afterwards for deep-linking. URL → state is reconciled from `useState` initializer + `nav.searchParams` effect + `popstate` listener, so the panel switches instantly regardless of how the adapter is wired. Breaking for consumers who imported `AccountSidebar` directly and passed `basePath`; the prop is gone — pass `onSelect` instead.

---

## v4.2.0 — Account page redesign: avatar dropdown, sidebar, wishlist section (mod1194)

The signed-in storefront experience gets a cohesive redesign. Three user-visible changes, one schema addition, and one helper utility — all additive. Closes mod1194.

**Header avatar dropdown.** The old header rendered a single-letter initials button that linked to `/account` and, for admins, a separate `[Admin]` button next to it. Both are replaced by a single avatar button that opens a dropdown with `My account`, `Orders`, `Admin` (admins only), and `Sign out`. The header's heart/wishlist icon is untouched. Structurally a close sibling of `AdminProfileMenu` so admins and shoppers get a consistent pattern on either side of the /admin boundary.

**Account page sidebar layout.** `<AccountPage>` was a long vertical scroll of cards — Profile Photo, Profile, Addresses, Password, Orders, Delete. It's now a two-column layout (240px sidebar + content pane) with five sections: **Profile**, **Orders**, **Addresses**, **Wishlist**, **Security**. Navigation is URL-driven (`?section=xxx`), so the header dropdown can link directly to a section and browser back/forward works. Below 720px the sidebar collapses to a horizontal scrollable tab strip. All existing `hide*` props still hide their respective sections; a new `hideWishlist` prop joins them.

**Wishlist section.** The library already had a wishlist engine (`useWishlist`, `WishlistButton`, `UserProfile.wishlist: string[]`) but no place for signed-in shoppers to actually see what they'd saved. The new `<WishlistPanel>` is mounted as the Wishlist sidebar section and renders saved products as a grid with per-item **Add to cart** and **Remove** actions. Empty state links to `/shop`.

**Inline editing gains phone.** `<ProfileCard>` now covers display name, email (read-only — changing it requires a password reset + re-auth, out of scope), and a new optional **phone** field. `UserProfile.phone?: string` is new and optional so existing Firestore docs continue to load without migration. The Firestore rules on `/users/{uid}` already allow the owner to write any non-role field, so no rules change is needed.

**Address book legacy handling.** The country field is already a `SearchableSelect` (v4.1.0). Two small follow-ups: (1) the address list now renders `countryName(addr.country)` instead of the raw value, so stored ISO codes like `"US"` display as `"United States"`; (2) when editing a legacy address whose country is a free-form name (e.g. `"United States"` from pre-v4.1.0), the Select now pre-selects the matching code via the new `findCountryCode()` helper, so saving converts the legacy string to a code without the user having to re-pick.

### No consumer action required

Additive release — existing installs pick up the new UI on the next build. All previous `AccountPage` props keep working; `StorefrontProfileMenu` and `WishlistPanel` are consumed automatically by `SiteHeader` and `AccountPage` and don't need to be wired in explicitly. If a consumer was passing a custom `userMenu` slot to `SiteHeader`, their slot still wins.

### Added

- [src/components/storefront-profile-menu.tsx](src/components/storefront-profile-menu.tsx): new `StorefrontProfileMenu` component — avatar trigger + dropdown with name/email header, `My account`, `Orders`, conditional `Admin`, `Sign out`. Mirrors `AdminProfileMenu`'s pattern using `DropdownMenu` + `Avatar`.
- [src/components/auth/account-sidebar.tsx](src/components/auth/account-sidebar.tsx): new `AccountSidebar` component + `AccountSection` type + `ACCOUNT_SECTION_ICONS` record. URL-driven section switching via `useCaspianNavigation().searchParams`.
- [src/components/auth/wishlist-panel.tsx](src/components/auth/wishlist-panel.tsx): new `WishlistPanel` component. Uses `useWishlist()` + `getProductsByIds()` + `useCart().addToCart()` to render a responsive grid with Add-to-cart + Remove actions.
- [src/utils/countries.ts](src/utils/countries.ts): new `findCountryCode(input)` helper — returns the ISO-2 code for a known code (case-normalized) or a case-insensitive name match, else `null`. Enables the address-book legacy-name prefill.
- [src/services/user-service.ts](src/services/user-service.ts): new `updatePhone(db, uid, phone)` and `updateProfileFields(db, uid, { displayName?, phone? })` functions.
- [src/types.ts](src/types.ts): new optional `phone?: string` on `UserProfile`.
- [src/ui/icons.tsx](src/ui/icons.tsx): added `HeartIcon`, `LockIcon`, `MapPinIcon` for the account sidebar.
- New i18n keys: `account.menu.{profile,orders,addresses,wishlist,security,viewStorefront,myAccount,admin,ariaLabel}`, `profile.{email.readonly,phone,phonePlaceholder}`, `wishlist.panel.{title,subtitle,empty,emptyCta,addToCart,remove,signInRequired}`.
- Public exports: `StorefrontProfileMenu`, `WishlistPanel`, `AccountSidebar`, `ACCOUNT_SECTION_ICONS`, `AccountSection`, `AccountSidebarItem`, `updatePhone`, `updateProfileFields`, `ALL_COUNTRIES`, `toCountryOptions`, `countryName`, `findCountryCode`.

### Changed

- [src/components/auth/account-page.tsx](src/components/auth/account-page.tsx): refactored from a vertical stack into a `.caspian-account-grid` layout with `AccountSidebar` on the left and section content on the right. Section is resolved from `?section=<id>`. New `hideWishlist` prop.
- [src/components/auth/profile-card.tsx](src/components/auth/profile-card.tsx): edit form now covers display name + email (read-only with "reset your password" hint) + optional phone. Save goes through new `updateProfileFields` to batch both mutable fields.
- [src/components/site-header.tsx](src/components/site-header.tsx): the signed-in branch's initials-button + inline Admin-link pair is replaced by `<StorefrontProfileMenu />`. Heart/wishlist and cart buttons are untouched.
- [src/components/auth/address-book.tsx](src/components/auth/address-book.tsx): the address list now routes through `countryName(addr.country)` so stored ISO codes render as English names. `openEdit` prefills via `findCountryCode` so legacy free-form name values map to the correct Select option.
- [src/styles/globals.css](src/styles/globals.css): added `.caspian-account-grid` (two-column desktop, single-column below 720px) and `.caspian-account-sidebar` hover/active + horizontal-scroll mobile rules.

---

## v4.1.1 — Settings sidebar matches Appearance "Categories" styling (mod1192)

The Settings shell has had its own sub-sidebar since v3.0.0, but the visuals (bordered white panel, icon+label rows, primary-colored active pill) didn't match the Appearance page's "Categories" menu right next to it in the main admin nav. Merchants who noticed the inconsistency asked for the Settings sub-nav to look and feel the same as Appearance's — single "CATEGORIES" header, plain labels, soft-grey active background.

This patch brings the Settings shell into visual parity with `<AdminAppearancePage>`. No route changes, no new settings, no new exports.

### No consumer action required

Admin-only UI polish; existing installs pick it up on the next build. Icons in `SETTINGS_SUB_NAV` are preserved (still used by the main admin sidebar via `AdminShell`) — the sub-sidebar just no longer renders them, matching Appearance.

### Changed

- [src/admin/admin-settings-shell.tsx](src/admin/admin-settings-shell.tsx): sub-sidebar restyled to mirror `AdminAppearancePage`'s category menu — added a "Categories" uppercase header, removed the bordered container, switched active background from `var(--caspian-primary)` to `rgba(0,0,0,0.06)`, dropped icon rendering (label-only items), routed the page title + subtitle through `useT()` instead of the hardcoded strings that had drifted from the i18n keys in [src/i18n/messages.ts](src/i18n/messages.ts). Closes mod1192.
- [src/i18n/messages.ts](src/i18n/messages.ts): added `'admin.settings.categories': 'Categories'` alongside the existing Settings sub-nav keys.

---

## v4.1.0 — Country dropdowns list all countries (mod1193)

Every country dropdown in the app now offers the full ISO 3166-1 alpha-2 list of 249 countries. Until now the library carried **three** hardcoded subsets — 90 for the admin country picker, 40 for the Localization default-country field, 6 for the unconfigured-store checkout fallback — and a merchant whose country wasn't in the 90-entry list was told in a source comment to *edit Firestore directly*. There is now one source of truth at [src/utils/countries.ts](src/utils/countries.ts) (`ALL_COUNTRIES`), and every dropdown routes through it.

The customer Address Book also moves from a freeform text input to a searchable dropdown. Existing freeform country values (e.g. `"United States"` typed by a user) keep rendering in the address list as-is; the next time the user edits the address they'll pick an ISO-2 code from the dropdown. No migration is required.

The Localization tab's default-country field and (already) the Store Address field now use `SearchableSelect` so 249 options stay usable — type "ger" to jump to Germany. Checkout keeps its native `<select>` and continues to respect `SiteSettings.supportedCountries` — the admin's shipping-destinations list is unchanged; only the *unconfigured-store* fallback grew from 6 countries to the full set.

### No consumer action required

Library-internal consolidation — existing installs pick up the full country list on the next rebuild with no code changes. Public exports `ISO_COUNTRIES` and `IsoCountry` still resolve (now re-exported from the new utility), so any consumer code that imports them keeps compiling.

### Fixed

- [src/admin/country-picker-dialog.tsx](src/admin/country-picker-dialog.tsx) no longer hardcodes a 90-entry regional subset — `ISO_COUNTRIES` now re-exports the full ISO 3166-1 alpha-2 set from [src/utils/countries.ts](src/utils/countries.ts). Admins managing supported-countries or shipping eligibility can now pick any country without editing Firestore manually.
- [src/admin/admin-site-settings-page.tsx](src/admin/admin-site-settings-page.tsx) Localization tab's 40-entry `COUNTRY_OPTIONS` is gone; the "Default country" field is a searchable combobox over all 249 countries.
- [src/components/checkout-page.tsx](src/components/checkout-page.tsx) `DEFAULT_COUNTRIES` fallback expanded from 6 to the full list. Stores that haven't configured `supportedCountries` no longer silently reject checkouts from unlisted countries.

### Changed

- [src/components/auth/address-book.tsx](src/components/auth/address-book.tsx): the Country field in the My Account address dialog is now a `SearchableSelect` backed by the full country list, replacing the freeform `<Input>`. New saves store ISO-2 codes; legacy freeform values continue to display untouched.

### Added

- [src/utils/countries.ts](src/utils/countries.ts): `ALL_COUNTRIES`, `toCountryOptions()`, and `countryName()` — single source of truth for country data across the library. Closes mod1193.
- New i18n key `addresses.countrySelect` → `"— Select country —"` for the address-book dropdown placeholder.

---

## v4.0.1 — Coming Soon admin auto-bypass (mod1191)

v2.7.0 shipped Coming Soon mode with a `SiteSettings.comingSoon.allowAdminPreview` flag and release notes promising that *"admins (or merchants sharing a preview link) bypass the splash"*. Only half of that ever worked — the shareable preview link (`?caspian-preview=1` → sessionStorage) was wired up, but signed-in admins were treated no differently from shoppers. When an admin enabled Coming Soon mode and reloaded the storefront, they saw their own splash and had to manually append the query string to preview the site they'd just gated.

Root cause: [src/components/layout-shell.tsx](src/components/layout-shell.tsx) never called `useAuth()`. The `isPreviewSession()` helper only knew about the URL + sessionStorage; it had no way to tell the current user was an admin. The "Let signed-in admins preview" checkbox in the Coming Soon admin section was effectively decorative.

Fix: `LayoutShell` now reads `userProfile` from the auth context and, when `allowAdminPreview` is true (the default), lets users with `role === 'admin'` through the gate automatically. Same source of truth as `<AdminGuard>` — no new admin signal invented. Unchecking "Let signed-in admins preview" now suppresses *both* the query-param bypass and the admin bypass, matching the name on the tin.

### No consumer action required

Client-side gate fix; existing installs pick it up on the next build. No API surface changes, no new settings, no migrations.

### Fixed

- [src/components/layout-shell.tsx](src/components/layout-shell.tsx): `LayoutShell` now imports `useAuth` and adds `userProfile?.role === 'admin'` as a bypass clause alongside the existing preview-session check, gated on `comingSoon.allowAdminPreview`. Closes mod1191.

---

## v4.0.0 — Theme preview escapes the admin shell (mod1190)

The theme-preview popup at `/admin/appearance/preview` was rendering *inside* the admin sidebar + topbar — the popup showed nav items like Dashboard/Catalog/Products wrapped around the storefront mockup, with the underlying appearance page peeking through from behind. Root cause: the preview lived under `/admin/**`, and the example (plus scaffolded) admin layout wraps every `/admin/*` route in `<AdminGuard>` + `<AdminShell>`. In Next.js App Router, a child segment cannot opt out of a parent layout, so the popup inherited the shell whether it wanted it or not.

Fix: relocate the preview route out from under `/admin/`. The new default path is `/admin-preview/appearance` — same component, same query-string, just outside the admin tree so the shell doesn't wrap it. The `previewPath` prop on `<AdminAppearancePage>` still overrides the default for consumers who mount the preview elsewhere.

### Consumer action required on upgrade

Existing consumers who scaffolded or hand-wired the preview at `/admin/appearance/preview` must **either**:

1. **Move to the new default** (recommended — clean popup chrome):

   ```bash
   # from your consumer site root
   mkdir -p src/app/admin-preview/appearance
   mv src/app/admin/appearance/preview/page.tsx src/app/admin-preview/appearance/page.tsx
   rmdir src/app/admin/appearance/preview
   ```

2. **Or keep the old URL** by passing the prop explicitly wherever you render `<AdminAppearancePage>`:

   ```diff
   - <AdminAppearancePage />
   + <AdminAppearancePage previewPath="/admin/appearance/preview" />
   ```

   Note: option 2 preserves the bug (preview wrapped in admin shell) — only use it if your custom admin layout does *not* wrap children in `<AdminShell>`.

Fresh `npm create caspian-store@latest` scaffolds get the new layout automatically. `create-caspian-store` sibling — no republish needed; the scaffolder CLI surface is unchanged.

### Fixed

- [src/admin/admin-appearance-page.tsx](src/admin/admin-appearance-page.tsx): `previewPath` default changed from `/admin/appearance/preview` to `/admin-preview/appearance`, so the popup opens a URL that doesn't inherit `app/admin/layout.tsx`. Closes mod1190.
- [scaffold/create.mjs](scaffold/create.mjs): removed `['appearance/preview', 'AdminAppearancePreviewPage']` from `adminRoutes` (which writes under `src/app/admin/`) and added a one-off `write('src/app/admin-preview/appearance/page.tsx', …)` so scaffolded sites generate the preview route in the new location.
- [examples/nextjs/app/admin-preview/appearance/page.tsx](examples/nextjs/app/admin-preview/appearance/page.tsx): new file; deleted the old [examples/nextjs/app/admin/appearance/preview/page.tsx](examples/nextjs/app/admin/appearance/preview/page.tsx). `cd examples/nextjs && npm run dev` now previews themes in a clean popup.
- [scripts/check-scaffold-routes.mjs](scripts/check-scaffold-routes.mjs): `SUBROUTE_ALLOWLIST` cleared (the old `/admin/appearance/preview` entry was only there because the preview lived under `/admin/`; the new path is outside that tree and not part of `adminRoutes`).

### Changed

- [src/admin/admin-appearance-preview-page.tsx](src/admin/admin-appearance-preview-page.tsx): JSDoc updated to explain why the route lives outside `/admin/**`.

---

## v3.1.1 — Fix admin route 404s in examples/nextjs (mod1189)

The in-repo example app at [examples/nextjs/](examples/nextjs/) had drifted from the canonical scaffolder route list ([scaffold/create.mjs](scaffold/create.mjs)) since the v3.0 sidebar redesign. Nine `/admin/*` sidebar links 404'd when running `cd examples/nextjs && npm run dev` — most visibly `/admin/users`, the one that triggered the bug report. Two further example route files were stale: `app/admin/search-terms/page.tsx` imported `AdminSearchTermsPage`, removed in v3.0.0, breaking `next build` outright; and `app/admin/settings/page.tsx` rendered the pre-v3 `ScriptSettingsPage` instead of the new `AdminSettingsShell` catch-all.

This patch syncs the example tree to the scaffolder and extends the existing drift-check script to catch the next regression of this shape.

### No consumer action required

Example-app-only fix. The shipped tarball, scaffolder, sidebar, and library exports are unchanged. Existing scaffolded sites are unaffected.

### Fixed

- [examples/nextjs/](examples/nextjs/): added the 9 admin route files the v3.0 sidebar links to — `users`, `subscribers`, `faqs`, `journal`, `pages`, `promo-codes`, `categories`, `collections`, `about`. Closes mod1189.
- [examples/nextjs/app/admin/search-terms/](examples/nextjs/app/admin/search-terms/): removed; the export it imported was deleted in v3.0.0 and the search-terms surface now lives on the Dashboard.
- [examples/nextjs/app/admin/settings/](examples/nextjs/app/admin/settings/): replaced the pre-v3 `page.tsx` with `[[...slug]]/page.tsx` rendering `AdminSettingsShell`, matching the scaffolder.

### Changed

- [scripts/check-scaffold-routes.mjs](scripts/check-scaffold-routes.mjs) now also verifies that every entry in `adminRoutes` has a corresponding `app/admin/.../page.tsx` file under `examples/nextjs/`. The next "added a sidebar link, forgot the example route" PR fails the check instead of waiting for a 404 report.

---

## v3.1.0 — Fix search results stuck on previous query (#43 / mod1183)

When a visitor was already on `/search?q=foo` and submitted a new term from the
header, the URL updated to `/search?q=bar` but the results panel kept showing
`foo`. Root cause: `<SearchResultsPage>` read `window.location.search` inside
a `useEffect` that only depended on the optional `query` prop, so after the
initial mount it had no way to notice client-side navigation in a Next.js
App Router. `router.push()` is a soft navigation; `window.location` is not
a reactive source.

Fix: extend the `CaspianNavigation` adapter contract with an optional
**reactive** `searchParams: URLSearchParams` field. In the Next.js adapter it's
populated from `useSearchParams()`, so every URL change re-renders subscribing
components. `<SearchResultsPage>` now reads the query from the adapter and
derives it during render — no more stale effect.

### Consumer action required on upgrade

**Only Next.js (or other SPA-router) consumers who maintain a custom
`useNavigation` adapter.** Default-adapter consumers and scaffolder users are
unaffected (the scaffolder generates the updated adapter automatically).

Add a single line to your `useNavigation` adapter, e.g. in
`src/lib/caspian-adapters.tsx`:

```diff
- import { useRouter, usePathname } from 'next/navigation';
+ import { useRouter, usePathname, useSearchParams } from 'next/navigation';

  export function useCaspianNextNavigation() {
    const router = useRouter();
    const pathname = usePathname();
+   const searchParams = useSearchParams();
    return {
      pathname: pathname ?? '/',
+     searchParams: new URLSearchParams(searchParams?.toString() ?? ''),
      push: (href) => router.push(href),
      replace: (href) => router.replace(href),
      back: () => router.back(),
    };
  }
```

Skip this step and the library still compiles and runs — but `/search` will
retain the v3.0.x bug.

Next.js may warn that `useSearchParams()` forces the closest `<Suspense>`
boundary (deopt-to-client-rendering). If you hit a build warning, wrap
`<Providers>` or the consuming page tree in `<Suspense fallback={null}>`.
This does not happen on `"use client"` pages, which is the scaffold's
default.

### Fixed

- `<SearchResultsPage>` ([src/components/search-results-page.tsx](src/components/search-results-page.tsx)) now re-runs the filter whenever the URL's `?q=` changes, not just on first mount. Closes [#43](https://github.com/Caspian-Explorer/script-caspian-store/issues/43).

### Added

- `CaspianNavigation.searchParams?: URLSearchParams` on the adapter contract ([src/primitives/types.ts](src/primitives/types.ts)). Optional for backwards compatibility; real framework adapters must populate it from a reactive source (e.g. `useSearchParams()` in Next.js) for URL-driven components to react to client-side navigation.
- Default navigation adapter ([src/primitives/navigation.tsx](src/primitives/navigation.tsx)) now populates `searchParams` from `window.location.search`.

### Changed

- Scaffolder ([scaffold/create.mjs](scaffold/create.mjs)) generates the updated `useCaspianNextNavigation()` — new sites pick up the fix automatically.
- Next.js example app ([examples/nextjs/app/providers.tsx](examples/nextjs/app/providers.tsx)) updated to match.

---

## v3.0.0 — Admin sidebar redesign · Self-healing error logging · Email plugin catalog

Three features ship as one breaking release:

1. **Admin sidebar redesign (#41 / mod1181).** The flat 23-item sidebar is replaced with a grouped, icon-aware, collapsible tree. Collapsing the sidebar now leaves a 56px icon rail visible instead of hiding the nav entirely. Settings moves from a single page into a sub-sidebared shell hosting General / Shipping / Payments / Email providers / Emails / Languages. Todos, Notifications, and Search terms are folded into the Dashboard as collapsible sections; their standalone pages and routes are removed.

2. **Self-healing error logging (mod1182).** Every runtime error on an installation — client React errors, service-layer catches, Cloud Functions exceptions — is captured to a new `errorLogs` Firestore collection and surfaced on `/admin/about` with a one-click "Report upstream" button that opens a pre-filled GitHub issue against this repo. Messages are redacted (emails, bearer tokens, Firebase API keys, query-string values) before write; 24h dedup bumps a `seenCount` instead of duplicating.

3. **Email provider plugin catalog.** Email sending becomes a first-class plugin catalog (mirroring shipping + payments), adds **Brevo** alongside **SendGrid**, and splits the email Cloud Functions into a new `caspian-email` codebase with zero `defineSecret` declarations — provider API keys live in Firestore (`emailPluginInstalls`, admin-only read) and are configured through `/admin/settings/email-providers`. Closes the admin-bootstrap chicken-and-egg the v1.16 Stripe split was meant to close.

All three are bundled because (2) and (3) were already in the working tree when (1) landed and an intermediate tag followed by a breaking v3 a day later would have been noisier than one combined release. The CHANGELOG below is split by feature; skim the section(s) that apply to you.

### Breaking changes (mod1181 — admin sidebar)

Eight admin routes are **removed entirely**. Existing bookmarks to these paths 404:

| Removed route | Replacement |
|---|---|
| `/admin/shipping-plugins` | `/admin/settings/shipping` |
| `/admin/payment-plugins` | `/admin/settings/payments` |
| `/admin/email-plugins` | `/admin/settings/email-providers` |
| `/admin/emails` | `/admin/settings/emails` |
| `/admin/languages` | `/admin/settings/languages` |
| `/admin/todos` | `/admin` (Todo section on Dashboard) |
| `/admin/notifications` | `/admin#notifications` (Notifications section on Dashboard) |
| `/admin/search-terms` | `/admin#search-terms` (Search terms section on Dashboard) |

Public exports removed: `AdminTodoPage`, `AdminNotificationsPage`, `AdminSearchTermsPage` and their `*Props` types. The underlying data services (todo, notifications, search-terms) are unchanged and still exported — only the page-shell components are gone.

### Added — admin sidebar (mod1181)

- **Grouped navigation** in [src/admin/admin-shell.tsx](src/admin/admin-shell.tsx). New `AdminNavGroup` type with per-group chevron, left-indented children, and a subtle vertical rule connecting them. Four default groups — Catalog (Products + Categories + Collections + Promo codes), People (Users + Subscribers), Sales (Orders + Reviews), Content (Pages + FAQs + Journal). Group expand/collapse state persists in `localStorage` under `caspian:admin:nav:groups`; the group containing the active route auto-expands on hard refresh.
- **Flat icon rail** when the sidebar is collapsed. Every leaf renders as an icon-only link with a native `title` tooltip; groups are separated by thin horizontal dividers. Width toggles between 240px (open) and 56px (collapsed). Replaces the pre-v3 "collapse = hide sidebar entirely" behavior.
- **`<AdminSettingsShell>`** ([src/admin/admin-settings-shell.tsx](src/admin/admin-settings-shell.tsx)) — URL-driven sub-sidebar modeled on `<AdminAppearancePage>`. Mounts at `/admin/settings/[[...slug]]` and switches the right-hand panel by slug. `/admin/settings` with no slug redirects to `/admin/settings/general`. Sub-pages: General, Shipping, Payments, Email providers, Emails, Languages.
- **Dashboard sections** ([src/admin/dashboard-sections/](src/admin/dashboard-sections/)) — `<DashboardTodoSection>`, `<DashboardNotificationsSection>`, `<DashboardSearchTermsSection>` + shared `<DashboardSection>` wrapper. Each is collapsible with per-section `localStorage` persistence. Notifications auto-open when unread > 0; Todos auto-open when pending > 0; Search terms default to closed. The bell's "View all" link now opens `/admin#notifications` and auto-expands that section.
- **24 new stroke-SVG admin icons** in [src/ui/icons.tsx](src/ui/icons.tsx) — DashboardIcon, PackageIcon, TagIcon, FolderIcon, LayersIcon, TicketIcon, UsersIcon, MailIcon, ShoppingCartIcon, ReceiptIcon, StarIcon, FileTextIcon, FileIcon, BookOpenIcon, PaletteIcon, SettingsIcon, TruckIcon, CreditCardIcon, AtSignIcon, InboxIcon, GlobeIcon, SlidersIcon, InfoIcon, ChevronRightIcon. Hand-rolled (no icon-library dep) following the existing `svgDefaults` helper.
- **Default link styling** in [src/styles/globals.css](src/styles/globals.css) — `.caspian-root a` gets `color: var(--caspian-primary)`, no underline, a subtle `underline-on-hover` with 3px offset, and a `:focus-visible` outline. Scoped to `.caspian-root` so the admin shell's inline styles are unaffected.
- **i18n keys** — `admin.nav.groups.{catalog,people,sales,content}`, `admin.dashboard.{todos,notifications,searchTerms}.*`, `admin.settings.*` in [src/i18n/messages.ts](src/i18n/messages.ts).
- **New public exports:** `AdminSettingsShell`, `SETTINGS_SUB_NAV`, `AdminNavLeaf`, `AdminNavGroup`, `AdminSettingsShellProps`.

### Added — self-healing error logging (mod1182)

- **Client capture:** new `<ErrorBoundary>` mounted outermost in the provider tree, plus `window.onerror` / `unhandledrejection` handlers. Exported as a top-level component.
- **Service-layer capture:** `reportServiceError(db, scope, error)` in [src/services/error-log-service.ts](src/services/error-log-service.ts), wired into high-traffic catches in auth-context, cart-context, admin-dashboard, admin-contacts-list, admin-emails-page. Remaining `[caspian-store] console.error` sites left for a follow-up sweep.
- **Cloud Functions capture:** `reportFunctionError()` in each of the three codebases (`caspian-admin`, `caspian-stripe`, `caspian-email`) writing via the Admin SDK. Wired into email-sender, stripe-webhook, stripe-session, and retention-cleanup error paths.
- **Firestore schema:** new `errorLogs/{autoId}` collection ([src/firebase/collections.ts](src/firebase/collections.ts)). Rules gate create with required scalar fields + capped lengths + `source` enum + `seenCount == 1`; admin-only read/update/delete. Composite index `(origin, message, timestamp desc)` for the 24h dedup lookup. 7 new rules-behavior tests in [firebase/rules.test.mjs](firebase/rules.test.mjs).
- **Redaction** ([src/utils/redact-error.ts](src/utils/redact-error.ts)) — strips emails, bearer tokens, Firebase AIza keys, query-string values; caps `message` ≤ 2000 and `stack` ≤ 4000 chars before write. Reused by `buildUpstreamIssueUrl()`, which also clamps the final URL ≤ 6000 chars to stay under GitHub's practical limit.
- **Admin triage surface** at `/admin/about` — lists recent errors with origin, source, message, stack, `seenCount`, and two one-click actions: "Dismiss" (admin-only delete) and "Report upstream" (opens pre-filled GitHub issue).
- **Retention:** optional `retainErrorLogsDays` field on `SiteSettings.privacy`; the existing daily `runRetentionCleanup` schedule trims expired docs. Admin Settings → General surfaces the field in the existing privacy block.
- **New public exports:** `ErrorBoundary`, `logError`, `listRecentErrors`, `dismissError`, `reportServiceError`, `buildUpstreamIssueUrl`, `redactError`, `redactString`, `ErrorLog`, `ErrorLogSource`.

### Added — email provider plugin catalog

- **Email plugin catalog** at [src/email/](src/email/) — `EMAIL_PLUGIN_CATALOG`, `EMAIL_PLUGIN_IDS`, `getEmailPlugin`, plus `SENDGRID_PLUGIN` and `BREVO_PLUGIN`. Each plugin is a metadata record (`{ id, name, description, defaultConfig, validateConfig }`) that the admin UI browses and the runtime resolves against a per-store install. New providers land by PR into the catalog.
- **`<AdminEmailPluginsPage>`** ([src/admin/admin-email-plugins-page.tsx](src/admin/admin-email-plugins-page.tsx)) — browse-and-install UI mirroring `<AdminPaymentPluginsPage>`. One configuration field per install (API key) + display label + order. New installs start disabled — the admin explicitly enables after validating. In v3.0.0 this renders inside `<AdminSettingsShell>` at `/admin/settings/email-providers`.
- **`EmailPluginInstall` Firestore type** + `emailPluginInstalls` collection ([src/types.ts](src/types.ts), [src/firebase/collections.ts](src/firebase/collections.ts)). Admin-only read AND write in [firebase/firestore.rules](firebase/firestore.rules) — the API key lives in `config`, unlike shipping/payment installs which are publicly readable. Cloud Functions read via the Admin SDK, which bypasses rules.
- **Email-plugin service** ([src/services/email-plugin-service.ts](src/services/email-plugin-service.ts)) — `listEmailPluginInstalls`, `createEmailPluginInstall`, `updateEmailPluginInstall`, `deleteEmailPluginInstall` + `EmailPluginInstallWriteInput`.
- **New `caspian-email` Cloud Functions codebase** at [firebase/functions-email/](firebase/functions-email/) — `runEmailOnOrderCreate`, `runEmailOnOrderUpdate`, `runEmailOnContactCreate`, `sendTestEmail`. **No `defineSecret` calls** — the dispatcher in `email-sender.ts` loads the first enabled `emailPluginInstalls` doc from Firestore at runtime, resolves SendGrid or Brevo, and delegates. `firebase deploy --only functions:caspian-email` runs with zero secrets configured; it's just dormant until an admin installs a provider.
- **Brevo SDK integration** — `@getbrevo/brevo` dependency in `functions-email`; `sendViaBrevo()` in [firebase/functions-email/src/email-sender.ts](firebase/functions-email/src/email-sender.ts) maps the internal `SendableMessage` to Brevo's `SendSmtpEmail` shape.
- **Scaffolder `--with-email` flag** in [scaffold/create.mjs](scaffold/create.mjs) — mirrors `--with-stripe`. When passed, copies `functions-email/` + adds the `caspian-email` codebase entry to `firebase.json`.
- **Scaffolder-vs-nav CI smoke** — [scripts/check-scaffold-routes.mjs](scripts/check-scaffold-routes.mjs) + [.github/workflows/scaffold-routes-smoke.yml](.github/workflows/scaffold-routes-smoke.yml). Regex-diffs `DEFAULT_ADMIN_NAV` hrefs against the scaffolder's `adminRoutes` array on every PR touching either file. Blocks the v2.4 / v2.11 / v2.12 class of regression where a nav entry shipped without a matching scaffolder route.
- **i18n keys** — `admin.emailPlugins.*` in [src/i18n/messages.ts](src/i18n/messages.ts).

### Changed

- **`<AdminNotificationsBell>`** ([src/admin/admin-notifications-bell.tsx](src/admin/admin-notifications-bell.tsx)) — default `viewAllHref` changes from `/admin/notifications` to `/admin#notifications` since the standalone notifications page is gone.
- **`<AdminDashboard>`** now renders three new collapsible sections below the stat-card grid.
- **Scaffolder** ([scaffold/create.mjs](scaffold/create.mjs)) — removes eight old admin routes from `adminRoutes` and replaces the single `settings` entry with a `[[...slug]]` catch-all that mounts `<AdminSettingsShell>`. Updates consumer README to document the new route layout.
- **`functions-admin` returns to zero-secrets** ([firebase/functions-admin/](firebase/functions-admin/)). Drops `@sendgrid/mail`, drops the three email triggers + `sendTestEmail` re-export, drops the renderer + sender. Remaining surface: `onUserCreate`, `claimAdmin`, `runRetentionCleanup`.
- **`firebase.json`** gains the `caspian-email` codebase entry (between `caspian-admin` and `caspian-stripe`).
- **Consumer `package.json` scripts** — scaffolds gain `deploy:email` alongside `deploy:admin` and `deploy:stripe`.

### Removed

- `AdminTodoPage`, `AdminNotificationsPage`, `AdminSearchTermsPage` and their `*Props` type exports.
- Scaffolder route templates for `/admin/todos`, `/admin/notifications`, `/admin/search-terms`, `/admin/shipping-plugins`, `/admin/payment-plugins`, `/admin/email-plugins`, `/admin/emails`, `/admin/languages`.

### Consumer action required on upgrade

Upgrade is a four-part operation:

**(1) Bump the dep + rebuild**

```bash
npm install github:Caspian-Explorer/script-caspian-store#v3.0.0
rm -rf .next
```

**(2) Regenerate the `src/app/admin/` tree for the new sidebar layout.** The simplest path is to delete your admin/ directory and re-run the scaffolder in a scratch dir to copy over the v3 route files. The surgical path:

```bash
# Remove the eight dead route files + their now-empty dirs:
for d in todos notifications search-terms shipping-plugins payment-plugins email-plugins emails languages; do
  rm -rf "src/app/admin/$d"
done

# Replace the single /admin/settings route with the catch-all shell:
rm -f src/app/admin/settings/page.tsx
mkdir -p 'src/app/admin/settings/[[...slug]]'
cat > 'src/app/admin/settings/[[...slug]]/page.tsx' <<'EOF'
'use client';
import { AdminSettingsShell } from '@caspian-explorer/script-caspian-store';
export default function Page() { return <AdminSettingsShell />; }
EOF
```

If you linked to any of the removed `/admin/*` URLs from your own code (custom header items, outbound emails, help docs), update them to the `/admin/settings/*` or `/admin#anchor` equivalents from the table above.

**(3) Pull + deploy the updated Firestore rules and indexes** (picks up `errorLogs` + admin-only `emailPluginInstalls` + new composite indexes):

```bash
cp node_modules/@caspian-explorer/script-caspian-store/firebase/firestore.rules .
cp node_modules/@caspian-explorer/script-caspian-store/firebase/firestore.indexes.json .
firebase deploy --only firestore:rules,firestore:indexes
```

**(4) Handle the email codebase split.** If you currently use SendGrid via the pre-v3 `functions-admin` path:

```bash
# 4a. Pull the new functions-email/ tree out of the installed library.
cp -r node_modules/@caspian-explorer/script-caspian-store/firebase/functions-email .
printf 'node_modules\nlib/\n' > functions-email/.gitignore

# 4b. Register the new codebase in firebase.json — add between caspian-admin and caspian-stripe:
#    { "source": "functions-email", "codebase": "caspian-email",
#      "runtime": "nodejs22",
#      "predeploy": ["npm --prefix \"$RESOURCE_DIR\" run build"] }

# 4c. Rebuild functions-admin (email deps are gone), install + deploy both codebases:
cd functions-admin && npm install && cd ..
cd functions-email && npm install && cd ..
firebase deploy --only functions:caspian-admin,functions:caspian-email

# 4d. Open /admin/settings/email-providers, install SendGrid or Brevo, paste the API key,
#     save, click Enable. Order + contact emails resume on the next trigger.

# 4e. (Optional) delete the old secret if nothing else reads it:
firebase functions:secrets:destroy SENDGRID_API_KEY
```

If you don't use email at all: skip step 4 — step 3 alone restores `functions:caspian-admin` to zero-secrets deploys.

The error-logging feature (mod1182) activates automatically once the Firestore rules and indexes from step 3 are deployed. Visit `/admin/about` to see captured errors; set `SiteSettings.privacy.retainErrorLogsDays` from Admin → Settings → General if you want automatic pruning.

## v2.14.1 — Security: npm audit remediation for Cloud Functions

Fixes all `@tootallnate/once <3.0.1` (GHSA-vpq2-c234-7xj6) and `uuid <14.0.0` (GHSA-w5hq-g745-h8pq) findings surfaced by `npm audit` in the Cloud Functions packages shipped with this library. These vulnerabilities enter via `firebase-admin`'s transitive `@google-cloud/storage → teeny-request → http-proxy-agent → @tootallnate/once` chain and are resolved without changing the top-level `firebase-admin ^13.0.0` pin — npm `overrides` in each `functions-*/package.json` force safe versions of the transitive deps.

### Warning — do not run `npm audit fix --force`

On this dependency tree `--force` downgrades `firebase-admin` to **10.1.0** (well below the `^13.0.0` pin) and re-introduces 5 additional critical/high CVEs in `dicer`, `jsonwebtoken`, `protobufjs`, `@grpc/grpc-js`, and old `@google-cloud/firestore`. If any consumer has already run this, recovery is: restore `firebase-admin: "^13.0.0"` in their `functions-*/package.json`, delete `package-lock.json`, and re-run `npm install`.

### Fixed

- **`firebase/functions-admin`** (0.3.0 → 0.3.1) — `@tootallnate/once`, `uuid`, `http-proxy-agent` forced to safe versions via `overrides`. `npm audit` now reports 0 vulnerabilities.
- **`firebase/functions-stripe`** (0.1.0 → 0.1.1) — same `overrides` block. `npm audit` now reports 0 vulnerabilities.

### Consumer action required on upgrade

Consumers who have deployed these Cloud Functions need to pick up the new `overrides` and regenerate their lock files:

```bash
# 1. Update the library
npm install @caspian-explorer/script-caspian-store@latest

# 2. For each functions directory your project uses, sync the new package.json
#    (the overrides block and the version bump) from the library tarball.
for d in functions-admin functions-stripe; do
  cp "node_modules/@caspian-explorer/script-caspian-store/firebase/$d/package.json" "firebase/$d/package.json"
  (cd "firebase/$d" && rm -f package-lock.json && rm -rf node_modules && npm install && npm audit)
done

# 3. Redeploy
firebase deploy --only functions
```

Expected `npm audit` result: `found 0 vulnerabilities` in both directories.

**Do NOT run `npm audit fix --force`** — see warning above.

## v2.14.0 — Collections storefront

Fixes a scaffolder bug that had `/collections` rendering a full-width product list titled "Shop" on every generated site — admins could create `productCollections` in the dashboard, but shoppers never saw them. Ships a proper storefront surface: a discovery page that lists the admin-curated collections and a per-collection detail page with hero + products. Also introduces a dedicated `/shop` route for the full catalog so the header nav's "Shop" link stops bouncing visitors to the homepage.

### Added

- **`<CollectionsPage>`** ([src/components/collections-page.tsx](src/components/collections-page.tsx)) — grid of active collections (image, name, description). Links each card to `/collections/{slug}` by default; override via `getCollectionHref`. Skeleton loading + empty state + i18n fall-throughs for title/subtitle/empty message.
- **`<CollectionDetailPage>`** ([src/components/collection-detail-page.tsx](src/components/collection-detail-page.tsx)) — hero (image + name + description) + `<ProductGrid>` for the collection's products. Honors `SiteSettings.inventory` and `SiteSettings.taxConfig` the same way `<ProductListPage>` does. Renders a not-found message when the slug doesn't resolve to an active collection.
- **`getProductCollectionBySlug(db, slug)`** ([src/services/product-collection-service.ts](src/services/product-collection-service.ts)) — returns the active collection matching `slug`, or `null`. Composite index on `(slug asc, isActive asc)` added to [firebase/firestore.indexes.json](firebase/firestore.indexes.json).
- **Scaffolder routes** ([scaffold/create.mjs](scaffold/create.mjs)) — new `/shop` (full product catalog) and `/collections/[slug]` (per-collection detail). The existing `/collections` slot now renders `<CollectionsPage>` instead of `<ProductListPage title="Shop" />`.
- **i18n keys** — `collections.subtitle`, `collections.empty`, `collectionDetail.notFound`, `collectionDetail.emptyProducts` in [src/i18n/messages.ts](src/i18n/messages.ts).

### Changed

- **Default header nav** ([src/components/site-header.tsx](src/components/site-header.tsx)) — `DEFAULT_NAV`'s "Shop" item points to `/shop` (was `/`). Consumers who pass a custom `nav` prop to `<SiteHeader>` are unaffected.

### Consumer action required on upgrade

Existing consumer sites (a) replace the buggy `/collections` route file, (b) add two new route files, and (c) redeploy Firestore indexes so the new `getProductCollectionBySlug` query doesn't fail at runtime:

```bash
# 1. Replace src/app/collections/page.tsx
cat > src/app/collections/page.tsx <<'EOF'
'use client';
import { CollectionsPage } from '@caspian-explorer/script-caspian-store';
export default function Page() { return <CollectionsPage />; }
EOF

# 2. Create src/app/collections/[slug]/page.tsx
mkdir -p 'src/app/collections/[slug]'
cat > 'src/app/collections/[slug]/page.tsx' <<'EOF'
'use client';
import { useParams } from 'next/navigation';
import { CollectionDetailPage } from '@caspian-explorer/script-caspian-store';
export default function Page() {
  const { slug } = useParams<{ slug: string }>();
  return <CollectionDetailPage slug={slug} />;
}
EOF

# 3. Create src/app/shop/page.tsx
mkdir -p src/app/shop
cat > src/app/shop/page.tsx <<'EOF'
'use client';
import { ProductListPage } from '@caspian-explorer/script-caspian-store';
export default function Page() { return <ProductListPage title="Shop" />; }
EOF

# 4. Pull + deploy the updated composite indexes.
cp node_modules/@caspian-explorer/script-caspian-store/firebase/firestore.indexes.json .
firebase deploy --only firestore:indexes
```

If you passed a custom `nav` prop to `<SiteHeader>` with `{ href: '/', label: 'Shop' }`, update it to `{ href: '/shop', label: 'Shop' }` so the link lands on the new product-catalog route.

## v2.13.0 — Public contact page + admin inbox

Adds a built-in `/contact` page so visitors can reach the store owner. Submissions land in a new Firestore `contacts` collection, surface as a tabbed **Admin > Users > Contacts** inbox, light up the admin notifications bell, and fire a Cloud Function that sends an admin-notify email and an auto-reply to the submitter via the existing v2.11 SendGrid pipeline. A **Recent contacts** section on the admin dashboard lists the latest submissions with snippets and relative timestamps.

### Added

- **`<ContactPage>`** ([src/components/contact/contact-page.tsx](src/components/contact/contact-page.tsx)) — public submission form (name, email, optional subject, message). Unauthenticated visitors can submit; signed-in users get name/email pre-filled. Ships an off-screen honeypot field for basic spam protection and hard caps message length at 5000 chars. The form writes `contacts/{id}` via `createContact()` and shows a success panel in place of the form on submit.
- **Firestore `contacts` collection** — new domain type [`ContactSubmission`](src/types.ts) with CRM-style `ContactStatus = 'new' | 'read' | 'archived'` (distinct from the `pending|approved|rejected` moderation triad, since contacts are never shown publicly). Collection ref added to [src/firebase/collections.ts](src/firebase/collections.ts:28).
- **Contact service** ([src/services/contact-service.ts](src/services/contact-service.ts)) — `createContact`, `listAllContacts`, `listRecentContacts`, `countNewContacts` (uses `getCountFromServer`), `setContactStatus`, `deleteContact`. Follows the existing service signature: `db: Firestore` first, returns plain domain types.
- **`<AdminUsersPage>`** ([src/admin/admin-users-page.tsx](src/admin/admin-users-page.tsx)) — new admin parent at `/admin/users` with a `Tabs` scaffold. First tab is **Contacts**; additional tabs can slot in without a nav re-org. Registered in `DEFAULT_ADMIN_NAV` between Notifications and Products.
- **`<AdminContactsList>`** ([src/admin/admin-contacts-list.tsx](src/admin/admin-contacts-list.tsx)) — the inbox UI: table with status filter (all / new / read / archived), row actions (Mark read, Mark unread, Archive, Unarchive, Delete), and a detail dialog that shows the full message plus a copy-email button. Opening the dialog auto-promotes `new → read`.
- **Dashboard "Recent contacts" section** — new section below the existing count-card grid. Shows the last 5 submissions with name + email, 1-line snippet, relative timestamp, and a "new" status pill. Empty state and `View all →` deep-link to `/admin/users` included.
- **Admin notifications bell** — new `'new-contacts'` notification kind in [src/hooks/use-admin-notifications.ts](src/hooks/use-admin-notifications.ts). The bell badge now rolls up the count of `status == 'new'` contact submissions alongside pending reviews/questions. A matching `KIND_LABEL` entry (`Inbox`) is added in [src/admin/admin-notifications-page.tsx](src/admin/admin-notifications-page.tsx).
- **Transactional emails** — two new `EmailTemplateKey` entries: `new_contact_admin` (admin audience) and `contact_autoreply` (customer audience). Default subject/heading/body are registered in [src/services/email-service.ts](src/services/email-service.ts); `EMAIL_TEMPLATE_AUDIENCE` and `EMAIL_TEMPLATE_LABELS` are extended. The email renderer gains four new optional placeholders — `{contact_name}`, `{contact_email}`, `{contact_subject}`, `{contact_message}` — substituted by the new trigger.
- **`runEmailOnContactCreate` Cloud Function** ([firebase/functions-admin/src/contact-email-triggers.ts](firebase/functions-admin/src/contact-email-triggers.ts)) — Firestore `onDocumentCreated` trigger on `contacts/{id}`. Sends `new_contact_admin` to the template's `recipients[]` (falling back to `SiteSettings.contactEmail`, same chain as the order-admin emails) with `replyTo` set to the submitter for one-click replies; then sends `contact_autoreply` to the submitter's own email. Registered from [firebase/functions-admin/src/index.ts](firebase/functions-admin/src/index.ts) as `caspian-admin:runEmailOnContactCreate`. `firebase/functions-admin/package.json` bumped `0.2.0 → 0.3.0`.
- **Firestore rule for `contacts/{id}`** — `allow create: if` length + shape clamps (`name` ≤ 120, `email` ≤ 200, `subject` ≤ 200, `message` ≤ 5000, `status == 'new'`); admin-only read/update/delete. Composite index on `(status asc, createdAt desc)` added to [firebase/firestore.indexes.json](firebase/firestore.indexes.json).
- **Rules-behavior tests** — 7 new cases in [firebase/rules.test.mjs](firebase/rules.test.mjs) exercising public-create, oversize/empty-name rejection, non-admin read denial, admin read/update success.
- **i18n keys** — `contact.*`, `admin.users.*`, `admin.contacts.*`, `admin.dashboard.recentContacts*` (~30 new keys) in [src/i18n/messages.ts](src/i18n/messages.ts).
- **Scaffolder** ([scaffold/create.mjs](scaffold/create.mjs)) — new `/contact` one-liner using `<ContactPage>`; new `/admin/users` admin route mounting `<AdminUsersPage>`. The legacy `PageContentView`-backed `/contact` entry is removed so the scaffolder no longer overwrites the new form.

### Consumer action required on upgrade

Existing consumer sites need to (a) deploy the new Firestore rule + index, (b) mount the two new routes, and (c) redeploy the admin Cloud Functions so `runEmailOnContactCreate` goes live:

```bash
# 1. Pull updated rules + indexes from the package and deploy them.
cp node_modules/@caspian-explorer/script-caspian-store/firebase/firestore.rules .
cp node_modules/@caspian-explorer/script-caspian-store/firebase/firestore.indexes.json .
firebase deploy --only firestore:rules,firestore:indexes

# 2. Redeploy the admin functions group so the new contact-email trigger ships.
firebase deploy --only functions:caspian-admin
```

Then add the two pages to your app (Next.js App Router shown; other routers mount equivalently):

```tsx
// src/app/contact/page.tsx
'use client';
import { ContactPage } from '@caspian-explorer/script-caspian-store';
export default function Page() { return <ContactPage />; }

// src/app/admin/users/page.tsx
'use client';
import { AdminUsersPage } from '@caspian-explorer/script-caspian-store';
export default function Page() { return <AdminUsersPage />; }
```

Optional: open **Admin > Emails** to customize the default `new_contact_admin` and `contact_autoreply` template copy — the trigger ships with sensible defaults so no action is required for emails to work out of the box.

---

## v2.12.1 — Self-update project-id remediation

Fixes a confusing failure mode in the `/admin/about` "Update to vX.Y.Z" button. When the scaffolded API route at `src/app/api/caspian-store/update/route.ts` runs on a host whose runtime `process.env` exposes none of `GOOGLE_CLOUD_PROJECT`, `GCLOUD_PROJECT`, `FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, or `CASPIAN_FIREBASE_PROJECT_ID`, `firebase-admin` cannot resolve a project ID and throws `Unable to detect a Project Id in the current environment`. The error previously surfaced verbatim with no remediation guidance.

### Fixed

- **Scaffolded route** ([scaffold/create.mjs](scaffold/create.mjs)) — `ensureAdminApp()` and `requireAdmin()` now: (a) extend the project-ID fallback chain to also check `FIREBASE_PROJECT_ID` and `CASPIAN_FIREBASE_PROJECT_ID`, (b) fail fast with an actionable HTTP 500 message naming the specific env vars and the Vercel / Firebase App Hosting paths to set them, and (c) mirror the resolved id into `process.env.GOOGLE_CLOUD_PROJECT` so any nested Google client lib inherits it. New scaffolds and consumers who manually re-paste the route get the improved error.
- **Admin About page** ([src/admin/admin-about-page.tsx](src/admin/admin-about-page.tsx)) — `UpdateResultPanel` now detects the canonical Google Auth Library `Unable to detect a Project Id` error string in the route response and renders a remediation panel with the env var name, a copy-pastable example, and step-by-step instructions for Vercel, Firebase App Hosting, and self-hosted Node. This benefits **every existing v2.4.0+ install** without requiring them to update their scaffolded route, because `UpdateResultPanel` ships in `dist/`.

### Added

- **[INSTALL.md](INSTALL.md) → §12 Upgrade → "Self-update from `/admin/about`"** — new subsection documenting the env var requirement, the in-order fallback chain, the production `CASPIAN_ALLOW_SELF_UPDATE=true` requirement, platform-specific setup snippets, and the read-only-filesystem caveat for serverless deploys.

### No consumer action required

Bug-fix release. Existing installs work as-is. Consumers who hit the project-id error after upgrading either get the new client-side remediation panel (any v2.4.0+ install benefits from upgrading to v2.12.1) or, if they manually re-paste the scaffolded route, get the improved server error message.

---

## v2.12.0 — Tax display + calculation options (C2)

Closes Release C. Layers WooCommerce-style tax **display and calculation preferences** on top of the existing v2.5 single-rate tax surface (`SiteSettings.taxMode` + `flatTaxRate` + per-country rates). Full tax-class + multi-rate-table schema is intentionally out of scope for v2.x — it would require a parallel collection design that conflicts with the active `supportedCountries[].taxRate` field. Revisit as a v3 breaking change.

### Added

- **`SiteSettings.taxConfig`** — new optional object with seven fields:
  - `pricesEnteredWithTax: boolean` — whether entered prices include tax.
  - `taxBasedOn: 'shipping' | 'billing' | 'store'` — drives rate lookup under `taxMode: 'per-country'`. (Billing falls back to shipping — checkout doesn't collect a separate billing address yet.)
  - `roundAtSubtotalLevel: boolean` — reserved for future per-line tax work.
  - `displayPricesInShop: 'incl' | 'excl'` — PLP / PDP price-display mode.
  - `displayPricesCartCheckout: 'incl' | 'excl'` — cart / checkout mode.
  - `priceDisplaySuffix: string` — e.g. `"incl. VAT"` or `"ex. {rate} GST"`; supports the `{rate}` placeholder.
  - `displayTaxTotals: 'single' | 'itemized'` — reserved for multi-class work.
  All fields default to pre-v2.12 behavior when `taxConfig` is absent.
- **`Order.tax?: number`** (additive, optional). When present, `total = subtotal + shippingCost + tax - discount`. Existing orders without the field continue to work — the storefront reads `total` directly.
- **Admin surface** — a new "Tax display options" sub-section inside the existing "Tax & supported countries" block at `/admin/settings`. Opt-in via a top-level checkbox so merchants who don't care see no new UI.
- **Checkout tax-based-on honoring** — `<CheckoutPage>` now picks the rate-lookup country from `taxConfig.taxBasedOn === 'store'` (uses `SiteSettings.country`) or defaults to the shopper's shipping-address country.
- **Price-display suffix wiring** — `<ProductCard>` renders the configured suffix after every price (muted, small). Threaded through `<ProductGrid>` and `<ProductListPage>` automatically.
- **`src/utils/tax.ts`** — new helper module exporting `DEFAULT_TAX_CONFIG`, `resolveTaxCountryCode(site, shippingCountry, billingCountry?)`, and `renderPriceSuffix(config, rate?)` for consumers bypassing the built-in components.

### Exports added

`TaxConfig` type; `DEFAULT_TAX_CONFIG`, `resolveTaxCountryCode`, `renderPriceSuffix` from `./utils/tax`; new `taxConfig` props on `<ProductCard>`, `<ProductGrid>`, `<ProductListPage>`.

### No consumer action required

Pure additive release — no new Firestore collections, no rules changes, no migrations. Stores that don't set `SiteSettings.taxConfig` get identical pre-v2.12 behavior. The `Order.tax` field is optional and defaults to `undefined` — existing order-confirmation pages and admin views continue to render `total` without change.

---

## v2.11.0 — Transactional email system (C1)

First half of Release C. The library now ships a complete transactional email surface: admin UI for editing per-type templates, global sender settings, reference Cloud Functions that listen on `orders/{id}` writes and deliver via SendGrid, and a callable for the "Send test" button.

### Added

- **`SiteSettings`-adjacent email config** — two new Firestore collections:
  - `emailSettings/site` singleton (`EmailSettings`): `fromName`, `fromAddress`, `replyTo`, `logoUrl`, `accentColor`, `backgroundColor`, `footerText`, and a master `enabled` toggle.
  - `emailTemplates/{key}` collection (`EmailTemplate`) with one doc per key: `new_order_admin`, `cancelled_order_admin`, `failed_order_admin`, `processing_order`, `completed_order`, `refunded_order`, `customer_note`, `new_account`. Each doc carries `enabled`, `subject`, `heading`, `additionalContent`, and `recipients` (for admin-audience templates).
- **`<AdminEmailsPage>`** at `/admin/emails` — global sender settings section + templates table with an edit dialog that shows a live preview using sample placeholder data (`{site_title}`, `{order_number}`, `{order_total}`, `{order_date}`, `{customer_name}`, `{customer_email}`) and a "Send test" button per template.
- **Admin nav entry** — a new "Emails" item in `DEFAULT_ADMIN_NAV` between Payments and Languages.
- **Service layer** — [src/services/email-service.ts](src/services/email-service.ts) exports `getEmailSettings`, `saveEmailSettings`, `listEmailTemplates`, `saveEmailTemplate`, `sendTestEmail`, plus `DEFAULT_EMAIL_SETTINGS`, `EMAIL_TEMPLATE_AUDIENCE`, `EMAIL_TEMPLATE_LABELS` helpers. `listEmailTemplates` hydrates defaults for keys that haven't been saved yet, so the admin table always shows all 8 rows on first run.
- **Firestore collection refs** — `emailTemplates`, `emailSettingsDoc` added to [src/firebase/collections.ts](src/firebase/collections.ts).
- **Firestore rules** — admin-only read/write on both collections; the Cloud Function bypasses via Admin SDK.
- **Reference Cloud Functions** in [firebase/functions-admin/](firebase/functions-admin/):
  - `runEmailOnOrderCreate` — fires on `orders/{id}` create. Sends the matching admin + customer templates based on `status` at creation time.
  - `runEmailOnOrderUpdate` — fires on `orders/{id}` update. Only sends when `status` actually changes (not on every cart-items tweak).
  - `sendTestEmail` — HTTPS callable, admin-gated. Invoked by the admin page's "Send test" button; renders with sample placeholders and delivers to a supplied recipient.
- **Pluggable sender** at [firebase/functions-admin/src/email-sender.ts](firebase/functions-admin/src/email-sender.ts). Ships with SendGrid via `@sendgrid/mail`. Swap to Resend / SES / Postmark by replacing `sendViaSendGrid` — callers depend only on the `{ to, from, subject, html, text }` signature.
- **Inline-styled HTML template shell** at [firebase/functions-admin/src/email-renderer.ts](firebase/functions-admin/src/email-renderer.ts) — intentionally minimal (no `<head>`, no stylesheets) for maximum Gmail / Outlook / Apple Mail compatibility. Merchants customize via the `EmailSettings` fields (logo, accent color, footer), not by editing HTML.

### Exports added

`EmailSettings`, `EmailTemplate`, `EmailTemplateKey`, `EmailAudience` types; `EMAIL_TEMPLATE_KEYS` const; `getEmailSettings`, `saveEmailSettings`, `listEmailTemplates`, `saveEmailTemplate`, `sendTestEmail`, `DEFAULT_EMAIL_SETTINGS`, `EMAIL_TEMPLATE_AUDIENCE`, `EMAIL_TEMPLATE_LABELS`, `SaveEmailTemplateInput`, `SendTestEmailInput`; `<AdminEmailsPage>` + `AdminEmailsPageProps`.

### Consumer action required on upgrade

To actually deliver emails:

1. **Set the SendGrid API key** as a Functions secret:
   ```bash
   firebase functions:secrets:set SENDGRID_API_KEY
   ```
   The value is injected into every email-sending function at runtime. Stores that don't set it see a `[email-sender] SENDGRID_API_KEY not set` warning and no email is sent — handy for local emulator runs.

2. **Redeploy `functions-admin`** to pick up the new triggers and the `sendTestEmail` callable:
   ```bash
   cd firebase/functions-admin
   npm install
   npm run build
   firebase deploy --only functions:caspian-admin
   ```

3. **Deploy the updated `firestore.rules`** so the admin UI can read/write the two new collections:
   ```bash
   firebase deploy --only firestore:rules
   ```

4. (In the admin UI) open **`/admin/emails`**, fill in global sender settings, toggle the master `enabled` switch, and save. No templates need to be touched — defaults are rendered until a merchant edits one.

Stores that leave the master `enabled: false` or never set a `SENDGRID_API_KEY` see zero change in behavior — the Cloud Functions are deployed but exit early.

---

## v2.10.0 — Account creation policy + guest checkout + GDPR retention Cloud Function

Closes Release B. Adds the four account-creation toggles, real guest checkout via Firebase anonymous auth, an optional "send password setup link" sign-up flow, and the first scheduled Cloud Function in the library — `runRetentionCleanup` — that deletes inactive accounts and old orders according to a merchant-configured retention window.

### Added

- **`SiteSettings.accounts`** — new `{ allowGuestCheckout, allowAccountCreationAtCheckout, allowAccountCreationOnMyAccount, sendPasswordSetupLink }`. Admin surface lives at `/admin/settings` under a new "Accounts & privacy" section.
- **`SiteSettings.privacy`** — new `{ retainInactiveAccountsDays, retainCancelledOrdersDays, retainFailedOrdersDays, retainCompletedOrdersDays }`. Every field is optional — `undefined` means "keep indefinitely". Each field gets its own input under the Accounts & privacy section.
- **`auth.signInAsGuest()`** — new on the auth context. Wraps `signInAnonymously(auth)` so the storefront can hand the shopper an authenticated session without an email/password. Used to back "Continue as guest" at checkout. Requires the Anonymous sign-in provider to be enabled in Firebase Authentication.
- **`auth.signUpWithSetupLink(email, displayName)`** — new on the auth context. Generates a high-entropy random password, signs the user in, and emails a password-reset link so they can pick a real password on their own. Used by `<RegisterPage>` when `accounts.sendPasswordSetupLink` is on.
- **`<CheckoutPage>` sign-in gate** — now reads `site.accounts`. When the shopper isn't signed in: shows a "Create an account" link only when `allowAccountCreationAtCheckout` is on, and a "Continue as guest" button only when `allowGuestCheckout` is on. Defaults preserve pre-v2.10 behavior (sign-in only).
- **`<RegisterPage>` policy gating** — when `accounts.allowAccountCreationOnMyAccount` is `false`, renders a "Registration is disabled" notice instead of the form. When `accounts.sendPasswordSetupLink` is `true`, hides the password fields and routes the submit through `signUpWithSetupLink`. Accepts a new `accounts?` prop override for tests / bespoke wiring.
- **`runRetentionCleanup` scheduled Cloud Function** — new in [firebase/functions-admin/src/retention-cleanup.ts](firebase/functions-admin/src/retention-cleanup.ts). Runs daily at 03:15 UTC, reads `settings/site` for the `privacy` block, and deletes inactive accounts (Firestore doc + Auth record), cancelled orders, failed/pending/on-hold orders, and delivered orders older than the configured windows. Logs `deleted N <kind> docs older than D days` per bucket. Respects `BATCH_SIZE = 200` per run to keep memory bounded — the function re-runs in 24h to catch stragglers.
- **`FeatureFlags.guestCheckout`** is now marked `@deprecated` — `SiteSettings.accounts.allowGuestCheckout` takes precedence when set.

### Exports added

`AccountSettings`, `PrivacyRetentionSettings` types; `signInAsGuest`, `signUpWithSetupLink` on the auth context; new `accounts` prop on `<RegisterPage>`.

### Consumer action required on upgrade

Two steps — both required only if you're enabling the new features:

1. **Redeploy `functions-admin`** to pick up `runRetentionCleanup`. From the consumer's project root:

    ```bash
    cd firebase/functions-admin
    npm install
    npm run build
    firebase deploy --only functions:caspian-admin
    ```

   The function is harmless out of the box — it logs a single line and exits when no `privacy` block is configured.

2. **Enable Anonymous sign-in in Firebase Authentication** (only if you set `accounts.allowGuestCheckout: true`): Firebase Console → Authentication → Sign-in method → Anonymous → enable.

The library upgrade itself is otherwise additive — stores that don't touch `SiteSettings.accounts` or `SiteSettings.privacy` get identical pre-upgrade behavior and don't need to redeploy Functions.

---

## v2.9.0 — Inventory tracking + checkout shipping-display toggles

First half of Release B — inventory (B1) and the shipping checkout-behavior toggles (B2). Stores that don't opt in see identical pre-upgrade behavior; merchants who turn on `SiteSettings.inventory.trackStock` get per-size stock fields in the product editor, auto low/out-of-stock badges on product cards, an optional hide-out-of-stock PLP filter, disabled sizes on PDP, and an Add-to-cart guard for out-of-stock sizes.

### Added

- **Inventory settings** — new `SiteSettings.inventory: { trackStock, lowStockThreshold, outOfStockThreshold, outOfStockVisibility, stockDisplay }`. Admin surface lives in the existing `/admin/settings` page as a new "Inventory" section between Cart behavior and Tax. Defaults to off (`trackStock: false`) — no storefront-visible change until opted in.
- **Per-size stock editing** — `<AdminProductEditor>` gains a "Stock per size" grid that renders one numeric input per size, keyed off the comma-separated sizes field. Empty values stay untracked (treated as always-available). Values are saved to `Product.stock: Record<size, number>` — the existing field that has been unused by the admin until now.
- **`<ProductCard>` stock badges** — cards render "Out of stock", "Low stock", or "In stock" based on `SiteSettings.inventory` (forwarded via a new optional `inventory` prop; `<ProductGrid>` and `<ProductListPage>` thread it through automatically). The badge kind respects `stockDisplay` (`always` / `low` / `never`).
- **PLP hide-out-of-stock filter** — `ProductFilters.hideOutOfStock` (new optional field) filters products whose every size is at/below the out-of-stock threshold. `<ProductListPage>` fetches `SiteSettings.inventory` and applies the filter automatically when `outOfStockVisibility === 'hide'`.
- **PDP out-of-stock handling** — `<ProductDetailPage>` fetches inventory settings, disables per-size buttons for out-of-stock sizes (via a new `outOfStock?: string[]` prop on `<SizeSelector>`), renders a red "Out of stock" banner when every size is empty, and blocks the Add-to-cart button with a toast when an out-of-stock size is selected.
- **Inventory utilities** — new [src/utils/inventory.ts](src/utils/inventory.ts) exports `DEFAULT_INVENTORY_SETTINGS`, `totalStock`, `isProductOutOfStock`, `isSizeOutOfStock`, and `resolveStockBadge` (returns `'out-of-stock' | 'low-stock' | 'in-stock' | null`). Consumers who bypass the built-in storefront components can reuse these directly.
- **Shipping options** — new `SiteSettings.shippingOptions: { hideRatesUntilAddressEntered, hideRatesWhenFreeAvailable }`. A new section at the top of `/admin/shipping-plugins` edits these two checkboxes and persists via `saveSiteSettings` (no new Firestore collection).
- **Checkout rate gating** — `<CheckoutPage>` now skips shipping rate calculation when `hideRatesUntilAddressEntered` is true and the shopper hasn't entered a country + postcode, and suppresses paid options when `hideRatesWhenFreeAvailable` is true and any rate resolves to 0.

### Exports added

`InventorySettings`, `ShippingOptions` types; `DEFAULT_INVENTORY_SETTINGS`, `totalStock`, `isProductOutOfStock`, `isSizeOutOfStock`, `resolveStockBadge`, `StockBadgeKind` from `./utils/inventory`; `SizeSelectorProps` from `./components/product-selectors`; new `inventory` props on `<ProductCard>`, `<ProductGrid>`, `<ProductListPage>`, `<ProductDetailPage>`, and `<ProductFilters.hideOutOfStock>`.

### No consumer action required

Pure additive release — no new Firestore collections, no rules changes, no migrations. Stores that don't set `SiteSettings.inventory` or `SiteSettings.shippingOptions` get identical pre-upgrade behavior. Product docs with no `stock` map continue to work (treated as untracked / always-available). Shipping rate calculation short-circuits only when a merchant explicitly opts in to the toggles.

---

## v2.8.0 — Manual payment methods (BACS, cheque, COD) + payment-row polish

Second WooCommerce-parity ship. The Stripe-only payments catalog grows three offline gateways — bank transfer, cheque, cash on delivery — that create orders client-side with `status: 'on-hold'` for manual fulfillment. Plus payment-row polish in admin: editable per-install description and a Set up / Manage button that flips state based on whether `validateConfig` passes.

### Added

- **`bacs` payment plugin** ([src/payments/plugins/bacs.ts](src/payments/plugins/bacs.ts)) — direct bank transfer. Config: `instructions` (shopper-facing), `accountName`, `accountNumber`, optional `sortCode`, `iban`, `swift`. Validates that either an account number or an IBAN is set.
- **`cheque` payment plugin** ([src/payments/plugins/cheque.ts](src/payments/plugins/cheque.ts)) — cheque payments. Config: `instructions`, optional `payableTo`, `postalAddress`.
- **`cod` payment plugin** ([src/payments/plugins/cod.ts](src/payments/plugins/cod.ts)) — cash on delivery. Config: `instructions`, optional `enabledForShippingMethods` (allowlist of shipping-install names; comma-separated in the admin UI, `string[]` in Firestore).
- **`startManualCheckout` shared helper** ([src/payments/plugins/manual-base.ts](src/payments/plugins/manual-base.ts)) — common path the three plugins call to create an `orders/{id}` doc client-side with `status: 'on-hold'` and `payment.method` stamped to the matching plugin id, then redirect to the consumer's success URL (`{CHECKOUT_SESSION_ID}` placeholder is substituted with the new order id, mirroring Stripe).
- **Payment-install description field** — `<AdminPaymentPluginsPage>` install dialog grows a "Checkout description" textarea. Stored as `PaymentPluginInstall.description` on Firestore; rendered inline in the install list under the install name; falls back to the plugin's catalog description when blank.
- **Set up / Manage button** — the per-install action flips between **Set up** (primary variant) when `plugin.validateConfig(install.config)` throws and **Manage** (outline variant) once it passes, matching WooCommerce's payments table ergonomics.
- **`OrderPayment.method`** — optional `'stripe' | 'bacs' | 'cheque' | 'cod'` field on the order's payment block. Lets admins filter / display the right "awaiting payment" instructions per order. Stripe orders that don't set it continue to work; new manual orders set it explicitly.

### Changed

- **`PaymentPluginId`** union expands from `'stripe'` to `'stripe' | 'bacs' | 'cheque' | 'cod'`. Existing installs keyed on `'stripe'` are unaffected.
- **`PAYMENT_PLUGIN_CATALOG`** registers BACS, cheque, COD alongside Stripe.
- **`docToInstall`** in [src/services/payment-plugin-service.ts](src/services/payment-plugin-service.ts) reads the new `description` field from Firestore so saved values hydrate back into the edit form.

### Exports added

`BACS_PLUGIN`, `CHEQUE_PLUGIN`, `COD_PLUGIN`; `ManualPaymentBaseConfig`, `BacsConfig`, `ChequeConfig`, `CodConfig` types.

### No consumer action required

Pure additive release — no rules changes, no migrations. The `orders/{id}` create rule has allowed authenticated users to create their own orders since v1.0, so manual-payment plugins work with the existing rules out of the box. Stores that don't install BACS / cheque / COD see no change. Existing Stripe installs continue to work without setting `payment.method`.

---

## v2.7.0 — Coming Soon mode, currency formatting, store address, reviews/cart policies, admin header polish

First release of the WooCommerce-parity roadmap (Release A). Adds admin surfaces and storefront wiring for five merchant-facing knobs — Coming Soon mode, currency display formatting, a structured store address, review-submission policy, and cart behavior — plus the shared UI primitives (tooltip, field description, searchable select) that every downstream section consumes, and an onboarding progress ring in the admin header.

### Added

- **Coming Soon mode** — new `SiteSettings.comingSoon: { enabled, message?, allowAdminPreview }`. When enabled, `<LayoutShell>` replaces non-admin routes with a branded `<ComingSoonSplash>`. Admins (or merchants sharing a preview link) bypass the splash by loading any page with `?caspian-preview=1`; the grant persists to `sessionStorage` so SPA navigation keeps the bypass. When `allowAdminPreview` is false, the query-key trick is ignored. Admin UI lives at the top of `/admin/settings` under "Coming Soon mode".
- **Currency display formatting** — new `SiteSettings.currencyDisplay: { position, thousandSep, decimalSep, decimals }` + new util `formatCurrency(amount, currency, { display?, locale? })` at [src/utils/format-currency.ts](src/utils/format-currency.ts). When `display` is absent, the util falls back to `Intl.NumberFormat` defaults — no behavior change for stores that don't set it. Admin UI exposes a live preview ("Preview: $1,234.50"). Also exports `currencySymbol(currency, locale)` and `defaultCurrencyDisplay(currency)`.
- **Structured store address** — new `SiteSettings.storeAddress: { line1, line2?, city, stateOrRegion, country, postcode }`. Country uses a new `<SearchableSelect>` over the full `ISO_COUNTRIES` list; state/region uses the same component when the country has a subdivision table (US, CA, GB, AU) and falls back to a free-text input otherwise. Subdivision data lives at [src/data/subdivisions.ts](src/data/subdivisions.ts) and is exported via `getSubdivisions(countryCode)` and `SUBDIVISION_LIBRARY`. The existing free-text `contactAddress` field is kept untouched for backward compat.
- **Reviews policy** — new `SiteSettings.reviewPolicy: { restrictToVerifiedBuyers, requireStarRating, showVerifiedBadge }`. `createReview` service in [src/services/review-service.ts](src/services/review-service.ts) now accepts an optional `policy` argument and rejects submissions that violate it. `<ReviewItem>` and `<ReviewList>` accept a new `showVerifiedBadge` prop so consumers can wire the toggle through without fetching settings at every render.
- **Cart behavior** — new `SiteSettings.cartBehavior: { redirectToCartAfterAdd, ajaxOnArchives }`. `<ProductDetailPage>` reads it from site settings on mount (overridable via the new `cartBehavior` / `cartHref` props) and navigates to `/cart` when the flag is on. The `ajaxOnArchives` toggle is reserved for a future release — the admin UI marks it as upcoming.
- **Admin header polish** — `<AdminShell>` grows two opt-in slots: a circular onboarding progress ring (new `<AdminOnboardingProgress>` component) that shows `% of AdminTodo completed where isDefault=true`, hidden at 100%; and a `headerHelp?: ReactNode` slot consumers can fill with docs/support links. Enabled by default via `showOnboardingProgress: true`.
- **Shared admin UI primitives** — three reusable components under [src/ui/](src/ui/): `<FieldHelp>` (`?` tooltip icon + hover popover), `<FieldDescription>` (muted sub-text that matches the established 13px / #666 / 4px-top-margin convention), and `<SearchableSelect>` (keyboard-navigable type-to-filter dropdown, used by the new store-address country/state pickers).
- **New icons** — `HelpIcon`, `SearchIcon`, `ChevronDownIcon` in [src/ui/icons.tsx](src/ui/icons.tsx), consumed by the primitives above.

### Changed

- **`OrderStatus`** gains `'on-hold'` — marks orders awaiting manual payment confirmation (bank transfer, cheque, cash-on-delivery). Backward compatible: stores that don't use manual payment methods never see this status.
- **`<ReviewItem>` / `<ReviewList>`** default `showVerifiedBadge` to `true`, matching current behavior. Consumers who want to hide the badge site-wide now pass `false` instead of forking the component.

### Exports added

`ComingSoonSettings`, `CurrencyDisplay`, `StoreAddress`, `ReviewPolicy`, `CartBehavior` types; `formatCurrency`, `currencySymbol`, `defaultCurrencyDisplay`, `FormatCurrencyOptions`; `getSubdivisions`, `SUBDIVISION_LIBRARY`, `Subdivision`; `FieldHelp`, `FieldDescription`, `SearchableSelect` and their prop types; `HelpIcon`, `SearchIcon`, `ChevronDownIcon`; `ComingSoonSplash`, `ComingSoonSplashProps`; `AdminOnboardingProgress`, `AdminOnboardingProgressProps`; `ReviewItemProps`, `ReviewListProps`.

### No consumer action required

Pure additive release — no new Firestore collections, no rules changes, no migrations. Stores on v2.6.x that don't set any of the new optional fields get identical pre-upgrade behavior. Coming Soon mode is off by default; currency formatting falls back to `Intl.NumberFormat`; review policy and cart behavior read as "no policy" when unset.

---

## v2.6.0 — Country picker dialog + per-country tax table + per-method shipping eligibility

v2.5 shipped the tax + supported-countries schema but with a minimal MVP admin UI — a comma-separated textarea. v2.6 lands the proper admin surfaces I deferred: a check-many-at-once **Country Picker dialog** over a curated ISO 3166 list, a per-row **tax-rate table** that appears when tax mode is `per-country`, and an **Eligible countries** picker on each shipping-plugin install so "Standard Shipping" can be US-only while "International" covers everywhere else. No schema change — these surfaces populate the same `SiteSettings.supportedCountries` and `ShippingPluginInstall.eligibleCountries` fields that already exist.

### Added

- **`<CountryPickerDialog>`** at [src/admin/country-picker-dialog.tsx](src/admin/country-picker-dialog.tsx). Reusable check-many-at-once picker: searchable list of ~90 ISO 3166 countries (curated, not exhaustive), Select-visible and Clear-all helpers, Confirm-with-count primary button. Takes an optional `source` prop so callers can scope the picker to a narrower list (e.g. the shipping-eligibility picker scopes to `SiteSettings.supportedCountries`, not the full ISO list).
- **`ISO_COUNTRIES`** exported alongside — 90-country curated list covering North America, UK/EU/EEA, Oceania, Asia, Middle East, Africa, and Latin America. Admins needing codes outside this set can still edit `supportedCountries` via Firestore directly.
- **Admin shipping-plugin "Eligible countries" field** in `/admin/shipping-plugins` install config dialog. Defaults to empty (available everywhere). Shows the picker dialog + a row of removable chips listing the chosen countries. The picker is scoped to `SiteSettings.supportedCountries` so admins don't accidentally offer shipping to countries they don't sell in.

### Changed

- **`/admin/settings` "Tax & supported countries" section** — replaces the v2.5 textarea with: a **Manage countries** button that opens the picker dialog; a proper table of selected countries with a `×` remove on each row; when tax mode is `per-country`, each row grows an inline numeric input for the decimal tax rate (e.g. `0.08`). Existing `supportedCountries` data is preserved — rates and custom names survive the upgrade untouched.
- **`docToInstall`** now reads `eligibleCountries` from Firestore so saved values hydrate back into the edit form correctly.

### Exports added

- `CountryPickerDialog`, `ISO_COUNTRIES`, `CountryPickerDialogProps`, `IsoCountry`.

### No consumer action required

Pure additive release — no schema changes, no rules changes, no migrations. Stores on v2.5.x that configured countries via the textarea will see the new table-driven UI immediately with the same data. Shipping plugins without `eligibleCountries` keep shipping to every supported country.

## v2.5.2 — Apply `stripUndefined` across all admin write services

v2.5.1 fixed the `Unsupported field value: undefined` Firestore error for **Products** and **Promo codes** — the two surfaces a user had hit. This release sweeps the same hardening across every other admin-write service that takes a payload with optional fields, so the next blank-field save can't trigger the same crash on a different page.

### Fixed (preventatively)

The following admin save flows are now also immune to the "undefined field value" Firestore error when optional inputs are left blank:

- **Categories** (`description`, `imageUrl`, `parentId`, `path`, `depth`, `isFeatured`) — [src/services/category-service.ts](src/services/category-service.ts)
- **Collections** (`description`, `imageUrl`, `isFeatured`, `updatedAt`) — [src/services/product-collection-service.ts](src/services/product-collection-service.ts)
- **Languages** (`flag`, `updatedAt`) — [src/services/language-service.ts](src/services/language-service.ts)
- **Journal articles** (defensive on partial updates) — [src/services/journal-service.ts](src/services/journal-service.ts)
- **FAQs** (defensive on partial updates) — [src/services/faq-service.ts](src/services/faq-service.ts)
- **Site settings** (`faviconUrl`, `currency`, `timezone`, `country`, `taxMode`, `taxLabel`, `flatTaxRate`, `supportedCountries`) — [src/services/site-settings-service.ts](src/services/site-settings-service.ts)
- **Shipping plugin installs** (`eligibleCountries`) — [src/services/shipping-plugin-service.ts](src/services/shipping-plugin-service.ts)
- **Payment plugin installs** (defensive on partial updates) — [src/services/payment-plugin-service.ts](src/services/payment-plugin-service.ts)
- **Admin todos** (`description`, `done`, `order`, `isDefault` on partial updates) — [src/services/admin-todo-service.ts](src/services/admin-todo-service.ts)

### No consumer action required

Pure runtime hardening; no schema changes, no API changes. Upgrade and the affected admin save flows can no longer throw `Unsupported field value: undefined` on blank optional inputs.

## v2.5.1 — Fix Firestore "undefined field" rejection on product and promo-code save

Both the admin product editor and the new-promo-code dialog were building write payloads that included optional fields (e.g. `weightKg`, `shortDescription`, `details` on products; `minOrderAmount`, `maxDiscount` on promo codes) with `undefined` values when the admin left them blank. Firestore's SDK rejects any document key whose value is `undefined`, so saves failed with `Function addDoc() called with invalid data. Unsupported field value: undefined (found in field weightKg ...)`. The fix lives in the service layer: a new `stripUndefined` helper drops `undefined` keys from the payload before `addDoc`/`setDoc`/`updateDoc` runs. Service-layer placement means every current and future caller is protected without changing form code.

### Fixed

- **Create/edit Product** with empty optional fields no longer throws `Unsupported field value: undefined`. ([src/services/product-service.ts](src/services/product-service.ts))
- **Create/edit Promo code** with empty `Min order amount` and/or `Max discount` no longer throws the same error. ([src/services/promo-code-service.ts](src/services/promo-code-service.ts))

### Added

- **`stripUndefined(obj)`** internal utility at [src/utils/strip-undefined.ts](src/utils/strip-undefined.ts) — shallow copy with `undefined`-valued keys omitted. Preserves `null`, `false`, `0`, `''`, and empty arrays/objects (all valid Firestore field values).

### No consumer action required

Upgrade and the affected admin save flows start working again — no code or schema changes on the consumer side.

## v2.5.0 — Retail-skin storefront + admin layout overhaul with notifications

Two parallel pushes landed together. On the storefront, four design screenshots defined the cleanWhite theme's look across the funnel: a product page with a vertical thumbnail rail and tabbed content, a full-page shopping bag, and a two-card checkout step — v2.5 implements that skin end-to-end and adds the product-content and tax/countries primitives it needs. On the admin side, the shell was rebuilt so the sidebar runs full-height (not under the header), the header starts from the right of the sidebar with a toggle icon at its far left, a notifications bell lives in the header with an unread badge + dropdown, and a new `/admin/notifications` page lists every active signal — starting with available-library-update alerts and pending moderation items.

### Added

- **`<CartPage>`** at [src/components/cart-page.tsx](src/components/cart-page.tsx) — new full-page shopping bag. Two-column layout: item cards on the left (thumbnail + name + variant + pill qty stepper + price + `×` remove); sticky order summary on the right (subtotal, shipping placeholder, total, promo code with apply/clear, Proceed-to-Checkout CTA, lock-icon "Secure checkout" microcopy, Continue Shopping link). Applied promo codes carry to checkout via a `?promo=` query param. Mount at `/cart`. The existing `<CartSheet>` drawer is preserved for quick peeks.
- **`<RichTextEditor>`** at [src/ui/rich-text-editor.tsx](src/ui/rich-text-editor.tsx) — minimal contentEditable editor with Bold + Bulleted-list toolbar. Cmd/Ctrl+B shortcut. Paste-as-plain-text to keep foreign markup out. Output sanitized to a tight allowlist (`<p>`, `<br>`, `<strong>`, `<b>`, `<ul>`, `<li>`; every attribute stripped).
- **`sanitizeRichHtml(input)`** — exported sanitizer used by both the editor and the `<HtmlContent>` renderer. Zero dependencies; runs on the client via `DOMParser`.
- **`<HtmlContent>`** at [src/ui/html-content.tsx](src/ui/html-content.tsx) — renders sanitized HTML via `dangerouslySetInnerHTML`, re-sanitizing at render so stale Firestore data stays inside the allowlist.
- **`Product.shortDescription`** — 1–3 line marketing blurb rendered in the PDP hero column above Add-to-Cart. Optional; falls back to the first paragraph of `description` when empty.
- **`Product.details`** — rich-text HTML for the Details tab on the PDP (dimensions, materials, care). Authored via `<RichTextEditor>` in the admin product editor. Optional; tab is hidden when both `details` and `description` are empty.
- **PDP tab system** — the product page now renders three sibling tabs (Details / Reviews / Questions) below the hero grid with an active-underline style. Reviews and Questions reuse the existing `<ProductReviews>` via a new `mode` prop (`reviews-only` / `questions-only` / `combined`); existing standalone consumers continue to see the previous combined widget.
- **`<ProductGallery>` rebuild** — vertical thumbnail rail on the left (fixed height, internal scroll for ≥5 images) + 4:5 featured image on the right. New `aspectRatio` prop. Single-image products render without a rail.
- **`SiteSettings.taxMode` / `taxLabel` / `flatTaxRate` / `supportedCountries`** — tax system. Three modes: `none` (hide the tax row), `flat` (one decimal rate applies site-wide), `per-country` (per-row `taxRate` on each entry in `supportedCountries`). Admin configures in `/admin/settings` → new "Tax & supported countries" section.
- **`SupportedCountry` type** — `{ code: ISO-2, name, taxRate? }`. Populates the checkout country dropdown (restricted to this whitelist when non-empty). Library falls back to a 6-country default (US/CA/GB/AU/DE/FR) on unconfigured stores so checkout stays usable.
- **`ShippingPluginInstall.eligibleCountries`** — per-install whitelist of ISO-2 codes. Empty or undefined → available everywhere. The shipping-rate calculator copies it through onto `ShippingRate`; the checkout filters the radio list to the selected country.
- **`<CheckoutPage>` restyle** — card-based layout (Contact / Shipping Address / Shipping Method) with sticky Order Summary. Signed-in users see a saved-address picker that auto-fills the form; an "Enter a new address" option reveals blank fields, and a checkbox offers to save the new address to their profile. A "Email me with news and offers" checkbox wires to the `subscribers` collection on submit. CART › CHECKOUT breadcrumb at top. Tax row is rendered based on `taxMode`. Continue-to-Payment still redirects through the active payment plugin (Stripe-hosted today).
- **i18n** — 40+ new keys under `product.tabs.*`, `cart.page.*`, and `checkout.*` (breadcrumb, contact, shipping address, shipping method, tax, etc.).
- **Scaffold + example wiring** — scaffolder's `/cart` route now mounts `<CartPage>` instead of auto-opening the sheet; new `examples/nextjs/app/cart/page.tsx` mirrors it.
- **Main-entry exports** — `CartPage`, `CartPageProps`, `RichTextEditor`, `HtmlContent`, `sanitizeRichHtml`, `TaxMode`, `SupportedCountry`.
- **`<AdminShell>` layout rebuild** — the sidebar is now sticky and runs from top to bottom of the viewport with the brand title at its top. The header occupies only the content area on the right, sits sticky above the main scroll, and hosts a sidebar-toggle button at the far left. Toggle state persists in `localStorage` under `caspian:admin:sidebarOpen` so it survives page navigation and refreshes. Two new props on `<AdminShell>`: `showNotificationsBell` (default `true`) and `notificationsHref` (default `/admin/notifications`); `defaultSidebarOpen` (default `true`) controls the first-visit state when no saved preference exists.
- **`<AdminNotificationsBell>`** at [src/admin/admin-notifications-bell.tsx](src/admin/admin-notifications-bell.tsx) — bell icon in the admin header with an unread count badge. Click opens a 340-px dropdown showing the 5 most recent items + a "View all notifications →" link. Closes on outside click or Escape. Pulls its data from `useAdminNotifications()`, so turning it off is a one-prop change on `<AdminShell>`.
- **`<AdminNotificationsPage>`** at [src/admin/admin-notifications-page.tsx](src/admin/admin-notifications-page.tsx) — full-page list of every active notification with a Refresh button and kind labels (Update / Moderation). Mount at `/admin/notifications`; scaffolder emits the route automatically.
- **`useAdminNotifications()`** hook at [src/hooks/use-admin-notifications.ts](src/hooks/use-admin-notifications.ts) — derives notifications from live sources. Kinds shipped today: `update-available` (from the GitHub Releases check), `pending-reviews`, `pending-questions` (via `getCountFromServer` on the matching collections). No persistent read state — notifications disappear when the underlying condition resolves (library upgraded, reviews approved). Options to disable per-source: `checkForUpdates`, `checkModeration`.
- **`BellIcon`, `MenuIcon`** added to [src/ui/icons.tsx](src/ui/icons.tsx) and re-exported from the main entry.
- **DEFAULT_ADMIN_NAV** gains a "Notifications" item pointing at `/admin/notifications`.

### Changed

- **`<ProductDetailPage>`** replaces the flat hero + in-page reviews with a hero grid over a tab bar. Long `product.description` content migrates into the Details tab alongside `product.details`; the hero column shows only the short blurb.
- **Admin product editor** grows a "Short description (PDP hero blurb)" textarea and a "Details" rich-text editor.
- **Shipping calculator** emits `eligibleCountries` on each rate so the checkout can filter without a second Firestore read.

### Consumer action required on upgrade

Fresh scaffolds pick up everything automatically. Existing installs on v2.4.x need **two route files** to get the new full-page cart and notifications page:

```tsx
// src/app/cart/page.tsx
'use client';
import { CartPage } from '@caspian-explorer/script-caspian-store';
export default function Page() { return <CartPage />; }
```

```tsx
// src/app/admin/notifications/page.tsx
'use client';
import { AdminNotificationsPage } from '@caspian-explorer/script-caspian-store';
export default function Page() { return <AdminNotificationsPage />; }
```

No Firestore rules changes, no migrations. Products without `shortDescription` / `details` keep rendering — the PDP falls back to `description` in both the hero and the Details tab. The tax row is hidden until an admin picks a `taxMode` in `/admin/settings`. Supported-country whitelist defaults to a 6-country fallback list; configure your own to restrict. The admin sidebar toggle + notifications bell are on by default on any page wrapped in `<AdminShell>` — no wiring needed. To hide the bell, pass `showNotificationsBell={false}`; to skip the GitHub update check, pass `checkForUpdates={false}`.

## v2.4.0 — One-click library self-update from the admin About page

The About page added in v1.25 told admins an update was available but left them to run `npm install` in a terminal. v2.4 adds an **Update to vX.Y.Z** button that installs the latest tag end-to-end: the button posts to a companion Next.js API route (`/api/caspian-store/update`) that verifies the caller's admin claim via Firebase Admin, runs `npm install github:Caspian-Explorer/script-caspian-store#vX.Y.Z` on the host, and schedules a `process.exit(0)` so a process manager (or the Next dev server) respawns with the new dependency loaded. A **Copy install command** button is always shown as a fallback for non-scaffolded setups.

### Added

- **`<AdminAboutPage updateEndpoint>`** prop — override or disable (`null`) the companion route. Default `/api/caspian-store/update`. When an update is available and a user is signed in, the page renders an **Update to vX.Y.Z** primary button next to Refresh; clicking it streams a success/error panel with the captured `stdout`/`stderr` and a "restart your server" nudge.
- **`triggerSelfUpdate(user, version, options?)`** at [src/services/self-update-service.ts](src/services/self-update-service.ts) — client-side helper that attaches `Authorization: Bearer <idToken>` from the current Firebase user and POSTs to the endpoint. Exposed from the main entry so consumers can wire custom buttons elsewhere.
- **Scaffolder emits `src/app/api/caspian-store/update/route.ts`** — Node runtime, Firebase-Admin ID-token verification (must have `admin: true` custom claim), version-string validation (`/^\d+\.\d+\.\d+$/`), fixed owner/repo allowlist, captured stdout/stderr, 500ms-deferred `process.exit(0)` on success. Production requires `CASPIAN_ALLOW_SELF_UPDATE=true` server env or the route returns 403 — no one can accidentally ship a site that lets admins push arbitrary versions.
- **`firebase-admin` promoted from `devDependencies` to `dependencies`** in scaffolded sites so the route's ID-token verification works under `NODE_ENV=production` installs (Vercel, Firebase App Hosting, etc. strip devDeps).

### Platform matrix

| Host                                         | In-app Update button                                                                                      |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Local dev (`npm run dev`)                    | ✅ Works. Dev server respawns after install.                                                              |
| Self-hosted Node (VPS, Docker + PM2/systemd) | ✅ Works when `CASPIAN_ALLOW_SELF_UPDATE=true` is set and a process manager restarts the exited Node.    |
| Firebase App Hosting                         | ⚠️ Works only if the runtime has a writable `node_modules` and respawns on exit. Normally use re-deploys. |
| Vercel / other serverless                    | ❌ Read-only filesystem — `npm install` fails with EROFS. Use the Copy install command button + redeploy. |

### Consumer action required on upgrade

Existing scaffolds on v2.3.x need to add the new API route file and move `firebase-admin` to `dependencies`:

```bash
# 1. Add the route file
mkdir -p src/app/api/caspian-store/update
# paste the route from scaffold/create.mjs's emitted template, or re-scaffold into a sibling
# with --force and diff.

# 2. Move firebase-admin to dependencies
npm uninstall firebase-admin --save-dev
npm install firebase-admin@^13.0.0

# 3. For production, opt in explicitly
echo 'CASPIAN_ALLOW_SELF_UPDATE=true' >> .env.production
```

Fresh `npm create caspian-store@latest` scaffolds get everything automatically.

## v2.3.0 — Storefront search + admin search-terms analytics

The header search box was a dead input — no submit handler, no results page, no analytics. v2.3 wires it up end-to-end: submitting the header search logs the normalized term to a new `searchTerms` Firestore collection (atomic count-increment + timestamps) and navigates to a new `/search` results page that filters the active-product catalog client-side. Admins get a **Search terms** page showing the list of everything shoppers have searched, sorted by frequency or recency, with per-row delete + clear-all actions. Useful for spotting demand gaps, naming mismatches, and recurring typos.

### Added

- **`searchTerms` Firestore collection** ([src/firebase/collections.ts](src/firebase/collections.ts)) — one doc per normalized term, schema on `SearchTerm` in [src/types.ts](src/types.ts): `{ id, term, count, firstSearchedAt, lastSearchedAt }`. Doc id is the normalized term (lowercased, whitespace-collapsed, `/` stripped, capped at 120 chars) so `"Shoes "` and `"shoes"` and `"Shoes/Boots"` all merge into one counter.
- **Search-term service** at [src/services/search-term-service.ts](src/services/search-term-service.ts) — `logSearchTerm(db, term)` (upsert + `increment(1)` via Firestore's atomic counter), `listSearchTerms(db, { sortBy })`, `deleteSearchTerm(db, id)`, `clearAllSearchTerms(db)`, `normalizeSearchTerm(raw)` for consumers who want to log from their own code.
- **`<SearchResultsPage>`** at [src/components/search-results-page.tsx](src/components/search-results-page.tsx) — reads `?q=` from the URL (or a `query` prop for consumer-controlled wiring), loads `getProducts(db)`, filters client-side by `name`/`brand`/`category` includes. Fine for small-to-medium catalogs; swap for a consumer-authored page wired to Algolia / Typesense at scale.
- **`<AdminSearchTermsPage>`** at [src/admin/admin-search-terms-page.tsx](src/admin/admin-search-terms-page.tsx) — table of terms with count + first/last searched timestamps, filter box, sort toggle (most searched vs most recent), per-row delete, clear-all. Total-searches counter in the header for quick scanning.
- **Header search now actually submits.** [src/components/site-header.tsx](src/components/site-header.tsx) hooks the form `onSubmit`: fire-and-forget `logSearchTerm` (any rules denial logs to console, never blocks navigation), then `nav.push('/search?q=...')`.
- **`DEFAULT_ADMIN_NAV`** gains a **Search terms** entry (`/admin/search-terms`), slotted between Subscribers and Shipping.
- **Firestore rules** ([firebase/firestore.rules](firebase/firestore.rules)) — admin-only read/delete; create requires `count == 1` and a non-empty `term ≤ 200 chars`; update requires monotonic count (count > resource.data.count) and immutable term. Writes stay public so anonymous shoppers are counted; admin auth guards readouts.
- **Scaffolder + example wiring** — `search-terms` appended to `adminRoutes` in [scaffold/create.mjs](scaffold/create.mjs); new `src/app/search/page.tsx` generated for fresh scaffolds. Example-app routes at [examples/nextjs/app/search/page.tsx](examples/nextjs/app/search/page.tsx) and [examples/nextjs/app/admin/search-terms/page.tsx](examples/nextjs/app/admin/search-terms/page.tsx).
- **i18n** — `search.{title, resultsFor, resultCount, noResults, emptyQuery}` (with an ICU-style plural on `resultCount` so "1 match" and "37 matches" both render correctly).

### Consumer action required on upgrade

1. **Re-deploy Firestore rules** so the new collection is writable by shoppers and readable by admins:
   ```bash
   firebase deploy --only firestore:rules
   ```
2. **Add a `/search` route to your Next.js app** — fresh scaffolds get this automatically; existing installs should add it by hand:
   ```tsx
   // src/app/search/page.tsx
   'use client';
   import { SearchResultsPage } from '@caspian-explorer/script-caspian-store';
   export default function Page() { return <SearchResultsPage />; }
   ```
3. **Add the admin route file** so the new **Search terms** sidebar link doesn't 404:
   ```tsx
   // src/app/admin/search-terms/page.tsx
   'use client';
   import { AdminSearchTermsPage } from '@caspian-explorer/script-caspian-store';
   export default function Page() { return <AdminSearchTermsPage />; }
   ```

## v2.2.2 — Admin nav exposes Pages, FAQs, Journal, Promo codes, Subscribers, Collections, Languages

`DEFAULT_ADMIN_NAV` was missing sidebar entries for seven admin pages that the scaffolder already generates routes for. The most visible symptom: the storefront's `<PageContentView>` fallback ("This page has no content yet. Edit it in /admin/pages.") pointed admins at a route with no nav link — the Admin → Pages editor existed and was exported, but there was no way to get to it from the sidebar without typing the URL by hand. Five other admin pages had the same gap.

### Fixed

- [src/admin/admin-shell.tsx](src/admin/admin-shell.tsx) — `DEFAULT_ADMIN_NAV` gains seven entries: **Collections** (`/admin/collections`), **Pages** (`/admin/pages`), **FAQs** (`/admin/faqs`), **Journal** (`/admin/journal`), **Promo codes** (`/admin/promo-codes`), **Subscribers** (`/admin/subscribers`), **Languages** (`/admin/languages`). Order groups content next to products/reviews and marketing before shipping/payments.

### No consumer action required

Existing consumers using the default `<AdminShell>` nav pick up the new links automatically. Fresh scaffolds already ship page.tsx files for all seven routes via `scaffold/create.mjs`. Consumers who pass a custom `navItems` prop are unaffected. If an existing install was scaffolded on an old library version that predates one of the listed routes, clicking the new link will 404 until the corresponding `src/app/admin/*/page.tsx` is added (two lines each — copy the pattern from any existing admin route file).

## v2.2.1 — DropdownMenu escapes overflow ancestors

The admin Products page wraps its table in a scrollable box (`overflow-x: auto`, which per CSS also implies `overflow-y: auto`). `<DropdownMenu>` rendered its panel inline with `position: absolute`, so the 3-dot action menu on each product row was clipped by the table's scroll box — only the first item peeked through with a stray scrollbar. The component now portals the panel to `document.body` and positions it with `position: fixed` + coords computed from the trigger's `getBoundingClientRect()` (re-measured on `scroll` in capture phase + `resize`). Escapes every `overflow` ancestor — the same fix benefits `<AdminProfileMenu>` defensively.

### Fixed

- [src/ui/dropdown-menu.tsx](src/ui/dropdown-menu.tsx) — panel portals to `document.body` with `position: fixed`; click-outside handler now treats clicks inside either the trigger root OR the portaled panel as "inside" (previously it only checked the trigger root, which with a portal would have closed the menu before any item's `onSelect` fired); first-item autofocus wrapped in `requestAnimationFrame` so it runs after the two-pass position measure commits.

### No consumer action required

Internal-only bug fix; no public-API change. Existing installs continue to work, and every `<DropdownMenu>` consumer — including anything downstream of `<AdminProductsList>` or `<AdminProfileMenu>` — picks up the fix automatically on upgrade.

## v2.2.0 — Stripe: separate test + live publishable key fields, mode toggle

The Stripe plugin had a single `publishableKey` field; going from test to live meant erasing one key and pasting the other (and re-configuring the Cloud Functions secret at the same time, which was easy to forget). v2.2 replaces that with **two dedicated fields** (`publishableKeyTest` / `publishableKeyLive`) and a **Mode dropdown** on the Stripe install — admins paste both keys once and flip a single dropdown to switch which pair the storefront uses. The server-side `STRIPE_SECRET_KEY` still has to be kept in sync manually; the dropdown's hint text reminds admins.

### Added
- **`StripeMode` type** (`'live' | 'test'`) and `StripeConfig` fields `mode`, `publishableKeyLive`, `publishableKeyTest` in [src/payments/types.ts](src/payments/types.ts). The `publishableKey` field is retained as a derived read-only field — `validateConfig` picks the active key based on `mode` and writes it there so callers needing the active key don't have to dispatch on mode themselves.
- **Mode dropdown + two key inputs** in the Stripe ConfigFields of [src/admin/admin-payment-plugins-page.tsx](src/admin/admin-payment-plugins-page.tsx). Required asterisk follows the currently-selected mode.
- **Legacy-config migration on dialog open** — a v2.0/v2.1 install that stored a single `publishableKey` gets it auto-moved into the matching `pk_test_` or `pk_live_` slot when the admin clicks **Configure**, so no re-pasting is required.
- **i18n** — `admin.paymentPlugins.field.stripe.{mode, modeTest, modeLive, modeHint, publishableKeyTest, publishableKeyLive}` in [src/i18n/messages.ts](src/i18n/messages.ts).

### Changed
- **`STRIPE_PLUGIN.defaultConfig`** now `{ mode: 'test', publishableKeyLive: '', publishableKeyTest: '', publishableKey: '' }` — a fresh install starts in test mode.
- **`STRIPE_PLUGIN.validateConfig`** validates the key matching the active `mode` (with `pk_live_` / `pk_test_` prefix check) and rejects mismatched keys with a clear error. Also accepts the legacy `publishableKey` field as a fallback so existing installs keep working until an admin opens and re-saves them.

### No consumer action required

Existing v2.1 installs keep working without changes — `validateConfig`'s legacy migration maps the old `publishableKey` field into the new shape on read. The first time an admin opens **Configure** on an existing Stripe install, the legacy key auto-migrates into the matching test/live slot and is written back on Save.

Admins graduating from test to live on an existing install can now:
1. Open `/admin/payment-plugins`, click **Configure** on Stripe.
2. Paste both the `pk_test_...` and `pk_live_...` keys.
3. Pick the active **Mode** (Test or Live).
4. Run `firebase functions:secrets:set STRIPE_SECRET_KEY` with the matching secret and re-deploy `functions-stripe`.

## v2.1.0 — Theme catalog: Avada-style grid with previewable themes

The v2.0 Appearance page exposed raw `primary / foreground / accent / radius` color pickers — accurate, but nothing an admin who isn't a designer would enjoy. v2.1 rebuilds it as a **catalog grid of pre-designed themes**, each a complete out-of-the-box visual identity (colors + radius + optional serif-font override) shown as a card with thumbnail, name, category tags, and Preview / Activate buttons. A sidebar filters by category (Corporate, Shop, Creative, Portfolio, Education, Health & Beauty, Events, Food, Marketing, Minimal) with live counts, plus a search box.

Ten starter themes ship: **Clean white, Minimal dark, Boutique, Editorial, Neon shop, Pastel studio, Academy, Kitchen table, Forum blue, Runway**. New themes land by PR into `THEME_CATALOG` ([src/theme/catalog.ts](src/theme/catalog.ts)) — there's no runtime registration hook.

Preview opens a **popup window** rendering a dummy-data storefront (header, hero, 6-product grid, footer) with the chosen theme applied — no Firestore roundtrip required, so fresh installs can eyeball every theme before seeding real products. **Apply theme** writes the tokens to `scriptSettings/site.theme` and closes the popup.

### Added

- **Theme catalog** at [src/theme/catalog.ts](src/theme/catalog.ts). `THEME_CATALOG: readonly CatalogTheme[]` — 10 themes, each with `id`, `name`, `description`, `categories`, optional `isNew` / `fontFamily`, raw `tokens`, and `thumbnail` metadata (wordmark + tagline + background / foreground / accent for the SVG preview). Helpers: `findCatalogTheme(id)`, `countThemesByCategory()`, `THEME_CATEGORY_LABELS`. Back-compat: `THEME_PRESETS` and `THEME_PRESET_LABELS` are now derived from the catalog, so `save({ theme: THEME_PRESETS.cleanWhite })` still works.
- **`<ThemeThumbnailSvg>`** at [src/theme/theme-thumbnail.tsx](src/theme/theme-thumbnail.tsx) — inline-SVG preview card. No binary assets; every thumbnail renders from the theme's own tokens so colors, radius, and wordmark match the activated result.
- **`<AdminAppearancePage>` rebuild** at [src/admin/admin-appearance-page.tsx](src/admin/admin-appearance-page.tsx) — sidebar (search + category list with counts), responsive card grid, "NEW" badge for fresh themes, "Active" badge for the currently-saved theme (detected by token equality), Preview button (opens popup), Activate button (writes tokens).
- **`<AdminAppearancePreviewPage>`** at [src/admin/admin-appearance-preview-page.tsx](src/admin/admin-appearance-preview-page.tsx) — full-page dummy-data storefront mockup for theme preview. Reads `?theme=<id>` from the URL, scopes theme tokens to a wrapper `div` (no global `:root` mutation — nothing leaks out of the popup), renders a sticky top banner with "Apply theme" and "Close" actions. Mount it at `/admin/appearance/preview`.
- **Dummy-data primitives** at [src/theme/preview-demo-data.ts](src/theme/preview-demo-data.ts) — `DEMO_BRAND`, `DEMO_NAV`, `DEMO_HERO`, `DEMO_PRODUCTS`. Also re-exported from the main entry so consumers can reuse them in their own previewers.
- **i18n** — 16 new `admin.appearance.*` keys covering the grid, sidebar, category labels-usage, and preview banner. Existing `settings.theme.*` keys are preserved.
- **Scaffolder + example wiring** — `['appearance/preview', 'AdminAppearancePreviewPage']` appended to `adminRoutes` in [scaffold/create.mjs](scaffold/create.mjs), generating `src/app/admin/appearance/preview/page.tsx` in fresh scaffolds. Example app at [examples/nextjs/app/admin/appearance/preview/page.tsx](examples/nextjs/app/admin/appearance/preview/page.tsx).

### Changed

- **`<AdminAppearancePage>`** now renders a theme catalog grid instead of raw color pickers. The raw-token surface (`<ScriptSettingsPage>`'s color inputs) is unchanged for admins who want manual control — mount that page at a secondary route if you need it. A new `previewPath` prop on `<AdminAppearancePage>` (default `/admin/appearance/preview`) controls where Preview opens in case you mount the preview at a non-default route.
- **`THEME_PRESETS`** widens from 1 entry (`cleanWhite`) back to 10, mirroring the catalog. Not a breaking change — consumers indexing it by the one existing key (`THEME_PRESETS.cleanWhite`) still resolve.

### Consumer action required on upgrade

Fresh scaffolds get the preview route wired automatically. **Existing installs on v2.0.x must add one route file** so the Preview popup has somewhere to land:

```tsx
// src/app/admin/appearance/preview/page.tsx
'use client';
import { AdminAppearancePreviewPage } from '@caspian-explorer/script-caspian-store';
export default function Page() { return <AdminAppearancePreviewPage />; }
```

No Firestore rules, indexes, or Functions changes. No persisted-theme migration runs — whatever's already in `scriptSettings/site.theme` keeps rendering. To adopt a new theme, open the Appearance page and click Activate.

## v2.0.1 — Polish admin About error messages

Small UX fix for the admin About page. When the GitHub releases API returns a non-2xx response, the page used to render `Couldn't reach GitHub: GitHub API 404:` — the `res.statusText` portion is blank on modern browsers (notably HTTP/2), so the message trailed off at a dangling colon. The service now drops the colon when there's nothing to follow, and adds hint text for the two status codes that actually show up in practice: `404 → Not found or private`, `403 → Rate-limited or forbidden`. Network failures (offline, DNS, CORS) now surface as `Network error` instead of the browser-specific `Failed to fetch` / `NetworkError when attempting to fetch resource`.

### Fixed

- [src/services/github-updates-service.ts](src/services/github-updates-service.ts) — `fetchRecentReleases` no longer produces trailing-colon error strings, gives hint text for 404/403, and maps fetch `TypeError` to `Network error`. `AbortError` still propagates unchanged so unmounts don't look like failures.

### No consumer action required

Internal-only bug fix; existing installs continue to work.

## v2.0.0 — Pluggable payment + shipping providers, admin appearance page

v2.0 makes the storefront's integration points **installable, not hard-coded**. Stripe used to be the only payment option and the Firestore `stripePublicKey` field was the only way to configure it; shipping used to be a flat list of fixed prices with no picker at checkout. Both are now plugin catalogs browsed and configured from the admin panel: the store owner picks a provider, fills in its fields, flips Enable. Alongside those two plugin systems, the admin panel grows a dedicated **Appearance** page for theme tokens (previously buried inside the orphan `<ScriptSettingsPage>`). This is a single major release because the payment migration removes `stripePublicKey` from `ScriptSettings` — a public-type breaking change — and bundling the shipping and appearance work keeps admin-nav churn to one upgrade.

### Added — Payment plugins

- **Plugin catalog** under [src/payments/](src/payments/) — static in-library registry of payment providers. Each plugin exposes `validateConfig`, `startCheckout(ctx, options)`, and a `defaultConfig`. One built-in ships today: `stripe` ([src/payments/plugins/stripe.ts](src/payments/plugins/stripe.ts)) wrapping the existing `createStripeCheckoutSession` Cloud Function callable. Full contract in [src/payments/types.ts](src/payments/types.ts). Future providers land by PR into `PAYMENT_PLUGIN_CATALOG` ([src/payments/catalog.ts](src/payments/catalog.ts)) — there is no runtime registration hook and that is intentional.
- **`paymentPluginInstalls` Firestore collection** — one document per installed provider. Schema on `PaymentPluginInstall` in [src/types.ts](src/types.ts): `{ pluginId, name, enabled, order, config }`. Rules: public read (so `useCheckout` can enumerate) + admin write ([firebase/firestore.rules](firebase/firestore.rules)). Only publishable (`pk_...`-style) credentials live here; server-side secrets remain Cloud Functions secrets.
- **CRUD service** at [src/services/payment-plugin-service.ts](src/services/payment-plugin-service.ts).
- **`<AdminPaymentPluginsPage>`** at [src/admin/admin-payment-plugins-page.tsx](src/admin/admin-payment-plugins-page.tsx) — installed-providers table (enable / configure / remove) + Browse dialog. Mounted at `/admin/payment-plugins`.
- **`useCheckout` refactor** ([src/hooks/use-checkout.ts](src/hooks/use-checkout.ts)) — reads `paymentPluginInstalls`, picks the first enabled install in `order`, delegates to its plugin's `startCheckout`. New return field `activePlugin: PaymentPlugin | null` so UI can render provider-specific labels. Emits a dev-only `console.info` when more than one plugin is enabled (no picker UI ships in v2.0; future minor).
- **Checkout empty-state** — when no payment plugin is installed-and-enabled, `<CheckoutPage>` renders a guidance block (and a link to `/admin/payment-plugins` if the viewer is an admin) instead of the shipping form.
- **i18n** — `admin.paymentPlugins.*`, `checkout.noPaymentConfigured.*`, and parameterized `checkout.paymentHint` / removed `checkout.calculatedAtStripe` ([src/i18n/messages.ts](src/i18n/messages.ts)).

### Added — Shipping plugins

- **Plugin catalog** under [src/shipping/](src/shipping/) — four built-ins: `flat-rate`, `free-shipping`, `free-over-threshold`, `weight-based`.
- **`shippingPluginInstalls` Firestore collection** — one document per installed + configured plugin instance. Schema on `ShippingPluginInstall` in [src/types.ts](src/types.ts). Rules: public read, admin write.
- **CRUD service** at [src/services/shipping-plugin-service.ts](src/services/shipping-plugin-service.ts).
- **Rate calculator** at [src/services/shipping-calculator.ts](src/services/shipping-calculator.ts). Resolves enabled installs through the catalog and returns a `ShippingRate[]` for the checkout picker. Invalid configs are logged and skipped so one bad install doesn't blank the whole picker.
- **`<AdminShippingPluginsPage>`** at [src/admin/admin-shipping-plugins-page.tsx](src/admin/admin-shipping-plugins-page.tsx). Replaces the old `<AdminShippingPage>`.
- **`<ShippingRatePicker>`** at [src/components/checkout/shipping-rate-picker.tsx](src/components/checkout/shipping-rate-picker.tsx) — radio-group rendered inside the checkout page.
- **Checkout integration** — `<CheckoutPage>` computes rates on cart change, renders the picker below the address form, shows a Shipping line + Total in the order summary, and disables the Pay button until a rate is selected.
- **Public shipping page update** — [src/components/shipping/shipping-returns-page.tsx](src/components/shipping/shipping-returns-page.tsx) reads `shippingPluginInstalls` and renders each install's describe-string.
- **Product `weightKg?: number` field** — new optional field on `Product` consumed by the Weight-Based plugin; `<AdminProductEditor>` gets a **Weight (kg)** input.
- **i18n** — `admin.shippingPlugins.*` (40+ keys), `shipping.plugins.{id}.{name,description}`, `checkout.rate.*`.

### Added — Admin Appearance page

- **`<AdminAppearancePage>`** at [src/admin/admin-appearance-page.tsx](src/admin/admin-appearance-page.tsx) mounted at `/admin/appearance`. Houses the `<ThemePresetPicker>` + live color pickers for `primary` / `primaryForeground` / `accent` + radius input. Saves via `useScriptSettings().save({ theme })`.

### Changed

- **`DEFAULT_ADMIN_NAV`** ([src/admin/admin-shell.tsx](src/admin/admin-shell.tsx)) gains `/admin/shipping-plugins`, `/admin/payment-plugins`, and `/admin/appearance` entries. `/admin/shipping` is removed.
- **`THEME_PRESETS`** narrows from six presets to one opinionated default (`cleanWhite`). Picker UI, types, and public exports are unchanged — just the contents of the record shrink.
- **`DEFAULT_SCRIPT_SETTINGS.theme.accent`** changes from `#f5a8b8` (pink) to `#171717` (neutral dark) to match the new default. `--caspian-accent` CSS fallback in [src/styles/globals.css](src/styles/globals.css) updated accordingly.
- **First-run todo detector** — `verify-shipping-methods` → `verify-shipping-plugins`, now reading the new collection.
- **Seed script** at [firebase/seed/seed.mjs](firebase/seed/seed.mjs) seeds three `shippingPluginInstalls` docs (Standard flat-rate, Express flat-rate, Free-over-$75) in place of the old flat `shippingMethods` seed.
- **`<ScriptSettingsPage>`** marked `@deprecated` in JSDoc — superseded by `<AdminSiteSettingsPage>` + `<AdminAppearancePage>`. Still functional; removal in a future major.

### Removed

- **`ScriptSettings.stripePublicKey`** — the publishable key now lives in `paymentPluginInstalls[stripe].config.publishableKey`. `DEFAULT_SCRIPT_SETTINGS.stripePublicKey` removed. `settings.stripePublicKey` / `settings.sections.payments` i18n keys dropped. The "Payments" section is gone from `<ScriptSettingsPage>`. Dead `stripePublicKey` fields in Firestore are harmless — nothing reads them post-upgrade.
- **`<AdminShippingPage>`**, `AdminShippingPage` public export, `src/admin/admin-shipping-page.tsx`.
- **`shipping-method-service`** — `listShippingMethods`, `createShippingMethod`, `updateShippingMethod`, `deleteShippingMethod`, `ShippingMethodWriteInput`.
- **`ShippingMethod`** type and its re-export from the main entry. Use `ShippingPluginInstall` (collection doc) or `ShippingRate` (computed) instead.
- **`shippingMethods` Firestore collection reference** — replaced with `shippingPluginInstalls`.
- **Preset keys** `minimalLight`, `minimalDark`, `boutique`, `neon`, `pastel`, `monochrome` from `THEME_PRESETS` / `THEME_PRESET_LABELS`.
- **Dead i18n keys** — `checkout.taxesShipping`, `checkout.calculatedAtStripe`.

### Consumer action required on upgrade

1. **Re-deploy Firestore rules** so the two new plugin-install collections are readable/writable per the public-read + admin-write policy:
   ```bash
   firebase deploy --only firestore:rules
   ```
2. **Add the three new admin route files** (fresh scaffolds get these automatically; existing installs on v1.25.x should add them by hand):
   ```tsx
   // src/app/admin/payment-plugins/page.tsx
   'use client';
   import { AdminPaymentPluginsPage } from '@caspian-explorer/script-caspian-store';
   export default function Page() { return <AdminPaymentPluginsPage />; }
   ```
   ```tsx
   // src/app/admin/shipping-plugins/page.tsx
   'use client';
   import { AdminShippingPluginsPage } from '@caspian-explorer/script-caspian-store';
   export default function Page() { return <AdminShippingPluginsPage />; }
   ```
   ```tsx
   // src/app/admin/appearance/page.tsx
   'use client';
   import { AdminAppearancePage } from '@caspian-explorer/script-caspian-store';
   export default function Page() { return <AdminAppearancePage />; }
   ```
   Delete any existing `src/app/admin/shipping/page.tsx` — the old route is gone.
3. **Re-install Stripe from the admin UI.** The old `stripePublicKey` field is no longer read. Sign in as admin, go to `/admin/payment-plugins`, click **Browse providers** → **Install** on the Stripe card, paste your `pk_...` publishable key, click **Save**, then flip **Enable**. Checkout resumes immediately — no Cloud Functions redeploy needed.
4. **Re-configure shipping.** Existing `shippingMethods` documents are no longer read. Either re-run the seed script (which now populates three starter `shippingPluginInstalls` docs), or go to `/admin/shipping-plugins` → **Browse providers** → install the strategies you want.
5. **If you mounted `<AdminShell>` with a custom `navItems` array**, update the entries: swap `/admin/shipping` → `/admin/shipping-plugins`, and add `/admin/payment-plugins` + `/admin/appearance` if you want them in your custom nav.
6. **Code-level migrations** — if your consumer code imports any of the removed names, map them over:
   - `listShippingMethods` / `createShippingMethod` / `updateShippingMethod` / `deleteShippingMethod` → equivalents from `shipping-plugin-service`.
   - `ShippingMethod` → `ShippingPluginInstall` (doc) or `ShippingRate` (computed).
   - `AdminShippingPage` → `AdminShippingPluginsPage`.
   - `settings.stripePublicKey` reads → `paymentPluginInstalls[stripe].config.publishableKey` via `listPaymentPluginInstalls(db)`.
   - `THEME_PRESETS.{minimalLight|minimalDark|boutique|neon|pastel|monochrome}` → `THEME_PRESETS.cleanWhite` or inline the tokens you want.
7. **To use the Weight-Based shipping plugin**, set `weightKg` on products via the admin product editor. The plugin hides itself at checkout when no cart items have a weight.

## v1.25.0 — Admin About page + update-availability nudges

The admin panel had no place to surface library metadata — a store operator couldn't tell which version of `@caspian-explorer/script-caspian-store` they were on, whether a newer release was out, or what had shipped lately without leaving the app. v1.25 adds an **About** page under `/admin/about` that pulls the current version from source and recent releases from the public GitHub Releases API. Two lightweight nudges elsewhere in the admin make a behind-version install noticeable without having to visit About: an "Update available" badge in the admin header, and a virtual row at the top of `/admin/todos`.

### Added
- **`<AdminAboutPage>`** at [src/admin/admin-about-page.tsx](src/admin/admin-about-page.tsx). Shows installed version vs. latest release tag with a status badge (up-to-date / update available / offline), a list of the 5 most recent releases (title + relative date + link to release notes on GitHub), a Refresh button, and footer links to the repo / CHANGELOG.md / Announcements. Props `owner`, `repo`, `maxReleases` let consumers repoint the page at a fork.
- **GitHub updates service** at [src/services/github-updates-service.ts](src/services/github-updates-service.ts). `fetchRecentReleases(owner?, repo?, limit?, options?)` — unauthenticated GET against `api.github.com`, filters drafts/prereleases, 10-minute module-level cache. `compareVersions(a, b)` and `isUpdateAvailable(installed, latest)` — semver-lite numeric compare. Also exports `GithubRelease`, `DEFAULT_REPO_OWNER`, `DEFAULT_REPO_NAME`.
- **`CASPIAN_STORE_VERSION`** top-level constant at [src/version.ts](src/version.ts). Auto-generated by [tsup.config.ts](tsup.config.ts) on every build / `npm install` from `package.json#version`, so it never drifts.
- **Admin header "Update available" badge** — [src/admin/admin-shell.tsx](src/admin/admin-shell.tsx) now optionally checks GitHub on mount and renders a small badge linking to `/admin/about` when behind. New props `checkForUpdates`, `updateCheckOwner`, `updateCheckRepo` on `<AdminShell>`; pass `checkForUpdates={false}` to skip the network call entirely.
- **Virtual upgrade todo** — [src/admin/admin-todo-page.tsx](src/admin/admin-todo-page.tsx) renders a non-persisted row at the top of the list when a newer version is out, linking to the About page. Disappears automatically once installed == latest.
- **Scaffolder wiring** — fresh scaffolds get `src/app/admin/about/page.tsx` mounting `<AdminAboutPage />` automatically.

### Consumer action required on upgrade

For fresh scaffolds, none — `/admin/about` is wired automatically. Existing installs on v1.24.x should add one route file to pick up the About page:

```tsx
// src/app/admin/about/page.tsx
'use client';
import { AdminAboutPage } from '@caspian-explorer/script-caspian-store';
export default function Page() { return <AdminAboutPage />; }
```

The header badge and virtual todo appear automatically on upgrade — no consumer wiring required. If you don't want the library to reach out to `api.github.com` from the admin shell, pass `checkForUpdates={false}` to `<AdminShell>`.

## v1.24.0 — Setup wizard: a guided `/setup` that replaces the CLI config dance

The post-install checklist in the scaffolder README asked consumers to seed Firestore, open `/admin/settings`, edit the site doc, open `scriptSettings` for theming, toggle feature flags — seven separate touchpoints before a store felt "theirs." v1.24 collapses all of that into a 4-step wizard at `/setup` that writes the same Firestore docs behind one guided flow (Your info → Branding → Features → Summary), plus a dev-only `/setup/init` that pastes your Firebase web config into `.env.local` so the very first step of the manual README also becomes a form.

### Added
- **`<SetupWizard>`** at [src/components/setup/setup-wizard.tsx](src/components/setup/setup-wizard.tsx). Admin-gated 4-step wizard. Step 1 writes `settings/site` via the existing `saveSiteSettings` service; steps 2 and 3 write `scriptSettings/site.{theme,hero,features}` via the `useScriptSettings()` context save. Pre-populates the draft from whatever's already in Firestore, so reopening `/setup` on an existing store surfaces current values, not empty fields. Styled to match the common multi-step-form pattern: violet left-rail stepper + navy-CTA white panel on a cream-blue background.
- **`<SetupInitPage>`** at [src/components/setup/setup-init-page.tsx](src/components/setup/setup-init-page.tsx). Dev-only Firebase-config paste form. POSTs to a companion Next.js API route that writes `.env.local` from the browser, then prompts the user to restart dev + register their first account (the `onUserCreate` trigger auto-promotes to admin from there). The API route 403s whenever `NODE_ENV !== 'development'` so a deployed site can't overwrite its own env vars from a browser.
- **Supporting primitives** — `<SetupShell>`, `<SetupStepper>`, `SetupStep` type — all exported from the main entry so consumers can build custom flows with the same visual language.
- **Scaffolder wiring** in [scaffold/create.mjs](scaffold/create.mjs). Fresh scaffolds ship `src/app/setup/{layout,page}.tsx`, `src/app/setup/init/page.tsx`, and `src/app/api/setup/write-env/route.ts` automatically. The generated README gets a "Prefer a GUI?" callout at the top of the First-run checklist pointing at `/setup/init` and `/setup`.
- **i18n** — 67 new `setup.*` keys in [src/i18n/messages.ts](src/i18n/messages.ts) covering every label, placeholder, hint, and error message so existing `messagesByLocale` consumers can translate the wizard.

### No consumer action required
Pure additive release. The wizard is a new surface; existing `/admin/settings` flows still work unchanged. Existing installs on v1.23.x upgrade by bumping the dep and adding four route files — copy the snippets from [scaffold/create.mjs](scaffold/create.mjs) or re-run the scaffolder with `--force` into a sibling directory and diff.

## v1.23.0 — Admin header profile menu + setup-todo automation

Final slice of the admin-UX overhaul started in v1.21. The admin shell now has a real profile dropdown in the header (avatar, name, "View storefront", "My profile", "Sign out") and the setup checklist at `/admin/todos` is self-driving — it auto-seeds on first load, auto-updates as the admin fixes things in other tabs, and a "Verify progress" button re-checks which items Firestore state says are done.

### Added
- **`<AdminProfileMenu>`** at [src/admin/admin-profile-menu.tsx](src/admin/admin-profile-menu.tsx). Avatar + dropdown. Mount it into `<AdminShell headerRight>` from your admin layout. Resolves `displayName` / `photoURL` / email from `useAuth()`; falls back to an initial-circle when no photo. Consumer-configurable props: `storefrontHref`, `profileHref`, `afterSignOutHref`, `avatarSize`.
- **Four new icons** in [src/ui/icons.tsx](src/ui/icons.tsx): `UserIcon`, `LogOutIcon`, `CheckIcon`, `RefreshIcon`. Exported from the main entry.
- **`listenAdminTodos(db, callback, onError?)`** in [src/services/admin-todo-service.ts](src/services/admin-todo-service.ts). `onSnapshot`-backed live subscription ordered by the todo `order` field. Replaces the one-shot `listAdminTodos()` call in `<AdminTodoPage>` so changes made in another tab (or by the auto-verify below) reflect instantly.
- **`verifyAdminTodos(db, todos)`** + **`AUTO_DETECTABLE_TODO_IDS`** in [src/services/admin-todo-detectors.ts](src/services/admin-todo-detectors.ts). One-shot detectors for eight of the seeded first-run items: admin role granted (tautological — you're reading the page), site settings edited, ≥ 2 active languages, at least one category / product / shipping method, homepage hero edited, a category marked featured. Deploy-related items (`deploy-firestore-rules`, `deploy-storage-rules`, `deploy-cloud-functions`, `configure-stripe-webhook`) are intentionally absent — they aren't observable from Firestore and stay manual.
- **"Verify progress" button** in `<AdminTodoPage>` wires `verifyAdminTodos()` + `updateAdminTodo()` so a single click flips every auto-detectable item whose work has been done.

### Changed
- **`<AdminTodoPage>`** now uses the live snapshot listener instead of a one-shot fetch. Auto-seeds `DEFAULT_ADMIN_TODOS` on first visit if the collection is empty, so the admin doesn't need the "Seed setup checklist" button to see the list. The button is renamed "Re-seed defaults" and remains available for recovery if someone deletes a default item and wants it back.
- **Scaffolder + example admin layout** now mount `<AdminProfileMenu />` into `<AdminShell headerRight>`. Fresh scaffolds pick this up automatically; existing consumers can add one import + one prop (see below).

### No consumer action required
Pure additive — no schema change, no storage-rules change, no migration. Existing admin pages keep working without the profile menu until you opt in.

To opt in in an existing install, update your `app/admin/layout.tsx` (or equivalent):

```tsx
import { AdminGuard, AdminProfileMenu, AdminShell } from '@caspian-explorer/script-caspian-store';

export default function AdminLayout({ children }) {
  return (
    <AdminGuard>
      <AdminShell headerRight={<AdminProfileMenu />}>{children}</AdminShell>
    </AdminGuard>
  );
}
```

Existing installs upgrade transparently via `npm install github:Caspian-Explorer/script-caspian-store#v1.23.0`.

## v1.22.0 — Admin products overhaul: category dropdown + color palette + image upload + 3-dot actions

Second slice of the admin-UX overhaul started in v1.21. Products were free-text everywhere — category was a text input (easy to typo, no connection to the categories collection), color was a text input (no swatch guidance), and images were URL-only. The product list had Edit + Delete buttons inline with no `#` column, no filters beyond search, and no way to jump to the storefront PDP. This release closes all of those.

### Added
- **`<DropdownMenu>` UI primitive** at [src/ui/dropdown-menu.tsx](src/ui/dropdown-menu.tsx). Minimal headless dropdown with click-outside + ESC close, arrow-key focus management, `destructive` item variant, optional icons. Exported from the main entry. Used by the product-row 3-dot menu here, and by the profile menu landing in v1.23.
- **Inline SVG icon set** at [src/ui/icons.tsx](src/ui/icons.tsx): `MoreHorizontalIcon`, `EditIcon`, `TrashIcon`, `ExternalLinkIcon`. Stroke-based, inherit `currentColor`. No icon library added — sticks to the existing inline-SVG pattern.
- **Categories entry in `DEFAULT_ADMIN_NAV`** (`/admin/categories`). The `<AdminProductCategoriesPage>` admin page already supported parent/child hierarchy; now it gets a sidebar link so operators can find it.
- **Hierarchical category `<Select>` in `<AdminProductEditor>`**. Options are indented by depth (e.g. `Shoes`, `— Sneakers`, `—— Low-top`) and sorted by the category `order` field. The select's `value` is the `ProductCategoryDoc.id`, and it's stored directly on `Product.category`.
- **Fixed-palette color `<Select>`**. 13 named colors: Black, White, Red, Blue, Green, Yellow, Pink, Purple, Orange, Brown, Grey, Beige, Multi. Legacy stored colors that don't match the palette surface a warning hint prompting the admin to normalise by picking + saving.
- **Multi-image upload in `<AdminProductEditor>`**. Uses `<ImageUploadField>` (introduced in v1.21) with a separate URL-paste row underneath. Files land at `products/{productId}/` in Firebase Storage.
- **Product-list overhaul** in [src/admin/admin-products-list.tsx](src/admin/admin-products-list.tsx):
  - Sequential `#` column (1-based over the filtered view).
  - Filter bar: status (all / active only / hidden only), category (dropdown fed from `productCategories`, including an "Unresolved (legacy names)" option to surface pre-migration docs), brand (substring match), plus the existing search box. Clear-filters button.
  - Edit / View on storefront / Delete collapsed into a 3-dot `<DropdownMenu>`. "View on storefront" opens the PDP in a new tab.
  - New optional `getViewHref` prop on `<AdminProductsList>` defaulting to `(id) => /product/${id}`.
  - Categories resolved `id → name` client-side for display. Products whose `category` doesn't match any known id render an amber warning icon (legacy pre-migration docs).
- **`products/**` Storage rule block** in [firebase/storage.rules](firebase/storage.rules). Public read, admin write up to 10 MB, raster image content-types only (`jpeg|png|webp|gif`). SVG is intentionally rejected for product photos — product catalogs shouldn't accept embedded-script vectors from less-trusted sources.
- **Storage-rules test coverage for `products/**`** in [firebase/rules.test.mjs](firebase/rules.test.mjs): unauthenticated write denied, non-admin write denied, SVG upload denied, public read allowed.

### Changed
- **`Product.category` semantics** — was the display name, now stores the `ProductCategoryDoc.id`. The Firestore filter in `getProducts`/`getRelatedProducts` is opaque to id-vs-name (`where('category', '==', value)`) so it keeps working as long as both halves (product + caller) use the same format. Callers that passed a hard-coded category name to `getProducts({ filters: { category } })` must resolve name → id via `listActiveCategories()` first.
- **`<AdminProductsList>`** displays the count as `filtered / total` instead of just `total`, since filters can now reduce the shown set below the full catalog.

### Migration
Run the one-off script once, from your project root:

```bash
node node_modules/@caspian-explorer/script-caspian-store/firebase/scripts/migrate-product-category-to-id.mjs \
  --project <your-project-id> \
  --credentials ./service-account.json \
  --dry-run    # first, to preview
```

Re-run without `--dry-run` to apply. The script:
- Rewrites `products/{id}.category` from name → id using `productCategories` as the lookup table.
- Skips docs whose `category` already matches a known category id (idempotent).
- Flags ambiguous matches (two categories with the same name) for manual reassignment.
- Flags unknown names — create the missing category or reassign the product in `/admin/products` before re-running.

Products flagged "unresolved" after the migration are surfaced with an amber warning icon in the admin list. Opening + saving such a product in the editor lets you pick the correct category from the dropdown.

### Consumer action required on upgrade

```bash
npm install github:Caspian-Explorer/script-caspian-store#v1.22.0

# Redeploy storage.rules so product-image uploads work:
cp node_modules/@caspian-explorer/script-caspian-store/firebase/storage.rules .
firebase deploy --only storage

# Run the category migration (see above).
node node_modules/@caspian-explorer/script-caspian-store/firebase/scripts/migrate-product-category-to-id.mjs \
  --project <your-project-id> \
  --credentials ./service-account.json \
  --dry-run

# If output looks right, re-run without --dry-run.
```

If your storefront code calls `getProducts({ filters: { category: 'Sneakers' } })` with a literal name, update it to resolve the category by slug or name → id first (the library's `listActiveCategories` returns the full category list).

## v1.21.0 — Admin settings overhaul: localization + logo/favicon upload + social links rework

First slice of a larger admin-UX overhaul. The storefront settings page was previously all plain text inputs — logo/favicon URLs had to be copy-pasted in from elsewhere, social-link `platform` was free-text (easy to typo), and there were no currency / timezone / country selectors. This release brings the page in line with what operators expect on day one.

### Added
- **Localization section in `<AdminSiteSettingsPage>`.** Three new dropdowns on [src/admin/admin-site-settings-page.tsx](src/admin/admin-site-settings-page.tsx):
  - **Currency** — 29 most-common ISO 4217 codes (USD, EUR, GBP, JPY, CAD, AUD, CHF, CNY, INR, BRL, MXN, …).
  - **Timezone** — populated at runtime from `Intl.supportedValuesOf('timeZone')` (typically ~420 IANA zones), with a 30-zone fallback list for older runtimes.
  - **Country** — 40-country ISO 3166-1 alpha-2 subset covering the usual storefront footprint.
  All three are optional on `SiteSettings`. Existing docs without these fields keep working.
- **`<ImageUploadField>` UI primitive** at [src/ui/image-upload-field.tsx](src/ui/image-upload-field.tsx). Wraps the existing `uploadAdminImage()` helper with a preview, file picker, `Replace` / `Remove` buttons, and an optional URL fallback input. Exported from the main entry so consumers can reuse it in their own admin pages. Renders a placeholder when empty; uploads are scoped to a caller-supplied `storagePath` so Storage rules stay in control of what ends up where.
- **`siteSettings/**` Storage rule block** in [firebase/storage.rules](firebase/storage.rules). Public read (the storefront renders the logo on every page), admin write up to 10 MB, content-type matches `image/(jpeg|png|webp|gif|svg+xml)`. SVG is permitted because logos and favicons are commonly vector.
- **Rules-behavior test coverage for Storage.** [firebase/rules.test.mjs](firebase/rules.test.mjs) now also initializes the Storage emulator and asserts the siteSettings block: admin upload allowed (PNG + SVG), non-admin write denied, disallowed content-type (`text/html`) denied, public read allowed after an admin upload. Paves the way for `products/**` coverage in a later release.
- **`SocialPlatform` type + `SOCIAL_PLATFORMS` constant** in [src/types.ts](src/types.ts). Closed union of the eight platforms the built-in `<SocialIcon>` registry already supports (`instagram`, `facebook`, `twitter`, `x`, `youtube`, `tiktok`, `linkedin`, `pinterest`). Exported from the main entry.

### Changed
- **`<AdminSiteSettingsPage>` logo + favicon** are now live file uploads via `<ImageUploadField>` instead of URL-only text inputs. The URL input is still available underneath each picker as a fallback for CDN-hosted images. Uploaded files land under `siteSettings/` in Firebase Storage.
- **Social links editor** — `platform` is now a `<Select>` fed from `SOCIAL_PLATFORMS`, and a live `<SocialIcon>` preview renders next to each row so operators can see the icon they picked without saving first. The `label` text input has been removed; the platform name doubles as the aria-label / tooltip in the footer.
- **`SocialLink.platform` type** narrowed from `string` to `SocialPlatform`. Consumer code that wrote arbitrary platform strings will no longer typecheck — migrate to one of the eight supported values (or extend `<SocialIcon>` + the union together). Existing Firestore docs with unknown platform strings fall through to the generic globe fallback icon at render time.
- **`SocialLink.label`** removed from the public type. Any consumer code reading it loses access; the field was optional and most installs never set it. The footer no longer reads `label`, so removing it from existing docs has no visible effect.

### Consumer action required on upgrade

```bash
npm install github:Caspian-Explorer/script-caspian-store#v1.21.0

# Redeploy storage.rules so logo/favicon uploads work:
cp node_modules/@caspian-explorer/script-caspian-store/firebase/storage.rules .
firebase deploy --only storage
```

If you were using `SocialLink.label` in a fork or custom footer, fold the copy into the `platform` value or render it from your own table — the field is gone from `SiteSettings`.

## v1.20.2 — `predev` kill-port in scaffolded `package.json` (Windows dev-server hygiene)

One-line mitigation for a Windows-specific Turbopack zombie-worker bug. When the parent shell exits without clean shutdown, Next 16's Turbopack occasionally leaves Node.exe worker PIDs holding port 3000, causing the next `npm run dev` to hang on `EADDRINUSE`. `predev` clears the port first.

### Added
- **`predev` script in scaffolder-generated `package.json`**: `npx --yes kill-port 3000 || exit 0`. Cross-platform safe — `kill-port` is a no-op if nothing holds the port, and `|| exit 0` swallows a port-free exit-1 so `npm run dev` proceeds normally on macOS / Linux / Windows without zombies. Applied in both scaffold branches (hand-rolled and `--use-create-next-app` delegation) via the shared `ourScripts` object.

### No consumer action required
Scaffolder-only change. Existing scaffolded sites can add this manually to their `package.json` if they've been seeing EADDRINUSE on Windows; fresh scaffolds pick it up automatically. No source, public API, or ruleset change.

Existing installs upgrade transparently via `npm install github:Caspian-Explorer/script-caspian-store#v1.20.2`.

## v1.20.1 — `firebase:sync` helper + `turbopack.root` in scaffolded `next.config.mjs`

Carryover items from earlier install reports. Two independent scaffolder additions and one audit-only item.

### Added
- **[firebase/scripts/sync-rules.mjs](firebase/scripts/sync-rules.mjs)** — new Node helper that copies `firestore.rules`, `firestore.indexes.json`, and `storage.rules` from the installed package into the consumer's project root. Scaffolded sites get a `firebase:sync` npm script wired to it. Run after any upgrade that touches rules/indexes (the release CHANGELOG will call it out).
- **[scaffold/create.mjs](scaffold/create.mjs): `turbopack: { root: __dirname }` in generated `next.config.mjs`.** Pins Turbopack's workspace root so Next stops logging "Warning: Next.js inferred your workspace root" for any consumer whose home dir has a stray `package-lock.json`. Derived via `fileURLToPath` + `dirname` because `__dirname` isn't a global in ESM `next.config.mjs`.
- **[INSTALL.md §12 Upgrade](INSTALL.md)** now recommends `npm run firebase:sync` as the rules-resync step after bumping the package.
- **Scaffolder-generated README Upgrade section** uses `npm run firebase:sync` instead of the previous "available in v1.18+; otherwise copy by hand" caveat — it's now unconditional.

### Changed
- **Scaffolded `package.json` scripts** gain a `firebase:sync` entry between `firebase:deploy` and `deploy:admin`.

### Verified (no code change)
- **[src/admin/admin-guard.tsx](src/admin/admin-guard.tsx) access-denied text** audited end-to-end. The three-path list (Claim admin button / `grant-admin` CLI / Firestore console) from v1.18.0 is intact; no stale "re-run the seed script" language. Closing the follow-up from report #2.

### Consumer action required on upgrade
Upgraded consumer sites need two small edits to pick up the new helper:

```bash
npm install github:Caspian-Explorer/script-caspian-store#v1.20.1

# Add firebase:sync to your package.json scripts:
#   "firebase:sync": "node node_modules/@caspian-explorer/script-caspian-store/firebase/scripts/sync-rules.mjs"

# Then sync the rules from the library into your project root:
npm run firebase:sync
firebase deploy --only firestore:rules,firestore:indexes,storage   # if rules changed in this release (they didn't)

# Optional: add the turbopack.root pin to your next.config.mjs.
# See scaffold/create.mjs for the current generated config — three new lines at the top and a two-line turbopack block.
```

Fresh scaffolds pick up everything automatically.

## v1.20.0 — Upgrade-notes template, `--no-apphosting` flag, hydration fix

Polish pass following v1.19.0. Three independent items:

1. CHANGELOG upgrade-notes had drifted across releases (`### Not affected`, `### Notes`, `### Consumer action required on upgrade`, or nothing at all). Customers couldn't tell at a glance whether a given release needed action. Formalized as a hard-required heading with only two allowed variants.
2. Scaffolder unconditionally wrote `apphosting.yaml` since v1.16.0. For Vercel-only consumers the file just sits unused. Now gated behind a new `--no-apphosting` flag (default stays "emit" — non-breaking).
3. `AdminDashboard` tile rendered `<Skeleton>` (a `<div>`) inside a `<p>`, tripping React's "`<p>` cannot contain a nested `<div>`" dev warning. Silent in production but noisy in dev. Fixed by swapping the outer `<p>` for a `<div>` with identical inline styles.

### Added
- **Scaffolder `--no-apphosting` flag** in [scaffold/create.mjs](scaffold/create.mjs). Suppresses the generated `apphosting.yaml`. Default remains "emit" — Firebase App Hosting consumers are unaffected. Documented in [INSTALL.md §Scaffold flags](INSTALL.md).
- **CHANGELOG upgrade-notes template** documented as a comment block at the top of [CHANGELOG.md](CHANGELOG.md). Every release entry must include exactly one of `### Consumer action required on upgrade` or `### No consumer action required`.

### Changed
- **[CLAUDE.md Pre-Commit Checklist §5](CLAUDE.md)** now documents the upgrade-notes heading requirement as part of the bump-version step.

### Fixed
- **[src/admin/admin-dashboard.tsx:132](src/admin/admin-dashboard.tsx)** — tile value was wrapped in `<p>` which React disallows containing `<Skeleton>` (a `<div>`). Changed to `<div>` with identical inline styles; visual output unchanged.
- **[CHANGELOG.md](CHANGELOG.md) v1.17.0 back-fill** — added the previously-missing `### No consumer action required` heading so the entry conforms to the new template.

### No consumer action required
- `--no-apphosting` is an additive flag with backwards-compatible default (emit). Existing scaffold invocations produce identical output.
- CHANGELOG template formalization is docs-only.
- The hydration fix is a silent-in-production source correction with no visual or API change.

Existing installs upgrade transparently via `npm install github:Caspian-Explorer/script-caspian-store#v1.20.0`.

## v1.19.0 — Per-codebase `.gitignore` + first-deploy retry helper

Closes the "install just works" gap on a clean v1.18.x run. Three field-report items from the latest consumer install:

1. Pre-split `.gitignore` didn't cover the new `functions-admin/lib/` and `functions-stripe/lib/` tsc output — customers were accidentally committing build artifacts on every upgrade.
2. First-ever 2nd-gen Cloud Functions deploy fails with a red `Permission denied while using the Eventarc Service Agent — Retry the deployment in a few minutes` error. The retry always works within a minute or two, but the raw `Error:` scares customers into thinking their store is broken.
3. Every functions deploy ends with `Error: Functions successfully deployed but could not set up cleanup policy in location us-central1` in red. The functions deployed fine — this is just Artifact Registry image retention — but the `Error:` prefix reads like a failure.

### Added
- **Scaffolder now writes per-codebase `.gitignore`** inside each generated `functions-admin/` and `functions-stripe/` dir (2 lines each: `node_modules` + `lib/`). Matches what `firebase init functions` ships and stops `tsc` output from being staged on upgrade. Written inline by the scaffolder because npm strips `.gitignore` entries from tarballs (it uses them as ignore rules rather than shipping them).
- **[firebase/scripts/deploy-functions.mjs](firebase/scripts/deploy-functions.mjs)** — consumer-side wrapper around `firebase deploy --only functions:<codebase>`. Detects the Eventarc-propagation error class and retries with a 60s visible countdown (max 2 retries). On success, runs `firebase functions:artifacts:setpolicy --force` and reframes the output with a `[cleanup-policy]` prefix so the informational lines aren't mistaken for errors. Zero new deps — pure Node built-ins.
- **Scaffolder: `deploy:admin` and `deploy:stripe` npm scripts** in the generated `package.json` wired to the helper above. Raw `firebase deploy` still available via the existing `firebase:deploy` script.

### Changed
- **[scaffold/create.mjs](scaffold/create.mjs) generated `.gitignore`** now also ignores `functions-admin/lib/` and `functions-stripe/lib/` as belt-and-braces in case the per-codebase ignore files are removed or merged away.
- **Generated README first-run checklist step #4** now recommends `npm run deploy:admin` over raw `firebase deploy`, with a one-paragraph explanation of the two first-deploy papercuts the helper handles.
- **[INSTALL.md §5 "Deploy Cloud Functions"](INSTALL.md)** updated to recommend `npm run deploy:admin` / `npm run deploy:stripe` and explain the Eventarc + cleanup-policy smoothings.

### Consumer action required on upgrade
If you've already scaffolded a site on v1.18.x and want the new deploy helper + per-codebase ignores:

```bash
npm install github:Caspian-Explorer/script-caspian-store#v1.19.0

# Create per-codebase .gitignore files (npm strips .gitignore from tarballs, so
# these must be written by hand for upgraded sites — fresh scaffolds get them automatically):
printf 'node_modules\nlib/\n' > functions-admin/.gitignore
printf 'node_modules\nlib/\n' > functions-stripe/.gitignore   # only if you deployed Stripe

# Add the deploy helper scripts to your package.json:
#   "deploy:admin":  "node node_modules/@caspian-explorer/script-caspian-store/firebase/scripts/deploy-functions.mjs --codebase caspian-admin",
#   "deploy:stripe": "node node_modules/@caspian-explorer/script-caspian-store/firebase/scripts/deploy-functions.mjs --codebase caspian-stripe"

# If you accidentally staged functions-admin/lib/ or functions-stripe/lib/ on a prior upgrade, untrack them now:
git rm -r --cached functions-admin/lib/ functions-stripe/lib/ 2>/dev/null || true
```

Fresh scaffolds pick up everything automatically.

### Notes
- The retry regex covers the three phrasings Firebase's CLI currently emits for Eventarc-propagation failures; if Google rewords the error, the helper falls through to exit with the original code and the customer sees the raw message, same as today (no regression).
- `firebase functions:artifacts:setpolicy` is one-time per project/region — the helper runs it on every deploy, but subsequent runs are no-ops. The `--force` flag suppresses the confirmation prompt.

## v1.18.2 — Fix scaffolded `next.config.mjs` image-host allowlist

Scaffolded storefronts were crashing with a `next/image` "hostname ... is not configured" runtime error whenever a product image came from a host outside Firebase Storage or Google user content (e.g. Wikimedia, Unsplash, a third-party CDN). The scaffolder's generated `next.config.mjs` shipped a two-host allowlist that was too tight for real catalogs.

### Fixed
- **[scaffold/create.mjs](scaffold/create.mjs) — `next.config.mjs` image hosts.** The generated config now allows any `https` host by default (`{ protocol: 'https', hostname: '**' }`), with an inline comment showing how to tighten it to an explicit per-host list for production. Fixes the "Invalid src prop — hostname not configured under images" runtime error for catalogs referencing images from external CDNs.
- **`--use-create-next-app` delegation path now carries our `images` config.** Previously, the delegated path inherited whatever `create-next-app` wrote (no `images` block at all), so the bug was silent in that branch. The scaffolder now removes any `next.config.{ts,js,mjs}` create-next-app emitted and writes our shared `next.config.mjs` on top.
- **[examples/nextjs/next.config.js](examples/nextjs/next.config.js)** — mirrored the same permissive images config so the example app renders arbitrary catalogs without surprise errors.

### Added
- **[INSTALL.md](INSTALL.md) — new "Configure `next/image` hosts" subsection** under manual Next.js setup, showing both the permissive scaffolder default and a tighter per-host recipe for production, with a link to the upstream Next.js docs.

### Notes
- No source, public API, or ruleset changes. Existing consumer sites can adopt the fix by editing their own `next.config.mjs` — the new subsection in INSTALL.md has the exact snippet.

## v1.18.1 — Fix scaffolder stripe runtime + regenerate Function lock files

Small follow-up to v1.18.0 catching a scaffolder bug and stale lock files that didn't make the cut.

### Fixed
- **[scaffold/create.mjs](scaffold/create.mjs) — generated `firebase.json` stripe codebase runtime.** v1.18.0 bumped the admin codebase from `nodejs20` to `nodejs22` in the scaffolder's output but missed the `--with-stripe` branch; scaffolded projects with `--with-stripe` got a mixed `nodejs22`/`nodejs20` config. Both now emit `nodejs22`.

### Changed
- **[firebase/functions-admin/package-lock.json](firebase/functions-admin/package-lock.json) and [firebase/functions-stripe/package-lock.json](firebase/functions-stripe/package-lock.json) regenerated** to reflect the `firebase-functions@^7` and `firebase-admin@^13` deps that shipped in v1.18.0. The v1.18.0 commit carried the `package.json` bumps but left the lock files pinned to the old v6/v12 resolution tree.

### Notes
- No source, public API, or ruleset changes. Consumer upgrade from v1.18.0 → v1.18.1 needs no action beyond `npm install` — and only if you were scaffolding with `--with-stripe` (otherwise the stripe runtime fix doesn't affect you).

## v1.18.0 — Split Cloud Functions codebase + retroactive admin-claim callable

Two interlocking fixes for the admin-bootstrap chicken-and-egg reported in the v1.15 field install:

1. **Functions codebase split.** The single `caspian-store` codebase forced `firebase deploy` to pre-flight all functions — including Stripe ones — before deploying *any*, so a consumer without Stripe configured couldn't deploy even `onUserCreate`. Splitting into two codebases lets the admin trigger ship on install day.
2. **New `claimAdmin` callable.** Closes the retroactive gap that `onUserCreate` can't: if the installer registered *before* deploying the trigger, the trigger never fires on their already-created `users/{uid}` doc. The callable runs on demand (wire it to the AdminGuard "Claim admin role" button), gated by the same "no admin exists yet" invariant the trigger uses.

### Added
- **[firebase/functions-admin/src/claim-admin.ts](firebase/functions-admin/src/claim-admin.ts)** — `claimAdmin` callable (v2 `onCall`). Throws `failed-precondition` once any admin exists, so the bootstrap window can never be re-opened by a malicious caller.
- **"Claim admin role" button in [src/admin/admin-guard.tsx](src/admin/admin-guard.tsx)** — wired to the new callable via `httpsCallable`. On success, calls `refreshProfile()` and the guard re-renders with the admin surface. On the `failed-precondition` error (admin already exists) the button shows the message but keeps the CLI / console / UID-copy paths visible as fallbacks.

### Fixed
- **[src/admin/admin-guard.tsx](src/admin/admin-guard.tsx) access-denied message** — removed the stale "re-run the seed script with --admin" language (the standalone `grant-admin.mjs` CLI has shipped since v1.11.0). Replaced with a three-path list: Claim admin button (if no admin yet), `grant-admin` CLI, Firestore console. The UID copy block from v1.10.0 stays.

### Changed (runtime bumps — time-sensitive)
- **Firebase Functions Node runtime `20 → 22`** in both [firebase/firebase.json](firebase/firebase.json) codebase entries and the scaffolder's generated `firebase.json`. **Firebase deprecates Node 20 on 2026-04-30 and decommissions it 2026-10-30.** Consumers still on Node 20 will lose redeploy capability this October. Package.json `engines.node` bumped to `"22"` in both `functions-admin/` and `functions-stripe/`.
- **`firebase-functions@^6.1.0 → ^7.0.0`** in both Function codebases. Our handlers use `firebase-functions/v2/*` APIs only, which are source-compatible across the bump — verified by recompiling both codebases locally (`tsc` clean, all exports land in `lib/`).
- **`firebase-admin@^12.6.0 → ^13.0.0`** in both Function codebases, matching the scaffolder bump in v1.16.1.

### Changed
- **[firebase/functions/](firebase/functions/) replaced by [firebase/functions-admin/](firebase/functions-admin/) and [firebase/functions-stripe/](firebase/functions-stripe/).**
  - `functions-admin` — `onUserCreate` only. Deps: `firebase-admin`, `firebase-functions`. No secrets, no Stripe, deployable immediately on a fresh Firebase project.
  - `functions-stripe` — `createStripeCheckoutSession`, `stripeWebhook`, `getStripeSession`. Deps: `firebase-admin`, `firebase-functions`, `stripe`. Requires `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` — deploy separately when your Stripe account is ready.
- **[firebase/firebase.json](firebase/firebase.json)** now declares two codebases (`caspian-admin`, `caspian-stripe`) with matching `predeploy` build steps. Deploy targets become `firebase deploy --only functions:caspian-admin` and `firebase deploy --only functions:caspian-stripe`.
- **[scaffold/create.mjs](scaffold/create.mjs)** — scaffolder now always copies `functions-admin/` and always includes the `caspian-admin` entry in the generated `firebase.json`. Opt into Stripe with `--with-stripe` (or the back-compat alias `--with-functions`) — that adds `functions-stripe/` and the matching codebase entry.
- **[INSTALL.md §5](INSTALL.md)** rewritten to describe the two-codebase deploy flow: admin always, Stripe when ready.
- **Generated README's first-run checklist step #4** now deploys `functions:caspian-admin` as step 1 (before registering!), then `functions:caspian-stripe` as optional step 2 with a clear signal about what secrets are needed.

### Consumer action required on upgrade
If you were on v1.17.0 or earlier:

```bash
npm install github:Caspian-Explorer/script-caspian-store#v1.18.0 firebase
rm -rf functions                                  # delete the old unified codebase
cp -R node_modules/@caspian-explorer/script-caspian-store/firebase/functions-admin .
cp -R node_modules/@caspian-explorer/script-caspian-store/firebase/functions-stripe .   # only if you have Stripe
cp node_modules/@caspian-explorer/script-caspian-store/firebase/firebase.json .         # or merge manually
cd functions-admin && npm install && cd ..
firebase deploy --only functions:caspian-admin
```

The old `functions:caspian-store` deploy target is gone; use `functions:caspian-admin` and `functions:caspian-stripe` instead.

### Notes
- Previously-deployed `caspian-store` codebase functions on Firebase aren't automatically renamed by this change. After deploying `caspian-admin` and `caspian-stripe`, use `firebase functions:delete <functionName> --codebase caspian-store` to clean up the orphans, or just leave them — they'll be idle.
- v1.17.0's rules CI doesn't yet cover Cloud Functions compilation. Future release could add a `functions-admin: tsc --noEmit && functions-stripe: tsc --noEmit` step alongside the rules tests — catches type regressions in the triggers at PR time.

## v1.17.0 — Rules compile + behavior tests in CI

The last two shipped bugs — v1.13.0 (`storage.rules` grammar) and v1.15.0 (`users/{uid}` first-create silently denied) — both escaped because nobody ran `firebase deploy` before release. The rules tree now has two safety nets: the Firebase emulator runs on every PR (compiles the rules files, fails CI on grammar errors), and [@firebase/rules-unit-testing](https://firebase.google.com/docs/rules/unit-tests) executes a small behavior suite against the rules (would have caught v1.15.0 at PR time).

### Added
- **[.github/workflows/rules.yml](.github/workflows/rules.yml)** — the repo's first GitHub Action. Triggers on push / PR that touches `firebase/*.rules`, `firebase/firestore.indexes.json`, `firebase/firebase.json`, the test file, or the workflow itself. Steps: checkout → setup Node 20 → setup Java 17 (emulators are JVM-based) → `npm install --legacy-peer-deps` → install `firebase-tools` globally → `firebase emulators:exec --only firestore,storage "node --test firebase/rules.test.mjs"`. The `emulators:exec` command boots the emulator (which parses the rules on startup and exits non-zero on grammar errors), runs the behavior suite, and tears down. Both bug classes fail CI before reaching a release.
- **[firebase/rules.test.mjs](firebase/rules.test.mjs)** — Node-22 `node --test` + `@firebase/rules-unit-testing@5`. ~20 assertions covering:
  - `users/{uid}` — auth user can self-create with `role='customer'` or role omitted; **cannot** self-create with `role='admin'`; **cannot** self-promote via update; unauth can't read. This is the exact regression that hit v1.15.0.
  - `products/{id}` — public read; non-admin write denied; admin write succeeds.
  - `orders/{id}` — auth user can create own order; cannot read another user's; admin can read any.
  - `reviews/{id}` — auth user can create with `status='pending'` and rating in [1, 5]; cannot create with `status='approved'` or rating out of bounds.
  - `adminTodos/{id}` — non-admin read/write denied; admin read/write succeeds.
- **`emulators` + `storage` blocks in [firebase/firebase.json](firebase/firebase.json)** — firestore on `:8080`, storage on `:9199`, UI disabled, `singleProjectMode: true`. Required for `firebase emulators:exec` to know which services to boot.
- **`@firebase/rules-unit-testing@^5.0.0`** added as a devDep in the main [package.json](package.json).
- **`npm test` script:** `cd firebase && firebase emulators:exec --only firestore,storage "cd .. && node --test firebase/rules.test.mjs"`. Runs the same suite locally; requires `firebase-tools` on PATH and a JRE.

### Changed
- **[CLAUDE.md](CLAUDE.md) Pre-Commit Checklist step 2** flipped from "N/A — no test runner is configured" to the `npm test` instructions above, with a Java-not-installed fallback pointing at CI. The "don't add Jest/Vitest/Playwright" rule still applies for component/unit tests; the rules tests are a narrow exception.

### No consumer action required
CI infrastructure only — no source, public API, or ruleset change. Existing installs are unaffected; the upgrade is transparent.

### Notes
- Regression-verified locally: reverting the v1.15.0 `users/{uid}` rule fix makes three of the suite's assertions fail; re-applying the fix turns them green again. Proves the tests actually gate the bug they were written for, not just pass-through noise.
- The install of `@firebase/rules-unit-testing` requires `--legacy-peer-deps` because its v5 peers `firebase@^10` while this repo pins `firebase@^11` as a devDep to match consumer peer deps. The behavior is fine at runtime; the workflow passes the flag explicitly.

## v1.16.1 — Scaffolder firebase-admin bump + upgrade-path docs

Three small-but-real items from a post-v1.15 field review that didn't make it into v1.16.0: an `npm audit` footgun in the scaffolder's `firebase-admin` pin, a stale version pin in the manual-install copy-paste, and a missing upgrade-procedure note that causes "every route 500s" on in-place upgrades.

### Changed
- **[scaffold/create.mjs](scaffold/create.mjs) `firebase-admin` pin bumped `^12.0.0` → `^13.0.0`** in the generated project's devDependencies. Closes a long-standing `npm audit` noise footgun (transitive `@tootallnate/once` / older `@google-cloud/*` chain in 12.x) that made `npm audit fix --force` *downgrade* `firebase-admin` to 10.x and introduce 5 critical vulnerabilities. `seed.mjs` and `grant-admin.mjs` use stable SDK APIs (`admin.initializeApp` / `firestore()` / `auth()`); 12 → 13 is transparent.
- **Scaffolder-generated README Upgrade section** now documents the dev-server stale-cache footgun: stop `next dev`, bump the dep, redeploy rules if changed, clear `.next`, restart. Avoids the "every route 500s after upgrade" trap.
- **[INSTALL.md §1](INSTALL.md) manual-install copy-paste** no longer pins stale `#v1.9.0`; now points at `#v1.16.1` with a link to the releases page so readers can pick the latest.

### Notes
- Pure scaffolder + docs; no source or build changes. Consumers don't need to upgrade their code. For existing scaffolded projects: running `npm install firebase-admin@^13 --save-dev` in the consumer project brings the `firebase-admin` dep in line with what new scaffolds get.

## v1.16.0 — Frontend deployment path: Vercel + Firebase App Hosting

Consumers who followed `INSTALL.md` end-to-end ended up with deployed Firestore rules, Storage rules, Cloud Functions, and seed data — but **no documented path for deploying the Next.js site itself**. The generated `npm run firebase:deploy` script ran `firebase deploy`, but the scaffolder's `firebase.json` has no `hosting` block, so only the backend rules/functions deployed. Closing that gap with first-class docs + a scaffolded `apphosting.yaml`.

### Added
- **Firebase App Hosting wiring in [scaffold/create.mjs](scaffold/create.mjs).** Scaffolded projects now ship an `apphosting.yaml` at the project root declaring the six `NEXT_PUBLIC_FIREBASE_*` vars + `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` with `availability: [BUILD, RUNTIME]` (BUILD is required — Next.js inlines `NEXT_PUBLIC_*` at build time). Values left blank by design; consumers fill them via the Firebase console or commit non-sensitive values. Safe to delete if the consumer deploys to Vercel instead.
- **§8 "Deploy the Next.js site" in the scaffolder-generated README** ([scaffold/create.mjs](scaffold/create.mjs)). Two parallel subsections cover Vercel (`npx vercel@latest --prod`, paste env vars in dashboard) and Firebase App Hosting (`firebase init apphosting` + `firebase deploy --only apphosting`). Notes that the Stripe webhook points at the Cloud Function, not the Next.js site — switching hosts doesn't reconfigure it.
- **§11 "Deploy the Next.js frontend" in [INSTALL.md](INSTALL.md)** for the manual-install path. Mirrors the scaffolder README but targets consumers embedding the package into an existing React app; documents the minimal `apphosting.yaml` shape for those who aren't using the scaffolder. Upgrade moves from §11 to §12.

### Notes
- No source changes; this is pure scaffolder + docs. Existing installs on v1.15.x or earlier can upgrade without code edits, then copy the `apphosting.yaml` template from the new [INSTALL.md §11](INSTALL.md#11-deploy-the-nextjs-frontend) if they want Firebase App Hosting.

## v1.15.0 — Fix first-sign-in profile create + admin nav link + AccountPage polish

A consumer reported three issues on a fresh install: (1) `/account` was missing the Profile / Photo / Addresses cards and had a huge blank gap at the top, (2) there was no visible way to navigate to `/admin` from the UI. Root cause of (1) turned out to be a Firestore-rules bug that silently blocked first-ever profile creation; (2) was intentional security (hide admin from non-admins) but missing a `role === 'admin'` escape hatch. Fixed both, plus tightened the account-page layout.

### Fixed
- **[firebase/firestore.rules](firebase/firestore.rules) `users/{uid}` rule blocked first-ever profile creation.** The single `allow write` rule required `request.resource.data.role == resource.data.role`, but on create `resource.data` is null, so `'customer' == null` evaluated false and the write was denied. The client's [auth-context.tsx](src/context/auth-context.tsx) silently caught the permission error and set `userProfile = null`, which made every profile-dependent UI card (`<ProfileCard>`, `<ProfilePhotoCard>`, `<AddressBook>`) early-return null. Rule now splits into `allow create` (permits role absent or explicitly `'customer'`) and `allow update` (role must equal existing). Admin-branch and read-self are unchanged.
- **Consumer action required after upgrading:** re-deploy the Firestore rules — `firebase deploy --only firestore:rules` — or the bug persists on already-deployed projects. The rule ships in both the package's `firebase/firestore.rules` and any scaffolded consumer's own copy.

### Added
- **Admin nav link in [SiteHeader](src/components/site-header.tsx).** A small "Admin" button renders in the right-side cluster (before the account avatar) only when `userProfile.role === 'admin'`. Clicks through to `/admin`. Invisible to non-admins — no information leak. New i18n key `navigation.admin`.

### Changed
- **[AccountPage](src/components/auth/account-page.tsx) layout polished.** Wrapped in a `maxWidth: 960` container with `32px/24px` padding so it no longer stretches edge-to-edge on wide screens. Header now renders an [Avatar](src/ui/misc.tsx) (user's `photoURL` if present, initial fallback) next to the title + signed-in-as line, on a subtle gradient card. Section order tightened: Photo → Profile → Addresses → Password → Orders → Delete. No prop changes; `AccountPageProps` remains the same.

## v1.14.0 — Fix `<DynamicFavicon>` rendered outside `<CaspianStoreProvider>`

Consumer running a fresh scaffolded install saw `Error: useCaspianStore must be called inside <CaspianStoreProvider>` at runtime. Root cause: the scaffolder and INSTALL.md §3 both emitted a `layout.tsx` with `<DynamicFavicon />` as a **sibling** of `<Providers>` instead of a child. [`<DynamicFavicon>`](src/components/dynamic-favicon.tsx) calls `useCaspianFirebase()` which requires the provider above it in the tree.

### Fixed
- [scaffold/create.mjs](scaffold/create.mjs) generated `layout.tsx` — moved `<DynamicFavicon />` inside `<Providers>`.
- [INSTALL.md](INSTALL.md) §3 Next.js example — same correction.

### Notes
- Existing installs scaffolded from v1.7.0–v1.13.0 need to edit their own `src/app/layout.tsx` manually (bumping the package dep doesn't touch consumer files). One-line move:
  ```diff
       <Providers>
         <LayoutShell>{children}</LayoutShell>
  +      <DynamicFavicon />
       </Providers>
  -    <DynamicFavicon />
  ```
- Consider adding a runtime sanity check to `<DynamicFavicon>` that renders a clearer *"must be inside `<CaspianStoreProvider>`"* message instead of bubbling the generic `useCaspianStore` error — deferred to a later release.

## v1.13.0 — Fix `storage.rules` compile error on fresh installs

A consumer running `firebase deploy --only storage` against a fresh install hit a grammar error. Root cause was a `{wildcard}` inside a path segment — not supported by Firebase Storage rules grammar. Bug dates back to v0.6.0 (profile-photo feature) and was never caught because storage rules only compile at deploy time and CI doesn't run `firebase deploy`.

### Fixed
- [firebase/storage.rules](firebase/storage.rules) — replaced `match /users/{uid}/avatar.{ext} { … }` with `match /users/{uid}/{filename} { … }`. Security is unchanged: the existing `write` guard already enforces `contentType.matches('image/(jpeg|png|webp)')` + `size < 5 MB`, so relaxing the path pattern doesn't broaden what can be uploaded.

### Notes
- No `{path=**}` recursive wildcard was used — avatars are a single flat file, not a subtree. Single-segment `{filename}` is the minimal fix.
- Consider adding `firebase emulators:start --only storage` (which compiles the rules on boot) to CI so future rules regressions fail at PR time, not at consumer-deploy time.

## v1.12.0 — Configurable Next version + optional `create-next-app` delegation

Picks up the two 🔵 nits the install reviewer explicitly deferred — closing out the punch list.

### Added
- **`--next-version <spec>`** on [scaffold/create.mjs](scaffold/create.mjs). Overrides the pin for `next` in the generated `package.json`. Default bumped from the old hard-coded `^14.2.0` to `^15.0.0`. Users who want Next 14 can still scaffold with `--next-version '^14.2.0'`.
- **`--use-create-next-app`** on [scaffold/create.mjs](scaffold/create.mjs) (opt-in). When passed, the scaffolder delegates the Next.js boilerplate to `npx create-next-app@latest` (flags: `--typescript --app --src-dir --no-tailwind --no-eslint --import-alias "@/*" --use-npm --yes --skip-install --disable-git`) and overlays our package dependencies, scripts, pages, adapters, providers, and Firebase config on top. This insulates the generated `tsconfig.json`, `next.config.*`, `next-env.d.ts`, and `.gitignore` from drifting out of step with Next upstream. Windows uses `shell: true` with a single command string so `cmd.exe` resolves the `npx.cmd` wrapper via `PATHEXT`; Linux/macOS spawn `npx` directly.

### Changed
- **Default Next pin** in the scaffolder is now `^15.0.0` (was `^14.2.0`). Next 15 supports React 19 — when using `--use-create-next-app`, the merged `package.json` inherits Next 15's `react`/`react-dom` `19.x` pins and `@types/react` `^19`. Hand-written path keeps the existing React 18 pins for backward compat; pass `--use-create-next-app` to get the React 19 stack.

### Notes
- Both paths are verified end-to-end: hand-written with default `^15.0.0`, hand-written with `--next-version '^14.2.0'`, and `--use-create-next-app` (network-dependent, ~30s). `--use-create-next-app` currently opts in; may flip to default after it's battle-tested.

## v1.11.1 — `npm create caspian-store@latest` (thin sibling package)

Main-package bump covers the doc updates; the actual new capability ships as a separate npm package.

### Added
- **`create-caspian-store` v0.1.0** ([create-caspian-store/](create-caspian-store/)) — a thin launcher published separately to npm. Enables `npm create caspian-store@latest <project-dir>` by cloning this repo shallowly into a temp dir, invoking [scaffold/create.mjs](scaffold/create.mjs) against the user's target with all flags forwarded, then cleaning up the clone. Requires `git` on `PATH` and Node ≥ 18.

### Changed
- [README.md](README.md) Quickstart now leads with `npm create caspian-store@latest`; the git-URL install remains as the "Manual install" path.
- [INSTALL.md](INSTALL.md) §0 replaced with the `npm create` one-liner; the old `git clone + node scaffold/create.mjs` invocation kept as a fallback for offline / locked-network environments.

### Not affected
- No source, build, or public API changes in the main package — so no upgrade action is required. `npm install github:Caspian-Explorer/script-caspian-store#v1.11.0` and `#v1.11.1` are interchangeable for consumers of the main package.

## v1.11.0 — Admin onboarding: auto-promote + grant-admin CLI

First-install admin grant no longer requires hunting for a uid in the Firebase console or editing Firestore by hand.

### Added
- **`onUserCreate` Firestore trigger** ([firebase/functions/src/on-user-create.ts](firebase/functions/src/on-user-create.ts)) — when the first-ever `users/{uid}` doc is created and no admin exists yet, promotes that user to `role: 'admin'`. Once any admin exists the trigger permanently short-circuits, so it's a strictly first-install helper. Exported from [firebase/functions/src/index.ts](firebase/functions/src/index.ts) alongside the Stripe handlers; deployed automatically when consumers run `firebase deploy --only functions`.
- **`grant-admin.mjs` CLI** ([firebase/seed/grant-admin.mjs](firebase/seed/grant-admin.mjs)) — promotes an existing user by email or uid. Accepts `--project`, `--credentials`, `--email <addr>` OR `--uid <uid>`. When `--email` is passed, resolves the uid via `firebase-admin/auth` before writing `users/{uid}.role = 'admin'` with `{ merge: true }`. Fails loudly if the target hasn't signed in yet (no users/{uid} doc) or the email doesn't match a Firebase Auth record.
- Scaffolder-generated `package.json` gains `"grant-admin"` as an npm script, pointing at `node_modules/@caspian-explorer/script-caspian-store/firebase/seed/grant-admin.mjs`.

### Changed
- **INSTALL.md §7** rewritten to present three paths — auto-promote (preferred), `grant-admin` CLI by email or uid (explicit), and hand-edit in the Firebase console (fallback) — instead of the old "find your uid in the console, re-run seed --admin".
- **Scaffolder generated README** — the admin-grant step now points at auto-promote first and `npm run grant-admin -- --email` as the explicit path; no more Firebase-console uid hunting.

### Security note
The `onUserCreate` trigger has a small race window during initial deployment: between the function going live and the installer registering their account, any other sign-up wins the admin role. Mitigations: deploy the function immediately before signing up, or leave it disabled and use the CLI. The in-code "check for existing admin before promoting" guard protects against *later* auto-promotions, not this initial race.

## v1.10.0 — Scaffolder polish + AdminGuard UID helper

The turnkey scaffolder produces a project that can now `firebase deploy` cleanly without any manual `cp` from `node_modules`, and a non-admin landing on `/admin` finally sees their own UID with a copy button instead of being told to hunt for it in the Firebase console.

### Added
- **`--with-functions` flag** on [scaffold/create.mjs](scaffold/create.mjs). Copies the package's [firebase/functions/](firebase/functions/) tree (Stripe Cloud Functions + Node 20 `package.json` + `tsconfig`) into the generated project and adds the `functions` block to `firebase.json`. Default stays off so a first-time user doesn't need a Blaze-plan upgrade on day one.
- **AdminGuard UID display.** When `userProfile.role !== 'admin'`, the access-denied screen now renders the signed-in user's `uid` in a monospaced block with a **Copy UID** button. Paste straight into `npm run firebase:seed -- --admin <uid>`.

### Fixed
- **Scaffolder wrote comment-only rule stubs.** The generated `firestore.rules`, `firestore.indexes.json`, and `storage.rules` were placeholder files telling the user to "copy me from node_modules" — anyone running `firebase deploy --only firestore:rules` before reading them deployed a comment-only ruleset and locked their database. The scaffolder now copies the real files from [firebase/](firebase/) at scaffold time.
- **Scaffolder refused to run on any non-empty directory.** Fresh `gh repo create` / `git init` leaves `.git`, `.gitignore`, `README.md`, `LICENSE` around — the scaffolder now detects these as "harmless", proceeds without `--force`, and emits a clearer error listing the actual files that would be overwritten when it can't.
- **Scaffolder wrote a `functions` block for a non-existent directory.** `firebase.json` used to list `functions: [{ source: 'functions', ... }]` while no `functions/` was ever created, making `firebase deploy --only functions` fail. The block is now written only when `--with-functions` is passed.
- **Scaffolder's `--package-tag` default was hard-coded** (last release: `v1.8.0`, so fresh clones post-v1.9.0 still pinned to v1.8.0). Now reads the package's own `package.json` version at scaffold time.

### Changed
- **`.env.example`** generated by the scaffolder gains `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=` and a comment explaining that `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` are Cloud Functions secrets (set via `firebase functions:secrets:set`), not env vars.
- **Generated `README.md`'s first-run checklist** drops the obsolete `cp node_modules/.../firebase/*.rules` step (the scaffolder now drops them in directly) and points admin-grant instructions at the new AdminGuard UID copy button.

## v1.9.0 — Unblock installs (fixed `'use client'`, fixed `exports` map)

Fresh installs into Next.js App Router now render. Two build-time bugs that had quietly shipped since tsup 8.5 upgraded the ESM/CJS filename convention are fixed.

### Fixed
- **`'use client'` preservation in the main bundle.** esbuild was stripping the module-level directive during bundling (warning: "Module level directives cause errors when bundled"), so consumers hit RSC-context errors the moment they imported anything from the package. The fix prepends `'use client';` to `dist/index.mjs` and `dist/index.js` via a tsup `onSuccess` hook — `banner: { js: "'use client';" }` does NOT work (esbuild strips it), and `esbuild-plugin-preserve-directives` was not preserving directives on Windows. The `./firebase` sub-entry is intentionally left unbannered so `initCaspianFirebase`, `caspianCollections`, and the Firestore rules/indexes constants stay callable from Node deploy scripts, Cloud Functions, and Server Components.
- **`exports` map referenced files tsup no longer emits.** Under tsup 8.5, ESM outputs are `.mjs` and CJS outputs are `.js`. The `exports` map was pinned to the older tsup convention (`.js` for ESM, non-existent `.cjs` for CJS), so `require('@caspian-explorer/script-caspian-store')` failed to resolve. Exports now map `import` → `.mjs` and `require` → `.js` for both the root and `./firebase` entries.

### Changed
- [tsup.config.ts](tsup.config.ts) split into two configs — main entry (gets the directive) and firebase sub-entry (does not) — so the two can be banner'd independently.
- [README.md](README.md) and [INSTALL.md](INSTALL.md) refreshed: stale version pins updated, the long-standing "a v0.1.1 release will preserve per-file directives automatically" promise removed (it's now actually preserved), the roadmap collapsed into a short release-history summary pointing at this CHANGELOG, and §0 (scaffolder) now branches cleanly from §1–§11 (manual install).

### Added
- **[CLAUDE.md](CLAUDE.md)** — orientation + workflow for AI coding sessions. Captures durable architecture invariants (two tsup entries, provider nesting order, framework-adapter contract, centralized Firestore collection refs, Server Component boundary), conventions (services signature, theming surface, i18n, class merging), the full release cycle (bump → docs → verify → commit → tag → push → release → announce), and the never-do list.
- `.claude/` added to [.gitignore](.gitignore) so session-local Claude state stays out of the repo.

## v1.8.0 — Admin todo list + seeded setup checklist

Adds an in-admin todo list so the person running the store has a single place to track setup actions and day-to-day operational tasks.

### Added
- **`<AdminTodoPage>`** — new admin page at `/admin/todos`. Lists tasks with checkboxes, progress bar (`N / M complete (X%)`), a "Hide completed" filter, inline add (press Enter to create), and per-row delete. Seeded tasks are tagged with a "Setup" badge so they're distinguishable from admin-added ones.
- **Setup checklist** — 12 pre-written tasks covering the manual steps needed to make a fresh install production-ready: deploy rules, deploy Cloud Functions, configure Stripe webhook, grant admin role, edit site settings, activate languages, seed categories + products, verify shipping, edit hero, pin featured content. Empty `adminTodos` collection shows a "Seed setup checklist" button; clicking it writes the defaults idempotently (re-seeding skips existing ids).
- **`admin-todo-service`** — `listAdminTodos` / `createAdminTodo` / `updateAdminTodo` / `deleteAdminTodo` / `seedDefaultAdminTodos` + `DEFAULT_ADMIN_TODOS` exported from the package root.
- **Types** — `AdminTodo` interface exported.
- **Nav** — `DEFAULT_ADMIN_NAV` gains a "Todo list" entry between Dashboard and Products.
- **Firestore rules** — new `match /adminTodos/{id}` block (admin-only read + write).
- **Scaffolder** — generates `src/app/admin/todos/page.tsx` and pins new installs to v1.8.0.

### Migration note
Drop-in from v1.7.0. Existing consumers get the new page automatically by bumping the tag; the `adminTodos` collection is empty until an admin clicks "Seed setup checklist".

## v1.7.0 — Turnkey install (scaffolder + seed + rewritten INSTALL)

No runtime changes. Makes the package trivial to install on a fresh domain.

### Added
- **`scaffold/create.mjs`** — Node scaffolder that generates a ready-to-run Next.js App Router consumer site wired up to the package. 48 pre-mounted routes (storefront + auth + account + editorial + admin), Next.js adapter code, Firebase config placeholders, tailored README with first-run checklist. Run with `node <path>/scaffold/create.mjs my-store [--package-tag vX.Y.Z]`.
- **`firebase/seed/seed.mjs`** — idempotent Firestore seeder using `firebase-admin`. Writes the `languages` collection (en/ar/de/es/fr with English as default), `settings/site` brand placeholders, `scriptSettings/site` (theme + hero + fonts), and `shippingMethods` (standard + express). Optional `--admin <uid>` flag promotes a Firebase Auth user to admin.
- **`INSTALL.md`** — fully rewritten for v1.6.0+. Covers the one-command scaffold path up front, then every surface added in phases 2–6 (homepage, journal, FAQs, shipping, size guide, admin CRUD pages, site shell), multi-locale i18n, theming, fonts, Troubleshooting section.

### Packaging
- `scaffold/` directory is now included in the published tarball so `node_modules/@caspian-explorer/script-caspian-store/scaffold/create.mjs` resolves after install.

## v1.6.0 — Site shell (header, footer, layout, favicon)

Sixth and final release in the hadiyyam migration series. Ships the site chrome — header, footer, layout shell, and dynamic favicon — so consumers can drop their bespoke shell components and have a working storefront end-to-end out of the package. No breaking changes.

### Added
- **`<SiteHeader>`** — sticky header with brand (auto-loaded from `settings/site.brandName`, falls back to a `brandFallback` prop), configurable top-level nav, optional "Pages" dropdown for secondary nav, search slot, language-switcher slot, user-menu slot, wishlist + cart icon buttons. The cart button opens an inline `<CartSheet>` so consumers don't need to wire it up themselves.
- **`<SiteFooter>`** — four-column footer (brand + description + social, About, Customer care, Newsletter). Brand description and social links read from `settings/site` automatically. Newsletter form posts to the `subscribers` collection via the already-shipped `subscribeEmail` helper. Social icons use a built-in `<SocialIcon>` SVG mapper for the 8 most-common platforms (instagram, facebook, twitter/x, youtube, tiktok, linkedin, pinterest); override via `renderSocialIcon` prop.
- **`<LayoutShell>`** — wraps children with `<SiteHeader>` + `<SiteFooter>` and bypasses the chrome on routes whose pathname (after stripping the locale prefix) starts with one of `bypassPrefixes` (default `['/admin']`). Pass `header={null}` or `footer={null}` to disable either band; pass props through to override defaults.
- **`<DynamicFavicon>`** — reads `settings/site.faviconUrl` and updates the document's `<link rel="icon">`. Mount once in your root layout.
- **`<SocialIcon>`** — exported standalone for consumers who want to reuse the icon set elsewhere.
- **i18n** — DEFAULT_MESSAGES gains 16 new keys under `navigation.*` and `footer.*` so the shell renders sensibly even with no consumer-supplied dict.
- **Adapter contract** — `CaspianLinkProps` now accepts an optional `style` prop. Existing consumer Link adapters keep working; the package's defaults pass it through.

### Migration note
Upgrading from v1.5.x is drop-in. Hadiyyam PR #6 pins this tag, retires `src/components/header.tsx`, `footer.tsx`, `layout-shell.tsx`, and `dynamic-favicon.tsx`, and replaces them with one-line mounts of the package components. After PR #6 merges, hadiyyam's `src/` is roughly 80% smaller than at the start of the migration series.

## v1.5.0 — Remaining admin CRUD (promo codes, subscribers, categories, collections, languages, site settings)

Fifth release in the hadiyyam migration series. Ships the last set of admin pages so consumers can retire every bespoke admin CRUD they still carry. No breaking changes.

### Added
- **`<AdminPromoCodesPage>`** — CRUD for the `promoCodes` collection: code (auto-uppercased), type (`percentage` | `fixed`), value, optional `minOrderAmount` / `maxDiscount`, active toggle.
- **`<AdminSubscribersPage>`** — list of `subscribers` docs with email search, delete, and a one-click CSV export (Blob download, `subscribers-YYYY-MM-DD.csv`).
- **`<AdminProductCategoriesPage>`** — hierarchical CRUD for `productCategories`. Parent-category select is filtered to exclude self when editing. Slug auto-generates from name when left blank. Supports `isActive` + `isFeatured` flags and a display `order` integer.
- **`<AdminProductCollectionsPage>`** — CRUD for `productCollections`. Includes a searchable product picker with selected-chips view so merchandisers can assemble a curated set of products for a named collection.
- **`<AdminLanguagesPage>`** — CRUD for the `languages` registry: code (BCP 47), name, native name, flag emoji, direction (`ltr` | `rtl`), default flag, active flag. Blocks deleting the default language.
- **`<AdminSiteSettingsPage>`** — single-form editor for the `settings/site` doc: brand name, brand description, logo URL, favicon URL, contact email/phone/address, business hours, and a repeatable list of social links.
- **Services** — `promo-code-service` gains `listPromoCodes` / `createPromoCode` / `updatePromoCode` / `deletePromoCode` / `PromoCodeWriteInput`; `subscriber-service` gains `listSubscribers` / `deleteSubscriber` / `subscribersToCsv`; `category-service` gains `listAllCategories` / `createCategory` / `updateCategory` / `deleteCategory` / `CategoryWriteInput`; **new** `product-collection-service` (`listProductCollections` + CRUD + `ProductCollectionWriteInput`); **new** `language-service` (`listLanguages` + CRUD + `LanguageWriteInput`); **new** `site-settings-service` (`getSiteSettings`, `saveSiteSettings`).
- **Exports** — all the above pages, services, and write-input types exported from the package root.

### Migration note
Upgrading from v1.4.x is drop-in. Hadiyyam PR #5 pins this tag, retires `admin/promo-codes/page.tsx`, `admin/subscribers/page.tsx`, `admin/categories/page.tsx`, `admin/collections/page.tsx`, `admin/languages/page.tsx`, and `admin/settings/page.tsx`, and collapses each to a one-line mount of the package component.

## v1.4.0 — FAQs + shipping/returns + size guide

Fourth release in the hadiyyam migration series. Rounds out the static-content surfaces with FAQs, shipping/returns, and a size guide, plus their admin editors. No breaking changes.

### Added
- **`<FaqsPage>`** — public accordion page grouping `faqs` docs by category. Configurable `categoryLabels`, `categoryOrder`, `title`, `subtitle`, `emptyMessage`.
- **`<AdminFaqsPage>`** — CRUD editor with category select + per-row display order. Ships a sensible default category list (`orders` / `returns` / `products` / `account` / `general`); override via `categoryOptions`.
- **`<ShippingReturnsPage>`** — renders active `shippingMethods` as a table with locale-aware price formatting, then appends the long-form returns copy from `pageContents/shipping-returns` (or whatever `returnsPageKey` you configure).
- **`<AdminShippingPage>`** — shipping-method CRUD: name, slug (auto-generated from name), price, min/max estimated days, display order, active toggle with show/hide shortcut.
- **`<SizeGuidePage>`** — reads `scriptSettings.sizeGuide` or falls back to the exported `DEFAULT_SIZE_GUIDE` (tops/bottoms/shoes tables). The size-guide config is now a typed `SizeGuideConfig` (tables + tips) that consumers can seed to Firestore per site.
- **Types** — `SizeTableRow`, `SizeTable`, `SizeGuideConfig` exported. `ScriptSettings` gains an optional `sizeGuide?: SizeGuideConfig` field.
- **Services** — `faq-service.ts` (`listFaqs`, `createFaq`, `updateFaq`, `deleteFaq`) and `shipping-method-service.ts` (`listShippingMethods` with `{ onlyActive }` filter, `createShippingMethod`, `updateShippingMethod`, `deleteShippingMethod`).

### Migration note
Upgrading from v1.3.x is drop-in. Hadiyyam PR #4 pins this tag, retires `faqs/page.tsx`, `shipping-returns/page.tsx`, `size-guide/page.tsx`, `admin/faqs/page.tsx`, and `admin/shipping/page.tsx`.

## v1.3.0 — Journal + generic content pages

Third release in the hadiyyam migration series. Ships the editorial/journal surface plus a generic page-content system so hadiyyam can retire its hardcoded `journal/`, `about/`, `contact/`, `privacy/`, `terms/`, `sustainability/` pages in a follow-up PR. No breaking changes.

### Added
- **`<JournalListPage>`** — responsive card grid reading from the `journal` Firestore collection (ordered by `createdAt` desc). Configurable `getArticleHref`, `title`, `subtitle`, `emptyMessage`.
- **`<JournalDetailPage articleId={id}>`** — full-width article view with hero image, category badge, date, paragraph-split content (splits on double newlines), and a back link. `onNotFound` callback.
- **`<PageContentView pageKey>`** — drop-in long-form page reading from `pageContents/{pageKey}`. Shows an optional `fallback={{ title, subtitle, content }}` when no doc exists yet, and accepts an `afterContent` slot for page-specific extras (e.g. a contact form).
- **`<AdminJournalPage>`** — create / edit / delete articles. Cover images upload to `journal/{filename}` in Firebase Storage via the new `uploadAdminImage` helper; best-effort Storage cleanup on delete.
- **`<AdminPagesPage pageKeys={[...]}>`** — table-driven editor for `pageContents/{pageKey}` docs. Ships `DEFAULT_PAGE_KEYS = ['about', 'contact', 'privacy', 'terms', 'sustainability', 'shipping-returns', 'size-guide']`; consumers can override.
- **Services** — `journal-service.ts` (`listJournalArticles`, `getJournalArticle`, `createJournalArticle`, `updateJournalArticle`, `deleteJournalArticle`), `page-content-service.ts` (`getPageContent`, `listPageContents`, `savePageContent`).
- **Storage helpers** — `uploadAdminImage({ storage, path, file })` + `deleteStorageObject(storage, path)` exports for admin upload flows.
- **Storage rules** — `firebase/storage.rules` now gates `/journal/**` and `/pageContents/**` by a Firestore-backed `isAdmin()` helper (no custom claims required). Same pattern as the Firestore rules the package already ships.

### Migration note
Upgrading from v1.2.x is drop-in. Hadiyyam PR #3 will pin this tag, replace the journal + content pages, and collapse the hadiyyam admin pages for journal and pageContents to one-line renders of the package components.

## v1.2.0 — Homepage + font management

Second release in the hadiyyam migration series. Ships the homepage surface and a font-management system so hadiyyam can retire its bespoke `[locale]/page.tsx` in a follow-up PR. No breaking changes.

### Added
- **`<Hero>`** — full-bleed homepage hero. Title / subtitle / CTA / background image all read from `scriptSettings.hero` (admin-editable). A gradient fallback renders when no image is set. Override any field inline via `<Hero hero={{ title, subtitle, cta, ctaHref, imageUrl }} />`.
- **`<FeaturedCategoriesSection>`** — calls `getFeaturedCategories(db)` (new service) and renders a responsive card grid. Hides when the list is empty.
- **`<TrendingProductsSection>`** — wraps `<ProductGrid>` with a `limit` (default 4) and title/label copy.
- **`<NewsletterSignup>`** — email capture form backed by the new `subscribeEmail(db, email)` service. Idempotent: returns `'already-subscribed'` when the email is already in `subscribers/`. Ships full-section and `compact` layouts.
- **`<HomePage>`** — compound component that stacks the four built-in sections with section-hide flags and `after*` slots for custom blocks.
- **Font management** — new `<FontLoader>` auto-mounted inside `<CaspianStoreProvider>`. Pushes `--caspian-font-body` / `--caspian-font-headline` CSS variables from `scriptSettings.fonts`; when `fonts.googleFamilies` is populated it injects a `<link>` tag for `fonts.googleapis.com/css2?…` with preconnect hints. Admin-editable via `<ScriptSettingsPage>`, which gained a **Fonts** section and a **Homepage hero** section.
- **Services** — `category-service.ts` (`listActiveCategories`, `getFeaturedCategories`) and `subscriber-service.ts` (`subscribeEmail`).
- **Messages** — ~12 new keys under `settings.fonts.*`, `settings.hero.*`.

### Changed
- `<ScriptSettingsPage>` grew two new sections (Fonts, Homepage hero).
- `<CaspianStoreProvider>` now mounts `<FontLoader />` as a sibling to `<ThemeInjector />`. No consumer change required.

### Migration note
Upgrading from v1.1.x is drop-in. Hadiyyam PR #2 pins this tag, replaces `[locale]/page.tsx` with `<HomePage>`, and deletes the hardcoded homepage. Hero title / subtitle / CTA / image that lived in next-intl JSON become editable from `/admin/settings`.

## v1.1.0 — Stripe + i18n parity for hadiyyam migration

Groundwork release for the hadiyyam migration. Brings the package's Stripe server logic and i18n capabilities to parity with hadiyyam's production setup so phase-1 migration can install this tag and retire a big chunk of the native implementation. No breaking changes — everything is additive.

### Added
- **Cloud Functions — `createStripeCheckoutSession`** rewritten to match hadiyyam's `/api/checkout/create-session`:
  - Server-side cart validation (product exists, `isActive`, per-size stock).
  - Server-side promo code resolution from the `promoCodes` collection with `isActive` / `minOrderAmount` / `maxDiscount` honored. Coupon created on Stripe when a valid discount applies.
  - Optional shipping cost added as a line item; shipping details passed through via session metadata.
  - Rich session metadata (`userId`, `userEmail`, `items` JSON, `shippingInfo` JSON, `shippingCost`, `discount`, `promoCode`, `locale`) for the webhook to reconstruct the order.
- **Cloud Functions — `stripeWebhook`** upgraded:
  - Duplicate-event detection by `payment.stripeSessionId`.
  - Enriched `payment` object with card brand + last4 from the retrieved payment intent.
  - Full order doc matching hadiyyam's schema (`subtotal`, `shippingCost`, `discount`, `promoCode`, `total`, serverTimestamps, `shippingInfo`).
  - Per-size stock decrement, best-effort with try/catch.
  - Cart clearing after order creation.
- **Cloud Functions — new `getStripeSession`** callable. Maps a Stripe session ID → Firestore order ID (parity with hadiyyam's `/api/checkout/session`). Useful on the order-success page.
- **`useCheckout`** gains:
  - Optional `endpoint: string` — when set, posts JSON to the consumer's URL (with a bearer `Authorization` header) instead of invoking the callable. Lets Next.js consumers keep existing API routes.
  - Optional `promoCode`, `shippingCost`, `shippingInfo`, `locale` fields on `StartCheckoutOptions`.
  - Exports the new `CheckoutShippingInfoInput` type.
- **`validatePromoCode(db, code, subtotal)`** — client-side preview helper that mirrors the server's discount math. Returns `AppliedPromoCode` or `null`. Display-only; server still re-validates at checkout.
- **i18n — `LocaleProvider`** gains:
  - New `messagesByLocale?: Record<string, MessageDict>` prop for multi-locale sites. Active `locale` selects the dict; `fr-CA` → `fr` falls back to the primary subtag.
  - Automatic `dir="rtl"` CSS custom property (`--caspian-direction`) for Arabic / Hebrew / Farsi / Urdu locales.
  - New `useDirection()`, `useFormatNumber()`, `useFormatCurrency(currency)`, `useFormatDate()` hooks wrapping the native `Intl` API with locale awareness.
  - `isRtl(locale)` helper exported.
- **`interpolate`** upgraded to a minimal ICU plural subset: `{count, plural, =0 {none} one {one} other {# items}}`. Simple `{placeholder}` substitution still works.
- **`CaspianStoreProvider`** forwards `messagesByLocale` to the LocaleProvider.
- **Types** — new exports matching hadiyyam's Firestore schema: `FaqItem`, `JournalArticle`, `Subscriber`, `SocialLink`, `SiteSettings`, `PromoCode`, `AppliedPromoCode`, `ShippingMethod`, `ProductCategoryDoc`, `ProductBrandDoc`, `ProductCollectionDoc`, `PageContent`, `LanguageDoc`, plus `FontTokens` and `HeroTokens`.
- **`ScriptSettings`** gains optional `fonts` and `hero` blocks (seeded with sensible defaults). Consumers can ignore both; they become active in v1.2.
- **`DEFAULT_MESSAGES`** gains ~30 keys for home / journal / FAQs / content pages / size guide / shipping so forthcoming phases don't redefine them mid-migration.

### Changed
- Bundle grew from 40 KB → 47 KB (`.d.ts`) to cover new exports. No runtime-size regression for tree-shaken consumers.

### Migration notes
Consumers upgrading from v1.0.0 have nothing to do — all changes are additive. Before deploying the new Cloud Functions, set the existing `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` secrets; nothing else changed about the deploy flow.

## v1.0.0 — Stable release

The public API is now frozen. All user-facing surfaces route through `useT()`, a `LocaleSwitcher` ships, and the six-stage roadmap closes out.

### Added
- **Full string migration** — every user-visible literal in storefront (product card, grid, list/detail pages, cart sheet), reviews & Q&A (summary, list, items, dialogs), checkout + order confirmation + order history, wishlist button, and the account cards (profile, address book, change password, script settings page) now flows through `useT()`. `DEFAULT_MESSAGES` gained ~140 keys covering these surfaces.
- **`<LocaleSwitcher />`** — minimal dropdown UI for switching locales. Consumers own where the chosen code is persisted (URL, cookie, user profile) and feed it back into the provider's `locale` prop.

### Changed
- Minor: components that previously accepted `emptyMessage` / `subtitle` / `title` string props now default to `useT(...)` keys when those props are omitted — explicit overrides still win.

### API surface
Stable as of v1.0 (see [README §Package surface](./README.md#package-surface)):
- Provider: `CaspianStoreProvider`, `useCaspianStore` + `useCaspian{Link,Image,Navigation,Collections,Firebase}`
- Hooks: `useAuth`, `useCart`, `useCheckout`, `useWishlist`, `useScriptSettings`, `useT`, `useLocale`, `useToast`
- Storefront: `ProductListPage`, `ProductGrid`, `ProductCard`, `ProductDetailPage`, `ProductGallery`, `SizeSelector`, `QuantitySelector`, `CartSheet`, `StarRatingInput`
- Reviews: `ProductReviews`, `ReviewSummary`, `ReviewList`, `ReviewItem`, `QuestionList`, `QuestionItem`, `WriteReviewDialog`, `AskQuestionDialog`
- Checkout + account: `CheckoutPage`, `OrderConfirmationPage`, `OrderHistoryList`, `WishlistButton`, `LoginPage`, `RegisterPage`, `ForgotPasswordPage`, `AccountPage`, `ProfileCard`, `AddressBook`, `ChangePasswordCard`, `ProfilePhotoCard`, `DeleteAccountCard`, `ScriptSettingsPage`
- Admin: `AdminGuard`, `AdminShell`, `AdminDashboard`, `AdminProductsList`, `AdminProductEditor`, `AdminOrdersList`, `AdminOrderDetail`, `AdminReviewsModeration`
- Theming + i18n: `ThemePresetPicker`, `THEME_PRESETS`, `LocaleProvider`, `LocaleSwitcher`, `DEFAULT_MESSAGES`
- UI primitives: `Button`, `Dialog`, `Input`, `Textarea`, `Label`, `Tabs`, `Select`, `Skeleton`, `Badge`, `Avatar`, `Separator`, `Table`

## v0.6.0 — Stage 5 i18n, theming presets, profile photo, delete account

Rounds out the customer + account surface with localization infrastructure, theme presets, Firebase Storage-backed profile photos, and a safe delete-account flow. This is the last feature release before v1.0 stabilizes the API.

### Added
- **i18n** — `<LocaleProvider>` + `useT()` hook + `DEFAULT_MESSAGES` dictionary. `CaspianStoreProvider` now accepts `locale` and `messages` props; partial overrides merge onto the defaults, so consumers can ship a tiny override dict or a complete translation. The login / register / forgot-password / account pages have been migrated to `useT()` as reference implementations; other surfaces still read defaults and can be migrated incrementally.
- **Theming presets** — `THEME_PRESETS` constants (`minimalLight`, `minimalDark`, `boutique`, `neon`, `pastel`, `monochrome`) plus a `<ThemePresetPicker />` swatch grid that writes the chosen preset to `scriptSettings/site`. Integrated into the existing `<ScriptSettingsPage />` above the manual color inputs.
- **Profile photo** — `<ProfilePhotoCard />` with upload-or-remove controls. Uploads to `users/{uid}/avatar.{ext}` in Firebase Storage (JPEG/PNG/WebP, ≤5 MB), then mirrors the download URL into the user's Firestore doc *and* `auth.currentUser.photoURL`.
- **Delete account** — `<DeleteAccountCard />` with a two-step dialog: re-enter password (skipped for Google accounts), type `DELETE` to confirm. On confirm, clears the user's Firestore docs (`users/{uid}`, `carts/{uid}`), calls `deleteUser`, signs out, and redirects. Order history is intentionally preserved for records.
- **Storage service** — `uploadProfilePhoto`, `removeProfilePhoto`, plus `MAX_PROFILE_PHOTO_BYTES` / `ALLOWED_PROFILE_PHOTO_TYPES` constants.
- **Storage rules** — `firebase/storage.rules` published for consumers to deploy (`firebase deploy --only storage`). Reads public (review avatars), writes scoped to the authenticated user's own path with 5 MB / image-mime enforcement.
- **AccountPage** — now stacks `ProfilePhotoCard` + `ProfileCard` + `ChangePasswordCard` + `AddressBook` + order history + `DeleteAccountCard`. New section-level hide props: `hidePhoto`, `hideDeleteAccount`.

### Changed
- `CaspianStoreProvider` now wraps `LocaleProvider` at the top of the tree so `useT()` works from anywhere inside.

### Known limitations (land in v1.0)
- String migration is partial — only auth + account views use `useT()`. Storefront, checkout, admin, and reviews still render English literals. Migration is mechanical; will happen before v1.0 API freeze.
- No locale-switcher component yet; consumers set `locale` + `messages` at the provider level.

## v0.5.0 — Stage 4 auth & account

Ships the user-facing auth surface — sign-in, sign-up, forgot password — plus a full account page with profile editing, addresses, password change, and order history.

### Added
- **`<LoginPage>`** — email/password form + "Continue with Google" + remember-me + forgot-password link. Uses `useAuth().signIn` / `signInWithGoogle`.
- **`<RegisterPage>`** — name/email/password/confirm form + "Continue with Google". Validates confirm + minimum password length.
- **`<ForgotPasswordPage>`** — email → `sendPasswordResetEmail` with a success state.
- **`<ProfileCard>`** — inline edit for `displayName`; email is read-only.
- **`<AddressBook>`** — list, add, edit, delete, and set-default on `users.addresses`. First address auto-set as default; removing the default promotes the next entry.
- **`<ChangePasswordCard>`** — re-authenticates with `EmailAuthProvider` and calls `updatePassword`. Detects Google-provider accounts and shows a friendly hint.
- **`<AccountPage>`** — compound page stacking `ProfileCard` + `ChangePasswordCard` + `AddressBook` + `OrderHistoryList`. Section-level hide props (`hideOrders`, `hideAddresses`, `hidePassword`). Sign out in the header.
- **Service** — `user-service`: `updateDisplayName`, `addAddress`, `updateAddress`, `deleteAddress`, `setDefaultAddress`.
- **Example routes** — `/login`, `/register`, `/forgot-password`; `/account` now mounts `<AccountPage />`.

### Known limitations (land in v0.6+)
- Profile photo upload + delete-account flow are staged for v0.6 alongside Firebase Storage wiring.
- No social providers beyond Google yet.
- Email verification banner not enforced — Firebase still sends the verification email on sign-up; we just don't render a UI around it.

## v0.4.0 — Stage 3 admin panel

Adds a complete admin surface: role-gated shell, dashboard, product CRUD, orders management, and the reviews/questions moderation page.

### Added
- **`<AdminGuard>`** — role gate. Blocks render unless `userProfile.role === 'admin'`. Renders a sign-in prompt for signed-out users and an access-denied notice for non-admins. Optional `fallback` override.
- **`<AdminShell>`** — sticky header + sidebar layout. Sidebar items come from `DEFAULT_ADMIN_NAV` or a custom `navItems` array. Active-route highlighting uses the framework adapter's `useNavigation`.
- **`<AdminDashboard>`** — at-a-glance cards: products, orders, revenue (paid/processing/shipped/delivered only), pending reviews, pending questions. Cards deep-link into the matching admin list.
- **`<AdminProductsList>`** — searchable table with name/brand/category/price/status/actions. Edit and Delete buttons per row, configurable `newProductHref` and `getEditHref`, confirm-before-delete.
- **`<AdminProductEditor>`** — one form for create + edit. Name, brand, description, price, category, sizes (CSV), color, `isNew` / `limited` / `isActive` flags, plus image URL list with add/remove controls.
- **`<AdminOrdersList>`** — status-filterable table (all / pending / paid / processing / shipped / delivered / cancelled), one row per order.
- **`<AdminOrderDetail>`** — per-order view with inline status dropdown (writes through `updateOrderStatus`), line items, shipping address, totals breakdown.
- **`<AdminReviewsModeration>`** — tabbed Reviews / Questions moderation. Per-row approve / reject / delete. Questions can also be answered via a dialog that writes `answer`, `answeredAt`, `answeredByUid`.
- **Services** — `listAllProducts`, `createProduct`, `updateProduct`, `deleteProduct`, `listAllOrders`, `updateOrderStatus`.
- **UI primitive** — `Table` / `THead` / `TBody` / `TR` / `TH` / `TD` (headless-ish, inline-styled).
- **Example app** — new routes: `/admin` (dashboard), `/admin/products`, `/admin/products/new`, `/admin/products/[id]/edit`, `/admin/orders`, `/admin/orders/[id]`, `/admin/reviews`, `/admin/settings`. `/admin/layout.tsx` wraps the tree in `<AdminGuard>` + `<AdminShell>`.

### Known limitations (land in v0.5+)
- Category / brand / promo-code / shipping-method admin CRUD pages are still on the roadmap.
- No bulk selection/bulk-actions on the product or order tables yet.
- Image upload still takes raw URLs; Firebase Storage picker comes later alongside the product-builder stepper.

## v0.3.0 — Stage 2 checkout & account

Completes the customer purchase flow: client-side Stripe redirect, post-payment confirmation with order polling, account order history, and wishlist.

### Added
- **`useCheckout()` hook** — wraps the `createStripeCheckoutSession` Firebase callable. Validates cart/sign-in, passes cart items + success/cancel URLs, auto-appends `{CHECKOUT_SESSION_ID}` to the success URL, clears the local cart optimistically, and redirects to Stripe.
- **`<CheckoutPage>`** — shipping form + order summary + "Continue to payment" button. Empty-cart and sign-in gates built in.
- **`<OrderConfirmationPage>`** — resolves an order from Firestore by ID (= Stripe session ID per our webhook). Polls up to ~9 s to cover webhook latency before showing a soft "still processing" message.
- **`<OrderHistoryList>`** — signed-in users see their past orders with status + total; links into order confirmation pages.
- **`useWishlist()` hook + `<WishlistButton>`** — heart toggle backed by the existing `users.wishlist` array on Firestore. Unsigned users get a sign-in toast.
- **Order service** — `getOrderById`, `getOrdersByUser`.
- **Wishlist service** — `addToWishlist`, `removeFromWishlist`.
- **Example routes** — `/checkout`, `/orders/success?session_id=…`, `/orders/[id]`, `/account`.

### Flow
1. Cart → `/checkout` → `useCheckout().startCheckout({ successUrl, cancelUrl })`.
2. Stripe Checkout → `success_url=…&session_id={CHECKOUT_SESSION_ID}` → `/orders/success`.
3. Our webhook creates the order doc keyed by the Stripe session ID. `OrderConfirmationPage` polls until it appears.

### Known limitations (land in v0.4+)
- Shipping-method picker + promo-code redemption are still pass-through — the client forwards them to the callable but the callable doesn't yet resolve server-side pricing. Stripe collects whatever flat rate you configure on the Checkout session.
- Dedicated account page wrapper and address/profile editing stage for v0.4 alongside admin moderation.

## v0.2.0 — Stage 1 storefront

Ports the full storefront surface — product listing, product detail, reviews & Q&A — plus a persistent cart, cart drawer, and a library of internal UI primitives. No Tailwind required; everything is styled via inline styles driven by the `--caspian-*` CSS variables set from script settings.

### Added
- **Product list page** — `<ProductListPage>`, `<ProductGrid>`, `<ProductCard>`. Responsive grid, skeleton loading states, configurable `getProductHref` and `formatPrice`.
- **Product detail page** — `<ProductDetailPage>`, `<ProductGallery>`, `<SizeSelector>`, `<QuantitySelector>`. Gallery with thumbnail strip, size/qty pickers, Add-to-Cart, and a collapsible Reviews/Questions section.
- **Reviews & Questions** — `<ProductReviews>` plus sub-components: `ReviewSummary` (average + distribution bars), `ReviewList`, `ReviewItem`, `QuestionList`, `QuestionItem`, `WriteReviewDialog`, `AskQuestionDialog`. Verified-Purchase badge computed server-side from orders.
- **Cart primitives** — `CartProvider` (wired into `CaspianStoreProvider`), `useCart()` hook, persistent cart (Firestore for signed-in users, localStorage fallback for guests). `<CartSheet>` drawer with quantity and remove controls.
- **Services** — `getProductsByIds`, `getRelatedProducts`, full `review-service` (create/list/moderate/delete), full `question-service` (create/list/moderate/answer/delete), `hasUserPurchasedProduct`, `loadUserCart`/`saveUserCart`.
- **UI primitives** — `Button`, `Dialog`, `Input`, `Textarea`, `Label`, `Tabs`, `Select`, `Skeleton`, `Badge`, `Avatar`, `Separator`, `ToastProvider` + `useToast`. Headless-ish: inline-styled, className-overridable, CSS-variable-driven for theming. No Tailwind peer dep.
- **Example update** — `examples/nextjs` now includes `/` (storefront list + cart drawer) and `/product/[id]` (detail page with reviews).

### Changed
- `product-service` functions now take a `Firestore` as their first argument (keeping the package stateless — no module-level collection refs).
- `CaspianStoreProvider` now wraps `AuthProvider` → `CartProvider` → `ScriptSettingsProvider` → `ToastProvider`. No consumer change required.

### Known limitations (land in v0.3+)
- Stripe callable from the client cart (`startCheckout()` hook) still to come. The Cloud Function is ready; only the client wiring is pending.
- Admin panel pages (`v0.4.0`) and auth pages (`v0.5.0`) still pending per roadmap.
- No locale switching yet — `defaultLocale` is stored but not consumed.

## v0.1.0-alpha — Stage 0 scaffolding

Initial release. Ships the install path, provider, framework adapter contract, Firestore rules/indexes, Cloud Functions for Stripe, and one fully ported proof-of-pattern component. Storefront, cart, checkout, admin, and auth surfaces are staged for subsequent releases — see [Roadmap in README](./README.md#roadmap).

### Added
- `@caspian-explorer/script-caspian-store` package with tsup build (ESM + CJS + .d.ts).
- `CaspianStoreProvider` — Firebase init (BYOF), auth state, script-settings subscription, theme injection.
- Framework-agnostic adapter contract: `Link`, `Image`, `useNavigation` — default implementations plus typed slots for Next.js / React Router / any React host.
- `useAuth`, `useScriptSettings`, `useCaspianStore`, `useCaspianCollections`, `useCaspianFirebase`, `useCaspianLink`, `useCaspianImage`, `useCaspianNavigation` hooks.
- **Script Settings** — site-level config (brand, currency, locale, Stripe public key, theme tokens, feature flags) stored at `scriptSettings/site`. Live theme tokens surfaced as CSS custom properties.
- `<ScriptSettingsPage />` — self-service admin form, role-gated.
- Proof-of-port component: `<StarRatingInput />`.
- Services: `getProducts`, `getProductById`.
- Firestore rules + indexes at `firebase/firestore.rules` and `firebase/firestore.indexes.json`.
- Firebase Cloud Functions for Stripe: `createStripeCheckoutSession` (callable) + `stripeWebhook` (HTTP).
- Minimal Next.js consumer example at `examples/nextjs/`.
- INSTALL.md with Next.js / Vite / CRA integration snippets.

### Known limitations
- Only one storefront component is ported so far (intentional — proves the pattern). Cart, checkout, PDP, PLP, admin, and auth pages land in v0.2+.
- Cloud Functions are scaffolded; promo-code discounting and shipping-method wiring land with the client cart hook in v0.3.
- No locale provider yet — `defaultLocale` is stored in script settings but not consumed by any shipped component.
