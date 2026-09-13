//! Files opened from the system, such as by double-clicking one in Finder. macOS reports them as
//! the app starts, before the page can listen, so they are kept until the page asks for them.

use std::path::PathBuf;
use std::sync::{Mutex, PoisonError};

use tauri::{AppHandle, Emitter, Manager, State};

/// The paths of files opened from the system that the page hasn't taken yet.
#[derive(Default)]
pub struct Opened(Mutex<Vec<String>>);

/// Tells the page, which then takes them.
pub const EVENT: &str = "files-opened";

/// Keeps `paths` for the page, and tells it.
pub fn add(app: &AppHandle, paths: impl IntoIterator<Item = PathBuf>) {
    let paths = paths
        .into_iter()
        .filter_map(|path| path.into_os_string().into_string().ok());
    let state = app.state::<Opened>();
    state
        .0
        .lock()
        .unwrap_or_else(PoisonError::into_inner)
        .extend(paths);
    // Before the page listens, it takes the files once it loads.
    let _ = app.emit(EVENT, ());
}

/// The files opened from the system since the last call, oldest first.
#[tauri::command]
pub fn opened_files(opened: State<'_, Opened>) -> Vec<String> {
    std::mem::take(&mut *opened.0.lock().unwrap_or_else(PoisonError::into_inner))
}
