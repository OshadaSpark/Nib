/**
 * Opening and saving files: the system's pickers (through the dialog plugin), then the file
 * commands in `fileSystem.ts`. Files are known by their absolute path, their location.
 */

import { open, save } from '@tauri-apps/plugin-dialog'
import { markdownExtensions, textExtensions } from './fileTypes'
import { readBytes, writeText } from './fileSystem'
import { join, nameOf } from './paths'

/** A file read from disk. */
export interface OpenedFile {
  name: string
  /** The file's bytes, undecoded: see `decodeText`. */
  bytes: ArrayBuffer
  /** Where the file is, to save back to; `null` for a dropped file, which the page gets no path for. */
  location: string | null
  /** When the file was last modified, in milliseconds since the epoch. */
  modified: number
}

/** Where a file was saved. */
export interface SavedFile {
  name: string
  location: string
  modified: number
}

const filters = [
  {
    name: 'Markdown and text',
    extensions: [...markdownExtensions, ...textExtensions].map((extension) => extension.slice(1)),
  },
]

/** Reads the file at `location`. */
export const readFile = async (location: string): Promise<OpenedFile> => ({
  name: nameOf(location),
  location,
  ...(await readBytes(location)),
})

/** Asks the user for a file to open, starting in `folder` if given. `null` if they cancel. */
export const openFile = async (folder: string | null = null): Promise<OpenedFile | null> => {
  const location = await open({ filters, ...(folder && { defaultPath: folder }) })
  return location === null ? null : readFile(location)
}

/** Asks the user for a folder to open. `null` if they cancel. */
export const openFolder = (): Promise<string | null> => open({ directory: true })

/**
 * Reads the first file of an HTML drop. Must be called while the drop event is dispatched, as its
 * data is gone afterwards; the file is only read when the returned function is called. `null` if
 * no file was dropped.
 */
export const droppedFile = (data: DataTransfer): (() => Promise<OpenedFile>) | null => {
  const file = [...data.items].find(({ kind }) => kind === 'file')?.getAsFile()
  if (!file) return null
  return async () => ({
    name: file.name,
    bytes: await file.arrayBuffer(),
    location: null,
    modified: file.lastModified,
  })
}

/**
 * Saves `text` to `location`, or asks the user where to save it when there is none, suggesting
 * `name` in `folder` if given. Resolves to `null` if they cancel.
 */
export const saveFile = async (
  text: string,
  name: string,
  location: string | null,
  folder: string | null = null,
): Promise<SavedFile | null> => {
  const target = location ?? (await save({ defaultPath: folder ? join(folder, name) : name }))
  if (target === null) return null
  return { name: nameOf(target), location: target, modified: await writeText(target, text) }
}
