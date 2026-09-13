import { invoke, isTauri } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'

// The window around the page: each function does nothing outside the app, as in tests.

/** Sets the window's title, which shows in the Window menu and Mission Control. */
export const setWindowTitle = async (title: string): Promise<void> => {
  if (isTauri()) await getCurrentWindow().setTitle(title)
}

/** Shows or hides the dot in the window's close button that marks unsaved changes. */
export const setDocumentEdited = async (edited: boolean): Promise<void> => {
  if (isTauri()) await invoke('set_document_edited', { edited })
}

/**
 * Gives the window the theme picked in the preferences, or the system's for `null`, so that its
 * buttons and the system's panels match the page.
 */
export const setWindowTheme = async (theme: 'light' | 'dark' | null): Promise<void> => {
  if (isTauri()) await getCurrentWindow().setTheme(theme)
}

/**
 * Calls `onchange` with whether the window is in full screen, now and whenever it resizes, until
 * the returned function is called.
 */
export const watchFullScreen = async (
  onchange: (fullScreen: boolean) => void,
): Promise<() => void> => {
  if (!isTauri()) return () => undefined
  const window = getCurrentWindow()
  const update = async (): Promise<void> => {
    onchange(await window.isFullscreen())
  }
  const unlisten = await window.onResized(() => {
    void update()
  })
  await update()
  return unlisten
}

/**
 * Closes the window, whether from its close button, ⌘W or Quit, only once `allowed` resolves to
 * true (as when the user agrees to discard unsaved changes). Until the returned function is called.
 */
export const guardClosing = async (allowed: () => Promise<boolean>): Promise<() => void> => {
  if (!isTauri()) return () => undefined
  return getCurrentWindow().onCloseRequested(async (event) => {
    if (!(await allowed())) event.preventDefault()
  })
}

/** Asks the window to close, which the guard may refuse; closing the last one quits the app. */
export const closeWindow = async (): Promise<void> => {
  if (isTauri()) await getCurrentWindow().close()
}
