import { invoke, isTauri } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

/**
 * Watches `location` (the open folder, with everything in it, or a file) for changes other apps
 * make, instead of what was watched before; `null` stops watching. (`src-tauri/src/watch.rs`)
 */
export const watchDisk = async (location: string | null): Promise<void> => {
  if (isTauri()) await invoke('watch', { path: location })
}

/** Calls `onchange` whenever what's watched changes on disk, until the returned function is called. */
export const onDiskChange = async (onchange: () => void): Promise<() => void> => {
  if (!isTauri()) return () => undefined
  return listen('disk-changed', onchange)
}
