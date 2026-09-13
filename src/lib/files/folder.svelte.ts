import { imageTypeOf, isEditableName } from './fileTypes'
import {
  createFile,
  listDirectory,
  modifiedTime,
  readBytes,
  renameFile,
  trashFile,
} from './fileSystem'
import { ObjectURLs } from './objectURLs'
import { join, nameOf, parentOf, relativePath } from './paths'

/** Dot files and folders (such as `.git`) and dependencies aren't notes. */
const hidden = (name: string): boolean => name.startsWith('.') || name === 'node_modules'

export class FileNode {
  readonly kind = 'file'
  readonly name: string
  /** Relative to the folder, with `/` between names. */
  readonly path: string

  constructor(name: string, path: string) {
    this.name = name
    this.path = path
  }
}

export class DirectoryNode {
  readonly kind = 'directory'
  readonly name: string
  /** Relative to the folder, with `/` between names; `''` for the folder itself. */
  readonly path: string
  /** The listed entries, or `null` until the directory is first expanded. */
  children: TreeNode[] | null = $state.raw(null)
  expanded = $state(false)

  constructor(name: string, path: string) {
    this.name = name
    this.path = path
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
 * A folder on disk: a tree of its text files, listed lazily as directories are expanded, and the
 * file operations on it, by paths relative to it. Methods reject when the file system does, for
 * example if a file was deleted meanwhile.
 */
export class Folder {
  /** The folder's absolute path. */
  readonly location: string
  readonly root: DirectoryNode
  /** URLs for the images shown from the folder. */
  readonly #images = new ObjectURLs()

  constructor(location: string) {
    this.location = location
    this.root = new DirectoryNode(nameOf(location), '')
    this.root.expanded = true
  }

  get name(): string {
    return this.root.name
  }

  /** The absolute path of `path` in the folder. */
  locationOf(path: string): string {
    return path ? join(this.location, path) : this.location
  }

  /** Where `location` is in the folder, or `null` if it is elsewhere. */
  pathOf(location: string): string | null {
    return relativePath(this.location, location)
  }

  /** Lists `directory`, keeping the nodes of entries that remain, so that they stay expanded. */
  async list(directory: DirectoryNode = this.root): Promise<void> {
    const previous = directory.children ?? []
    const children: TreeNode[] = []
    const entries = await listDirectory(this.locationOf(directory.path))
    for (const { name, directory: isDirectory } of entries) {
      if (hidden(name)) continue
      const path = join(directory.path, name)
      const node = previous.find((child) => child.name === name)
      if (isDirectory) {
        children.push(node?.kind === 'directory' ? node : new DirectoryNode(name, path))
      } else if (isEditableName(name)) {
        children.push(node?.kind === 'file' ? node : new FileNode(name, path))
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

  /** A URL to show the image at `path` with, or `null` if it can't be read. */
  async imageURL(path: string): Promise<string | null> {
    try {
      const location = this.locationOf(path)
      const cached = this.#images.get(path, await modifiedTime(location))
      if (cached) return cached
      const { bytes, modified } = await readBytes(location)
      return this.#images.set(path, new Blob([bytes], { type: imageTypeOf(path) }), modified)
    } catch (error) {
      console.warn(error)
      return null
    }
  }

  /** Lets go of the folder's resources, as when another folder is opened. */
  close(): void {
    this.#images.clear()
  }

  /**
   * Creates an empty file named `name` in `directory`, returning its modified time. Rejects if the
   * name is taken.
   */
  async create(directory: string, name: string): Promise<number> {
    const modified = await createFile(this.locationOf(join(directory, name)))
    await this.#listed(directory)
    return modified
  }

  /**
   * Renames the file at `path` within its directory, returning its modified time. Rejects if the
   * name is taken.
   */
  async rename(path: string, name: string): Promise<number> {
    const directory = parentOf(path)
    const modified = await renameFile(this.locationOf(path), this.locationOf(join(directory, name)))
    await this.#listed(directory)
    return modified
  }

  /** Moves the file at `path` to the Trash. */
  async remove(path: string): Promise<void> {
    await trashFile(this.locationOf(path))
    await this.#listed(parentOf(path))
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
