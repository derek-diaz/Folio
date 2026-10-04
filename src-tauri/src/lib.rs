mod documents;
mod menu;
mod platform;

use documents::{Documents, OpenBatch, Recent};
use std::{path::PathBuf, sync::Mutex};
use tauri::{Emitter, Manager, State};
use tauri_plugin_dialog::DialogExt;

type Store = Mutex<Documents>;

#[tauri::command]
async fn choose_files(
    app: tauri::AppHandle,
    window: tauri::WebviewWindow,
) -> Result<OpenBatch, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let paths = app
            .dialog()
            .file()
            .set_parent(&window)
            .set_title("Open in Folio")
            .add_filter(
                "Documents and images",
                &[
                    "pdf", "docx", "txt", "md", "markdown", "csv", "tsv", "png", "jpg", "jpeg",
                    "webp", "gif", "svg",
                ],
            )
            .add_filter("All files", &["*"])
            .blocking_pick_files()
            .unwrap_or_default();
        let paths = paths.into_iter().filter_map(|path| path.into_path().ok());
        Ok(app
            .state::<Store>()
            .lock()
            .map_err(|e| e.to_string())?
            .grant_many(paths))
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
fn take_pending(store: State<Store>) -> Result<OpenBatch, String> {
    Ok(std::mem::take(
        &mut store.lock().map_err(|e| e.to_string())?.pending,
    ))
}
#[tauri::command]
async fn read_document(id: String, app: tauri::AppHandle) -> Result<tauri::ipc::Response, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let bytes = app
            .state::<Store>()
            .lock()
            .map_err(|e| e.to_string())?
            .read(&id)?;
        Ok(tauri::ipc::Response::new(bytes))
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
fn release_document(id: String, store: State<Store>) -> Result<(), String> {
    store.lock().map_err(|e| e.to_string())?.release(&id);
    Ok(())
}
#[tauri::command]
fn recent_files(store: State<Store>) -> Result<Vec<Recent>, String> {
    Ok(store.lock().map_err(|e| e.to_string())?.recent.clone())
}
#[tauri::command]
fn open_recent(path: String, store: State<Store>) -> Result<OpenBatch, String> {
    let mut docs = store.lock().map_err(|e| e.to_string())?;
    if !docs.recent.iter().any(|item| item.path == path) {
        return Err("This file is not in recent history. Use Open to select it.".into());
    }
    Ok(docs.grant_many([PathBuf::from(path)]))
}
#[tauri::command]
fn forget_recent(path: Option<String>, store: State<Store>) -> Result<(), String> {
    store
        .lock()
        .map_err(|e| e.to_string())?
        .forget(path.as_deref())
}
#[tauri::command]
fn open_with(id: String, window: tauri::WebviewWindow, store: State<Store>) -> Result<(), String> {
    let path = store.lock().map_err(|e| e.to_string())?.path(&id)?;
    let owned_window = window.clone();
    window
        .run_on_main_thread(move || {
            if let Err(error) = platform::open_with(&owned_window, &path) {
                let _ = owned_window.emit("native-error", error);
            }
        })
        .map_err(|e| e.to_string())
}
#[tauri::command]
fn open_external(url: String) -> Result<(), String> {
    let parsed = url::Url::parse(&url).map_err(|_| "Invalid link.")?;
    if !matches!(parsed.scheme(), "https" | "http" | "mailto") {
        return Err("This link type is not allowed.".into());
    }
    webbrowser::open(parsed.as_str()).map_err(|e| e.to_string())
}
#[tauri::command]
fn print_document(window: tauri::WebviewWindow) -> Result<(), String> {
    window.print().map_err(|e| e.to_string())
}

fn queue_paths(app: &tauri::AppHandle, paths: Vec<PathBuf>) {
    let app = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        if let Ok(mut docs) = app.state::<Store>().lock() {
            docs.queue(paths);
        }
        let _ = app.emit("files-pending", ());
    });
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            queue_paths(app, documents::argument_paths(args, &PathBuf::from(cwd)));
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            app.manage(Mutex::new(Documents::new(app.path().app_data_dir()?)));
            menu::install(app)?;
            tauri::WebviewWindowBuilder::new(
                app,
                "main",
                tauri::WebviewUrl::App("index.html".into()),
            )
            .title("Folio")
            .theme(Some(tauri::Theme::Dark))
            .inner_size(1100.0, 780.0)
            .min_inner_size(620.0, 420.0)
            .on_new_window(|_, _| tauri::webview::NewWindowResponse::Deny)
            .on_navigation(|url| {
                let local =
                    matches!(url.host_str(), Some("tauri.localhost")) || url.scheme() == "tauri";
                let dev = cfg!(debug_assertions)
                    && url.host_str() == Some("127.0.0.1")
                    && url.port() == Some(1420);
                local || dev
            })
            .build()?;
            let cwd = std::env::current_dir().unwrap_or_default();
            queue_paths(
                app.handle(),
                documents::argument_paths(std::env::args(), &cwd),
            );
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::DragDrop(event) = event {
                match event {
                    tauri::DragDropEvent::Drop { paths, .. } => {
                        let _ = window.emit("file-drag", false);
                        queue_paths(window.app_handle(), paths.clone());
                    }
                    tauri::DragDropEvent::Enter { .. } => {
                        let _ = window.emit("file-drag", true);
                    }
                    tauri::DragDropEvent::Leave => {
                        let _ = window.emit("file-drag", false);
                    }
                    _ => {}
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            choose_files,
            take_pending,
            read_document,
            release_document,
            recent_files,
            open_recent,
            forget_recent,
            open_with,
            open_external,
            print_document,
            menu::sync_menu,
            menu::set_app_theme
        ])
        .run(tauri::generate_context!())
        .expect("Folio could not start");
}
