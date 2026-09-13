/// Runs the app until its last window closes.
///
/// # Panics
///
/// If the app can't start, for example without a window system.
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running the app");
}
