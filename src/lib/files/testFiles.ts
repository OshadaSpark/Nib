import type { OpenedFile } from './fileAccess'

/** For tests: a file as read from disk, with `text` encoded as UTF-8. */
export const opened = (
  name: string,
  text: string,
  location: string | null = null,
  modified = 0,
): OpenedFile => ({
  name,
  bytes: new TextEncoder().encode(text).buffer,
  location,
  modified,
})
