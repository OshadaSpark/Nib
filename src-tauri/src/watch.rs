//! Watching the open folder (or, without one, the open file) for changes made by other apps, such as
//! sync or Git, so the page can pick them up as they happen.

use std::path::{Component, Path, PathBuf};
use std::sync::{Mutex, PoisonError};
use std::time::Duration;

use notify_debouncer_mini::notify::{RecommendedWatcher, RecursiveMode};
use notify_debouncer_mini::{DebounceEventResult, Debouncer, new_debouncer};
use tauri::{AppHandle, Emitter, State};

/// The watcher for what's open, if anything; dropping it stops watching.
#[derive(Default)]
pub struct Watching(Mutex<Option<Debouncer<RecommendedWatcher>>>);

/// Tells the page that something it shows may have changed on disk.
pub const EVENT: &str = "disk-changed";

/// How long changes settle before the page is told, so that a burst (a save, a checkout) is one.
const SETTLE: Duration = Duration::from_millis(250);

/// Whether `path`, within `root`, is in a dot folder or is a dot file (such as `.git`), which the
/// folder's tree leaves out.
fn hidden(root: &Path, path: &Path) -> bool {
    path.strip_prefix(root).is_ok_and(|inside| {
        inside.components().any(|component| {
            matches!(component, Component::Normal(name) if name.to_string_lossy().starts_with('.'))
        })
    })
}

/// Watches `path` (a folder, with everything in it, or a file), instead of what was watched
/// before; `None` stops watching.
#[tauri::command]
pub fn watch(
    app: AppHandle,
    watching: State<'_, Watching>,
    path: Option<PathBuf>,
) -> Result<(), String> {
    let mut current = watching.0.lock().unwrap_or_else(PoisonError::into_inner);
    *current = None;
    let Some(root) = path else { return Ok(()) };
    let changed_root = root.clone();
    let mut debouncer = new_debouncer(SETTLE, move |result: DebounceEventResult| {
        let Ok(events) = result else { return };
        if events
            .iter()
            .any(|event| !hidden(&changed_root, &event.path))
        {
            let _ = app.emit(EVENT, ());
        }
    })
    .map_err(|error| error.to_string())?;
    debouncer
        .watcher()
        .watch(&root, RecursiveMode::Recursive)
        .map_err(|error| error.to_string())?;
    *current = Some(debouncer);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn leaves_out_dot_files_and_folders_within_the_root() {
        let root = Path::new("/Users/me/.notes/Notes");

        assert!(!hidden(root, &root.join("ideas.md")));
        assert!(!hidden(root, &root.join("journal/today.md")));
        assert!(hidden(root, &root.join(".git/index")));
        assert!(hidden(root, &root.join("journal/.draft.md")));
        assert!(!hidden(root, root));
    }
}
