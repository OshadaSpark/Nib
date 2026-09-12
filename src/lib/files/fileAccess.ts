/**
 * Reading and writing local files. Uses the File System Access API where available, which saves
 * back to the opened file. Elsewhere, files are opened with a file input and saved as downloads.
 */

/** A file read from disk. */
export interface OpenedFile {
  name: string
  /** The file's bytes, undecoded: see `decodeText`. */
  bytes: ArrayBuffer
  /** Handle for saving back to the file, if the browser supports it. */
  handle: FileSystemFileHandle | null
}

/** Where a file was saved. */
export interface SavedFile {
  name: string
  handle: FileSystemFileHandle | null
}

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
    return file && { name: file.name, bytes: await file.arrayBuffer(), handle: null }
  }

  const [handle] = (await pick(() => showOpenFilePicker({ types: pickerTypes }))) ?? []
  if (!handle) return null
  const file = await handle.getFile()
  return { name: file.name, bytes: await file.arrayBuffer(), handle }
}

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
    return {
      name: file.name,
      bytes: await file.arrayBuffer(),
      handle: fileHandle instanceof FileSystemFileHandle ? fileHandle : null,
    }
  }
}

/**
 * Saves `text` to `handle`, or asks the user where to save it when there is no handle. Resolves to
 * `null` if they cancel. Without the File System Access API, the file is downloaded instead.
 */
export const saveFile = async (
  text: string,
  name: string,
  handle: FileSystemFileHandle | null,
): Promise<SavedFile | null> => {
  const showSaveFilePicker = window.showSaveFilePicker?.bind(window)

  if (!showSaveFilePicker) {
    download(text, name)
    return { name, handle: null }
  }

  const target =
    handle ?? (await pick(() => showSaveFilePicker({ suggestedName: name, types: pickerTypes })))
  if (!target) return null

  // Writes go to a temporary file that replaces the original on `close()`, or is discarded on
  // `abort()`, so a failed save leaves the file untouched.
  const writable = await target.createWritable()
  try {
    await writable.write(text)
    await writable.close()
  } catch (error) {
    await writable.abort()
    throw error
  }
  return { name: target.name, handle: target }
}
