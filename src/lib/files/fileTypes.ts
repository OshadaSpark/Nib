// The files the app edits, told apart by extension only: Markdown, rendered, and plain text; and
// the images it shows.

export const markdownExtensions: readonly string[] = ['.md', '.markdown']
export const textExtensions: readonly string[] = ['.txt']

const hasExtension = (name: string, extensions: readonly string[]): boolean => {
  const lowerCase = name.toLowerCase()
  return extensions.some((extension) => lowerCase.endsWith(extension))
}

export const isMarkdownName = (name: string): boolean => hasExtension(name, markdownExtensions)

/** Whether the app edits files named `name`, and so lists them in a folder. */
export const isEditableName = (name: string): boolean =>
  isMarkdownName(name) || hasExtension(name, textExtensions)

/** `name`, trimmed, and given `.md` unless the app edits it already, so that it shows in the folder. */
export const withExtension = (name: string): string => {
  const trimmed = name.trim()
  return isEditableName(trimmed) ? trimmed : `${trimmed}.md`
}

const imageTypes: Readonly<Record<string, string>> = {
  avif: 'image/avif',
  gif: 'image/gif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  svg: 'image/svg+xml',
  webp: 'image/webp',
}

/**
 * The media type of the image named `name`, or `''` if unknown. Images from bytes need it: without
 * it, SVG doesn't show, nor anything in Firefox.
 */
export const imageTypeOf = (name: string): string =>
  imageTypes[name.slice(name.lastIndexOf('.') + 1).toLowerCase()] ?? ''
