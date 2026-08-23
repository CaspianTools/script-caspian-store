# @caspian-explorer/script-caspian-store

Framework-agnostic React e-commerce store. **Bring your own Firebase.** Install into any React app (Next.js, Vite, CRA).

> **Status: `v8.0.0` — hardened deploy path.** Self-update endpoint runs `npm install` with `--ignore-scripts`, gated by `CASPIAN_ALLOW_SELF_UPDATE=true` and an admin Bearer token. Email-provider API keys (SendGrid, Brevo) live in Google Cloud Secret Manager — no secret values in Firestore. Brevo SDK upgraded to `^5.0.4` to clear the `request`-library SSRF (CVE-2024-6225). Build now emits typed `.d.ts` for all three entries (`.`, `./firebase`, `./server`). See [CHANGELOG](./CHANGELOG.md) for the full v8.0.0 upgrade steps.

## Quickstart

```bash
npm create caspian-store@latest my-shop
cd my-shop && npm install
cp .env.example .env.local   # fill in Firebase config
npm run dev                  # http://localhost:3000
```

`npm create caspian-store@latest` generates a **Next.js 15 App Router** project with every storefront, auth, content, and admin route pre-mounted, real deployable Firestore rules, and optional Stripe + email Cloud Functions (`--with-stripe`, `--with-email`). See [INSTALL.md](./INSTALL.md) for the full first-run checklist, or the manual-install path below for embedding into an existing app.

### Manual install (v7.0.0+ — one route file owns every page)

```bash
npm install github:Caspian-Explorer/script-caspian-store#v8.0.0 firebase
```

Two files are all you ever need. **No per-page route files, ever, for any library version.** New library pages land automatically.

```tsx
// app/layout.tsx — Providers + global CSS
import type { ReactNode } from 'react';
import { CaspianStoreProvider } from '@caspian-explorer/script-caspian-store';
import '@caspian-explorer/script-caspian-store/styles.css';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en"><body>
      <CaspianStoreProvider
        firebaseConfig={{
          apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
          authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
          appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
        }}
        adapters={{
          Link: ({ href, children, ...rest }) => <Link href={href as any} {...rest}>{children}</Link>,
          Image: (props) => <Image {...(props as any)} />,
          useNavigation: () => {
            const r = useRouter();
            const p = usePathname();
            const sp = useSearchParams();
            return {
              pathname: p ?? '/',
              searchParams: new URLSearchParams(sp?.toString() ?? ''),
              push: (h) => r.push(h as any),
              replace: (h) => r.replace(h as any),
              back: () => r.back(),
            };
          },
        }}
      >
        {children}
      </CaspianStoreProvider>
    </body></html>
  );
}
```

```tsx
// app/[[...slug]]/page.tsx — one file, every page
'use client';
import { CaspianRoot } from '@caspian-explorer/script-caspian-store';
export default function Page() { return <CaspianRoot />; }
```

That's it. `<CaspianRoot />` dispatches every library URL — storefront, admin, account, auth, journal, checkout, setup wizard — via pathname. To replace the homepage, pass `<CaspianRoot homepage={<MyHomepage />} />`. To handle custom paths, pass a `fallback={({ pathname }) => <MyCustomPage path={pathname} />}` render prop. Admin `app/api/**/route.ts` endpoints (setup/write-env, self-update) still live as separate files because they're server-side.

See [INSTALL.md](./INSTALL.md) for the **one-command scaffolder**, **Vite** / **CRA** snippets, Firebase rules deployment, and Cloud Functions setup.

## What's in the box

