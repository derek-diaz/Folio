fn main() {
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "choose_files",
            "take_pending",
            "read_document",
            "release_document",
            "recent_files",
            "open_recent",
            "forget_recent",
            "open_with",
            "open_external",
            "print_document",
            "sync_menu",
            "set_app_theme",
        ]),
    ))
    .expect("failed to build Folio");
}
