//! The window's integration with macOS beyond what Tauri covers.

use objc2_app_kit::NSWindow;

/// Shows or hides the dot in the window's close button that marks unsaved changes.
///
/// Without `async`, the command runs on the main thread, as `AppKit` requires.
#[tauri::command]
pub fn set_document_edited(window: tauri::WebviewWindow, edited: bool) -> Result<(), String> {
    let pointer = window.ns_window().map_err(|error| error.to_string())?;
    // SAFETY: Tauri gives the pointer to the window's `NSWindow`, which lives as long as `window`
    // does, and this runs on the main thread.
    #[expect(
        unsafe_code,
        reason = "the `AppKit` window, from the pointer Tauri gives"
    )]
    let ns_window = unsafe { &*pointer.cast::<NSWindow>() };
    ns_window.setDocumentEdited(edited);
    Ok(())
}
