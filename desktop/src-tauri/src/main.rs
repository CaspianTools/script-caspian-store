#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

//! Caspian Register — a thin native shell around a shop's own /pos page.
//!
//! Deliberately NOT a bundled copy of the register. The window points at the
//! shop's live https origin, for two reasons:
//!
//!   1. `signInWithPopup` does not work from a `tauri://localhost` origin, and
//!      the register signs cashiers in with Firebase Auth.
//!   2. Bundling would version-lock the register UI to a signed binary, so
//!      every library release would need a re-signed installer. The shop
//!      updates its site; the till follows on the next launch.
//!
//! What the shell adds over the browser PWA is the store URL baked in (a
//! cashier never types an address), a window with no browser chrome at all,
//! and WebView2's own user-data folder — clearing Chrome's browsing data
//! cannot touch it, which matters once the register starts holding unsent
//! sales.
//!
//! One binary serves every shop. The URL is set on first run and stored in the
//! app config directory. Per-shop builds were rejected: SmartScreen reputation
//! accrues per signed binary, so a build per customer would leave every one of
//! them staring at "Windows protected your PC" indefinitely.
//!
//! Because the address is typed by a human once and then never looked at
//! again, two things are load-bearing: it is checked before it is saved (see
//! `probe_register`), and the register window always carries a way back to the
//! setup screen. v0.1.0 had neither, so a shop that typed its company website
//! instead of its shop got a bare 404, with nothing on screen naming the
//! address and no way out short of deleting a file from %APPDATA%.

use std::fs;
use std::path::PathBuf;
use std::time::Duration;

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

const REGISTER_WINDOW: &str = "register";
const SETUP_WINDOW: &str = "setup";

const MENU_CHANGE_ADDRESS: &str = "change-address";
const MENU_RELOAD: &str = "reload";

fn config_file(app: &AppHandle) -> Option<PathBuf> {
    let dir = app.path().app_config_dir().ok()?;
    Some(dir.join("store.json"))
}

fn read_store_url(app: &AppHandle) -> Option<String> {
    let path = config_file(app)?;
    let raw = fs::read_to_string(path).ok()?;
    let parsed: serde_json::Value = serde_json::from_str(&raw).ok()?;
    parsed
        .get("storeUrl")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .filter(|s| !s.is_empty())
}

/// The host on its own, for showing a person which address a window points at.
fn host_of(origin: &str) -> &str {
    origin
        .split_once("://")
        .map(|(_, rest)| rest)
        .unwrap_or(origin)
}

/// Accept only what we are willing to point a till at.
///
/// https is required because Firebase Auth, service workers and the manifest
/// all refuse to work otherwise — a shop that typed http:// would get a window
/// that looks right and cannot sign anyone in. localhost is exempt so the
/// shell can be pointed at `npm run dev` while a counter is being set up.
fn normalise_store_url(input: &str) -> Result<String, String> {
    let trimmed = input.trim().trim_end_matches('/');
    if trimmed.is_empty() {
        return Err("Enter your shop's web address.".into());
    }

    // Split the scheme off before deciding anything, and judge the HOST rather
    // than a prefix of the whole string. "http://localhost.evil.com" starts
    // with "http://localhost", so a prefix test waved it through as local and
    // took the https requirement with it.
    let (scheme, rest) = match trimmed.split_once("://") {
        Some((scheme, rest)) => (Some(scheme.to_ascii_lowercase()), rest),
        None => (None, trimmed),
    };

    // Anything after the host is dropped: the shell appends /pos itself, and
    // "https://shop.example/pos" pasted in here would otherwise become
    // "https://shop.example/pos/pos".
    let host = rest.split('/').next().unwrap_or("");
    if host.is_empty() {
        return Err("That does not look like a web address. Example: shop.example.com".into());
    }

    let bare_host = host.split(':').next().unwrap_or("");
    let is_local = bare_host == "localhost" || bare_host == "127.0.0.1";

    match scheme.as_deref() {
        Some("https") | None => {}
        Some("http") if is_local => {}
        Some("http") => {
            return Err("The address must start with https:// — the register cannot sign cashiers in over an insecure connection.".into())
        }
        Some(_) => {
            return Err("That does not look like a web address. Example: shop.example.com".into())
        }
    }

    if !is_local && !host.contains('.') {
        return Err("That does not look like a web address. Example: shop.example.com".into());
    }

    // A bare "localhost:3000" is a dev server, so it gets http rather than the
    // https default every real shop gets.
    let resolved_scheme = match scheme.as_deref() {
        Some("https") => "https",
        Some("http") => "http",
        _ if is_local => "http",
        _ => "https",
    };
    Ok(format!("{resolved_scheme}://{host}"))
}

/// Ask the address whether a register actually lives there.
///
/// Only a definitive 404 refuses. An unreachable host, a timeout, a TLS
/// failure or a 500 all pass, because a till is routinely set up before the
/// shop's site is live and on connections having a bad morning — refusing then
/// would strand a shop that had typed exactly the right address. A 404 from a
/// server that did answer is the one case that is proof, and it is the case
/// that matters: it is what a company's marketing site returns.
fn probe_register(origin: &str) -> Result<(), String> {
    let agent = ureq::AgentBuilder::new()
        .timeout_connect(Duration::from_secs(5))
        .timeout_read(Duration::from_secs(8))
        .build();

    match agent.get(&format!("{origin}/pos")).call() {
        Err(ureq::Error::Status(404, _)) | Err(ureq::Error::Status(410, _)) => Err(format!(
            "There is no register at {}/pos. Check the address — this should be your shop's own site, not your company's main website.",
            host_of(origin)
        )),
        _ => Ok(()),
    }
}

