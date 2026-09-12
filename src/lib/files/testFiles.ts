import type { OpenedFile } from './fileAccess'

/** For tests: a stand-in for a file handle, which only has a name. */
export const handle = (name: string): FileSystemFileHandle => ({ name }) as FileSystemFileHandle

/** For tests: a file as read from disk, with `text` encoded as UTF-8. */
export const opened = (
  name: string,
  text: string,
  fileHandle: FileSystemFileHandle | null = null,
  modified = 0,
): OpenedFile => ({
  name,
  bytes: new TextEncoder().encode(text).buffer,
  handle: fileHandle,
  modified,
})
