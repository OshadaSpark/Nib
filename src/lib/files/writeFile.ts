/**
 * Writes `data` to the file behind `handle`. Writes go to a temporary file that replaces the
 * original on `close()`, or is discarded on `abort()`, so a failed write leaves the file untouched.
 */
export const writeFile = async (
  handle: FileSystemFileHandle,
  data: string | Blob,
): Promise<void> => {
  const writable = await handle.createWritable()
  try {
    await writable.write(data)
    await writable.close()
  } catch (error) {
    await writable.abort()
    throw error
  }
}
