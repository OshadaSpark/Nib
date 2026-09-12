import { Text } from '@codemirror/state'

const byteOrderMark = '\uFEFF'

// Keeps the byte-order mark, so that it can be written back, and fails on invalid UTF-8 rather than
// replacing it, which would corrupt the file on save.
const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })

/** Decodes a file's bytes as UTF-8, or returns `null` if it is not a UTF-8 text file. */
export const decodeText = (bytes: ArrayBuffer): string | null => {
  try {
    const text = decoder.decode(bytes)
    // Text files don't contain NUL, while binary files that happen to be valid UTF-8 usually do.
    return text.includes('\0') ? null : text
  } catch {
    return null
  }
}

/** A text file open in the editor, tracking its content against the last saved version. */
export class TextFile {
  name: string = $state('')
  /** Handle for saving back to the file, if it has one. */
  handle: FileSystemFileHandle | null = $state.raw(null)
  /** The current content, kept in sync with the editor. */
  content: Text = $state.raw(Text.empty)
  #saved: Text = $state.raw(Text.empty)
  readonly dirty: boolean = $derived(!this.content.eq(this.#saved))

  /** The content the file was opened with. */
  readonly initial: Text
  /** The editor normalises line breaks to `\n`, so the file's own is restored on save. */
  readonly #lineBreak: string
  /** Kept out of the editor, where it would be invisible, and restored on save. */
  readonly #byteOrderMark: string

  constructor(name: string, text = '', handle: FileSystemFileHandle | null = null) {
    this.name = name
    this.handle = handle
    this.#byteOrderMark = text.startsWith(byteOrderMark) ? byteOrderMark : ''
    this.#lineBreak = text.includes('\r\n') ? '\r\n' : '\n'
    this.initial = Text.of(text.slice(this.#byteOrderMark.length).split(/\r\n?|\n/))
    this.content = this.initial
    this.#saved = this.initial
  }

  /** Converts `content` to the file's text, with its original line breaks and byte-order mark. */
  serialize(content: Text = this.content): string {
    return this.#byteOrderMark + content.sliceString(0, content.length, this.#lineBreak)
  }

  /** Records that `content` was saved, possibly under a new name and handle. */
  markSaved(content: Text, name: string, handle: FileSystemFileHandle | null): void {
    this.#saved = content
    this.name = name
    this.handle = handle
  }
}
