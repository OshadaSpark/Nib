// The files the app edits, told apart by extension only: Markdown, rendered, and plain text.

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
