use serde::Deserialize;
use tauri::{
    menu::{Menu, MenuItem, SubmenuBuilder},
    Emitter, Manager,
};

pub struct AppMenu {
    open: MenuItem<tauri::Wry>,
    close: MenuItem<tauri::Wry>,
    print: MenuItem<tauri::Wry>,
    open_with: MenuItem<tauri::Wry>,
    find: MenuItem<tauri::Wry>,
    zoom_in: MenuItem<tauri::Wry>,
    zoom_out: MenuItem<tauri::Wry>,
    actual_size: MenuItem<tauri::Wry>,
    fit: MenuItem<tauri::Wry>,
    fit_page: MenuItem<tauri::Wry>,
    appearance: MenuItem<tauri::Wry>,
    about: MenuItem<tauri::Wry>,
}

pub fn install(app: &tauri::App) -> tauri::Result<()> {
    let item = |id, label, enabled, shortcut| MenuItem::with_id(app, id, label, enabled, shortcut);
    let state = AppMenu {
        open: item("open", "&Open…", true, Some("CmdOrCtrl+O"))?,
        close: item("close", "&Close Tab", false, Some("CmdOrCtrl+W"))?,
        print: item("print", "&Print…", false, Some("CmdOrCtrl+P"))?,
        open_with: item("open-with", "Open &With…", false, None)?,
        find: item("find", "&Find in Document…", false, Some("CmdOrCtrl+F"))?,
        zoom_in: item("zoom-in", "Zoom &In", false, Some("CmdOrCtrl+Equal"))?,
        zoom_out: item("zoom-out", "Zoom &Out", false, Some("CmdOrCtrl+Minus"))?,
        actual_size: item("actual-size", "&Actual Size", false, Some("CmdOrCtrl+0"))?,
        fit: item("fit", "Fit &Width", false, None)?,
        fit_page: item("fit-page", "Fit &Page", false, None)?,
        appearance: item("appearance", "A&ppearance…", true, Some("CmdOrCtrl+Comma"))?,
        about: item("about", "&About Folio", true, Some("F1"))?,
    };
    let exit = item("exit", "E&xit", true, Some("Alt+F4"))?;
    let file = SubmenuBuilder::new(app, "&File")
        .items(&[&state.open, &state.close])
        .separator()
        .items(&[&state.open_with, &state.print])
        .separator()
        .item(&exit)
        .build()?;
    let view = SubmenuBuilder::new(app, "&View")
        .item(&state.find)
        .separator()
        .items(&[
            &state.zoom_in,
            &state.zoom_out,
            &state.actual_size,
            &state.fit,
            &state.fit_page,
        ])
        .separator()
        .item(&state.appearance)
        .build()?;
    let help = SubmenuBuilder::new(app, "&Help")
        .item(&state.about)
        .build()?;
    app.set_menu(Menu::with_items(app, &[&file, &view, &help])?)?;
    app.manage(state);
    app.on_menu_event(|app, event| {
        if event.id().as_ref() == "exit" {
            app.exit(0);
        } else if let Some(window) = app.get_webview_window("main") {
            let _ = window.emit("menu-action", event.id().as_ref());
        }
    });
    Ok(())
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MenuState {
    document: bool,
    modal: bool,
    find: bool,
    print: bool,
    open_with: bool,
    zoom: bool,
    fit: bool,
    fit_page: bool,
    fit_window: bool,
}

#[tauri::command]
pub fn sync_menu(state: MenuState, menu: tauri::State<AppMenu>) -> Result<(), String> {
    menu.fit
        .set_text(if state.fit_window {
            "Fit to &Window"
        } else {
            "Fit &Width"
        })
        .map_err(|error| error.to_string())?;
    for (item, enabled) in [
        (&menu.open, true),
        (&menu.close, state.document),
        (&menu.print, state.document && state.print),
        (&menu.open_with, state.document && state.open_with),
        (&menu.find, state.document && state.find),
        (&menu.zoom_in, state.document && state.zoom),
        (&menu.zoom_out, state.document && state.zoom),
        (&menu.actual_size, state.document && state.zoom),
        (&menu.fit, state.document && state.fit),
        (&menu.fit_page, state.document && state.fit_page),
        (&menu.appearance, true),
        (&menu.about, true),
    ] {
        item.set_enabled(enabled && !state.modal)
            .map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[derive(Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ThemeMode {
    Dark,
    Light,
    System,
}

#[tauri::command]
pub fn set_app_theme(
    theme: ThemeMode,
    app: tauri::AppHandle,
    window: tauri::WebviewWindow,
) -> Result<(), String> {
    let theme = match theme {
        ThemeMode::Dark => Some(tauri::Theme::Dark),
        ThemeMode::Light => Some(tauri::Theme::Light),
        ThemeMode::System => None,
    };
    // App theme also updates GTK and the Windows menu; window theme updates the
    // title bar and lets System resume responding to OS appearance changes.
    app.set_theme(theme);
    window.set_theme(theme).map_err(|error| error.to_string())
}
