# Scaffolder

Generates a ready-to-run Next.js storefront wired up to `@caspian-explorer/script-caspian-store`.

## Run it

```bash
# Clone the package repo temporarily and run the scaffolder:
git clone https://github.com/CaspianTools/script-caspian-store /tmp/scs
node /tmp/scs/scaffold/create.mjs my-store

cd my-store
npm install
cp .env.example .env.local   # fill in Firebase web config
npm run dev                  # http://localhost:3000
```

Options:

- `--package-tag vX.Y.Z` — pin the consumer to a specific package release (default: latest known tag).
- `--force` — overwrite an existing target directory.

## What gets generated

```
my-store/
├── package.json              # pins @caspian-explorer/script-caspian-store + Next.js 14 + firebase
├── tsconfig.json
├── next.config.mjs
├── next-env.d.ts
├── .env.example
├── .gitignore
├── firebase.json, firestore.rules, firestore.indexes.json, storage.rules   # placeholders → copy from node_modules/ after install
├── README.md                 # first-run checklist tailored to the package
└── src/
    ├── lib/caspian-adapters.tsx   # CaspianNextLink / CaspianNextImage / useCaspianNextNavigation
    └── app/
        ├── layout.tsx         # mounts <CaspianStoreProvider> + <LayoutShell> + <DynamicFavicon>
        ├── providers.tsx
        ├── page.tsx           # <HomePage>
        ├── product/[id]/page.tsx
        ├── collections/page.tsx
        ├── cart/page.tsx
        ├── checkout/page.tsx
        ├── orders/success/page.tsx
        ├── account/page.tsx
        ├── auth/{login,register,forgot-password}/page.tsx
        ├── {about,contact,privacy,terms,sustainability}/page.tsx
        ├── journal/page.tsx, journal/[id]/page.tsx
        ├── faqs/page.tsx, shipping-returns/page.tsx, size-guide/page.tsx
        └── admin/
            ├── layout.tsx, page.tsx
            ├── products/page.tsx, products/new/page.tsx, products/[id]/edit/page.tsx
            ├── orders/page.tsx, orders/[id]/page.tsx
            ├── reviews/page.tsx
            ├── journal/page.tsx, pages/page.tsx, faqs/page.tsx, shipping/page.tsx
            ├── promo-codes/page.tsx, subscribers/page.tsx
            ├── categories/page.tsx, collections/page.tsx, languages/page.tsx
            └── settings/page.tsx
```

Every route file is a 3-line client component that re-exports the matching package component. All the logic lives in the package.

## After scaffolding

The generated `README.md` walks through Firebase setup, rules deploy, Cloud Functions deploy, seeding, and admin-role grant. See also the package's [INSTALL.md](../INSTALL.md) for the per-topic deep dive.
