import { Text } from '@codemirror/state'

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

  constructor(name: string, text = '', handle: FileSystemFileHandle | null = null) {
    this.name = name
    this.handle = handle
    this.#lineBreak = text.includes('\r\n') ? '\r\n' : '\n'
    this.initial = Text.of(text.split(/\r\n?|\n/))
    this.content = this.initial
    this.#saved = this.initial
  }

  /** Converts `content` to the file's text, with its original line breaks. */
  serialize(content: Text = this.content): string {
    return content.sliceString(0, content.length, this.#lineBreak)
  }

  /** Records that `content` was saved, possibly under a new name and handle. */
  markSaved(content: Text, name: string, handle: FileSystemFileHandle | null): void {
    this.#saved = content
    this.name = name
    this.handle = handle
  }
}