/// The register window's menu. Native, so it still works when the page below
/// it is a 404, a blank tab or "can't reach this page" — which is exactly when
/// somebody needs to change the address.
fn register_menu(app: &AppHandle) -> Result<Menu<tauri::Wry>, String> {
    let build_error = |e: tauri::Error| format!("Could not build the menu: {e}");

    let change = MenuItem::with_id(
        app,
        MENU_CHANGE_ADDRESS,
        "Change shop address…",
        true,
        Some("CmdOrCtrl+Shift+A"),
    )
    .map_err(build_error)?;
    let reload = MenuItem::with_id(app, MENU_RELOAD, "Reload", true, Some("CmdOrCtrl+R"))
        .map_err(build_error)?;
    let separator = PredefinedMenuItem::separator(app).map_err(build_error)?;
    let quit = PredefinedMenuItem::quit(app, Some("Quit")).map_err(build_error)?;

    let till = Submenu::with_items(app, "Till", true, &[&change, &reload, &separator, &quit])
        .map_err(build_error)?;
    Menu::with_items(app, &[&till]).map_err(build_error)
}

fn open_register(app: &AppHandle, store_url: &str) -> Result<(), String> {
    let target = format!("{store_url}/pos");
    let url = target.parse().map_err(|_| "Could not open that address.".to_string())?;

    if let Some(existing) = app.get_webview_window(REGISTER_WINDOW) {
        let _ = existing.set_focus();
        return Ok(());
    }

    let menu = register_menu(app)?;

    WebviewWindowBuilder::new(app, REGISTER_WINDOW, WebviewUrl::External(url))
        // Name the address in the title. When the shop's own site answers with
        // its 404 page there is otherwise nothing on screen saying which
        // address the till is asking for.
        .title(format!("Caspian Register — {}", host_of(store_url)))
        .menu(menu)
        .on_menu_event(|window, event| {
            let app = window.app_handle().clone();
            let id: &str = event.id().as_ref();
            if id == MENU_CHANGE_ADDRESS {
                let _ = change_address(&app);
            } else if id == MENU_RELOAD {
                if let Some(register) = app.get_webview_window(REGISTER_WINDOW) {
                    let _ = register.eval("location.reload()");
                }
            }
        })
        .inner_size(1280.0, 800.0)
        .min_inner_size(900.0, 600.0)
        .maximized(true)
        .build()
        .map_err(|e| format!("Could not open the register window: {e}"))?;

    if let Some(setup) = app.get_webview_window(SETUP_WINDOW) {
        let _ = setup.close();
    }
    Ok(())
}

fn open_setup(app: &AppHandle) -> Result<(), String> {
    if let Some(existing) = app.get_webview_window(SETUP_WINDOW) {
        let _ = existing.set_focus();
        return Ok(());
    }
    WebviewWindowBuilder::new(app, SETUP_WINDOW, WebviewUrl::App("index.html".into()))
        .title("Set up this till")
        .inner_size(560.0, 520.0)
        .resizable(false)
        .center()
        .build()
        .map_err(|e| format!("Could not open the setup window: {e}"))?;
    Ok(())
}

/// Send a till back to the setup screen.
///
/// The saved address is deliberately left on disk. The setup screen reads it
/// back to prefill the box, so repointing a till is an edit rather than a
/// retype, and somebody who opens this by accident still has a working till
/// when they close it again.
fn change_address(app: &AppHandle) -> Result<(), String> {
    if let Some(register) = app.get_webview_window(REGISTER_WINDOW) {
        let _ = register.close();
    }
    open_setup(app)
}

#[tauri::command]
fn get_store_url(app: AppHandle) -> Option<String> {
    read_store_url(&app)
}

#[tauri::command]
async fn save_store_url(app: AppHandle, url: String) -> Result<String, String> {
    let normalised = normalise_store_url(&url)?;

    // Off the calling thread: the probe blocks for as long as the timeouts
    // allow, and the setup window has to stay responsive enough to show that
    // it is checking.
    let target = normalised.clone();
    tauri::async_runtime::spawn_blocking(move || probe_register(&target))
        .await
        .map_err(|_| "The address check did not finish. Try again.".to_string())??;

    let path = config_file(&app).ok_or("Could not find a place to save the setting.")?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Could not create the settings folder: {e}"))?;
    }
    let body = serde_json::json!({ "storeUrl": normalised });
    fs::write(&path, serde_json::to_vec_pretty(&body).unwrap_or_default())
        .map_err(|e| format!("Could not save the setting: {e}"))?;
    open_register(&app, &normalised)?;
    Ok(normalised)
}

/// Let a cashier get back to the setup screen if the shop moves address.
#[tauri::command]
fn change_store_url(app: AppHandle) -> Result<(), String> {
    change_address(&app)
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_store_url,
            save_store_url,
            change_store_url
        ])
        .setup(|app| {
            let handle = app.handle().clone();
            match read_store_url(&handle) {
                // A till that has been set up goes straight to the counter. No
                // probe here on purpose: a shop opening on a slow morning must
                // never be met with a setup screen instead of its register.
                Some(url) => open_register(&handle, &url).map_err(|e| e.to_string())?,
                None => open_setup(&handle).map_err(|e| e.to_string())?,
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running the Caspian Register shell");
}
