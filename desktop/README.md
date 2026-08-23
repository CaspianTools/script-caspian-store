# Caspian Register — Windows shell

A small native window that opens a shop's own `/pos` page. Built with [Tauri](https://tauri.app),
so it uses the WebView2 runtime already present on Windows rather than shipping a browser: the
installer is a few megabytes, not a hundred and fifty.

**This is not part of the npm package.** `package.json`'s `files` list is an allowlist, so nothing in
`desktop/` is in the published tarball. It builds and releases on its own `desktop/v*` tag, the same
way `create-caspian-store/` does.

## What it adds over the PWA

The register is already installable from Chrome or Edge (v10.3.0+), and for most shops that is
enough. The native shell exists for the cases the browser cannot cover:

- **The store address is baked in.** A cashier never types a URL, and cannot navigate away from one.
- **No browser at all.** No address bar, no tabs, no other sites one click away.
- **Its own storage.** WebView2 keeps a separate user-data folder, so clearing Chrome's browsing
  data cannot touch it. That matters as soon as the register starts holding unsent sales.
- **A file you can hand someone.** A shop that will not install a web app from a browser prompt will
  run a setup exe.

## What it deliberately does *not* do

- **It does not bundle the register.** The window points at the shop's live https origin. Bundling
  at `tauri://localhost` would break `signInWithPopup` — which is how cashiers sign in — and would
  version-lock the register UI to a signed binary, so every library release would need a re-signed
  installer.
- **It does not print directly to a thermal printer yet.** Receipts go through the WebView print
  dialogue, exactly as in the browser. Native ESC/POS printing over the Windows spooler is the main
  reason to want this shell and is planned next; it is not in v0.1.0.
- **It is Windows only.** macOS Gatekeeper is a hard block rather than a warning, so shipping there
  means a second signing pipeline with no usable unsigned path. The PWA covers macOS, Linux and
  tablets.

## First run

The app asks once for the shop address, stores it in the app config directory, and opens the
register. To point a till somewhere else, call the `reset_store_url` command — or delete
`store.json` from `%APPDATA%\app.caspian.register\`.

Only `https://` addresses are accepted, plus `http://localhost` for development. Firebase Auth,
service workers and the web manifest all refuse to work over plain http, so a till pointed at an
insecure address would look correct and then fail to sign anybody in.

## Building

Requires [Rust](https://rustup.rs) and Node 20+.

```bash
cd desktop
npm install
npm run icons     # derives the full icon set (including the .ico) from icons/icon.png
npm run build     # -> src-tauri/target/release/bundle/nsis/*-setup.exe
```

CI does the same on `windows-latest`. Push a `desktop/v*` tag to cut a release with the installer
attached, or run the **Desktop — Windows register installer** workflow by hand to get an artifact
without tagging.

## Code signing

**The installer is currently unsigned**, so Windows SmartScreen shows *"Windows protected your PC"*
on first run. Users can proceed via **More info → Run anyway**, but a shop being sold a till will
not find that reassuring.

Fixing it is procurement, not code:

1. Buy an OV or EV code-signing certificate (roughly $200–400/year). EV clears SmartScreen
   immediately; OV builds reputation over time and installs.
2. Add the certificate and password as repository secrets.
3. Set `bundle.windows.certificateThumbprint` (and `signCommand` if using a cloud HSM) in
   `src-tauri/tauri.conf.json`.

It is not wired up with placeholder secrets, because that would fail every build until someone
bought a certificate.

**Reputation accrues per signed binary, so there is one build for every shop** — the store address is
configured at first run rather than compiled in. Per-customer builds would leave every customer
staring at the SmartScreen warning forever.

## The icons

`src-tauri/icons/*.png` are generated placeholders — a rounded square with a receipt mark — produced
by a script rather than committed as an opaque blob. Replace them with real artwork before selling
anything, then re-run `npm run icons`.
