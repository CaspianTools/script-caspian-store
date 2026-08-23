# create-caspian-store

One-command scaffolder for [`@caspian-explorer/script-caspian-store`](https://github.com/CaspianTools/script-caspian-store) — a framework-agnostic React e-commerce storefront + admin panel.

## Usage

```bash
npm create caspian-store@latest my-shop
cd my-shop
npm install
cp .env.example .env.local  # fill in Firebase config
npm run dev                  # http://localhost:3000
```

### Options

All flags are forwarded to the underlying scaffolder:

- `--package-tag vX.Y.Z` — pin the generated project to a specific release (default: latest main)
- `--with-stripe` — also scaffold the Stripe Cloud Functions tree into `functions-stripe/`
- `--with-email` — also scaffold the transactional-email Cloud Functions tree into `functions-email/` (v8.0.0+ requires `firebase functions:secrets:set CASPIAN_EMAIL_<PROVIDER>_API_KEY` before first deploy)
- `--with-instagram` — also scaffold the Instagram-channel Cloud Functions tree into `functions-instagram/` (requires `META_APP_ID` + `META_APP_SECRET` as Functions secrets)
- `--with-pos` — also scaffold the point-of-sale Cloud Functions tree into `functions-pos/`, for the in-person register at `/pos`. **No secrets to set.** The register cannot record a sale without this deployed.
- `--pos-only` — implies `--with-pos`. It **only** adds the register's Cloud Functions; it does not switch the public storefront off. The scaffolder writes files and never touches your database, so register-only mode is a switch you flip at `/admin/pos` after deploying. It's a runtime setting, so you can switch the storefront back on later without re-scaffolding.
- `--with-functions` — **deprecated** alias for `--with-stripe`, kept for back-compat
- `--no-apphosting` — suppress `apphosting.yaml` in the output. **Set this when deploying to Vercel** so the unused file doesn't sit in your repo.
- `--force` — scaffold into a non-empty directory (`.git`, `.gitignore`, `README.md`, `LICENSE` are preserved automatically)

### What gets scaffolded

- **Next.js 15** App Router project with every storefront, auth, content, and admin route pre-mounted
- Next.js adapter code (`Link`, `Image`, `useNavigation`) for the package
- Real `firestore.rules`, `firestore.indexes.json`, `storage.rules` deployable via `firebase deploy --only firestore:rules,firestore:indexes,storage`
- `.env.example` with Firebase web config + Stripe publishable key placeholders, plus a runtime preflight in `providers.tsx` that throws a clear error if any `NEXT_PUBLIC_FIREBASE_*` is missing on first run
- `package.json` scripts for `dev`, `typecheck`, `firebase:seed`, `grant-admin`, `deploy:admin`, `deploy:email`, `deploy:stripe`
- Self-update route that POSTs to the library's hardened handler (v8.0.0+ runs `npm install` with `--ignore-scripts` and is gated by `CASPIAN_ALLOW_SELF_UPDATE=true`)

## How it works

This package is a thin launcher. It clones the main [`script-caspian-store`](https://github.com/CaspianTools/script-caspian-store) repo into a temporary directory, runs the scaffolder inside it against your target directory, then removes the clone.

Requires `git` on `PATH` and Node ≥ 18.

## Links

- Main repo: https://github.com/CaspianTools/script-caspian-store
- INSTALL guide: https://github.com/CaspianTools/script-caspian-store/blob/main/INSTALL.md
- CHANGELOG: https://github.com/CaspianTools/script-caspian-store/blob/main/CHANGELOG.md

## License

MIT © Caspian-Explorer
