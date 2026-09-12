/**
 * Reading and writing local files. Uses the File System Access API where available, which saves
 * back to the opened file. Elsewhere, files are opened with a file input and saved as downloads.
 */

import { writeFile } from './writeFile'

/** A file read from disk. */
export interface OpenedFile {
  name: string
  /** The file's bytes, undecoded: see `decodeText`. */
  bytes: ArrayBuffer
  /** Handle for saving back to the file, if the browser supports it. */
  handle: FileSystemFileHandle | null
  /** When the file was last modified, in milliseconds since the epoch. */
  modified: number
}

/** Where a file was saved. */
export interface SavedFile {
  name: string
  handle: FileSystemFileHandle | null
  /** When the file was last modified, which is only known with a handle. */
  modified: number | null
}

/** Reads a file's bytes, and when it was last modified. */
const read = async (file: File, handle: FileSystemFileHandle | null): Promise<OpenedFile> => ({
  name: file.name,
  bytes: await file.arrayBuffer(),
  handle,
  modified: file.lastModified,
})

const pickerTypes: FilePickerAcceptType[] = [
  { description: 'Markdown', accept: { 'text/markdown': ['.md', '.markdown'] } },
  { description: 'Text', accept: { 'text/plain': ['.txt'] } },
]

const inputAccept = '.md,.markdown,.txt,text/markdown,text/plain'

/** Pickers reject with an `AbortError` when the user dismisses them. */
const isAbortError = (error: unknown): boolean =>
  error instanceof DOMException && error.name === 'AbortError'

/** Runs a file picker, resolving to `null` if the user dismisses it. */
const pick = async <T>(picker: () => Promise<T>): Promise<T | null> => {
  try {
    return await picker()
  } catch (error) {
    if (isAbortError(error)) return null
    throw error
  }
}

const pickWithInput = (): Promise<File | null> =>
  new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = inputAccept
    input.addEventListener('change', () => {
      resolve(input.files?.[0] ?? null)
    })
    input.addEventListener('cancel', () => {
      resolve(null)
    })
    input.click()
  })

const download = (text: string, name: string): void => {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  URL.revokeObjectURL(url)
}

/** Asks the user for a file to open. Resolves to `null` if they cancel. */
export const openFile = async (): Promise<OpenedFile | null> => {
  // Bound, as the pickers throw when called without `window` as their receiver.
  const showOpenFilePicker = window.showOpenFilePicker?.bind(window)

  if (!showOpenFilePicker) {
    const file = await pickWithInput()
    return file && read(file, null)
  }

  const [handle] = (await pick(() => showOpenFilePicker({ types: pickerTypes }))) ?? []
  return handle ? readFile(handle) : null
}

/** Reads the file behind `handle`. */
export const readFile = async (handle: FileSystemFileHandle): Promise<OpenedFile> =>
  read(await handle.getFile(), handle)

/** When the file behind `handle` was last modified, without reading it. */
export const lastModified = async (handle: FileSystemFileHandle): Promise<number> =>
  (await handle.getFile()).lastModified

/**
 * Reads the first file of a drop, with its handle where the browser provides one (Chromium), so
 * that saving writes back to it. Must be called while the drop event is dispatched, as its data is
 * gone afterwards; the file is only read when the returned function is called. `null` if no file
 * was dropped.
 */
export const droppedFile = (data: DataTransfer): (() => Promise<OpenedFile>) | null => {
  const item = [...data.items].find(({ kind }) => kind === 'file')
  const file = item?.getAsFile()
  if (!item || !file) return null
  const handle = item.getAsFileSystemHandle?.()
  return async () => {
    const fileHandle = await handle
    return read(file, fileHandle instanceof FileSystemFileHandle ? fileHandle : null)
  }
}

/** Whether folders can be opened, which needs the File System Access API. */
export const canOpenFolders = (): boolean => 'showDirectoryPicker' in window

/** Asks the user for a folder to open, with permission to edit it. `null` if they cancel. */
export const openFolder = async (): Promise<FileSystemDirectoryHandle | null> => {
  const showDirectoryPicker = window.showDirectoryPicker?.bind(window)
  return showDirectoryPicker ? pick(() => showDirectoryPicker({ mode: 'readwrite' })) : null
}

/**
 * Saves `text` to `handle`, or asks the user where to save it when there is no handle, starting in
 * `folder` if given. Resolves to `null` if they cancel. Without the File System Access API, the file
 * is downloaded instead.
 */
export const saveFile = async (
  text: string,
  name: string,
  handle: FileSystemFileHandle | null,
  folder: FileSystemDirectoryHandle | null = null,
): Promise<SavedFile | null> => {
  const showSaveFilePicker = window.showSaveFilePicker?.bind(window)

  if (!showSaveFilePicker) {
    download(text, name)
    return { name, handle: null, modified: null }
  }

  const target =
    handle ??
    (await pick(() =>
      showSaveFilePicker({
        suggestedName: name,
        types: pickerTypes,
        ...(folder && { startIn: folder }),
      }),
    ))
  if (!target) return null

  await writeFile(target, text)
  return { name: target.name, handle: target, modified: await lastModified(target) }
}
