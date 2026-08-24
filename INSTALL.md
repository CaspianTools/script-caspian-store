# Install guide

Install `@caspian-explorer/script-caspian-store` into a React app and get a full e-commerce storefront + admin in ~15 minutes. Works with Next.js (App Router), Vite + React Router, or Create React App. Bring your own Firebase project + Stripe account.

The fastest path is the [one-command scaffolder](#zero-one-command-scaffold). Prefer a manual install? Skip to [§1](#1-install-the-package).

---

## 0. One-command scaffold

```bash
npm create caspian-store@latest my-store
cd my-store
npm install
cp .env.example .env.local   # fill in Firebase web config
npm run dev                  # http://localhost:3000
```

This generates a **Next.js 15** App Router project with every storefront / admin / content route pre-mounted, Next.js adapter code (Link/Image/useNavigation), real deployable `firestore.rules` / `firestore.indexes.json` / `storage.rules`, and a `.env.example` with Firebase + Stripe placeholders.

Flags:

- `--package-tag vX.Y.Z` — pin the generated project to a specific release (default: latest)
- `--with-stripe` — also scaffold the Stripe Cloud Functions tree into `functions-stripe/` (and add the matching `caspian-stripe` codebase to `firebase.json`). The admin codebase (`functions-admin/`, auto-promote trigger) is always scaffolded — it has no secrets and is deployable immediately.
- `--with-email` (v3.0.0+) — also scaffold the transactional-email Cloud Functions tree into `functions-email/` (adds the `caspian-email` codebase to `firebase.json`). Ships the order + contact-form triggers and the `sendTestEmail` callable. **v8.0.0+:** the provider API key (SendGrid or Brevo) is held in Google Cloud Secret Manager — run `firebase functions:secrets:set CASPIAN_EMAIL_<PROVIDER>_API_KEY` once, then deploy. Pre-v8.0.0 stores stored the key in Firestore; see the v8.0.0 CHANGELOG entry for the migration steps.
- `--with-functions` — deprecated alias for `--with-stripe`, kept for back-compat
- `--no-apphosting` — suppress `apphosting.yaml` in the output. Set this on Vercel-only deploys so the file doesn't sit unused. (v1.20.0+)
- `--force` — scaffold into a non-empty directory (`.git`, `.gitignore`, `README.md`, `LICENSE` are preserved automatically)

**Running the shop day to day is documented separately:** the two manuals ship in the package at `node_modules/@caspian-explorer/script-caspian-store/docs/index.html` — one for the store, one for the register.

**If you used the scaffolder, stop here and follow the generated `my-store/README.md`** for Firebase + Stripe + seeding. The remainder of this document (§1–§12) is the manual-install path for people embedding the package into an existing React app; you don't need it after scaffolding.

If you can't use `npm create` (e.g. offline mirror, locked-down network), the same scaffolder can be invoked directly from a clone:

```bash
git clone https://github.com/CaspianTools/script-caspian-store /tmp/scs
node /tmp/scs/scaffold/create.mjs my-store --package-tag v8.0.0
```

---

## Manual install

## 1. Install the package

```bash
npm install github:CaspianTools/script-caspian-store#v11.0.1 firebase
# v11.0.2 is the current release. For other versions, see:
#   https://github.com/CaspianTools/script-caspian-store/releases
# Pinning to a specific sha is also fine:
# npm install github:CaspianTools/script-caspian-store#<sha>
```

For private-repo access, GitHub's `git` over HTTPS or SSH works — same credentials you use for `git clone`.

Peer deps: React 18/19, `firebase` 10, 11, or 12. Next.js consumers: install `next@14`, `next@15`, or `next@16` separately.

**Upgrading from 5.x to 6.0:** v6.0.0 bumps the dev pins to React 19 and Firebase 12 and the runtime dep `tailwind-merge` to 3. Existing consumers on React 18 / Firebase 11 still work (peer ranges include both), but to upgrade your own app:

```bash
npm install react@^19 react-dom@^19 firebase@^12
npm install github:CaspianTools/script-caspian-store#v11.0.1
```

Newly scaffolded sites (`npm create caspian-store@latest`) get the new versions automatically.

---

## 2. Create a Firebase project

At <https://console.firebase.google.com>:

1. Create a new project.
2. **Authentication** → Sign-in method → enable Email/Password and Google.
3. **Firestore Database** → Create database (production mode).
4. **Storage** → Get started.
5. **Functions** → Upgrade to Blaze plan (required for outbound HTTP to Stripe).

Copy the web-app config object (Project settings → Your apps → Web) into `.env.local`:

```
NEXT_PUBLIC_FIREBASE_API_KEY=…
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=…
NEXT_PUBLIC_FIREBASE_PROJECT_ID=…
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=…
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=…
NEXT_PUBLIC_FIREBASE_APP_ID=…
```

> **Deploying to Firebase App Hosting?** Backends created via the Firebase Console auto-inject `FIREBASE_WEBAPP_CONFIG` (a JSON blob containing the same fields) at BUILD time, so on App Hosting you don't need to populate the six vars above. Since v8.9.2, `<CaspianStoreProvider>` auto-heals an incomplete `caspianFirebaseConfig` from `FIREBASE_WEBAPP_CONFIG` server-side and forwards the resolved config to the client browser via an SSR-injected `<script>` tag — no `next.config.mjs` env: forwarding required. The v8.9.0-style explicit setup (`readFirebaseConfigFromEnv()` in `caspian-adapters.tsx` + `env:` block in `next.config.mjs`) is still valid and is what new scaffolds emit; it's now belt-and-suspenders rather than a requirement. Vercel and local dev keep using the six `NEXT_PUBLIC_*` vars.

---

## 3. Mount the provider

### Next.js (App Router)

```tsx
// src/lib/caspian-adapters.tsx
'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import type { CaspianLinkProps, CaspianImageProps } from '@caspian-explorer/script-caspian-store';

import { readFirebaseConfigFromEnv } from '@caspian-explorer/script-caspian-store/firebase';

// Reads FIREBASE_WEBAPP_CONFIG (App Hosting auto-injects it) first, then
// falls back to the six NEXT_PUBLIC_FIREBASE_* vars (Vercel / .env.local).
export const caspianFirebaseConfig = readFirebaseConfigFromEnv();

export function CaspianNextLink({ href, children, ...rest }: CaspianLinkProps) {
  return <Link href={href as any} {...rest}>{children}</Link>;
}

export function CaspianNextImage({ src, alt, width, height, fill, priority, className, sizes }: CaspianImageProps) {
  if (fill) return <Image src={src} alt={alt} fill priority={priority} className={className} sizes={sizes} />;
  return <Image src={src} alt={alt} width={width ?? 600} height={height ?? 400} priority={priority} className={className} sizes={sizes} />;
}

export function useCaspianNextNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  return {
    pathname: pathname ?? '/',
    push: (href: string) => router.push(href as any),
    replace: (href: string) => router.replace(href as any),
    back: () => router.back(),
  };
}
```

```tsx
// src/app/providers.tsx
'use client';
import type { ReactNode } from 'react';
import { CaspianStoreProvider } from '@caspian-explorer/script-caspian-store';
import { CaspianNextLink, CaspianNextImage, useCaspianNextNavigation, caspianFirebaseConfig } from '@/lib/caspian-adapters';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <CaspianStoreProvider
      firebaseConfig={caspianFirebaseConfig}
      adapters={{ Link: CaspianNextLink, Image: CaspianNextImage, useNavigation: useCaspianNextNavigation }}
    >
      {children}
    </CaspianStoreProvider>
  );
}
```

```tsx
// src/app/layout.tsx
import { DynamicFavicon } from '@caspian-explorer/script-caspian-store';
import '@caspian-explorer/script-caspian-store/styles.css';
import { Providers } from './providers';

export default function RootLayout({ children }: { children: React.ReactNode }) {
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
```

> ⚠️ **Do NOT wrap `{children}` in `<LayoutShell>` here.** The single-route page below (`<CaspianRoot />`) owns the storefront shell — header, footer, navigation, drawers — and rendering `<LayoutShell>` *around* it produces duplicate stacked headers and footers on every page. This is the bug v7.0.2 fixed for scaffolded sites; it's documented here so manual installs don't recreate it.

#### Configure `next/image` hosts

`next/image` rejects any hostname not listed under `images.remotePatterns` in `next.config.mjs` with a runtime error ([Invalid src prop](https://nextjs.org/docs/messages/next-image-unconfigured-host)). Storefront catalogs routinely contain images from arbitrary hosts (seeded demo data, Unsplash, Wikimedia, third-party CDNs), so the scaffolder ships a permissive default — match it in a manual install:

```js
// next.config.mjs
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
  env: {
    // Forward Firebase App Hosting's auto-injected web config into the client
    // bundle. Required for /_not-found prerender + browser runtime when the
    // six NEXT_PUBLIC_FIREBASE_* vars aren't set. No-op on Vercel/local.
    FIREBASE_WEBAPP_CONFIG: process.env.FIREBASE_WEBAPP_CONFIG,
  },
};
export default nextConfig;
```

To tighten it for production, replace the wildcard with explicit per-host rules:

```js
remotePatterns: [
  { protocol: 'https', hostname: 'firebasestorage.googleapis.com' },
  { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
  { protocol: 'https', hostname: 'cdn.example.com' },
],
```

### Vite / React Router

```tsx
import { CaspianStoreProvider } from '@caspian-explorer/script-caspian-store';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import '@caspian-explorer/script-caspian-store/styles.css';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

function useCaspianRouterNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  return {
    pathname,
    push: (h: string) => navigate(h),
    replace: (h: string) => navigate(h, { replace: true }),
    back: () => navigate(-1),
  };
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <CaspianStoreProvider
      firebaseConfig={firebaseConfig}
      adapters={{
        Link: ({ href, children, ...rest }) => <Link to={href} {...rest}>{children}</Link>,
        useNavigation: useCaspianRouterNav,
      }}
    >
      {children}
    </CaspianStoreProvider>
  );
}
```

### Create React App

Same as Vite, but read env vars with `process.env.REACT_APP_*`.

---

## 4. Deploy Firestore rules + indexes + Storage rules

The package ships deployable files under `firebase/`.

```bash
cp node_modules/@caspian-explorer/script-caspian-store/firebase/firestore.rules .
cp node_modules/@caspian-explorer/script-caspian-store/firebase/firestore.indexes.json .
cp node_modules/@caspian-explorer/script-caspian-store/firebase/storage.rules .
cp node_modules/@caspian-explorer/script-caspian-store/firebase/firebase.json .   # or merge if you have one

firebase login
firebase use --add           # select your project
firebase deploy --only firestore:rules,firestore:indexes,storage
```

If you already have a `firestore.rules`, merge the `match /<collection>/{id} { ... }` blocks into yours.

---

## 5. Deploy Cloud Functions

v1.16.0+ ships **three codebases** so you can deploy admin triggers without having any provider configured:

- `caspian-admin` — `onUserCreate` (auto-promote first user to admin), `claimAdmin`, scheduled retention cleanup, `linkGuestOrdersOnUserCreate` (re-stamps prior guest orders to a newly-registered account that matches the same email — v9.1+), `getGuestOrder` (unauthenticated HTTPS callable that powers `<GuestOrderLookupPage />` at `/order-status` — v9.1+). **No secrets**, no provider deps. Always deployable.
- `caspian-email` (v3.0.0+) — transactional email triggers (`runEmailOnOrderCreate`, `runEmailOnOrderUpdate`, `runEmailOnContactCreate`) + `sendTestEmail` callable. **v8.0.0+ requires Cloud Secret Manager:** before deploy, run `firebase functions:secrets:set CASPIAN_EMAIL_SENDGRID_API_KEY` and/or `CASPIAN_EMAIL_BREVO_API_KEY` (you only need the secrets for providers you actually use). Functions read the keys via `defineSecret(...)` at runtime.
- `caspian-stripe` — `createStripeCheckoutSession`, `stripeWebhook`, `getStripeSession`. Requires `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` as Functions secrets.
- `caspian-pos` (v10.0.0+) — the in-person register: `commitPosSale` (prices the whole ticket from Firestore in one transaction, applies the promo, decrements stock, allocates the receipt number, writes the order) and `getPosCatalogDelta`. **No secrets.** Scaffold it with `--with-pos`. The register cannot commit a sale without this codebase deployed.
- `caspian-instagram` (v9.21.0+) — the Instagram channel for store staff: `linkInstagram` / `unlinkInstagram`, `instagramInbox` (feed + comments), `replyInstagramComment` / `setInstagramCommentHidden` / `deleteInstagramComment`, `publishInstagramMedia` (publish a product), `deleteInstagramMedia`, and a scheduled token refresh. Requires `META_APP_ID` + `META_APP_SECRET` as Functions secrets (`defineSecret`). Scaffold it with `--with-instagram`.

Copy the codebases you need from `node_modules` into your project root, merge the `functions` entries into your `firebase.json`, then deploy them separately:

```bash
cp -R node_modules/@caspian-explorer/script-caspian-store/firebase/functions-admin ./functions-admin
cp -R node_modules/@caspian-explorer/script-caspian-store/firebase/functions-email  ./functions-email     # skip if no email
cp -R node_modules/@caspian-explorer/script-caspian-store/firebase/functions-stripe ./functions-stripe    # skip if no Stripe
cp -R node_modules/@caspian-explorer/script-caspian-store/firebase/functions-pos    ./functions-pos       # skip if no register
cp -R node_modules/@caspian-explorer/script-caspian-store/firebase/functions-instagram ./functions-instagram  # skip if no Instagram
cp node_modules/@caspian-explorer/script-caspian-store/firebase/firebase.json .                          # or merge manually
```

**Admin codebase (always deploy this, before anyone registers):**

```bash
cd functions-admin && npm install && cd ..
npm run deploy:admin     # v1.19.0+ helper — wraps `firebase deploy` with Eventarc retry
                         # If you're on ≤v1.18.x, use `firebase deploy --only functions:caspian-admin`
```

The `deploy:admin` helper (shipped with the scaffolded `package.json` in v1.19.0+) wraps `firebase deploy` and handles two first-deploy papercuts automatically:

1. **Eventarc propagation.** First 2nd-gen deploys on a brand-new Firebase project often fail with `Permission denied while using the Eventarc Service Agent`. The helper detects this and retries after a 60s countdown — no more panic at the `Error:` line.
2. **Artifact Registry cleanup policy.** After a successful deploy, `firebase deploy` often emits `Error: could not set up cleanup policy`. The functions themselves are live — that message is about old container-image retention. The helper runs `firebase functions:artifacts:setpolicy --force` afterwards and reframes the output so you don't see red `Error:` for a non-problem.

Raw `firebase deploy --only functions:caspian-admin` still works if you prefer it (or if you're not using the scaffolded `package.json`).

**Email codebase (v3.0.0+ — only when you want transactional email):**

```bash
cd functions-email && npm install && cd ..

# v8.0.0+: set the secret(s) for the providers you actually use BEFORE deploy.
# You'll be prompted to paste the API key for each.
firebase functions:secrets:set CASPIAN_EMAIL_SENDGRID_API_KEY     # SG.…
firebase functions:secrets:set CASPIAN_EMAIL_BREVO_API_KEY        # xkeysib-…

npm run deploy:email    # v3.0.0+ helper
```

After deploy, configure the provider at `/admin/plugins/email-providers`: browse the catalog (SendGrid, Brevo), install the one whose secret you set, click **Enable**. The install record in `emailPluginInstalls/{id}` only carries the merchant-facing display name + which provider is active; the actual API key never touches Firestore. If no provider is installed (or the secret value is empty), order + contact triggers log a warning and return without sending — harmless for stores that don't use email.

> **Upgrading from pre-v8.0.0?** Your existing installs have `config.apiKey` in Firestore — that field is no longer read. Run the `firebase functions:secrets:set` commands above with the same key you have in Firestore, redeploy `caspian-email`, and the existing install records keep working unchanged. You can clear the legacy `config.apiKey` from Firestore at your leisure (the new dispatcher ignores it either way).

**Stripe codebase (only when you have Stripe keys):**

```bash
cd functions-stripe && npm install && cd ..
firebase functions:secrets:set STRIPE_SECRET_KEY       # sk_test_… or sk_live_…
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET   # whsec_…
npm run deploy:stripe    # v1.19.0+ helper
```

In Stripe dashboard → Webhooks → add endpoint:

```
https://<region>-<project-id>.cloudfunctions.net/stripeWebhook
```

Subscribe to `checkout.session.completed`. Paste the resulting `whsec_…` into the `STRIPE_WEBHOOK_SECRET` secret and redeploy.

**Install Stripe in the admin UI.** Once the Cloud Functions are deployed, sign in as admin and go to `/admin/plugins/payments`. Click **Browse providers** → **Install** on the Stripe card, paste your publishable key (`pk_live_…` or `pk_test_…`), save, then click **Enable**. The publishable key is stored in Firestore under `paymentPluginInstalls`; only the secret/webhook keys live in Cloud Functions secrets. `useCheckout` picks up enabled plugin installs automatically — no redeploy needed after flipping a provider on or off.

**Instagram codebase (v9.21.0+ — only when you run the Instagram channel):**

```bash
cd functions-instagram && npm install && cd ..
firebase functions:secrets:set META_APP_ID       # your Meta (Facebook) app id
firebase functions:secrets:set META_APP_SECRET    # your Meta app secret
npm run deploy:instagram
```

This lets store staff view the store's Instagram feed, moderate comments, publish a product as a post, and delete posts — the Meta app secret + the long-lived token stay server-side in these functions and never reach the browser. Enable the **Cloud Scheduler** API for the daily token refresh, and (re)deploy your Firestore rules so the server-only `instagram/connection` doc is locked down: `firebase deploy --only firestore:rules`.

Going live also needs, **outside this repo**: one **Meta app** with **Facebook Login** + **Instagram** (register the POS loopback redirect `http://127.0.0.1:47113/`, request `instagram_basic` / `instagram_manage_comments` / `instagram_content_publish` / `instagram_manage_contents` / `pages_show_list` / `pages_read_engagement` / `business_management`, and complete **App Review** + Business Verification), and this store's Instagram as a **Professional** account linked to a **Facebook Page**. This package ships the Instagram Cloud Functions only — **there is no Instagram screen in the admin panel**. Call `linkInstagram` from your own front end to run the OAuth exchange, and store the Meta **App ID** wherever that front end keeps it.

**POS codebase (v10.0.0+ — only when you use the in-person register):**

```bash
cd functions-pos && npm install && cd ..
firebase deploy --only functions:caspian-pos
```

No secrets to set. Sales are priced entirely server-side here — the register only ever sends *what was
scanned*, never what it costs — so a tampered browser cannot ring up a discounted sale.

Then, in the admin panel:

1. **Sales → Point of sale → Enable the register.**
2. **Users →** set each cashier's role to **Staff**. Staff reach `/pos` and read the catalog; they are
   denied every admin surface. `admin` accounts can use the register too, so an owner working the
   counter does not need a second login.
3. **Products → edit → Barcode.** Click into the field and scan — most USB and Bluetooth scanners type
   the code straight in. The register matches `barcode` first, then `sku`, then the product id.
4. Open `/pos`.

**Scanners.** Any USB or Bluetooth barcode scanner that presents as a keyboard (essentially all retail
scanners) works with no setup, driver, or permission prompt — the register recognises a scan by how
fast the characters arrive. If scans arrive split across two lines, raise the gap in `/pos/settings`;
if fast typing is mistaken for a scan, lower it. Camera scanning uses the browser's native
`BarcodeDetector` and is Chromium-only; Safari and Firefox show a message and fall back to typing.

**Receipts** print through the normal browser print dialog against any printer your computer already
has installed, on an 80 mm continuous roll. Set the header and footer under **Sales → Point of sale**.

**The register has its own manual.** `docs/pos-manual.html` covers the whole lifecycle for owners and cashiers — hardware, cashier access, a day at the counter, and closing a till down. Installed copy: `node_modules/@caspian-explorer/script-caspian-store/docs/pos-manual.html`.

**Per-register settings** live at `/pos/settings` and apply to that computer only — its name, its
interface language, and its scanner timing. One shop can run an English till at the counter and
another in a different language without touching the website.

**Selling register licences (v10.1.0+, optional).** Only relevant if you *distribute* this product to
other shops. An ordinary store ignores all of this — with no signing key configured, the licence
surface does not render at all.

```bash
# Once, ever. Back the private key up somewhere that is not this repo.
node scripts/generate-pos-signing-key.mjs

# Paste the printed public key into BOTH:
#   src/pos/license/public-key.ts      -> POS_LICENSE_PUBLIC_KEY
#   caspian-pos functions environment  -> CASPIAN_POS_LICENSE_PUBLIC_KEY

# Then per sale:
node scripts/mint-pos-license.mjs --name "Acme Shop" --expires 2027-01-01
```

Send the printed `cslic1.…` key to the customer; they paste it at `/pos/settings`. Activation binds it
to one computer, and `/admin/pos` lists what has been sold with a **Release** button for when a till is
replaced or wiped — without that, a customer who paid you gets locked out by their own IT.

**Be clear-eyed about what this enforces.** This library is MIT-licensed with public source, so the
browser-side check is a speed bump, not a lock — a fork can delete it. The half with teeth is
server-side: `activatePosLicense` re-verifies the signature and records which device claimed the
licence, so a key used on a second machine is logged where the customer cannot edit it. Enforcement is
**warning-only by design**: a licence problem shows a dismissible strip and never blocks a sale,
because a shop that cannot serve a customer over paperwork is a worse outcome than an unlicensed shop.

**Register-only stores.** Turn on **Register-only store** under Sales → Point of sale (or scaffold with
`--pos-only`) and the public storefront is switched off: `/` redirects to `/pos` and storefront routes
show a notice. `/admin`, `/login` and `/setup` stay reachable, and you can switch it back on at any
time — it is a runtime setting, not a build-time fork.

---

## 6. Seed Firestore

Before the admin pages can render anything useful, seed the defaults:

```bash
npm install --no-save firebase-admin

# Download service account JSON: Firebase console → Project settings → Service accounts
node node_modules/@caspian-explorer/script-caspian-store/firebase/seed/seed.mjs \
  --project <your-project-id> \
  --credentials ./service-account.json
```

That writes:

- `languages` collection (en/ar/de/es/fr — en = default + active)
- `settings/site` (brand placeholders + empty social links)
- `scriptSettings/site` (theme + features + hero + fonts defaults)
- `shippingMethods` (standard + express)

Idempotent — existing docs are skipped unless `--force` is passed. See [`firebase/seed/README.md`](./firebase/seed/README.md) for full options.

---

## 7. Grant yourself admin

Pick one of three paths (in order of preference):

**Auto-promote (easiest).** The package ships an `onUserCreate` Firestore trigger in the `caspian-admin` codebase that promotes whoever creates the first `users/{uid}` doc — and permanently stops the moment any admin exists, so it's only ever a first-install helper. Deploy the admin codebase (§5 — no Stripe secrets needed), *then* sign up at `/auth/register`. Registering before the trigger is deployed means auto-promote can't fire retroactively — use the CLI path below instead.

**CLI (explicit, works any time).**

```bash
# by email (preferred):
node node_modules/@caspian-explorer/script-caspian-store/firebase/seed/grant-admin.mjs \
  --project <projectId> \
  --credentials ./service-account.json \
  --email you@example.com

# or by uid — open /admin while signed in; the AdminGuard access-denied
# screen renders your uid with a Copy button:
node node_modules/@caspian-explorer/script-caspian-store/firebase/seed/grant-admin.mjs \
  --project <projectId> \
  --credentials ./service-account.json \
  --uid <your-uid>
```

Scaffolded projects have this wired to `npm run grant-admin -- --email ...`.

**Firestore console (fallback).** Set `users/{uid}.role = 'admin'` by hand.

Admin pages gate on `role === 'admin'`; without it `<AdminGuard>` renders an access-denied screen with your uid pre-filled for copy-paste.

---

## 7.5. Templates — apply a starter design (optional, v8.23.0+)

A fresh install lands with the theme of your choice on an **empty** Firestore — no products, no categories, blank pages. The Templates feature seeds your storefront with sample content + curated imagery in one click, so the site looks like a finished shop on day one.

Three bundled templates ship with v8.23.0:

- **Fashion Minimal** — apparel & accessories, clean white palette, editorial photography.
- **Electronics Tech** — audio, wearables, desk gear; dark studio palette with a green accent.
- **Home Goods** — kitchen / living / workspace pieces in warm earth tones with lifestyle interior photography.

Each bundles a theme + hero copy + ~9 products + 3 categories + four content pages (about, privacy, terms, shipping-returns) + 2 journal articles + branding hints. Imagery uses Unsplash CDN URLs (free for commercial use, no attribution required); admins can replace any sample image after applying.

### Two ways to apply

**Setup wizard.** The wizard\'s new template-picker step (between Site Info and Branding) shows the three template tiles + a "Start blank" option. Pick one and the chosen template\'s theme + hero pre-populate the branding step; `applyTemplate()` runs in merge mode on wizard completion. Owners installing v8.23.0+ get this flow automatically.

**`/admin/templates`.** Browse and apply templates anytime from the admin panel. Mounted automatically when you use `<CaspianRoot />` (see section 8); for non-scaffolded installs, add a route file:

```tsx
// src/app/admin/templates/page.tsx
import { AdminTemplatesPage } from '@caspian-explorer/script-caspian-store';
export default function Page() { return <AdminTemplatesPage />; }
```

### Apply modes

- **Merge** (default, recommended) — writes only docs whose id is unused. Idempotent — safe to re-apply, and won\'t overwrite any product / category / page you\'ve already created.
- **Replace** (destructive, UI-confirmed) — wipes the four template-managed collections (productCategories, products, pageContents, journal) first, then writes. Used by the "reset to sample data" affordance. The admin UI shows a live count of what will be deleted before the confirmation.

The settings docs (`scriptSettings/site`, `settings/site`) are always merged — the template\'s theme and hero replace the current ones (the point of applying a template), but unrelated fields (brand name, currency, social links) are preserved.

### Programmatic apply

```ts
import { applyTemplate } from '@caspian-explorer/script-caspian-store';

await applyTemplate(db, 'fashion-minimal', { mode: 'merge' });
// returns { ok, templateId, mode, written: {...}, skipped: {...} }
```

Useful for headless scripts, custom onboarding flows, or one-off resets. The caller must be authenticated as an admin (Firestore rules enforce this).

### Authoring new templates

Templates live in [src/templates/templates/](src/templates/templates/) — one folder per template, with an `index.ts` that default-exports a `TemplateDefinition`. Register the new template in [src/templates/catalog.ts](src/templates/catalog.ts). The existing three templates are the reference shape.

---

## 7.6. v9.0.0 — Per-template component overrides

v9.0.0 generalises the v8.23 templates feature from *content-and-theme-tokens* into *content + theme + complete component overrides*. Each template can now register its own React components for the primary storefront surfaces (hero, homepage layout, product card, product detail page) and ship a `css` string for keyframes and hover micro-interactions. Applying a template visibly changes the storefront — not just the colors and copy.

### What's new in v9

- **Component override registry.** Templates declare `components?: { Hero?, HomePage?, ProductCard?, ProductDetailPage?, LayoutShell? }`. At render time the active template's overrides replace the defaults; missing slots fall through to the built-ins.
- **Per-template CSS bundle.** Templates declare `css?: string`. The bundled v9 helper `<ThemeInjector>` mounts it as `<style id="caspian-template-css">` and writes `<html data-caspian-template="<id>">` so the template's CSS rules can scope cleanly.
- **`ScriptSettings.activeTemplateId`.** Firestore now stores which template is active; `applyTemplate()` sets it. The `<TemplateProvider>` (mounted automatically inside `<CaspianStoreProvider>`) reads it and exposes the active template's components + CSS via context.
- **Three bundled templates ship complete looks.** `fashion-minimal` keeps the v8.x storefront identity; `electronics-tech` ships dark-mode spec-sheet layouts with monospace eyebrows; `home-goods` ships magazine-style editorial layouts. Apply from `/admin/templates` or the setup wizard.

### Back-compat — what you do NOT need to change

- **All component imports stay the same.** `<Hero>`, `<HomePage>`, `<ProductCard>`, `<ProductDetailPage>` are the same exports — they're now thin dispatchers that pick a variant via the active template, falling back to byte-equivalent defaults when no template is active.
- **All props stay the same.** Variant components accept the same prop shape as the v8.x originals.
- **Existing Firestore docs work unchanged.** `ScriptSettings.activeTemplateId` is optional; a pre-v9 settings doc resolves to the default storefront.
- **Templates from v8.23.x still apply.** They simply don't register `components` / `css` (the v9 fields are optional). v8 templates running on v9 behave exactly as they did on v8.23.

### Subtle behaviour change to be aware of

The `<HomePage>` component supports slot-injection props (`afterHero`, `afterFeaturedCategories`, `afterTrendingProducts`, `afterNewsletter`). On v8.x these always landed at fixed visual positions because the section order was hardcoded. On v9, each `HomePage` variant chooses its own section order — so the *semantic position* of each slot follows the variant's flow, not the v8.x flow. Consumers relying on a slot landing at a specific visual position should either:

- Set `<CaspianStoreProvider>`'s store to a template that uses `HomePageDefault` (currently `fashion-minimal` or no template) so the v8.x section order is preserved, **OR**
- Render their own composition using the individual section exports (`<Hero>`, `<FeaturedCategoriesSection>`, `<TrendingProductsSection>`, `<NewsletterSignup>`) and place their custom blocks exactly where they want.

### Migrating from v8.23.x

Most consumers need no migration. Pin the new tag, reinstall, redeploy:

```bash
npm install github:CaspianTools/script-caspian-store#v9.0.0
```

The storefront renders identically to v8.23.x until an admin applies a template that registers component overrides (which the three bundled v9 templates now do).

### Authoring component overrides on your own template

```ts
// src/templates/templates/my-template/index.ts
import type { TemplateDefinition } from '@caspian-explorer/script-caspian-store';
import { MyCustomHero, MyCustomProductCard } from './components';

export const myTemplate: TemplateDefinition = {
  id: 'my-template',
  // ...standard template fields (theme, hero, brands, categories, products, ...)
  components: {
    Hero: MyCustomHero,
    ProductCard: MyCustomProductCard,
    // Omit slots you don't override — the default renders.
  },
  css: `
    [data-caspian-template="my-template"] .caspian-hero {
      /* template-scoped rules */
    }
  `,
};
```

The override's prop signature must match the slot's contract. The bundled variants in [src/components/variants/](src/components/variants/) and [src/components/home/variants/](src/components/home/variants/) are reference implementations.

---

## 8. Mount routes (v7.0.0 — one file)

As of v7.0.0 the library ships a single dispatcher, `<CaspianRoot />`, that owns every library URL — storefront, admin, account, auth, journal, checkout, setup — via pathname-based routing. You mount it **once** and never touch routes again when the library adds pages.

```tsx
// src/app/[[...slug]]/page.tsx
'use client';
import { CaspianRoot } from '@caspian-explorer/script-caspian-store';
export default function Page() { return <CaspianRoot />; }
```

That's the whole consumer-side routing. Server-side Next.js endpoints (`app/api/**/route.ts`) stay as separate files because they're not client pages.

### Customizing

- **Custom homepage.** Pass a `homepage` prop: `<CaspianRoot homepage={<MyHomepage />} />`.
- **Custom routes.** Add them alongside — Next.js routes a more specific file (e.g. `app/blog/page.tsx`) over the catch-all, so your custom pages keep working. Or plug into the fallback: `<CaspianRoot fallback={({ pathname }) => <MyCustomPage path={pathname} />} />`.
- **Custom storefront header/footer.** Pass through: `<CaspianRoot header={{ showSearch: true }} footer={null} />`.

### What CaspianRoot dispatches

Every route the old per-page scaffold used to write, now an internal switch:

- `/` — `<HomePage />` (or your `homepage` prop)
- `/cart`, `/checkout`, `/orders/success` — storefront purchase flow
- `/product/:slug`, `/shop`, `/collections`, `/collections/:slug`, `/search`, `/wishlist` — product discovery (the `:slug` segment also accepts a Firestore document id; pre-v8.3 stores keep working without re-saving products)
- `/account`, `/auth/login`, `/auth/register`, `/auth/forgot-password` — account + auth
- `/journal`, `/journal/:id` — editorial
- `/faqs`, `/contact`, `/shipping-returns`, `/size-guide` — support
- `/about`, `/privacy`, `/terms`, `/sustainability` — editable content pages (`<PageContentView>`)
- `/setup`, `/setup/init` — admin-gated configuration wizard
- `/admin-preview/appearance` — theme preview (escapes admin shell)
- `/admin/**` — the whole admin tree, auto-wrapped in `<AdminGuard>` + `<AdminShell>` + `<AdminProfileMenu>` — no `app/admin/layout.tsx` needed

Every page component (`<HomePage>`, `<ProductDetailPage>`, `<AdminDashboard>`, etc.) is still a public export, so if you want a fully hand-rolled route tree you can still do that — CaspianRoot is the convenience layer, not a cage.

See [`scaffold/create.mjs`](./scaffold/create.mjs) for the current minimal scaffolder output.

---

## 9. i18n (optional)

### Single locale with overrides

```tsx
import { CaspianStoreProvider, DEFAULT_MESSAGES } from '@caspian-explorer/script-caspian-store';

const messages = {
  ...DEFAULT_MESSAGES,
  'navigation.brand': 'My Store',
  'footer.newsletter.title': 'Join the list',
};

<CaspianStoreProvider firebaseConfig={...} locale="en" messages={messages}>{...}</CaspianStoreProvider>
```

### Multiple locales

```tsx
<CaspianStoreProvider
  firebaseConfig={...}
  locale={currentLocale}
  messagesByLocale={{
    en: { ...DEFAULT_MESSAGES, 'navigation.brand': 'STORE' },
    ar: { ...DEFAULT_MESSAGES, 'navigation.brand': 'المتجر' },
    // … de, es, fr …
  }}
>
  {children}
</CaspianStoreProvider>
```

RTL locales (ar, he, fa, ur) automatically set `--caspian-direction: rtl` on the document — point your CSS at it. See the package's [i18n README](./src/i18n) for ICU-subset plural syntax.

---

## 9.5. Make it installable (PWA, optional, v9.10.0+)

The storefront chrome is mobile-friendly out of the box — `<SiteHeader>` collapses to a hamburger +
`<MobileNavSheet>` below 820px once you import the library CSS. To make the site **installable** (Add
to Home Screen), wire these consumer-side pieces. A complete working reference is `examples/nextjs`.

**1. Register a service worker + install prompt** in your root layout:

```tsx
import { ServiceWorkerRegister, InstallAppPrompt } from '@caspian-explorer/script-caspian-store';
// …inside <body>, after your providers:
<ServiceWorkerRegister />
<InstallAppPrompt />
```

**2. Add `public/sw.js` and `public/offline.html`** — copy them from `examples/nextjs/public/`. The
worker does network-first navigations with an offline fallback and never caches Firestore/auth.

**3. Serve a dynamic manifest** with a route handler that calls the pure `buildWebManifest()` helper. Import it from the **`/pwa`** subpath, not the main entry: the main entry is stamped `'use client'` by the build, so calling it from a server route fails with *"Attempted to call buildWebManifest() from the server"*. That subpath arrived in v10.3.0 — this example was broken from v9.10.0 until then.

```ts
// app/manifest.webmanifest/route.ts
import { buildWebManifest } from '@caspian-explorer/script-caspian-store/pwa';
export const dynamic = 'force-dynamic';
export async function GET() {
  // read settings/site (see examples/nextjs/app/_pwa-brand.ts), then:
  const manifest = buildWebManifest({ name: brand.name, themeColor: brand.themeColor });
  return new Response(JSON.stringify(manifest), {
    headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'public, max-age=300' },
  });
}
```

Reference it from your layout `metadata`: `manifest: '/manifest.webmanifest'`, add a `viewport` export
with `viewportFit: 'cover'` + a `themeColor`, and serve `/sw.js` with a `no-cache` header.

**4. (Optional) Derive icons from your logo** — add an `app/icon/[size]/route.tsx` that paints the
brand logo onto a square canvas via `next/og` `ImageResponse` (see `examples/nextjs`). Or point the
manifest `icons` at your own static square PNGs.

Verify in Chrome DevTools → Application → Manifest + Service Workers, and the installability audit.

---

## 10. Theming + fonts + hero

Visit `/admin/settings` for site-level fields and `/admin/appearance` for theming:

- **`/admin/settings`** — brand name, logo, favicon, contact info, currency, timezone, country, social links.
- **`/admin/appearance`** — pick the default `luivante` preset (Google blue accent, rounded pills, Poppins) or tune `primary` / `primaryForeground` / `accent` / `radius` directly. Tokens are pushed to `:root` CSS custom properties live.
- **Hero / fonts / feature flags** — still editable via the `/setup` wizard or by mounting `<ScriptSettingsPage>` at a custom route. Feature flags: reviews, questions, wishlist, newsletter, promo codes.

---

## 11. Deploy the Next.js frontend

Two supported hosts. Both need the same `NEXT_PUBLIC_*` env vars from [§3](#3-mount-the-provider) re-entered on the host side (Next.js inlines them into the client bundle at build time, so they must be set before the host runs `next build`). The Stripe webhook keeps pointing at the Cloud Function deployed in [§5](#5-deploy-stripe-cloud-functions) regardless of which host you pick — you don't reconfigure it when switching.

### Vercel

Zero-config native Next.js host. Splits hosting (Vercel) from backend (Firebase).

```bash
# Option A: push to GitHub, then import the repo at https://vercel.com/new
# Option B: install the CLI and deploy directly:
npx vercel@latest        # first run: links the project
npx vercel@latest --prod # subsequent deploys
```

After the first deploy, paste every variable from your local `.env.local` into **Project Settings → Environment Variables** in the Vercel dashboard, then redeploy. Apply them to Production / Preview / Development as needed.

### Firebase App Hosting

Firebase's current Next.js-native target (git-based, Cloud Build → Cloud Run). Keeps everything on Firebase.

```bash
firebase init apphosting       # creates a backend, links your GitHub repo
firebase deploy --only apphosting
```

Create an `apphosting.yaml` at the project root listing the `NEXT_PUBLIC_*` vars with `availability: [BUILD, RUNTIME]` (BUILD is required — `NEXT_PUBLIC_*` must be inlined at build time):

```yaml
runConfig:
  minInstances: 0
  maxInstances: 1
env:
  - variable: NEXT_PUBLIC_FIREBASE_API_KEY
    value: ""
    availability: [BUILD, RUNTIME]
  # … repeat for the other NEXT_PUBLIC_FIREBASE_* vars
```

Fill the values in **Firebase console → App Hosting → your backend → Environment variables**, or commit them to `apphosting.yaml` (they're already public — bundled into the client). For anything sensitive, use `firebase apphosting:secrets:set <NAME>` and switch the entry from `value:` to `secret: <NAME>`.

Consumers who used the [one-command scaffolder](#0-one-command-scaffold) already get an `apphosting.yaml` with the seven vars pre-declared.

---

## 12. Upgrade

Pin to a tag; bump when ready:

```bash
npm install github:CaspianTools/script-caspian-store#vX.Y.Z
```

**Resync rules and indexes on every upgrade — even patch releases.** They're cheap to redeploy and skipping is the #1 cause of `storage/unauthorized` after a library bump (the `siteSettings/**` Storage rule was added in v3.0.0; admins who upgrade across that boundary without redeploying still default-deny logo / favicon / page-image uploads). v1.20.1+:

```bash
npm run firebase:sync    # copies firestore.rules, firestore.indexes.json, storage.rules from the library
firebase deploy --only firestore:rules,firestore:indexes,storage
```

`firebase:sync` overwrites any hand edits to those root files — if you have custom rules, merge by hand from git history instead.

**v8.5.1 — admin authorization moved to Auth custom claims.** If you're crossing the v8.5.1 boundary, you also need to redeploy the `caspian-admin` Cloud Functions codebase (it now sets the `role` custom claim on promotion + on every `users/{uid}` write) and backfill the claim for existing admins. One-time per project:

```bash
cd firebase/functions-admin && npm install && cd ../..
firebase deploy --only functions:caspian-admin

node firebase/seed/sync-admin-claims.mjs \
  --project <your-firebase-project-id> \
  --credentials ./service-account.json
```

After the backfill, each affected admin must sign out + back in (or call `auth.currentUser.getIdToken(true)` from the client) for their session to pick up the new claim. Without the refresh, storage.rules + firestore.rules fall through to the legacy Firestore-field path — slower and the failure mode that was breaking logo uploads — so do the refresh.

### Self-update from `/admin/about`

The admin About page can upgrade the library on the host with one click. The button POSTs to `src/app/api/caspian-store/update/route.ts` (scaffolded into your project), which verifies your admin Firebase ID token and then takes one of two paths depending on the env vars set on the host:

- **npm-install mode** (default; the original v7 behaviour). Runs `npm install github:CaspianTools/script-caspian-store#vX.Y.Z` with `--ignore-scripts` (so a compromised tarball can't run a postinstall hook), then exits the Node process so your supervisor restarts it. Works on hosts with `git`, a writable `node_modules`, and a process manager: VPS / Docker / `npm run dev`.
- **GitHub-commit mode** (added in v8.22.0; preferred on serverless hosts). When `CASPIAN_GITHUB_TOKEN` is set, the route doesn't touch the runtime at all — instead it fetches your storefront's `package.json` via the GitHub REST API, bumps the script dependency to the new tag, best-effort updates `package-lock.json`, and pushes a single commit to your configured branch. Your host's normal git-trigger redeploy handles the rest. Works on Firebase App Hosting, Vercel, Cloud Run, and anywhere with a git-trigger build pipeline.

**v8.0.0 — route shape changed.** Pre-v8.0.0 sites had ~150 lines of inline route logic. v7.4.0+ moves the logic into the library; v8.0.0 hardens it. Your `src/app/api/caspian-store/update/route.ts` should now be:

```ts
import { caspianHandleSelfUpdate } from '@caspian-explorer/script-caspian-store/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: Request) {
  return caspianHandleSelfUpdate(req);
}
```

If you're upgrading from a pre-v7.4.0 install with the inline route still in place, replace it with the eight-line shim above. Newly scaffolded sites already get this shape.

**Requirements:**

- **All environments** (not just production), set `CASPIAN_ALLOW_SELF_UPDATE=true` on the host. The route refuses to run without it. v7.x only enforced this in production; v8.0.0 closes the gap so dev / preview / staging can't be tripped accidentally either.
- **Per-process rate limit:** the route accepts at most one install per 10 minutes per warm Node instance. Subsequent requests return a 429 with retry-in-seconds.
- **Always**, the route needs to know your Firebase project ID to verify the admin token. It checks (in order):
  - `GOOGLE_CLOUD_PROJECT` (auto-set on Firebase App Hosting / Cloud Functions / Cloud Run)
  - `GCLOUD_PROJECT`
  - `FIREBASE_PROJECT_ID`
  - `NEXT_PUBLIC_FIREBASE_PROJECT_ID` (the scaffolder default)
  - `CASPIAN_FIREBASE_PROJECT_ID` (server-only escape hatch)

If none are set at runtime, the route returns: *"Server cannot detect a Firebase project ID. Set NEXT_PUBLIC_FIREBASE_PROJECT_ID …"* and the admin About page renders a remediation panel with platform-specific steps.

**How to set it on common hosts:**

- **Vercel** — Project Settings → Environment Variables → add `NEXT_PUBLIC_FIREBASE_PROJECT_ID = <your-project-id>` for Production + Preview, then redeploy.
- **Firebase App Hosting** — `apphosting.yaml`:
  ```yaml
  env:
    - variable: NEXT_PUBLIC_FIREBASE_PROJECT_ID
      value: <your-project-id>
      availability: [BUILD, RUNTIME]
    - variable: CASPIAN_ALLOW_SELF_UPDATE
      value: "true"
      availability: [RUNTIME]
  ```
- **Self-hosted Node** — export both vars in your process manager (PM2 `ecosystem.config.js`, systemd unit, Docker `-e`, …) before starting the Next.js server.

**Serverless caveat (npm-install mode):** Vercel and stock Firebase App Hosting use read-only filesystems for function runtimes, and App Hosting's runtime container ships without `git` on `PATH`, so `npm install` fails with `EROFS` or `spawn git ENOENT` even when project-ID detection succeeds. Even if both somehow worked, `process.exit(0)` makes the platform respawn from the original deployed image — so the freshly-installed version would evaporate on the next request. Use GitHub-commit mode below for those hosts.

#### GitHub-commit mode setup (Firebase App Hosting / Vercel / serverless)

GitHub-commit mode pushes a `package.json` bump to your storefront repo via the GitHub REST API and lets your host's normal redeploy pipeline pick it up. The runtime container needs no `git`, no writable filesystem, and no process supervisor — it only needs to make an HTTPS call. Setup is one fine-grained Personal Access Token plus two env vars.

**Step 1 — Create a fine-grained PAT.** Go to <https://github.com/settings/personal-access-tokens/new> while signed in as the GitHub user (or org owner) that owns your storefront repo. Set:

- **Token name:** `caspian-self-update` (any label that helps you recognise it later)
- **Expiration:** your choice — `90 days` is a good default; `No expiration` if you don't want to rotate. Tokens with expirations send you an email a week before they expire.
- **Resource owner:** the user or org that owns your storefront repo (e.g. `CaspianTools` if you forked into an org).
- **Repository access:** **Only select repositories** → pick your storefront repo (e.g. `CaspianTools/luivante`). Do **not** use "All repositories" — the principle of least privilege means a leaked token can only touch the one repo it needs.
- **Repository permissions:** find **Contents** in the list and set it to **Read and write**. Leave every other permission at "No access". That's the only permission GitHub-commit mode needs (it reads `package.json` + `package-lock.json` and pushes a single commit).

Click **Generate token** at the bottom. The next page shows the token exactly once — it starts with `github_pat_…`. Copy it.

**Step 2 — Expose the token + repo on your host.** The route reads three env vars in GitHub-commit mode:

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `CASPIAN_GITHUB_TOKEN` | yes | — | The PAT from Step 1. Activates GitHub-commit mode by its presence. Treat as a secret — use your host's secret store, not a plaintext env file. |
| `CASPIAN_CONSUMER_REPO` | yes | — | The `<owner>/<repo>` of your storefront (e.g. `CaspianTools/luivante`). Validated against `[A-Za-z0-9._-]/[A-Za-z0-9._-]`. |
| `CASPIAN_CONSUMER_BRANCH` | no | `main` | Branch to commit to. The host's git-trigger watches this branch. |

**On Firebase App Hosting** — create the token as an App Hosting secret, the repo as plain config:

```bash
# Provisions the secret in Google Cloud Secret Manager and grants the
# backend's service account read access. Prompts for the value — paste
# the github_pat_… token.
firebase apphosting:secrets:set CASPIAN_GITHUB_TOKEN
```

Then in `apphosting.yaml`:

```yaml
env:
  - variable: CASPIAN_ALLOW_SELF_UPDATE
    value: "true"
    availability: [RUNTIME]
  - variable: CASPIAN_GITHUB_TOKEN
    secret: CASPIAN_GITHUB_TOKEN
    availability: [RUNTIME]
  - variable: CASPIAN_CONSUMER_REPO
    value: <your-org-or-user>/<your-storefront-repo>
    availability: [RUNTIME]
  # Optional — defaults to "main":
  # - variable: CASPIAN_CONSUMER_BRANCH
  #   value: main
  #   availability: [RUNTIME]
  - variable: NEXT_PUBLIC_FIREBASE_PROJECT_ID
    value: <your-firebase-project-id>
    availability: [BUILD, RUNTIME]
```

Commit `apphosting.yaml` and push. The next rollout picks up the new config.

**On Vercel** — Project Settings → Environment Variables → add for **Production** + **Preview** + **Development**:

- `CASPIAN_GITHUB_TOKEN` (mark **Sensitive** so the UI hides the value on subsequent views)
- `CASPIAN_CONSUMER_REPO` (regular)
- `CASPIAN_CONSUMER_BRANCH` (regular, optional)
- `CASPIAN_ALLOW_SELF_UPDATE=true`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`

Trigger a redeploy so the route sees the new vars.

**On self-hosted Node** — export all three plus the existing `CASPIAN_ALLOW_SELF_UPDATE=true` + `NEXT_PUBLIC_FIREBASE_PROJECT_ID` in your process manager (PM2 `ecosystem.config.js`, systemd unit, Docker `-e`, …). You can still use npm-install mode here by leaving `CASPIAN_GITHUB_TOKEN` unset — the route falls back automatically.

**Step 3 — Click Update.** Open `/admin/about`, sign in as an admin, click **Update to vX.Y.Z**. The response panel shows the pushed commit SHA and a github.com link to it. Your host detects the push (typically within 30 seconds) and starts a normal rebuild. Refresh `/admin/about` after the rollout finishes (3–5 min for App Hosting; 1–2 min for Vercel) — the **Installed** line shows the new version.

**What gets committed.** A single commit titled `Bump <package-name> to vX.Y.Z` containing only `package.json` (and `package-lock.json` if your repo has one). The route's best-effort lockfile updater rewrites the `resolved` SHA for the script package against the new tag's commit; if the new release ships a different transitive dep tree, the build may fail with "lock file out of sync" and you'll need to run `npm install` locally + commit the regenerated lockfile yourself. Most minor-version bumps don't trigger this.

**Token rotation.** If a token expires (or you suspect it leaked), generate a new one with the same scoping and replace it in the secret store. The Firebase CLI command above (`firebase apphosting:secrets:set …`) creates a new secret version automatically and the next rollout picks it up. Vercel: update the env var value and trigger a redeploy.

**Security model.** The PAT is the most sensitive credential the route handles. Two facts limit blast radius: (1) the token is scoped to one repo with one permission (Contents: Read and write), so even if it leaked, an attacker could only push commits to your storefront repo — they cannot read other private repos, access GitHub billing, or do anything outside this one workspace; (2) the token never leaves the server — it goes out as the `Authorization` header on `api.github.com` requests and is not logged, captured in any response field, or echoed back through error messages. Stderr / stdout from npm-install mode are still scrubbed for `$VAR` and `${VAR}` patterns before being returned to the admin.

### One-off migrations

Some upgrades include a data migration. Each is a single Node script under `node_modules/@caspian-explorer/script-caspian-store/firebase/scripts/`, runs once per project, and is idempotent (safe to re-run). All accept `--dry-run` to preview.

**v1.22.0 — product category stored as id instead of name.** Run once after upgrading:

```bash
node node_modules/@caspian-explorer/script-caspian-store/firebase/scripts/migrate-product-category-to-id.mjs \
  --project <your-project-id> \
  --credentials ./service-account.json \
  --dry-run

# If the output looks right, re-run without --dry-run.
```

Products with a legacy name that doesn't match any `productCategories` entry stay unchanged; the admin products list flags them with an amber warning icon so you can fix them by hand.

**v8.4.0 — product brand stored as id instead of name.** Same pattern as the v1.22 category migration, but run from the admin UI rather than a CLI: open **Catalog → Brands** in the admin panel. If any products still hold a free-text brand string, a yellow banner appears with a **Migrate now** button — clicking it creates matching `productBrands` records (deterministic ids from `slugify(name)`, case-insensitive coalescing so "Nike" + "nike" become one) and updates each product in place. Idempotent. No CLI script, no service-account key, no `--dry-run` flag — admins click once and the data reshapes itself. The product editor and storefront keep rendering legacy free-text brand values via the read-side fallback until the admin runs the sweep, so storefronts are never visibly broken in the meantime.

See [CHANGELOG.md](./CHANGELOG.md) for release notes and migration guidance per version.

---

## Troubleshooting

**"auth/invalid-api-key"** — your `.env.local` values didn't load. Next.js reads `.env.local` at build time; restart `npm run dev`.

**Admin pages say "access denied"** — you haven't set `users/{yourUid}.role = 'admin'`. See [§7](#7-grant-yourself-admin).

**Logo / avatar / page-image uploads fail with `Firebase Storage: User does not have permission … (storage/unauthorized)`** — your deployed Storage rules are stale. Run `npm run firebase:sync && firebase deploy --only storage` from your project root, then retry. The `siteSettings/**` rule block was added in v3.0.0; libraries upgraded across that boundary without redeploying storage rules will hit this on every admin image upload. From v8.3.1 onward, the toast surfaces the fix command directly.

**Cart doesn't persist across refreshes** — when signed out, cart lives in `localStorage`. When signed in, it syncs to `carts/{uid}`. Check that Firestore rules from [§4](#4-deploy-firestore-rules--indexes--storage-rules) are deployed.

**Stripe Checkout redirects to a 404** — confirm your `successUrl` matches an actual route and includes `{CHECKOUT_SESSION_ID}` (Stripe substitutes it server-side).

**Webhook order never writes** — check the Stripe dashboard event log for `checkout.session.completed` failures; usually the `STRIPE_WEBHOOK_SECRET` is wrong. Re-run `firebase functions:secrets:set STRIPE_WEBHOOK_SECRET` after rotating in Stripe.

**`font-family: Lato / Montserrat` not applying** — the `<FontLoader>` inside `<CaspianStoreProvider>` injects `<link>` tags at mount. If you use a strict CSP, allow `https://fonts.googleapis.com` and `https://fonts.gstatic.com`.

---

## Page builder (v9.26.0)

The library ships a catalog-driven, Elementor-style **page builder** (drag-and-drop blocks, draft/publish
with revision history + scheduling, per-block styling). It is **opt-in** — your storefront renders exactly
as before until you mount it.

**Prerequisites** (see the CHANGELOG's "Consumer action required"): `firebase deploy --only firestore:rules`
(the `pageLayoutDrafts` / `pageLayoutSchedules` collections + `pageLayouts/*/revisions` are admin-only) and
`firebase deploy --only functions:caspian-admin` (enables `runScheduledPublish` for scheduled publishing).

**Mount it** on any page you want editable (an admin sees an "Edit page" pill; shoppers see the published
layout). Everything is exported from the package root:

```tsx
'use client';
import {
  HomeEditorProvider, BlockRenderer, HomeEditorChrome, useHomeEditor,
} from '@caspian-explorer/script-caspian-store';

function EditableHome() {
  return (
    <HomeEditorProvider pageId="home">
      <HomeBody />
      <HomeEditorChrome /> {/* admin-only editor chrome (pill + panel + toolbar) */}
    </HomeEditorProvider>
  );
}

function HomeBody() {
  const { blocks, siteSettings, isEditing, selectedId, breakpoint, updateField, select } = useHomeEditor();
  return (
    <main>
      <BlockRenderer
        blocks={blocks}
        siteSettings={siteSettings}
        editing={isEditing}
        selectedId={selectedId}
        breakpoint={breakpoint}
        onFieldChange={updateField}
        onSelect={(id) => select(id)}
      />
    </main>
  );
}
```

Custom pages beyond the homepage use `createBuilderPage` / `listBuilderPages` (admin) and a
`<HomeEditorProvider pageId={slug}>` + `<BuilderPageView />` on the route; the static content pages work
the same way with a `pageId` of `about` / `press` / etc.

### Optional: stock-image proxy route

The Image widget and the Style-tab background can search **Openverse** stock images inline. This needs an
**admin-only** server route in your Next.js app (the library can't ship a Next route — it's framework-
agnostic). Without it, image **upload** and **URL** still work; only inline search is disabled. Add
`app/api/stock-images/route.ts` (App Router) with the content below — it verifies an admin Firebase ID
token, blocks SSRF (DNS-resolving guard + per-redirect re-validation, HTTPS-only), and streams a size cap:

```ts
import { NextResponse } from 'next/server';
import { promises as dns } from 'node:dns';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import type { StockImageResult } from '@caspian-explorer/script-caspian-store';

export const runtime = 'nodejs';

const OPENVERSE = 'https://api.openverse.org/v1';
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_CT = /^image\/(jpeg|png|webp|gif)\b/;
const MAX_REDIRECTS = 3;

let adminInited = false;
function ensureAdminApp(): boolean {
  if (adminInited) return getApps().length > 0;
  adminInited = true;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) return false;
  try {
    if (getApps().length === 0) initializeApp({ projectId });
    return true;
  } catch {
    return false;
  }
}

async function isAdminRequest(request: Request): Promise<boolean> {
  if (!ensureAdminApp()) return false;
  const m = (request.headers.get('authorization') || '').match(/^Bearer (.+)$/);
  if (!m) return false;
  try {
    const decoded = await getAuth().verifyIdToken(m[1]);
    return decoded.role === 'admin';
  } catch {
    return false;
  }
}

function isPrivateAddress(ip: string): boolean {
  const host = ip.toLowerCase();
  if (/^(127\.|10\.|192\.168\.|169\.254\.)/.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true;
  if (host === '::1' || host === '::') return true;
  if (/^f[cd][0-9a-f]{2}:/.test(host)) return true;
  if (host.startsWith('fe80:')) return true;
  if (host.startsWith('::ffff:')) return true;
  return false;
}

const clampInt = (v: string | null, lo: number, hi: number, dflt: number): number => {
  const n = Number.parseInt(v ?? '', 10);
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : dflt;
};

interface OpenverseResult {
  id?: string; title?: string; url?: string; thumbnail?: string;
  creator?: string | null; creator_url?: string | null;
  license?: string; license_version?: string; license_url?: string;
  foreign_landing_url?: string; attribution?: string; width?: number; height?: number;
}

function normalize(r: OpenverseResult): StockImageResult {
  return {
    id: String(r.id ?? r.url ?? Math.random()),
    thumbUrl: r.thumbnail || r.url || '',
    fullUrl: r.url || '',
    title: r.title || '',
    width: r.width || 0,
    height: r.height || 0,
    attribution: {
      source: 'openverse',
      title: r.title || '',
      creator: r.creator ?? null,
      creatorUrl: r.creator_url ?? null,
      license: r.license || '',
      licenseVersion: r.license_version || '',
      licenseUrl: r.license_url || '',
      foreignLandingUrl: r.foreign_landing_url || '',
      attributionText: r.attribution || '',
    },
  };
}

async function isSafePublicUrl(raw: string): Promise<boolean> {
  let u: URL;
  try { u = new URL(raw); } catch { return false; }
  if (u.protocol !== 'https:') return false;
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost')) return false;
  if (isPrivateAddress(host)) return false;
  try {
    const records = await dns.lookup(host, { all: true });
    if (records.length === 0) return false;
    if (records.some((r) => isPrivateAddress(r.address.toLowerCase()))) return false;
  } catch {
    return false;
  }
  return true;
}

async function safeImageFetch(startUrl: string): Promise<Response | null> {
  let current = startUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!(await isSafePublicUrl(current))) return null;
    const res = await fetch(current, { redirect: 'manual' });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) return null;
      current = new URL(location, current).toString();
      continue;
    }
    return res;
  }
  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  if (!(await isAdminRequest(request))) {
    return new NextResponse('forbidden', { status: 403 });
  }

  const download = searchParams.get('download');
  if (download) {
    let upstream: Response | null;
    try { upstream = await safeImageFetch(download); } catch { return new NextResponse('fetch failed', { status: 502 }); }
    if (!upstream) return new NextResponse('invalid url', { status: 400 });
    if (!upstream.ok || !upstream.body) return new NextResponse('fetch failed', { status: 502 });
    const ct = upstream.headers.get('content-type') ?? '';
    if (!ALLOWED_CT.test(ct)) return new NextResponse('unsupported media type', { status: 415 });
    const declared = Number.parseInt(upstream.headers.get('content-length') ?? '', 10);
    if (Number.isFinite(declared) && declared > MAX_BYTES) return new NextResponse('too large', { status: 413 });
    const reader = upstream.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          total += value.byteLength;
          if (total > MAX_BYTES) { await reader.cancel(); return new NextResponse('too large', { status: 413 }); }
          chunks.push(value);
        }
      }
    } catch { return new NextResponse('fetch failed', { status: 502 }); }
    const body = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) { body.set(c, offset); offset += c.byteLength; }
    return new NextResponse(body, { status: 200, headers: { 'content-type': ct, 'cache-control': 'private, max-age=60' } });
  }

  const q = searchParams.get('q')?.trim();
  if (!q) return NextResponse.json({ results: [], page: 1, pageCount: 0, resultCount: 0 });
  const page = clampInt(searchParams.get('page'), 1, 50, 1);
  const license = searchParams.get('license')?.trim() ?? '';
  const licenseType = searchParams.get('licenseType')?.trim() ?? 'commercial,modification';

  const url = new URL(`${OPENVERSE}/images/`);
  url.searchParams.set('q', q);
  url.searchParams.set('page', String(page));
  url.searchParams.set('page_size', '20');
  url.searchParams.set('format', 'json');
  if (license) url.searchParams.set('license', license);
  else if (licenseType) url.searchParams.set('license_type', licenseType);

  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return new NextResponse('stock provider error', { status: 502 });
    const data = (await res.json()) as { results?: OpenverseResult[]; page?: number; page_count?: number; result_count?: number };
    return NextResponse.json(
      {
        results: (data.results ?? []).map(normalize).filter((r) => r.fullUrl),
        page: data.page ?? page,
        pageCount: data.page_count ?? 0,
        resultCount: data.result_count ?? 0,
      },
      { headers: { 'cache-control': 'private, max-age=30' } },
    );
  } catch {
    return new NextResponse('stock provider error', { status: 502 });
  }
}
```

---

## 13. Standalone till — no website, no Firebase (v11.0.0+)

Most shops running the register have an online store behind it. Many physical
shops do not, and for those the register can run entirely on one computer:
catalogue, staff, sales and receipt numbers all live in that machine's
IndexedDB, and the till contacts nothing.

Mount the provider with `standalone` and leave `firebaseConfig` off:

```tsx
'use client';
import { CaspianStoreProvider, CaspianRoot } from '@caspian-explorer/script-caspian-store';
import '@caspian-explorer/script-caspian-store/styles.css';

