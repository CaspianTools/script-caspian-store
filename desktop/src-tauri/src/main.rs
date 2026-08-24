#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

//! Caspian Register — the till, running on nothing.
//!
//! The register is bundled into this binary and mounted in the library's
//! standalone mode: the catalogue, staff, sales and receipt numbers live in
//! IndexedDB inside this app's own WebView2 profile, and the window contacts no
//! network at all. There is no address to type, no account, and no website
//! behind it.
//!
//! Up to v0.2.0 this was the opposite: a thin window onto a shop's hosted /pos
//! page, with a setup screen that asked for the address. Two things killed it.
//! An address typed once and never looked at again is an address that is
//! sometimes wrong — a till pointed at a company's marketing site showed that
//! site's 404 and nothing else — and the shops this is for do not want a
//! website in the first place. Standalone mode removed the reasons the register
//! could not simply be bundled: `signInWithPopup` is irrelevant with no Firebase
//! Auth in the tree, and version-locking the UI to a signed binary is what an
//! offline product is.
//!
//! What is left here is a window and two menu items. Everything a cashier or an
//! owner does — sign in, sell, add products, add staff, take a backup — is the
//! register itself, and lives in the library.

use std::fs;

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

const REGISTER_WINDOW: &str = "register";
const MENU_RELOAD: &str = "reload";

/// Remove the store address left behind by a pre-1.0 install.
///
/// Nothing reads it any more. It is deleted rather than ignored because the
/// file names an address this app no longer has any use for, and a support call
/// that starts by finding it is a support call that starts confused. Failure is
/// ignored on purpose: a leftover file must never stop a till from opening.
fn forget_legacy_store_url(app: &AppHandle) {
    if let Ok(dir) = app.path().app_config_dir() {
        let _ = fs::remove_file(dir.join("store.json"));
    }
}

/// Native, so it still works if the page below it ever fails to paint — which
/// is exactly when somebody needs to reload or quit.
fn register_menu(app: &AppHandle) -> Result<Menu<tauri::Wry>, String> {
    let build_error = |e: tauri::Error| format!("Could not build the menu: {e}");

    let reload = MenuItem::with_id(app, MENU_RELOAD, "Reload", true, Some("CmdOrCtrl+R"))
        .map_err(build_error)?;
    let separator = PredefinedMenuItem::separator(app).map_err(build_error)?;
    let quit = PredefinedMenuItem::quit(app, Some("Quit")).map_err(build_error)?;

    let till = Submenu::with_items(app, "Till", true, &[&reload, &separator, &quit])
        .map_err(build_error)?;
    Menu::with_items(app, &[&till]).map_err(build_error)
}

fn open_register(app: &AppHandle) -> Result<(), String> {
    if let Some(existing) = app.get_webview_window(REGISTER_WINDOW) {
        let _ = existing.set_focus();
        return Ok(());
    }

    let menu = register_menu(app)?;

    WebviewWindowBuilder::new(app, REGISTER_WINDOW, WebviewUrl::App("index.html".into()))
        .title("Caspian Register")
        .menu(menu)
        .on_menu_event(|window, event| {
            if event.id().as_ref() == MENU_RELOAD {
                let _ = window.eval("location.reload()");
            }
        })
        .inner_size(1280.0, 800.0)
        .min_inner_size(900.0, 600.0)
        .maximized(true)
        .build()
        .map_err(|e| format!("Could not open the register window: {e}"))?;

    Ok(())
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let handle = app.handle().clone();
            forget_legacy_store_url(&handle);
            open_register(&handle).map_err(|e| e.to_string())?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running the Caspian Register shell");
}
