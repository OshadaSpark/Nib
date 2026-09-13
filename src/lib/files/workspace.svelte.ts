import type { Confirm } from '$lib/dialog/confirmation.svelte'
import { SvelteMap } from 'svelte/reactivity'
import { openFile, openFolder, readFile, saveFile, type OpenedFile } from './fileAccess'
import { failedWith, modifiedTime } from './fileSystem'
import { withExtension } from './fileTypes'
import { Folder } from './folder.svelte'
import { isValidName, join, nameOf, parentOf, resolvePath } from './paths'
import type { Session } from './session'
import { decodeText, TextFile } from './textFile.svelte'

const untitledName = 'Untitled.md'
const couldNotOpen = 'Couldn’t open the file.'
const couldNotOpenFolder = 'Couldn’t open the folder.'

/**
 * The open file and folder, and the actions on them. Failures are reported through `error`, never
 * thrown.
 */
export class Workspace {
  file: TextFile = $state.raw(new TextFile(untitledName))
  /** The open folder, if any. */
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

  /** Asks the user for a file to open, starting in the open folder. */
  async open(): Promise<void> {
    await this.#run(couldNotOpen, async () => {
      const opened = await openFile(this.folder?.location)
      if (opened) await this.#openFile(opened)
    })
  }

  /** Opens the file at `location`, as one opened from the system. */
  async openLocation(location: string): Promise<void> {
    await this.#run(couldNotOpen, async () => {
      await this.#openFile(await readFile(location))
    })
  }

  /** Opens the file dropped on the window, which `read` reads. */
  async openDropped(read: () => Promise<OpenedFile>): Promise<void> {
    await this.#run(couldNotOpen, async () => {
      await this.#openFile(await read())
    })
  }

  /** Shows `opened`, or its unsaved changes if it is one of the folder's files, opened before. */
  async #openFile(opened: OpenedFile): Promise<void> {
    const path = (opened.location && this.folder?.pathOf(opened.location)) ?? null
    const existing = path === null ? undefined : this.opened.get(path)
    const file = existing ?? this.#textFile(opened)
    if (!file || !(await this.#confirmDiscard())) return
    if (file.path === null) this.#show(file, path)
    else this.file = file
    if (path !== null) await this.folder?.reveal(path)
  }

  /** Asks the user for a folder, and lists its files. */
  async openFolder(): Promise<void> {
    await this.#run(couldNotOpenFolder, async () => {
      const location = await openFolder()
      if (location) await this.#openFolder(location)
    })
  }

  /** Opens the folder at `location`, and lists its files. */
  async openFolderAt(location: string): Promise<void> {
    await this.#run(couldNotOpenFolder, () => this.#openFolder(location))
  }

  async #openFolder(location: string): Promise<void> {
    if (!(await this.#confirmDiscardAll())) return
    const folder = new Folder(location)
    await folder.list()
    this.folder?.close()
    this.folder = folder
    this.opened.clear()
    this.file = new TextFile(untitledName)
  }

  /**
   * Opens again what was open when the app last closed. What has been moved or deleted since is
   * left out, without an error, as it's no action of the user's that failed.
   */
  async restore({ folder, file }: Session): Promise<void> {
    if (folder) await this.openFolderAt(folder)
    if (file) await this.openLocation(file)
    this.error = null
  }

  /**
   * Whether the window may close: after asking, if any file has unsaved changes. Not while an action
   * is under way, such as saving.
   */
  async confirmClose(): Promise<boolean> {
    return !this.#busy && this.#confirmDiscardAll()
  }

  /** Shows the folder's file at `path`, with its unsaved changes if it has been opened before. */
  async openPath(path: string): Promise<void> {
    await this.#inFolder(`Couldn’t open ${path}.`, async (folder) => {
      const existing = this.opened.get(path)
      if (existing === this.file || !(await this.#confirmDiscard())) return
      if (existing) {
        this.file = existing
      } else {
        const opened = await readFile(folder.locationOf(path)).catch((error: unknown) => {
          if (failedWith(error, 'notFound')) return null
          throw error
        })
        if (!opened) {
          this.error = `There’s no ${path} in the folder.`
          return
        }
        const file = this.#textFile(opened)
        if (!file) return
        this.#show(file, path)
      }
      await folder.reveal(path)
    })
    // A file opened before may have changed on disk since.
    await this.checkDisk()
  }

  /** Opens the note a relative link in the open file points to. Returns whether there is one. */
  openLink(target: string): boolean {
    const path = this.#linked(target)
    if (path !== null) void this.openPath(path)
    return path !== null
  }

  /** A URL to show the image at a relative `src` in the open file with, or `null` if none. */
  async imageURL(src: string): Promise<string | null> {
    const path = this.#linked(src)
    return path === null ? null : ((await this.folder?.imageURL(path)) ?? null)
  }

  /** The folder path a relative link or image in the open file points to, if it is in the folder. */
  #linked(target: string): string | null {
    const { folder, file } = this
    return folder && file.path !== null ? resolvePath(file.path, target) : null
  }

  /** Saves to the open file, or asks where to save if it has not been saved before. */
  async save(): Promise<void> {
    await this.#save(this.file.location)
  }

  /** Asks where to save, even if the file has been saved before. */
  async saveAs(): Promise<void> {
    await this.#save(null)
  }

  async #save(location: string | null): Promise<void> {
    const { file, folder } = this
    await this.#run(`Couldn’t save ${file.name}.`, async () => {
      // Edits made while saving are not part of the save, so they leave the file dirty.
      const { content } = file
      const saved = await saveFile(
        file.serialize(content),
        file.name,
        location,
        folder?.location ?? null,
      )
      if (!saved) return
      file.markSaved(content, saved.name, saved.location, saved.modified)
      // Saving somewhere new may have added the file to the folder, or taken it out.
      const path = folder?.pathOf(saved.location) ?? null
      if (folder && path !== file.path) {
        this.#track(file, path)
        await folder.refresh()
      }
    })
  }

  /** Creates an empty file named `name` in the folder's `directory`, and opens it. */
  async createFile(directory: string, name: string): Promise<void> {
    await this.#inFolder(`Couldn’t create ${name}.`, async (folder) => {
      if (!isValidName(name) || !(await this.#confirmDiscard())) return
      const fileName = withExtension(name)
      const path = join(directory, fileName)
      const modified = await folder.create(directory, fileName)
      this.#show(new TextFile(fileName, '', folder.locationOf(path), modified), path)
    })
  }

  /** Renames the folder's file at `path`, keeping its unsaved changes if it is open. */
  async renameFile(path: string, name: string): Promise<void> {
    await this.#inFolder(`Couldn’t rename ${path}.`, async (folder) => {
      if (!isValidName(name)) return
      const fileName = withExtension(name)
      const modified = await folder.rename(path, fileName)
      const file = this.opened.get(path)
      if (!file) return
      const renamed = join(parentOf(path), fileName)
      file.name = fileName
      file.location = folder.locationOf(renamed)
      file.modified = modified
      this.#track(file, renamed)
    })
  }

  /** Deletes the folder's file at `path`, after asking. */
  async deleteFile(path: string): Promise<void> {
    await this.#inFolder(`Couldn’t delete ${path}.`, async (folder) => {
      const confirmed = await this.#confirm({
        title: `Delete ${nameOf(path)}?`,
        message: 'It will be moved to the Trash.',
        confirm: 'Delete',
        cancel: 'Cancel',
      })
      if (!confirmed) return
      await folder.remove(path)
      const file = this.opened.get(path)
      this.opened.delete(path)
      if (file === this.file) this.file = new TextFile(untitledName)
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
      const { location, modified } = file
      if (!location || (await modifiedTime(location)) === modified) return
      const disk = await readFile(location)
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

  /** The text file read as `opened`, or `null` if it isn't text, which is reported. */
  #textFile({ name, bytes, location, modified }: OpenedFile): TextFile | null {
    const text = decodeText(bytes)
    if (text !== null) return new TextFile(name, text, location, modified)
    this.error = `${name} isn’t a UTF-8 text file.`
    return null
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

  /** Runs `action` on the open folder, as `#run` does, if there is one. */
  async #inFolder(
    failureMessage: string,
    action: (folder: Folder) => Promise<void>,
  ): Promise<void> {
    const { folder } = this
    if (folder) await this.#run(failureMessage, () => action(folder))
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
    return this.#confirmLosing(this.file.path === null ? [this.file] : [])
  }

  /** Asks before every open file is replaced, as when opening another folder. */
  async #confirmDiscardAll(): Promise<boolean> {
    // The open file is among the opened ones if it is in the folder.
    const files = [this.file, ...this.opened.values()]
    return this.#confirmLosing(files.filter((file, index) => files.indexOf(file) === index))
  }

  /** Asks before `files` are replaced, if any has unsaved changes. */
  async #confirmLosing(files: readonly TextFile[]): Promise<boolean> {
    const dirty = files.filter((file) => file.dirty)
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
