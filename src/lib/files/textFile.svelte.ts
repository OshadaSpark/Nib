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
  /** The content last read from disk: when the file is reloaded, the editor takes it over. */
  loaded: Text = $state.raw(Text.empty)
  #saved: Text = $state.raw(Text.empty)
  readonly dirty: boolean = $derived(!this.content.eq(this.#saved))
  /** When the file was last modified, as of reading or saving it, to notice changes on disk. */
  modified: number | null

  /** The editor normalises line breaks to `\n`, so the file's own is restored on save. */
  #lineBreak = '\n'
  /** Kept out of the editor, where it would be invisible, and restored on save. */
  #byteOrderMark = ''

  constructor(
    name: string,
    text = '',
    handle: FileSystemFileHandle | null = null,
    modified: number | null = null,
  ) {
    this.name = name
    this.handle = handle
    this.modified = modified
    this.#load(text)
  }

  /** Replaces the content with `text`, read from disk again as it was modified at `modified`. */
  reload(text: string, modified: number): void {
    this.modified = modified
    this.#load(text)
  }

  /** Whether `text` is what was last saved, or read from disk. */
  matchesSaved(text: string): boolean {
    return text === this.serialize(this.#saved)
  }

  #load(text: string): void {
    this.#byteOrderMark = text.startsWith(byteOrderMark) ? byteOrderMark : ''
    this.#lineBreak = text.includes('\r\n') ? '\r\n' : '\n'
    this.loaded = Text.of(text.slice(this.#byteOrderMark.length).split(/\r\n?|\n/))
    this.content = this.loaded
    this.#saved = this.loaded
  }

  /** Converts `content` to the file's text, with its original line breaks and byte-order mark. */
  serialize(content: Text = this.content): string {
    return this.#byteOrderMark + content.sliceString(0, content.length, this.#lineBreak)
  }

  /** Records that `content` was saved, possibly under a new name and handle. */
  markSaved(
    content: Text,
    name: string,
    handle: FileSystemFileHandle | null,
    modified: number | null,
  ): void {
    this.#saved = content
    this.name = name
    this.handle = handle
    this.modified = modified
  }
}
