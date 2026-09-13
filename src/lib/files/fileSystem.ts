/**
 * The app's file commands (`src-tauri/src/files.rs`), by absolute path. Times are milliseconds since
 * the epoch.
 */

import { invoke } from '@tauri-apps/api/core'

/** Why a command failed, as far as the app tells failures apart. */
export type FailureKind = 'notFound' | 'alreadyExists' | 'other'

export class FileSystemError extends Error {
  readonly kind: FailureKind

  constructor(kind: FailureKind, message: string) {
    super(message)
    this.name = 'FileSystemError'
    this.kind = kind
  }
}

const kinds = new Set<unknown>(['notFound', 'alreadyExists', 'other'])

/** Runs `command`, turning its failure (the Rust error's fields) into a `FileSystemError`. */
const run = async <T>(command: string, args: Record<string, unknown>): Promise<T> => {
  try {
    return await invoke<T>(command, args)
  } catch (error) {
    const { kind, message } = (error ?? {}) as { kind?: unknown; message?: unknown }
    throw new FileSystemError(
      kinds.has(kind) ? (kind as FailureKind) : 'other',
      typeof message === 'string' ? message : String(error),
    )
  }
}

/** Whether `error` is a failure of the kind `kind`. */
export const failedWith = (error: unknown, kind: FailureKind): boolean =>
  error instanceof FileSystemError && error.kind === kind

/** When the file at `path` was last modified. */
export const modifiedTime = (path: string): Promise<number> => run('modified', { path })

/**
 * The bytes of the file at `path`, and when it was modified. The time is taken first, so that if the
 * file changes meanwhile, the next check for changes still notices.
 */
export const readBytes = async (
  path: string,
): Promise<{ bytes: ArrayBuffer; modified: number }> => {
  const modified = await modifiedTime(path)
  return { bytes: await run<ArrayBuffer>('read_file', { path }), modified }
}

/** Replaces the file at `path` with `text` (creating it if need be), returning its modified time. */
export const writeText = (path: string, text: string): Promise<number> =>
  run('write_file', { path, contents: text })

export interface DirectoryEntry {
  name: string
  directory: boolean
}

/** The entries of the directory at `path`. */
export const listDirectory = (path: string): Promise<DirectoryEntry[]> => run('list_dir', { path })

/** Creates an empty file at `path`, failing if it's taken; returns its modified time. */
export const createFile = (path: string): Promise<number> => run('create_file', { path })

/** Moves the file at `from` to `to`, failing if it's taken; returns its modified time. */
export const renameFile = (from: string, to: string): Promise<number> =>
  run('rename_file', { from, to })

/** Moves the file at `path` to the Trash. */
export const trashFile = (path: string): Promise<void> => run('trash', { path })
