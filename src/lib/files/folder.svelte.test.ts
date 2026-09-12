import { afterEach, describe, expect, it, vi } from 'vitest'
import { Folder, parentOf, resolvePath, type DirectoryNode, type TreeNode } from './folder.svelte'
import { fakeFolder, fakeText } from './testFiles'

const names = (directory: DirectoryNode): string[] =>
  (directory.children ?? []).map((node) => node.name)

const child = (directory: DirectoryNode, name: string): TreeNode => {
  const node = directory.children?.find((entry) => entry.name === name)
  if (!node) throw new Error(`No ${name} in ${directory.path || 'the folder'}`)
  return node
}

const directoryIn = (directory: DirectoryNode, name: string): DirectoryNode => {
  const node = child(directory, name)
  if (node.kind !== 'directory') throw new Error(`${name} is a file`)
  return node
}

describe('Folder', () => {
  const notes = () =>
    fakeFolder('Notes', {
      'b.md': '',
      'a 10.txt': '',
      'a 9.markdown': '',
      'photo.png': '',
      '.git': { config: '' },
      node_modules: { 'x.md': '' },
      '.hidden.md': '',
      journal: { 'today.md': '# Today', archive: { 'old.md': '' } },
    })

  it('lists directories, then Markdown and text files by name, leaving out others', async () => {
    const folder = new Folder(notes())

    await folder.list()

    expect(folder.name).toBe('Notes')
    expect(names(folder.root)).toEqual(['journal', 'a 9.markdown', 'a 10.txt', 'b.md'])
    expect(child(folder.root, 'b.md').path).toBe('b.md')
  })

  it('lists directories as they are expanded', async () => {
    const folder = new Folder(notes())
    await folder.list()
    const journal = directoryIn(folder.root, 'journal')
    expect(journal.children).toBeNull()

    await folder.toggle(journal)
    expect(journal.expanded).toBe(true)
    expect(names(journal)).toEqual(['archive', 'today.md'])
    expect(child(journal, 'today.md').path).toBe('journal/today.md')

    await folder.toggle(journal)
    expect(journal.expanded).toBe(false)
  })

  it('expands the directories down to a file', async () => {
    const folder = new Folder(notes())

    await folder.reveal('journal/archive/old.md')

    const archive = directoryIn(directoryIn(folder.root, 'journal'), 'archive')
    expect(archive.expanded).toBe(true)
    expect(names(archive)).toEqual(['old.md'])
  })

  it('stops revealing at a directory that isn’t there', async () => {
    const folder = new Folder(notes())

    await folder.reveal('gone/x.md')

    expect(names(folder.root)).toContain('journal')
  })

  it('picks up changes on refresh, keeping expanded directories', async () => {
    const handle = notes()
    const folder = new Folder(handle)
    await folder.list()
    const journal = directoryIn(folder.root, 'journal')
    await folder.toggle(journal)

    await (await handle.getDirectoryHandle('journal')).getFileHandle('new.md', { create: true })
    await handle.removeEntry('b.md')
    await folder.refresh()

    expect(directoryIn(folder.root, 'journal')).toBe(journal)
    expect(journal.expanded).toBe(true)
    expect(names(journal)).toEqual(['archive', 'new.md', 'today.md'])
    expect(names(folder.root)).not.toContain('b.md')
  })

  it('finds files by path, listed or not', async () => {
    const folder = new Folder(notes())

    expect((await folder.file('journal/archive/old.md'))?.name).toBe('old.md')
    expect(await folder.file('journal/missing.md')).toBeNull()
    expect(await folder.file('missing/today.md')).toBeNull()
    expect(await folder.file('journal')).toBeNull()
  })

  it('tells where a handle is in the folder', async () => {
    const handle = notes()
    const folder = new Folder(handle)
    const today = await (await handle.getDirectoryHandle('journal')).getFileHandle('today.md')

    expect(await folder.pathOf(today)).toBe('journal/today.md')
    expect(await folder.pathOf(fakeFolder('Elsewhere', {}))).toBeNull()
  })
})