export default function Page() {
  return (
    <CaspianStoreProvider standalone>
      <CaspianRoot />
    </CaspianStoreProvider>
  );
}
```

That is the whole configuration. There is no project to create, no rules to
deploy and no Cloud Functions codebase.

### What a standalone till has

| Screen | What it does |
| --- | --- |
| First run | Creates the **Support** account. Nothing else can happen until it exists. |
| `/pos` | The register: scan, ticket, tender, receipt — the same screen as a cloud till. |
| `/pos/admin` | The back office: items (with CSV import/export), sales and takings, people and roles, shop and receipt wording, backup and restore. |
| `/pos/settings` | Per-device settings: language, register name, scanner speed. |

### The three tiers

Commissioned by whoever installs the till, and separate from the cloud
`UserRole` — these never reach Firestore and are not mirrored into any claim.

| Role | Reaches |
| --- | --- |
| `superadmin` (Support) | Everything, including creating other Support accounts. |
| `admin` (Owner) | The register and the back office. |
| `staff` (Cashier) | The register only. |

Access is cumulative: an owner can still work the counter without signing out.

### Two things to be deliberate about

**Backups are the shop's own.** Nothing is copied off the machine — that is the
whole point of the mode — so a failed disk takes the shop's entire trading
history with it. `/pos/admin` → Backup writes a dated JSON file holding items,
people, sales, the receipt counter and the shop record. Tell the shop to put it
somewhere that is not that computer, and to do it weekly.

**`standalone` is explicit, never inferred.** A missing or broken
`firebaseConfig` does *not* fall back to standalone. It throws, loudly, at
mount. Falling back would mean a real shop whose credentials broke came up as an
empty local register and started taking sales into a database nobody knows
about — a failure that looks exactly like a working till.

### What it deliberately does not do

- **No sync to a website.** Attaching a shop link later, and pushing local
  history up to it, is a separate release. Local is the only source of truth
  today.
- **No cloud reporting.** Nothing appears in an online admin panel, because
  there isn't one.
- **Receipts still print through the browser's print dialogue.** Direct
  thermal printing is not in this version, in standalone or cloud mode.
- **The Windows installer still asks for a shop address.** The desktop shell in
  [`desktop/`](desktop/README.md) is a window over a shop's own `/pos` page and
  has not moved to standalone yet; packaging a standalone till as an `.exe` that
  needs no website at all is the next desktop release.

### Mixing the two

`useCaspianFirebase()` and `useCaspianCollections()` throw in standalone mode
rather than returning null, because ninety-odd storefront and admin call sites
need a real project and a null check in each of them would serve nobody. The
handful of screens that must work either way use
`useCaspianFirebaseOptional()`, `useCaspianCollectionsOptional()` and
`useCaspianStandalone()`.
