import { invoke, isTauri } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

/**
 * Calls `onopen` with the files opened from the system, such as by double-clicking one in Finder:
 * first those the app was started with, then others as they come, until the returned function is
 * called. Resolves once it has taken the first ones. (`src-tauri/src/opened.rs` keeps them.)
 */
export const watchOpenedFiles = async (onopen: (paths: string[]) => void): Promise<() => void> => {
  if (!isTauri()) return () => undefined
  const take = async (): Promise<void> => {
    const paths = await invoke<string[]>('opened_files')
    if (paths.length > 0) onopen(paths)
  }
  // Listening first, so that no file comes between taking them and listening.
  const unlisten = await listen('files-opened', () => {
    take().catch(console.error)
  })
  await take()
  return unlisten
}
