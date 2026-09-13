mod files;
mod opened;
mod window;

/// Runs the app until its last window closes.
///
/// # Panics
///
/// If the app can't start, for example without a window system.
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(opened::Opened::default())
        .invoke_handler(tauri::generate_handler![
            files::read_file,
            files::modified,
            files::write_file,
            files::list_dir,
            files::create_file,
            files::rename_file,
            files::trash,
            opened::opened_files,
            window::set_document_edited,
        ])
        .build(tauri::generate_context!())
        .expect("error while building the app")
        .run(|app, event| {
            if let tauri::RunEvent::Opened { urls } = event {
                opened::add(
                    app,
                    urls.into_iter().filter_map(|url| url.to_file_path().ok()),
                );
            }
        });
}
