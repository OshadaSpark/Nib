import type { Confirm } from '$lib/dialog/confirmation.svelte'
import { SvelteMap } from 'svelte/reactivity'
import {
  lastModified,
  openFile,
  openFolder,
  readFile,
  saveFile,
  type OpenedFile,
} from './fileAccess'
import { Folder } from './folder.svelte'
import { decodeText, TextFile } from './textFile.svelte'

const untitledName = 'Untitled.md'

/**
 * The open file and folder, and the actions on them. Failures are reported through `error`, never
 * thrown.
 */
export class Workspace {
  file: TextFile = $state.raw(new TextFile(untitledName))
  /** The open folder, if any (Chromium only). */
  folder: Folder | null = $state.raw(null)
  /** Files from the folder that have been opened, by path, which keep their edits while hidden. */
  readonly opened = new SvelteMap<string, TextFile>()
  /** Whether any open file has unsaved changes. */
  readonly dirty: boolean = $derived(
    this.file.dirty || [...this.opened.values()].some((file) => file.dirty),
  )
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
      const path = opened.handle && (await this.folder?.pathOf(opened.handle))
      const existing = path && this.opened.get(path)
      if (existing) {
        if (await this.#confirmDiscard()) this.file = existing
        return
      }
      const text = decodeText(opened.bytes)
      if (text === null) {
        this.error = `${opened.name} isn’t a UTF-8 text file.`
      } else if (await this.#confirmDiscard()) {
        this.#show(new TextFile(opened.name, text, opened.handle, opened.modified), path ?? null)
      }
    })
  }

  /** Asks the user for a folder, and lists its files. */
  async openFolder(): Promise<void> {
    await this.#run('Couldn’t open the folder.', async () => {
      const handle = await openFolder()
      if (!handle || !(await this.#confirmDiscardAll())) return
      const folder = new Folder(handle)
      await folder.list()
      this.folder = folder
      this.opened.clear()
      this.file = new TextFile(untitledName)
    })
  }

  /** Shows the folder's file at `path`, with its unsaved changes if it has been opened before. */
  async openPath(path: string): Promise<void> {
    const { folder } = this
    if (!folder) return
    await this.#run(`Couldn’t open ${path}.`, async () => {
      const existing = this.opened.get(path)
      if (existing === this.file || !(await this.#confirmDiscard())) return
      if (existing) {
        this.file = existing
      } else {
        const handle = await folder.file(path)
        if (!handle) {
          this.error = `There’s no ${path} in the folder.`
          return
        }
        const opened = await readFile(handle)
        const text = decodeText(opened.bytes)
        if (text === null) {
          this.error = `${opened.name} isn’t a UTF-8 text file.`
          return
        }
        this.#show(new TextFile(opened.name, text, handle, opened.modified), path)
      }
      await folder.reveal(path)
    })
    // A file opened before may have changed on disk since.
    await this.checkDisk()
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
    const { file, folder } = this
    await this.#run(`Couldn’t save ${file.name}.`, async () => {
      // Edits made while saving are not part of the save, so they leave the file dirty.
      const { content } = file
      const saved = await saveFile(
        file.serialize(content),
        file.name,
        handle,
        folder?.root.handle ?? null,
      )
      if (!saved) return
      file.markSaved(content, saved.name, saved.handle, saved.modified)
      // Saving somewhere new may have added the file to the folder, or taken it out.
      const path = saved.handle && (await folder?.pathOf(saved.handle))
      if (folder && (path ?? null) !== file.path) {
        this.#track(file, path ?? null)
        await folder.refresh()
      }
    })
  }

  /**
   * Reloads the file if it changed on disk since it was read or saved, and lists the folder again.
   * With unsaved changes, asks first; if the user keeps them, asks again only on the next change.
   */
  async checkDisk(): Promise<void> {
    const { file, folder } = this
    if (this.#busy || this.#checking) return
    // Not through `#run`: it's no action of the user's, so it doesn't hold up theirs, nor clear or
    // report errors.
    this.#checking = true
    const actions = this.#actions
    try {
      await folder?.refresh()
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

  /** Shows `file`, keeping it among the opened files if it is in the folder. */
  #show(file: TextFile, path: string | null): void {
    this.#track(file, path)
    this.file = file
  }

  /** Records that `file` is at `path` in the folder, or outside it if `null`. */
  #track(file: TextFile, path: string | null): void {
    if (file.path !== null) this.opened.delete(file.path)
    file.path = path
    if (path !== null) this.opened.set(path, file)
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

  /** Asks before the open file is replaced, unless it keeps its changes as one of the folder's. */
  async #confirmDiscard(): Promise<boolean> {
    return (
      !this.file.dirty ||
      this.file.path !== null ||
      this.#confirm({
        title: 'Discard unsaved changes?',
        message: `Your changes to ${this.file.name} will be lost.`,
        confirm: 'Discard',
        cancel: 'Cancel',
      })
    )
  }

  /** Asks before every open file is replaced, as when opening another folder. */
  async #confirmDiscardAll(): Promise<boolean> {
    // The open file is among the opened ones if it is in the folder.
    const files = [this.file, ...this.opened.values()]
    const dirty = files.filter((file, index) => file.dirty && files.indexOf(file) === index)
    const [only] = dirty
    return (
      !only ||
      this.#confirm({
        title: 'Discard unsaved changes?',
        message:
          dirty.length === 1
            ? `Your changes to ${only.name} will be lost.`
            : `Your changes to ${String(dirty.length)} files will be lost.`,
        confirm: 'Discard',
        cancel: 'Cancel',
      })
    )
  }
}
