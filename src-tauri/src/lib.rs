mod files;

/// Runs the app until its last window closes.
///
/// # Panics
///
/// If the app can't start, for example without a window system.
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            files::read_file,
            files::modified,
            files::write_file,
            files::list_dir,
            files::create_file,
            files::rename_file,
            files::trash,
        ])
        .run(tauri::generate_context!())
        .expect("error while running the app");
}
