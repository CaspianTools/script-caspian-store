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

## Code signing — fixing "Windows protected your PC"

The installer is **unsigned**, so Microsoft Defender SmartScreen blocks it on first run. Nothing in
the code can remove that screen: it is a statement about who signed the binary, and an unsigned binary
has no answer. Only a certificate fixes it.

**Right now, to run it anyway:** click **More info** → **Run anyway**. That is safe for a build you
produced yourself, but it is not something to ask a paying shop to do.

### What each option actually buys

| Option | Cost | Warning gone |
| --- | --- | --- |
| **Azure Trusted Signing** | ~$10/month | After reputation builds. Cheapest real option; certificate is Microsoft-managed, so nothing to store or rotate. Requires an organisation that can be identity-verified. |
| **EV certificate** | ~$300-600/year | **Immediately.** The only option that clears SmartScreen on day one. Usually ships on a hardware token, which is awkward in CI — most people pair it with a cloud HSM. |
| **OV certificate** | ~$200-400/year | After reputation builds — days to weeks, driven by how many people download and run it. |
| **Nothing** | free | Never. Every shop sees the warning on every new version. |

Two things worth knowing before choosing:

- **Reputation attaches to the certificate, not just the file.** With an unsigned build, every new
  version starts from zero forever. With any certificate, later versions inherit what earlier ones
  earned — which is why OV becomes painless after the first release or two.
- **Signing is not the same as being trusted.** A signature proves who built it. SmartScreen still
  decides separately whether that publisher is known, which is what the "reputation" column means.

### Turning it on

The build already does the signing. It imports a PFX, patches the thumbprint into
`tauri.conf.json`, and lets Tauri sign **both** the app and the installer that wraps it — signing only
the installer would leave the register itself unsigned, and the warning would come back the first time
a shop actually launched it.

The step **skips cleanly when no certificate is configured**, so the build keeps working today and
starts producing signed installers the moment two repository secrets exist:

```bash
# Encode the certificate
certutil -encode cert.pfx cert-base64.txt

gh secret set WINDOWS_CERT_PFX_BASE64 < cert-base64.txt
gh secret set WINDOWS_CERT_PASSWORD
```

Nothing else changes — no config edit, no workflow edit. The build logs the signature status and
warns loudly when a release ships unsigned, so it cannot happen quietly.

## The icons

`src-tauri/icons/*.png` are generated placeholders — a rounded square with a receipt mark — produced
by a script rather than committed as an opaque blob. Replace them with real artwork before selling
anything, then re-run `npm run icons`.
