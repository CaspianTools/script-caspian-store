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

use std::fs;
use std::path::PathBuf;

use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

const REGISTER_WINDOW: &str = "register";
const SETUP_WINDOW: &str = "setup";

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
    let with_scheme = if trimmed.contains("://") {
        trimmed.to_string()
    } else {
        format!("https://{trimmed}")
    };

    let is_local = with_scheme.starts_with("http://localhost")
        || with_scheme.starts_with("http://127.0.0.1");
    if !with_scheme.starts_with("https://") && !is_local {
        return Err("The address must start with https:// — the register cannot sign cashiers in over an insecure connection.".into());
    }

    // Reject anything with a path, query or fragment: the shell appends /pos
    // itself, and "https://shop.example/pos" pasted in here would otherwise
    // become "https://shop.example/pos/pos".
    let after_scheme = with_scheme.splitn(2, "://").nth(1).unwrap_or("");
    let host = after_scheme.split('/').next().unwrap_or("");
    if host.is_empty() || !host.contains('.') && !is_local {
        return Err("That does not look like a web address. Example: shop.example.com".into());
    }

    let scheme = if is_local { "http" } else { "https" };
    Ok(format!("{scheme}://{host}"))
}

fn open_register(app: &AppHandle, store_url: &str) -> Result<(), String> {
    let target = format!("{store_url}/pos");
    let url = target.parse().map_err(|_| "Could not open that address.".to_string())?;

    if let Some(existing) = app.get_webview_window(REGISTER_WINDOW) {
        let _ = existing.set_focus();
        return Ok(());
    }

    WebviewWindowBuilder::new(app, REGISTER_WINDOW, WebviewUrl::External(url))
        .title("Caspian Register")
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

#[tauri::command]
fn get_store_url(app: AppHandle) -> Option<String> {
    read_store_url(&app)
}

#[tauri::command]
fn save_store_url(app: AppHandle, url: String) -> Result<String, String> {
    let normalised = normalise_store_url(&url)?;
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
fn reset_store_url(app: AppHandle) -> Result<(), String> {
    if let Some(path) = config_file(&app) {
        let _ = fs::remove_file(path);
    }
    if let Some(register) = app.get_webview_window(REGISTER_WINDOW) {
        let _ = register.close();
    }
    open_setup(&app)
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_store_url,
            save_store_url,
            reset_store_url
        ])
        .setup(|app| {
            let handle = app.handle().clone();
            match read_store_url(&handle) {
                // A till that has been set up goes straight to the counter.
                Some(url) => open_register(&handle, &url).map_err(|e| e.to_string())?,
                None => open_setup(&handle).map_err(|e| e.to_string())?,
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running the Caspian Register shell");
}
