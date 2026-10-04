use std::{os::windows::ffi::OsStrExt, path::Path};
use windows_sys::Win32::UI::Shell::{SHOpenWithDialog, OAIF_EXEC, OPENASINFO};

pub fn open_with(window: &tauri::WebviewWindow, path: &Path) -> Result<(), String> {
    let filename: Vec<u16> = path.as_os_str().encode_wide().chain(Some(0)).collect();
    let info = OPENASINFO {
        pcszFile: filename.as_ptr(),
        pcszClass: std::ptr::null(),
        oaifInFlags: OAIF_EXEC,
    };
    let hwnd = window.hwnd().map_err(|e| e.to_string())?;
    // SHOpenWithDialog consumes the borrowed UTF-16 path synchronously. No shell
    // command is constructed and no registration/default-changing flags are set.
    let result = unsafe { SHOpenWithDialog(hwnd.0 as _, &info) };
    if result < 0 && result as u32 != 0x800704c7 {
        return Err(format!("Open With failed ({result:#x})."));
    }
    Ok(())
}
