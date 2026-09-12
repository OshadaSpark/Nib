import { writeFile } from './writeFile'

/** The files a folder lists: Markdown and plain text. */
const listedFile = /\.(?:md|markdown|txt)$/i

/** Dot files and folders (such as `.git`) and dependencies aren't notes. */
const hidden = (name: string): boolean => name.startsWith('.') || name === 'node_modules'

const join = (directory: string, name: string): string =>
  directory ? `${directory}/${name}` : name

const nameOf = (path: string): string => path.slice(path.lastIndexOf('/') + 1)

/** Errors for a path with nothing, or a directory, where a file was expected. */
const missing = new Set(['NotFoundError', 'TypeMismatchError'])

/** The directory part of a path, `''` for the folder's root. */
export const parentOf = (path: string): string => path.slice(0, Math.max(0, path.lastIndexOf('/')))

/** Whether `name` works as a file name: not empty, nor a path. */
export const isValidName = (name: string): boolean =>
  name.trim() !== '' && name !== '.' && name !== '..' && !/[/\\]/.test(name)

export class FileNode {
  readonly kind = 'file'
  readonly name: string
  /** Relative to the folder, with `/` between names. */
  readonly path: string
  readonly handle: FileSystemFileHandle

  constructor(name: string, path: string, handle: FileSystemFileHandle) {
    this.name = name
    this.path = path
    this.handle = handle
  }
}

export class DirectoryNode {
  readonly kind = 'directory'
  readonly name: string
  /** Relative to the folder, with `/` between names; `''` for the folder itself. */
  readonly path: string
  readonly handle: FileSystemDirectoryHandle
  /** The listed entries, or `null` until the directory is first expanded. */
  children: TreeNode[] | null = $state.raw(null)
  expanded = $state(false)

  constructor(name: string, path: string, handle: FileSystemDirectoryHandle) {
    this.name = name
    this.path = path
    this.handle = handle
  }
}

export type TreeNode = FileNode | DirectoryNode

/** Directories first, then by name, with numbers in names compared by value. */
const order = (a: TreeNode, b: TreeNode): number =>
  a.kind === b.kind
    ? a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
    : a.kind === 'directory'
      ? -1
      : 1

/**
 * A folder opened with the File System Access API: a tree of its text files, listed lazily as
 * directories are expanded, and the file operations on it. Methods reject when the file system
 * does, for example if a file was deleted meanwhile.
 */
export class Folder {
  readonly root: DirectoryNode

  constructor(handle: FileSystemDirectoryHandle) {
    this.root = new DirectoryNode(handle.name, '', handle)
    this.root.expanded = true
  }

  get name(): string {
    return this.root.name
  }

  /** Lists `directory`, keeping the nodes of entries that remain, so that they stay expanded. */
  async list(directory: DirectoryNode = this.root): Promise<void> {
    const previous = directory.children ?? []
    const children: TreeNode[] = []
    for await (const [name, handle] of directory.handle.entries()) {
      if (hidden(name)) continue
      const path = join(directory.path, name)
      const node = previous.find((child) => child.name === name)
      if (handle.kind === 'directory') {
        children.push(node?.kind === 'directory' ? node : new DirectoryNode(name, path, handle))
      } else if (listedFile.test(name)) {
        children.push(node?.kind === 'file' ? node : new FileNode(name, path, handle))
      }
    }
    directory.children = children.sort(order)
  }

  /** Lists every directory listed before again, to pick up changes made outside the app. */
  async refresh(directory: DirectoryNode = this.root): Promise<void> {
    if (!directory.children) return
    await this.list(directory)
    await Promise.all(
      directory.children.flatMap((node) => (node.kind === 'directory' ? [this.refresh(node)] : [])),
    )
  }

  async toggle(directory: DirectoryNode): Promise<void> {
    directory.expanded = !directory.expanded
    if (directory.expanded && !directory.children) await this.list(directory)
  }

  /** Expands the directories down to `path`, so that its file shows. */
  async reveal(path: string): Promise<void> {
    let directory = this.root
    for (const name of parentOf(path).split('/').filter(Boolean)) {
      if (!directory.children) await this.list(directory)
      const child = directory.children?.find((node) => node.name === name)
      if (child?.kind !== 'directory') return
      directory = child
      directory.expanded = true
    }
    if (!directory.children) await this.list(directory)
  }

  /** The file at `path`, whether listed or not, or `null` if there is none. */
  async file(path: string): Promise<FileSystemFileHandle | null> {
    try {
      return await (await this.#directory(parentOf(path))).getFileHandle(nameOf(path))
    } catch (error) {
      // No such file or directory, or a directory where a file was expected.
      if (error instanceof DOMException && missing.has(error.name)) return null
      throw error
    }
  }

  /** Where `handle` is in the folder, or `null` if it is elsewhere. */
  async pathOf(handle: FileSystemHandle): Promise<string | null> {
    return (await this.root.handle.resolve(handle))?.join('/') ?? null
  }

  /** Creates an empty file named `name` in `directory`. Rejects if the name is taken. */
  async create(directory: string, name: string): Promise<FileSystemFileHandle> {
    const parent = await this.#directory(directory)
    await this.#assertFree(parent, name)
    const handle = await parent.getFileHandle(name, { create: true })
    await this.#listed(directory)
    return handle
  }

  /** Renames the file at `path` within its directory. Rejects if the name is taken. */
  async rename(path: string, name: string): Promise<FileSystemFileHandle> {
    const directory = parentOf(path)
    const parent = await this.#directory(directory)
    const handle = await parent.getFileHandle(nameOf(path))
    // A name differing only in case finds the file itself on case-insensitive file systems.
    if (name.toLowerCase() !== handle.name.toLowerCase()) await this.#assertFree(parent, name)
    let renamed: FileSystemFileHandle
    try {
      if (!handle.move) throw new DOMException('move() is not supported', 'NotSupportedError')
      await handle.move(name)
      renamed = handle
    } catch {
      // Where moving isn't available, copy the file under its new name, then delete the original,
      // unless the copy is the original, as on a case-insensitive file system.
      renamed = await parent.getFileHandle(name, { create: true })
      if (await renamed.isSameEntry(handle)) {
        throw new DOMException(`Can’t rename ${handle.name} to ${name}`, 'NotSupportedError')
      }
      await writeFile(renamed, await handle.getFile())
      await parent.removeEntry(handle.name)
    }
    await this.#listed(directory)
    return renamed
  }

  /** Deletes the file at `path`. */
  async remove(path: string): Promise<void> {
    const directory = parentOf(path)
    await (await this.#directory(directory)).removeEntry(nameOf(path))
    await this.#listed(directory)
  }

  async #directory(path: string): Promise<FileSystemDirectoryHandle> {
    let directory = this.root.handle
    for (const name of path.split('/').filter(Boolean)) {
      directory = await directory.getDirectoryHandle(name)
    }
    return directory
  }

  async #assertFree(parent: FileSystemDirectoryHandle, name: string): Promise<void> {
    const taken = await parent.getFileHandle(name).then(
      () => true,
      () => false,
    )
    if (taken) throw new DOMException(`${name} already exists`, 'InvalidModificationError')
  }

  /** Lists the directory at `path` again, if it has been listed. */
  async #listed(path: string): Promise<void> {
    let directory: DirectoryNode | undefined = this.root
    for (const name of path.split('/').filter(Boolean)) {
      const child: TreeNode | undefined = directory.children?.find((node) => node.name === name)
      directory = child?.kind === 'directory' ? child : undefined
      if (!directory) return
    }
    if (directory.children) await this.list(directory)
  }
}
