use std::path::Path;

#[cfg(target_os = "linux")]
mod linux;
#[cfg(target_os = "windows")]
mod windows;

pub fn open_with(window: &tauri::WebviewWindow, path: &Path) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    return windows::open_with(window, path);
    #[cfg(target_os = "linux")]
    return linux::open_with(window, path);
    #[cfg(not(any(target_os = "windows", target_os = "linux")))]
    {
        let _ = (window, path);
        Err("Open With is not implemented on this platform.".into())
    }
}
