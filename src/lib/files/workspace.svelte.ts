import type { Confirm } from '$lib/dialog/confirmation.svelte'
import { lastModified, openFile, readFile, saveFile, type OpenedFile } from './fileAccess'
import { decodeText, TextFile } from './textFile.svelte'

const untitledName = 'Untitled.md'

/** The open file and the actions on it. Failures are reported through `error`, never thrown. */
export class Workspace {
  file: TextFile = $state.raw(new TextFile(untitledName))
  /** Message for the last failed action, cleared when the next one starts. */
  error: string | null = $state(null)
  /** Set while an action awaits the user or the file system, so actions cannot overlap. */
  #busy = false
  /** How many actions have started, for checks in the background to notice one did. */
  #actions = 0
  /** Set while checking for changes on disk, which happens in the background. */
  #checking = false
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

  /** Asks the user for a file to open. */
  async open(): Promise<void> {
    await this.#open(openFile)
  }

  /** Opens a file dropped on the page, read by `read` (see `droppedFile`). */
  async openDropped(read: () => Promise<OpenedFile>): Promise<void> {
    await this.#open(read)
  }

  async #open(read: () => Promise<OpenedFile | null>): Promise<void> {
    await this.#run('Couldn’t open the file.', async () => {
      const opened = await read()
      if (!opened) return
      const text = decodeText(opened.bytes)
      if (text === null) {
        this.error = `${opened.name} isn’t a UTF-8 text file.`
      } else if (await this.#confirmDiscard()) {
        this.file = new TextFile(opened.name, text, opened.handle, opened.modified)
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
      if (saved) file.markSaved(content, saved.name, saved.handle, saved.modified)
    })
  }

  /**
   * Reloads the file if it changed on disk since it was read or saved. With unsaved changes, asks
   * first; if the user keeps them, asks again only on the next change.
   */
  async checkDisk(): Promise<void> {
    const { file } = this
    if (this.#busy || this.#checking) return
    // Not through `#run`: it's no action of the user's, so it doesn't hold up theirs, nor clear or
    // report errors.
    this.#checking = true
    const actions = this.#actions
    try {
      const { handle, modified } = file
      if (!handle || (await lastModified(handle)) === modified) return
      const disk = await readFile(handle)
      // Leaves it to the next check if the user started an action meanwhile, such as saving.
      if (this.#actions !== actions || file.modified !== modified) return
      const text = decodeText(disk.bytes)
      this.#busy = true
      try {
        if (text === null || file.matchesSaved(text) || !(await this.#confirmReload())) {
          file.modified = disk.modified
        } else {
          file.reload(text, disk.modified)
        }
      } finally {
        this.#busy = false
      }
    } catch (error) {
      // For example, the file was moved or deleted. Saving will report it, if it still fails then.
      console.warn(error)
    } finally {
      this.#checking = false
    }
  }

  async #run(failureMessage: string, action: () => Promise<void>): Promise<void> {
    if (this.#busy) return
    this.#busy = true
    this.#actions += 1
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

  async #confirmReload(): Promise<boolean> {
    return (
      !this.file.dirty ||
      this.#confirm({
        title: `${this.file.name} changed on disk`,
        message:
          'Reload it and lose your unsaved changes, or keep your version? Saving will then replace the file on disk.',
        confirm: 'Reload',
        cancel: 'Keep mine',
      })
    )
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
