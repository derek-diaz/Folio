use gtk::{gio, prelude::*};
use std::path::Path;

pub fn open_with(window: &tauri::WebviewWindow, path: &Path) -> Result<(), String> {
    let parent = window.gtk_window().map_err(|e| e.to_string())?;
    let file = gio::File::for_path(path);
    let dialog = gtk::AppChooserDialog::new(Some(&parent), gtk::DialogFlags::MODAL, &file);
    dialog.set_heading("Open this document with another application");
    dialog.connect_response(move |dialog, response| {
        if response == gtk::ResponseType::Ok {
            if let Some(application) = dialog.app_info() {
                if let Err(error) =
                    application.launch(std::slice::from_ref(&file), None::<&gio::AppLaunchContext>)
                {
                    let message = gtk::MessageDialog::new(
                        Some(dialog),
                        gtk::DialogFlags::MODAL,
                        gtk::MessageType::Error,
                        gtk::ButtonsType::Close,
                        &error.to_string(),
                    );
                    message.connect_response(|message, _| message.close());
                    message.show_all();
                }
            }
        }
        dialog.close();
    });
    dialog.show_all();
    Ok(())
}
