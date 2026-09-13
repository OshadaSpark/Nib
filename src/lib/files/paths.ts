// Paths of files: absolute (a file's location on disk), or relative to an open folder, with `/`
// between names.

export const join = (directory: string, name: string): string =>
  directory ? `${directory}/${name}` : name

/** The last part of a path, the file's name. */
export const nameOf = (path: string): string => path.slice(path.lastIndexOf('/') + 1)

/** The directory part of a path, `''` for the folder's root. */
export const parentOf = (path: string): string => path.slice(0, Math.max(0, path.lastIndexOf('/')))

/** Where `location` is in the folder at `root`, or `null` if it's elsewhere. */
export const relativePath = (root: string, location: string): string | null => {
  const prefix = root.endsWith('/') ? root : `${root}/`
  return location.startsWith(prefix) && location.length > prefix.length
    ? location.slice(prefix.length)
    : null
}

/** Whether `name` works as a file name: not empty, nor a path. */
export const isValidName = (name: string): boolean =>
  name.trim() !== '' && name !== '.' && name !== '..' && !/[/\\]/.test(name)

/**
 * The folder path that a link or image `target` in the file at `from` points to: relative to that
 * file's directory, or to the folder's root if it starts with `/`. Query and fragment are dropped,
 * and percent-escapes decoded. `null` if it points outside the folder, or to no file.
 */
export const resolvePath = (from: string, target: string): string | null => {
  const [path = ''] = target.split(/[?#]/, 1)
  let decoded = path
  try {
    decoded = decodeURIComponent(path)
  } catch {
    // Not percent-encoded after all, such as a `%` on its own.
  }
  if (!decoded) return null
  const segments = decoded.startsWith('/') ? [] : from.split('/').slice(0, -1)
  for (const segment of decoded.split('/')) {
    if (segment === '..') {
      if (segments.pop() === undefined) return null
    } else if (segment !== '' && segment !== '.') {
      segments.push(segment)
    }
  }
  return decoded.endsWith('/') || segments.length === 0 ? null : segments.join('/')
}
