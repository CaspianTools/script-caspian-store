# Caspian Register — the offline Windows till

A complete point-of-sale register that runs entirely on the computer it is installed on. No internet
connection, no account, no Firebase project and no website are involved: the catalogue, the staff, the
sales and the receipt numbers all live in a local database inside the app.

Built with [Tauri](https://tauri.app), so it uses the WebView2 runtime already present on Windows
rather than shipping a browser — the installer is a couple of megabytes, not a hundred and fifty.

**This is not part of the npm package.** `package.json`'s `files` list is an allowlist, so nothing in
`desktop/` is in the published tarball. It builds and releases on its own `desktop/v*` tag, the same
way `create-caspian-store/` does, and its version is independent of the library's.

## What it is

The library's **standalone mode** (v11.0.0), bundled. `<CaspianStoreProvider standalone>` boots the
whole tree with no Firebase project, and `PosLocalAdapter` keeps everything in IndexedDB. This app is
that, in a window, with the storefront switched off.

A shop gets the register, a local sign-in with its own staff and roles, and a back office for items,
sales, people, shop details and backups. That is the entire product. There is nothing else to set up.

## What it deliberately does *not* do

- **It does not talk to anything.** No sync, no accounts, no online admin panel, no telemetry. A till
  unplugged from the network works exactly as well as one that is not.
- **It does not print directly to a thermal printer yet.** Receipts go through the WebView print
  dialogue. Native ESC/POS printing over the Windows spooler is the main reason to want a native shell
  and is planned next; it is not in v1.0.0.
- **It is Windows only.** macOS Gatekeeper is a hard block rather than a warning, so shipping there
  means a signing pipeline with no usable unsigned path.
- **It is not the cloud till.** Up to v0.2.0 this app was a thin window onto a shop's hosted `/pos`
  page, with a setup screen asking for the store address. That mode is gone — see below. A shop that
  *does* run a hosted Caspian store installs the register from Chrome or Edge as a PWA instead, which
  is what that audience already had.

### Why the store address went away

Two reasons, and the first is the one that mattered.

An address typed once on setup day and never looked at again is an address that is sometimes wrong. A
till pointed at a company's marketing site rather than at its shop showed that site's 404 page and
nothing else, and v0.1.0 shipped with no check and no way back to the setup screen. v0.2.0 added both,
but could not help a till that had already stored a bad address: it deliberately never re-probed on
launch, because a shop opening on a slow morning must never be met with a setup screen instead of its
register. So the failure survived the upgrade.

The second reason is that the shops this is for do not want a website at all.

Standalone mode removed the two objections that had kept the register from simply being bundled:
`signInWithPopup` is irrelevant when there is no Firebase Auth in the tree, and version-locking the UI
to a signed binary is what an offline product *is*.

A `store.json` left behind by a pre-1.0 install is deleted on first launch.

## First run

There is nothing to configure. The app opens straight into the register and asks for one thing: a
support account, which can then add the shop's own staff.

## Where the data lives, and how it is lost

Everything is in IndexedDB inside this app's own WebView2 profile, under
`%LOCALAPPDATA%\app.caspian.register\`. Nothing is copied anywhere else, by design.

**That data is not rebuildable.** Uninstalling the app, wiping the Windows profile, or a failed disk
takes the shop's only copy of its catalogue, its staff and its entire trading history with it.
**Back office → Backup** writes a single file; save it somewhere that is not this computer, weekly at
minimum and always before moving a till to a new machine. The panel says so on screen too.

## Building

Requires [Rust](https://rustup.rs) and Node 20+. The library must be built first — `desktop/` depends
on it as `file:..`, which npm links rather than builds.

```bash
npm install && npm run build     # at the repo root: produces dist/
cd desktop
npm install
npm run icons                    # derives the icon set, including the .ico the bundler needs
npm run build                    # -> src-tauri/target/release/bundle/nsis/*-setup.exe
```

`npm run dev` runs Vite and Tauri together. `npm run build:web` builds only the bundled register,
which is worth knowing because it is the half that can be checked without a Rust toolchain.

CI does the same on `windows-latest`. Push a `desktop/v*` tag to cut a release with the installer
attached, or run the **Desktop — Windows register installer** workflow by hand for an artifact without
tagging.

## "Windows protected your PC"

The installer is unsigned, so Microsoft Defender SmartScreen blocks it on first run. **To run it
anyway: More info → Run anyway.**

SmartScreen is not a signature check alone. It weighs three things, which is worth knowing before
deciding what to buy:

1. **The signature** — whether the file is signed, and by whom.
2. **Reputation** — of the certificate *and* of the exact file. An unsigned build that enough people
   download and run does stop triggering the warning, but that reputation is attached to the file
   hash, so every new version starts from zero again. With a certificate, later versions inherit what
   earlier ones earned.
3. **The Mark of the Web** — the zone tag a browser attaches to a download. A file that arrives some
   other way, such as a USB stick or a network share, carries no such tag and does not trip SmartScreen
   at all. This is why so much unsigned software appears to have no problem.

Approximate costs at the time of writing; verify before buying, as all of these move:

| Option | Cost | Warning gone |
| --- | --- | --- |
| **Nothing** | free | Never, for a fresh download over the web. Never an issue for a till installed from a USB stick. |
| **Microsoft file submission** | free | Sometimes. The Defender file-submission portal accepts a developer report on a specific file; it is a review, not a guarantee, and it is per-file. |
| **Certum open-source signing** | ~€30/year | After reputation builds. The cheapest real certificate; ships on a hardware token, so CI signing needs a self-hosted runner or a cloud HSM. |
| **Azure Trusted Signing** | ~$10/month | After reputation builds. Microsoft-managed, nothing to store or rotate, clean in GitHub Actions. Requires an identity-verified organisation. |
| **OV certificate** | ~$200-400/year | After reputation builds. |
| **EV certificate** | ~$300-600/year | **Immediately** — the only option that clears SmartScreen with no reputation at all. |

**No signing path has been chosen yet.** This is a procurement decision, not a code change.

### What the build already does

The workflow imports a PFX, patches the thumbprint into `tauri.conf.json`, and lets Tauri sign **both**
the app and the installer that wraps it — signing only the installer would leave the register itself
unsigned, and the warning would return the first time a shop actually launched it.

The step **skips cleanly when no certificate is configured**, so the build keeps working today and
starts producing signed installers the moment two repository secrets exist:

```bash
# Encode the certificate. NOT `certutil -encode`: it wraps the output in
# -----BEGIN CERTIFICATE----- armor, and the workflow's FromBase64String
# throws on those lines, failing the build on the first signed release.
powershell -Command "[Convert]::ToBase64String([IO.File]::ReadAllBytes('cert.pfx')) | Set-Content cert-base64.txt"

gh secret set WINDOWS_CERT_PFX_BASE64 < cert-base64.txt
gh secret set WINDOWS_CERT_PASSWORD
```

Nothing else changes — no config edit, no workflow edit. The build logs the signature status and warns
loudly when a release ships unsigned, so it cannot happen quietly.

Note that this path takes a **PFX**. Azure Trusted Signing does not use one and would need a second
signing step; it is not wired up.

## The icons

`src-tauri/icons/*.png` are generated placeholders — a rounded square with a receipt mark — produced by
a script rather than committed as an opaque blob. Replace them with real artwork before selling
anything, then re-run `npm run icons`.
