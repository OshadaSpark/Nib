/** For tests: files on a disk in memory, by absolute path, with their text or base64 bytes. */
export type FakeFiles = Record<string, string | { base64: string }>

/** For tests: a disk in memory behind the app's file commands and pickers. */
export interface FakeDisk {
  /** The text of the file at `path`, or `undefined` if there is none. */
  text: (path: string) => string | undefined
  /** Writes `text` to the file at `path`, as another app would, which changes its modified time. */
  write: (path: string, text: string) => void
  /** The paths the pickers give next; `null` as if the user cancelled. */
  picks: { open: string | null; save: string | null; folder: string | null }
  /** The options the last picker was opened with. */
  lastPicker: unknown
}

declare global {
  interface Window {
    __TAURI_INTERNALS__?: { invoke: (command: string, args: Record<string, unknown>) => unknown }
    /** The disk `installFakeDisk` put in place, for E2E tests to check from outside the page. */
    fakeDisk?: FakeDisk
  }
}

/**
 * For tests: answers the app's calls to Tauri (see `src-tauri/src/files.rs` and the dialog plugin)
 * from a disk in memory holding `files`, and returns it. Self-contained, as E2E tests run it in the
 * page with `page.addInitScript`, where it can't import anything.
 */
export const installFakeDisk = (files: FakeFiles): FakeDisk => {
  const encoder = new TextEncoder()
  const decoder = new TextDecoder('utf-8', { ignoreBOM: true })
  const entries = new Map<string, { bytes: Uint8Array; modified: number }>()
  const directories = new Set<string>()
  let clock = 0

  const parentOf = (path: string): string => path.slice(0, path.lastIndexOf('/')) || '/'
  // With the fields of the Rust command's error, as Tauri rejects with them.
  class Failure extends Error {
    readonly kind: string
    constructor(kind: string, message: string) {
      super(message)
      this.kind = kind
    }
  }
  const fail = (kind: string, message: string) => Promise.reject(new Failure(kind, message))
  const nameOf = (path: string): string => path.slice(path.lastIndexOf('/') + 1)

  const addDirectory = (path: string): void => {
    for (let directory = path; !directories.has(directory); directory = parentOf(directory)) {
      directories.add(directory)
      if (directory === '/') break
    }
  }
  const put = (path: string, bytes: Uint8Array): number => {
    addDirectory(parentOf(path))
    clock += 1
    entries.set(path, { bytes, modified: clock })
    return clock
  }
  for (const [path, content] of Object.entries(files)) {
    put(
      path,
      typeof content === 'string'
        ? encoder.encode(content)
        : Uint8Array.from(atob(content.base64), (char) => char.charCodeAt(0)),
    )
  }

  const disk: FakeDisk = {
    text: (path) => {
      const entry = entries.get(path)
      return entry && decoder.decode(entry.bytes)
    },
    write: (path, text) => {
      put(path, encoder.encode(text))
    },
    picks: { open: null, save: null, folder: null },
    lastPicker: undefined,
  }

  const commands: Record<string, (args: Record<string, unknown>) => unknown> = {
    read_file: ({ path }) => {
      const entry = entries.get(String(path))
      return entry ? entry.bytes.slice().buffer : fail('notFound', `No file at ${String(path)}`)
    },
    modified: ({ path }) =>
      entries.get(String(path))?.modified ?? fail('notFound', `No file at ${String(path)}`),
    write_file: ({ path, contents }) =>
      directories.has(parentOf(String(path)))
        ? put(String(path), encoder.encode(String(contents)))
        : fail('notFound', `No directory for ${String(path)}`),
    list_dir: ({ path }) => {
      if (!directories.has(String(path))) return fail('notFound', `No directory ${String(path)}`)
      const children = (paths: Iterable<string>) =>
        [...paths].filter((child) => child !== '/' && parentOf(child) === path)
      return [
        ...children(directories).map((child) => ({ name: nameOf(child), directory: true })),
        ...children(entries.keys()).map((child) => ({ name: nameOf(child), directory: false })),
      ]
    },
    create_file: ({ path }) =>
      entries.has(String(path)) || directories.has(String(path))
        ? fail('alreadyExists', `${String(path)} already exists`)
        : put(String(path), new Uint8Array()),
    rename_file: ({ from, to }) => {
      const entry = entries.get(String(from))
      if (!entry) return fail('notFound', `No file at ${String(from)}`)
      if (entries.has(String(to))) return fail('alreadyExists', `${String(to)} already exists`)
      entries.delete(String(from))
      entries.set(String(to), entry)
      return entry.modified
    },
    trash: ({ path }) =>
      entries.delete(String(path)) ? null : fail('notFound', `No file at ${String(path)}`),
    'plugin:dialog|open': ({ options }) => {
      disk.lastPicker = options
      return (options as { directory?: boolean }).directory ? disk.picks.folder : disk.picks.open
    },
    'plugin:dialog|save': ({ options }) => {
      disk.lastPicker = options
      return disk.picks.save
    },
  }

  window.__TAURI_INTERNALS__ = {
    invoke: (command, args) =>
      Promise.resolve().then(() => {
        const run = commands[command]
        if (!run) throw new Error(`The fake disk has no command ${command}`)
        return run(args)
      }),
  }
  window.fakeDisk = disk
  return disk
}