describe('Folder file operations', () => {
  const folderWith = async () => {
    const handle = fakeFolder('Notes', { 'a.md': 'A', journal: { 'b.md': 'B' } })
    const folder = new Folder(handle)
    await folder.list()
    return { handle, folder }
  }

  it('creates files, listing them', async () => {
    const { handle, folder } = await folderWith()

    const created = await folder.create('', 'new.md')

    expect(created.name).toBe('new.md')
    expect(fakeText(handle, 'new.md')).toBe('')
    expect(names(folder.root)).toContain('new.md')
    await folder.create('journal', 'c.md')
    expect(fakeText(handle, 'journal/c.md')).toBe('')
  })

  it('won’t create or rename over an existing file', async () => {
    const { handle, folder } = await folderWith()
    await handle.getFileHandle('taken.md', { create: true })

    await expect(folder.create('', 'a.md')).rejects.toThrow('a.md already exists')
    await expect(folder.rename('a.md', 'taken.md')).rejects.toThrow('taken.md already exists')
    expect(fakeText(handle, 'a.md')).toBe('A')
  })

  it('renames files in place where it can', async () => {
    const { handle, folder } = await folderWith()
    const original = await handle.getFileHandle('a.md')

    const renamed = await folder.rename('a.md', 'A.md')

    expect(renamed).toBe(original)
    expect(fakeText(handle, 'A.md')).toBe('A')
    expect(names(folder.root)).toEqual(['journal', 'A.md'])
  })

  it('renames by copying where files can’t move', async () => {
    const { handle, folder } = await folderWith()
    const journal = await handle.getDirectoryHandle('journal')
    Object.defineProperty(await journal.getFileHandle('b.md'), 'move', { value: undefined })

    const renamed = await folder.rename('journal/b.md', 'c.md')

    expect(renamed.name).toBe('c.md')
    expect(fakeText(handle, 'journal/c.md')).toBe('B')
    expect(fakeText(handle, 'journal/b.md')).toBeUndefined()
  })

  it('deletes files', async () => {
    const { handle, folder } = await folderWith()

    await folder.remove('a.md')

    expect(fakeText(handle, 'a.md')).toBeUndefined()
    expect(names(folder.root)).toEqual(['journal'])
  })
})

describe('Folder images', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('makes a URL for each image once, until it changes or the folder closes', async () => {
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:cat')
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockReturnValue()
    const handle = fakeFolder('Notes', { img: { 'cat.png': 'meow' } })
    const folder = new Folder(handle)

    expect(await folder.imageURL('img/cat.png')).toBe('blob:cat')
    expect(await folder.imageURL('img/cat.png')).toBe('blob:cat')
    expect(create).toHaveBeenCalledOnce()
    expect(await folder.imageURL('img/dog.png')).toBeNull()

    const cat = await (await handle.getDirectoryHandle('img')).getFileHandle('cat.png')
    const writable = await cat.createWritable()
    await writable.write('purr')
    await writable.close()
    await folder.imageURL('img/cat.png')
    expect(create).toHaveBeenCalledTimes(2)
    expect(revoke).toHaveBeenCalledOnce()

    folder.close()
    expect(revoke).toHaveBeenCalledTimes(2)
  })

  it('has no URL for images it can’t read', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const handle = fakeFolder('Notes', { 'cat.png': 'meow' })
    const cat = await handle.getFileHandle('cat.png')
    vi.spyOn(cat, 'getFile').mockRejectedValue(new DOMException('Busy', 'NotReadableError'))

    expect(await new Folder(handle).imageURL('cat.png')).toBeNull()
  })
})

describe('resolvePath', () => {
  it.each([
    ['a.md', 'b.md', 'b.md'],
    ['notes/a.md', 'b.md', 'notes/b.md'],
    ['notes/a.md', './img/cat.png', 'notes/img/cat.png'],
    ['notes/a.md', '../b.md', 'b.md'],
    ['notes/a.md', '/b.md', 'b.md'],
    ['a.md', 'my%20note.md#heading', 'my note.md'],
    ['a.md', 'b.md?x=1', 'b.md'],
    ['a.md', '100%.md', '100%.md'],
  ])('resolves %j + %j to %j', (from, target, expected) => {
    expect(resolvePath(from, target)).toBe(expected)
  })

  it.each([
    ['a.md', '../b.md'],
    ['a.md', '#heading'],
    ['notes/a.md', '#heading'],
    ['a.md', 'notes/'],
  ])('finds nothing in the folder for %j + %j', (from, target) => {
    expect(resolvePath(from, target)).toBeNull()
  })
})

describe('parentOf', () => {
  it.each([
    ['a.md', ''],
    ['notes/a.md', 'notes'],
    ['notes/2026/a.md', 'notes/2026'],
  ])('gives the directory of %j as %j', (path, expected) => {
    expect(parentOf(path)).toBe(expected)
  })
})
