import { afterEach, describe, expect, it, vi } from 'vitest'
import { installFakeDisk, type FakeFiles } from './fakeDisk'
import { Folder, type DirectoryNode, type TreeNode } from './folder.svelte'

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

/** A folder at /Notes holding `files`, by paths relative to it. */
const notesWith = (files: FakeFiles) => {
  const disk = installFakeDisk(
    Object.fromEntries(Object.entries(files).map(([path, text]) => [`/Notes/${path}`, text])),
  )
  return { disk, folder: new Folder('/Notes') }
}

describe('Folder', () => {
  const notes = () =>
    notesWith({
      'b.md': '',
      'a 10.txt': '',
      'a 9.markdown': '',
      'photo.png': '',
      '.git/config': '',
      'node_modules/x.md': '',
      '.hidden.md': '',
      'journal/today.md': '# Today',
      'journal/archive/old.md': '',
    })

  it('lists directories, then Markdown and text files by name, leaving out others', async () => {
    const { folder } = notes()

    await folder.list()

    expect(folder.name).toBe('Notes')
    expect(names(folder.root)).toEqual(['journal', 'a 9.markdown', 'a 10.txt', 'b.md'])
    expect(child(folder.root, 'b.md').path).toBe('b.md')
  })

  it('lists directories as they are expanded', async () => {
    const { folder } = notes()
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
    const { folder } = notes()

    await folder.reveal('journal/archive/old.md')

    const archive = directoryIn(directoryIn(folder.root, 'journal'), 'archive')
    expect(archive.expanded).toBe(true)
    expect(names(archive)).toEqual(['old.md'])
  })

  it('stops revealing at a directory that isn’t there', async () => {
    const { folder } = notes()

    await folder.reveal('gone/x.md')

    expect(names(folder.root)).toContain('journal')
  })

  it('picks up changes on refresh, keeping expanded directories', async () => {
    const { disk, folder } = notes()
    await folder.list()
    const journal = directoryIn(folder.root, 'journal')
    await folder.toggle(journal)

    disk.write('/Notes/journal/new.md', '')
    await folder.remove('b.md')
    await folder.refresh()

    expect(directoryIn(folder.root, 'journal')).toBe(journal)
    expect(journal.expanded).toBe(true)
    expect(names(journal)).toEqual(['archive', 'new.md', 'today.md'])
    expect(names(folder.root)).not.toContain('b.md')
  })

  it('converts between paths in the folder and on disk', () => {
    const { folder } = notes()

    expect(folder.locationOf('journal/today.md')).toBe('/Notes/journal/today.md')
    expect(folder.locationOf('')).toBe('/Notes')
    expect(folder.pathOf('/Notes/journal/today.md')).toBe('journal/today.md')
    expect(folder.pathOf('/Elsewhere/today.md')).toBeNull()
    expect(folder.pathOf('/Notes')).toBeNull()
  })
})

describe('Folder file operations', () => {
  const folderWith = async () => {
    const notes = notesWith({ 'a.md': 'A', 'journal/b.md': 'B' })
    await notes.folder.list()
    return notes
  }

  it('creates files, listing them', async () => {
    const { disk, folder } = await folderWith()

    expect(await folder.create('', 'new.md')).toBeGreaterThan(0)

    expect(disk.text('/Notes/new.md')).toBe('')
    expect(names(folder.root)).toContain('new.md')
    await folder.create('journal', 'c.md')
    expect(disk.text('/Notes/journal/c.md')).toBe('')
  })

  it('won’t create or rename over an existing file', async () => {
    const { disk, folder } = await folderWith()
    disk.write('/Notes/taken.md', '')

    await expect(folder.create('', 'a.md')).rejects.toThrow('/Notes/a.md already exists')
    await expect(folder.rename('a.md', 'taken.md')).rejects.toThrow(
      '/Notes/taken.md already exists',
    )
    expect(disk.text('/Notes/a.md')).toBe('A')
  })

  it('renames files within their directory', async () => {
    const { disk, folder } = await folderWith()

    await folder.rename('journal/b.md', 'c.md')

    expect(disk.text('/Notes/journal/c.md')).toBe('B')
    expect(disk.text('/Notes/journal/b.md')).toBeUndefined()
  })

  it('moves files to the Trash', async () => {
    const { disk, folder } = await folderWith()

    await folder.remove('a.md')

    expect(disk.text('/Notes/a.md')).toBeUndefined()
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
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { disk, folder } = notesWith({ 'img/cat.png': 'meow' })

    expect(await folder.imageURL('img/cat.png')).toBe('blob:cat')
    expect(await folder.imageURL('img/cat.png')).toBe('blob:cat')
    expect(create).toHaveBeenCalledOnce()
    expect(await folder.imageURL('img/dog.png')).toBeNull()

    disk.write('/Notes/img/cat.png', 'purr')
    await folder.imageURL('img/cat.png')
    expect(create).toHaveBeenCalledTimes(2)
    expect(revoke).toHaveBeenCalledOnce()

    folder.close()
    expect(revoke).toHaveBeenCalledTimes(2)
  })
})
