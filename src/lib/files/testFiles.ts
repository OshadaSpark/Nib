import type { OpenedFile } from './fileAccess'

/** For tests: a stand-in for a file handle, which only has a name. */
export const handle = (name: string): FileSystemFileHandle => ({ name }) as FileSystemFileHandle

/** For tests: a file as read from disk, with `text` encoded as UTF-8. */
export const opened = (
  name: string,
  text: string,
  fileHandle: FileSystemFileHandle | null = null,
  modified = 0,
): OpenedFile => ({
  name,
  bytes: new TextEncoder().encode(text).buffer,
  handle: fileHandle,
  modified,
})

/** For tests: the files and directories in a fake folder, by name, with files' text as values. */
export interface FakeTree {
  [name: string]: string | FakeTree
}

const notFound = (name: string): DOMException =>
  new DOMException(`${name} not found`, 'NotFoundError')

const typeMismatch = (name: string): DOMException =>
  new DOMException(`${name} is the wrong kind`, 'TypeMismatchError')

/** A file in memory, standing in for a `FileSystemFileHandle`. */
class FakeFile {
  readonly kind = 'file'
  name: string
  text: string
  lastModified = 1
  readonly parent: FakeDirectory

  constructor(name: string, text: string, parent: FakeDirectory) {
    this.name = name
    this.text = text
    this.parent = parent
  }

  getFile(): Promise<File> {
    return Promise.resolve(new File([this.text], this.name, { lastModified: this.lastModified }))
  }

  createWritable(): Promise<Pick<FileSystemWritableFileStream, 'write' | 'close' | 'abort'>> {
    // The app only writes text and files.
    let data: string | Blob = ''
    return Promise.resolve({
      write: (chunk: string | Blob) => {
        data = chunk
        return Promise.resolve()
      },
      close: async () => {
        this.text = typeof data === 'string' ? data : await data.text()
        this.lastModified += 1
      },
      abort: () => Promise.resolve(),
    })
  }

  isSameEntry(other: unknown): Promise<boolean> {
    return Promise.resolve(other === this)
  }

  move(name: string): Promise<void> {
    this.parent.entries_.delete(this.name)
    this.name = name
    this.parent.entries_.set(name, this)
    return Promise.resolve()
  }
}

/** A directory in memory, standing in for a `FileSystemDirectoryHandle`. */
class FakeDirectory {
  readonly kind = 'directory'
  readonly name: string
  readonly entries_ = new Map<string, FakeFile | FakeDirectory>()

  constructor(name: string, tree: FakeTree) {
    this.name = name
    for (const [child, content] of Object.entries(tree)) {
      this.entries_.set(
        child,
        typeof content === 'string'
          ? new FakeFile(child, content, this)
          : new FakeDirectory(child, content),
      )
    }
  }

  async *entries(): AsyncGenerator<[string, FakeFile | FakeDirectory]> {
    for (const entry of [...this.entries_]) yield await Promise.resolve(entry)
  }

  getFileHandle(name: string, options?: { create?: boolean }): Promise<FakeFile> {
    const entry = this.entries_.get(name)
    if (entry instanceof FakeFile) return Promise.resolve(entry)
    if (entry) return Promise.reject(typeMismatch(name))
    if (!options?.create) return Promise.reject(notFound(name))
    const file = new FakeFile(name, '', this)
    this.entries_.set(name, file)
    return Promise.resolve(file)
  }

  getDirectoryHandle(name: string): Promise<FakeDirectory> {
    const entry = this.entries_.get(name)
    if (entry instanceof FakeDirectory) return Promise.resolve(entry)
    return Promise.reject(entry ? typeMismatch(name) : notFound(name))
  }

  removeEntry(name: string): Promise<void> {
    return this.entries_.delete(name) ? Promise.resolve() : Promise.reject(notFound(name))
  }

  resolve(handle: unknown): Promise<string[] | null> {
    for (const [name, entry] of this.entries_) {
      if (entry === handle) return Promise.resolve([name])
    }
    const inside = [...this.entries_.values()].flatMap((entry) =>
      entry instanceof FakeDirectory
        ? [entry.resolve(handle).then((path) => path && [entry.name, ...path])]
        : [],
    )
    return Promise.all(inside).then((paths) => paths.find((path) => path !== null) ?? null)
  }
}

/** For tests: a folder in memory, as a directory handle. */
export const fakeFolder = (name: string, tree: FakeTree): FileSystemDirectoryHandle =>
  new FakeDirectory(name, tree) as unknown as FileSystemDirectoryHandle

/** For tests: the text of the file at `path` in a fake folder, or `undefined` if there is none. */
export const fakeText = (folder: FileSystemDirectoryHandle, path: string): string | undefined => {
  let entry: FakeFile | FakeDirectory | undefined = folder as unknown as FakeDirectory
  for (const name of path.split('/')) {
    entry = entry instanceof FakeDirectory ? entry.entries_.get(name) : undefined
  }
  return entry instanceof FakeFile ? entry.text : undefined
}
