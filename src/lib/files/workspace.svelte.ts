import type { Confirm } from '$lib/dialog/confirmation.svelte'
import { openFile, saveFile } from './fileAccess'
import { TextFile } from './textFile.svelte'

const untitledName = 'Untitled.md'

/** The open file and the actions on it. Failures are reported through `error`, never thrown. */
export class Workspace {
  file: TextFile = $state.raw(new TextFile(untitledName))
  /** Message for the last failed action, cleared when the next one starts. */
  error: string | null = $state(null)
  /** Set while an action awaits the user or the file system, so actions cannot overlap. */
  #busy = false
  readonly #confirm: Confirm

  /** `confirm` asks the user before unsaved changes are discarded. */
  constructor(confirm: Confirm) {
    this.#confirm = confirm
  }

  async newFile(): Promise<void> {
    await this.#run('Couldn’t create a new file.', async () => {
      if (await this.#confirmDiscard()) this.file = new TextFile(untitledName)
    })
  }

  async open(): Promise<void> {
    await this.#run('Couldn’t open the file.', async () => {
      const opened = await openFile()
      if (opened && (await this.#confirmDiscard())) {
        this.file = new TextFile(opened.name, opened.text, opened.handle)
      }
    })
  }

  /** Saves to the open file, or asks where to save if it has not been saved before. */
  async save(): Promise<void> {
    await this.#save(this.file.handle)
  }

  /** Asks where to save, even if the file has been saved before. */
  async saveAs(): Promise<void> {
    await this.#save(null)
  }

  async #save(handle: FileSystemFileHandle | null): Promise<void> {
    const { file } = this
    await this.#run(`Couldn’t save ${file.name}.`, async () => {
      // Edits made while saving are not part of the save, so they leave the file dirty.
      const { content } = file
      const saved = await saveFile(file.serialize(content), file.name, handle)
      if (saved) file.markSaved(content, saved.name, saved.handle)
    })
  }

  async #run(failureMessage: string, action: () => Promise<void>): Promise<void> {
    if (this.#busy) return
    this.#busy = true
    this.error = null
    try {
      await action()
    } catch (error) {
      console.error(error)
      this.error = failureMessage
    } finally {
      this.#busy = false
    }
  }

  async #confirmDiscard(): Promise<boolean> {
    return (
      !this.file.dirty ||
      this.#confirm({
        title: 'Discard unsaved changes?',
        message: `Your changes to ${this.file.name} will be lost.`,
        confirm: 'Discard',
        cancel: 'Cancel',
      })
    )
  }
}