| Surface | Status |
| --- | --- |
| `CaspianStoreProvider` + framework adapter contract | ✅ |
| Firebase init (BYOF), auth context, user profile bootstrap | ✅ |
| **Script Settings** — `<ScriptSettingsPage />`, theme tokens via CSS vars | ✅ |
| `firebase/firestore.rules` + `firebase/firestore.indexes.json` + `firebase/storage.rules` | ✅ |
| **Payment plugins** — pluggable providers (Stripe included); install/configure at `/admin/plugins/payments` | ✅ |
| **Email plugins** — pluggable providers (SendGrid + Brevo); install at `/admin/plugins/email-providers`; API keys held in Google Cloud Secret Manager (`firebase functions:secrets:set …`) | ✅ (v8.0.0+) |
| Cloud Functions — Stripe callable + webhook; transactional-email dispatcher (caspian-email codebase) | ✅ (deployed as scaffold) |
| **Storefront — PLP:** `<ProductListPage />`, `<ProductGrid />`, `<ProductCard />` | ✅ |
| **Storefront — PDP:** `<ProductDetailPage />`, `<ProductGallery />`, size/qty pickers, Add to cart | ✅ |
| **Reviews & Q&A:** `<ProductReviews />` with summary, list, sort, write/ask dialogs, Verified Purchase badge | ✅ |
| **Cart:** `<CartProvider />`, `useCart()`, `<CartSheet />` drawer — Firestore-persisted for signed-in users, localStorage otherwise | ✅ |
| **Mobile nav:** `<SiteHeader>` collapses to a hamburger + `<MobileNavSheet>` below 820px; reusable `<BottomSheet>` primitive | ✅ (v9.10.0+) |
| **PWA / installable:** `<ServiceWorkerRegister>`, `<InstallAppPrompt>` + `useInstallPrompt()`, `buildWebManifest()` helper (consumer wires routes — see `examples/nextjs`) | ✅ (v9.10.0+) |
| UI primitives: Button, Dialog, Input, Textarea, Label, Tabs, Select, Skeleton, Badge, Avatar, Separator, Toast | ✅ |
| **Checkout:** `useCheckout()` + `<CheckoutPage />` — delegates to the active payment plugin (Stripe ships today). WooCommerce-style **guest checkout** with optional inline sign-in and "create account at checkout" (v9.1+) | ✅ |
| **Order confirmation:** `<OrderConfirmationPage />` — polls Firestore for the webhook-created order | ✅ |
| **Order history:** `<OrderHistoryList />` for signed-in customers; `<GuestOrderLookupPage />` at `/order-status` for guests (order # + email) | ✅ |
| **Wishlist:** `useWishlist()` + `<WishlistButton />` + `<WishlistPanel />` (account page section) | ✅ |
| **Point of sale:** `/pos` full-screen register — barcode scanning (USB/Bluetooth keyboard-wedge, camera, manual), cash / card / split tender with change due, 80 mm receipt, server-priced sales via the `caspian-pos` codebase; per-device language + scanner settings at `/pos/settings`; register-only mode disables the storefront; **installs as its own PWA** (own icon and window, separate from the storefront app) via `buildPosWebManifest()`, plus an optional [Windows installer](desktop/README.md). Owner + cashier documentation in [`docs/pos-manual.html`](docs/pos-manual.html) | ✅ (v10.0.0+) |
| **Staff role:** `staff` accounts reach the register and the catalog but no admin surface; three-role picker in `<AdminUsersPage />`, enforced in `firestore.rules` via `isStaff()` | ✅ (v10.0.0+) |
| **Admin:** `<AdminGuard />`, `<AdminShell />`, `<AdminDashboard />`, product CRUD, orders (table + drag-and-drop Kanban board) + status, reviews moderation, `<AdminAboutPage />` (installed version + GitHub release feed + one-click self-update) | ✅ |
| **Auth:** `<LoginPage />`, `<RegisterPage />`, `<ForgotPasswordPage />`, `<AccountPage />` — sidebar-driven: profile (name/email/phone/photo), orders, addresses, wishlist, security | ✅ |
| **i18n:** `<LocaleProvider>` + `useT()` + `DEFAULT_MESSAGES` + `<LocaleSwitcher />`; **per-device persisted locale** via `useLocaleControls()` with a store default from `ScriptSettings.defaultLocale`; built-in **az / ru / tr** dictionaries covering the register + shared strings (everything else falls back to English) | ✅ (persistence + locales v10.0.0+) |
| **Theming:** 10-theme `THEME_CATALOG` + Avada-style `<AdminAppearancePage>` grid + popup `<AdminAppearancePreviewPage>` with dummy-data storefront | ✅ |
| **Profile photo:** `<ProfilePhotoCard />` (Firebase Storage, JPEG/PNG/WebP ≤5 MB) | ✅ |
| **Delete account:** `<DeleteAccountCard />` with reauth + typed confirmation | ✅ |
| **Contact page + admin inbox:** `<ContactPage />` public form (+ optional structured weekly **business hours** panel); `<AdminUsersPage />` tabbed inbox; bell badge, dashboard "Recent contacts" card; Cloud Function fires admin-notify + auto-reply emails | ✅ |

## Package surface

```ts
// Provider + hooks
CaspianStoreProvider, useCaspianStore,
useCaspianLink, useCaspianImage, useCaspianNavigation,
useCaspianCollections, useCaspianFirebase,
useAuth, useCart, useScriptSettings, useToast

// Storefront
ProductListPage, ProductGrid, ProductCard,
ProductDetailPage, ProductGallery, SizeSelector, QuantitySelector,
ProductReviews, ReviewSummary, ReviewList, ReviewItem,
QuestionList, QuestionItem, WriteReviewDialog, AskQuestionDialog,
CartSheet, CheckoutPage, OrderConfirmationPage, GuestOrderLookupPage, OrderHistoryList,
WishlistButton, ScriptSettingsPage, ContactPage,
StarIcon, StarRatingInput

// Client hooks
useCheckout, useWishlist, useInstallPrompt

// Mobile + PWA (v9.10.0+)
BottomSheet, MobileNavSheet,
ServiceWorkerRegister, InstallAppPrompt,
buildWebManifest

// Admin surface
AdminGuard, AdminShell, DEFAULT_ADMIN_NAV, AdminDashboard,
AdminProductsList, AdminProductEditor,
AdminOrdersList, AdminOrderDetail,
AdminReviewsModeration, AdminSiteSettingsPage,
AdminUsersPage, AdminUserDetail, AdminContactsList,
AdminEmailsPage, AdminEmailPluginsPage,
AdminShippingPluginsPage, AdminPaymentPluginsPage,
AdminAppearancePage, AdminAppearancePreviewPage,
AdminAboutPage

// Library metadata + update checks
CASPIAN_STORE_VERSION,
fetchRecentReleases, compareVersions, isUpdateAvailable,
triggerSelfUpdate

// Auth + account
LoginPage, RegisterPage, ForgotPasswordPage,
AccountPage, AccountSidebar, ACCOUNT_SECTION_ICONS,
ProfileCard, AddressBook, ChangePasswordCard,
ProfilePhotoCard, DeleteAccountCard, WishlistPanel,
StorefrontProfileMenu

// i18n
LocaleProvider, LocaleSwitcher, useT, useLocale,
DEFAULT_MESSAGES, interpolate

// Theming
THEME_PRESETS, THEME_PRESET_LABELS, ThemePresetPicker,
THEME_CATALOG, THEME_CATEGORY_LABELS, findCatalogTheme,
countThemesByCategory, ThemeThumbnailSvg,
DEMO_BRAND, DEMO_HERO, DEMO_NAV, DEMO_PRODUCTS

// UI primitives (also consumable)
Button, Input, Textarea, Label, Dialog,
Tabs, TabsList, TabsTrigger, TabsContent,
Select, Skeleton, Badge, Avatar, Separator

// Services
getProducts, getProductById, getProductsByIds, getRelatedProducts,
getApprovedReviewsForProduct, hasUserReviewedProduct, createReview,
listAllReviews, setReviewStatus, deleteReview,
getApprovedQuestionsForProduct, createQuestion, listAllQuestions,
setQuestionStatus, answerQuestion, deleteQuestion,
hasUserPurchasedProduct, loadUserCart, saveUserCart

// Framework adapter contract
FrameworkAdapters, CaspianLinkProps, CaspianImageProps,
CaspianNavigation, UseCaspianNavigation,
DefaultCaspianLink, DefaultCaspianImage, useDefaultCaspianNavigation
```

And a sub-entrypoint for Firestore config:

```ts
import {
  CASPIAN_FIRESTORE_RULES,
  CASPIAN_FIRESTORE_INDEXES,
  CASPIAN_STORAGE_RULES,
  caspianCollections,
} from '@caspian-explorer/script-caspian-store/firebase';
```

## Architecture

The package exports **components + hooks**. Routing is consumer-owned: you drop our pages into your own routes (Next.js app router, React Router, whatever). Host-framework integration is through a small `adapters` contract for `Link`, `Image`, and `useNavigation` — no `next/*` imports leak out of the package.

Data lives in your Firebase project (BYOF). We ship Firestore rules, indexes, and Cloud Functions. You deploy them once per install.

Stripe is handled by Firebase Cloud Functions (callable + webhook), so the package works in Next.js, Vite, and CRA without requiring a server.

## Usage notes

- **`"use client"` boundary (Next.js App Router):** the main entry bundle starts with `'use client';`, so package components and hooks can be imported directly from Server Component layouts and pages — the library *is* the client boundary. The `./firebase` sub-entry (`initCaspianFirebase`, `caspianCollections`, and the Firestore + Storage rules/indexes constants) is intentionally unbannered, so it stays callable from Node deploy scripts, Cloud Functions, and Server Components.
- **Tree-shaking:** the ESM bundle is side-effect-free except for `styles.css`, which you import once at your app root.
- **One store per page:** pass `appName="my-shop"` if you need multiple `CaspianStoreProvider` instances (e.g. a preview alongside the live storefront).

## User manuals

Two manuals, one per product, written for the person **running** the shop rather than the person installing it. **Hand the register manual to a cashier and nothing else** — that separation is the whole reason there are two.

| File | Covers |
| --- | --- |
| [`docs/index.html`](docs/index.html) | A picker. Start here; it links to both and carries your language across. |
| [`docs/user-manual.html`](docs/user-manual.html) | **The store** — products, orders, customers, content, the page builder, themes and settings. 7 parts / 57 sections. |
| [`docs/pos-manual.html`](docs/pos-manual.html) | **The register** — a full lifecycle: installing it, the hardware, cashier access, a day at the counter, sales records, and winding a till down again. 7 parts / 38 sections. |

They ship in the package, so installed copies sit at:

```
node_modules/@caspian-explorer/script-caspian-store/docs/index.html
node_modules/@caspian-explorer/script-caspian-store/docs/user-manual.html
node_modules/@caspian-explorer/script-caspian-store/docs/pos-manual.html
```

Open them straight from disk — each is one self-contained file, no build step and no network requests. Each has a sidebar, a search box, light and dark modes, a print stylesheet, and a language switch covering **English, Azerbaijani, Russian and Turkish**.

Every screen they describe was checked against the source. Where a control is deliberately not available yet — a disabled option, a feature that does not exist — the manual says so plainly rather than describing it as working.

## Release history

The full release log lives in [CHANGELOG.md](./CHANGELOG.md). High-level:

- **v0.1 – v1.0** — scaffolded the provider, storefront, reviews/Q&A, cart, checkout, admin, auth, account, i18n, theming.
- **v1.1 – v1.9** — Stripe + i18n parity polish, homepage, journal + content pages, FAQs / shipping / size guide, remaining admin CRUD, site shell, scaffolder, admin todo list. v1.9 fixed the `'use client'` stripping bug so App Router consumers render out of the box.
- **v1.10 – v1.23** — admin overhaul (dashboard cards, notifications bell, contacts inbox), site-settings page, search-term analytics.
- **v2.0 – v2.14** — payment + shipping + email plugin architecture, appearance themes, contact-form admin emails, transactional dispatcher.
- **v3.0 – v6.x** — email plugin metadata-only catalog, RSC boundary tightening, framework-adapter contract.
- **v7.0 – v7.3** — single-route-file architecture (`<CaspianRoot />` dispatches every URL), self-healing layout shell, plugins sidebar/grid polish, cart hydration safety.
- **v8.0** — security hardening pass: Secret Manager for email API keys, hardened self-update (env-gate + `--ignore-scripts` + rate-limit + stderr redaction), Brevo SSRF cleared, tsup parallel-clean race fixed so all three entries ship `.d.ts`, Firestore service collection refs centralized.

## License

MIT © Caspian-Explorer
