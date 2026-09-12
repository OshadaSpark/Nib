import { describe, expect, it } from 'vitest'
import { Folder, parentOf, type DirectoryNode, type TreeNode } from './folder.svelte'
import { fakeFolder } from './testFiles'

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

describe('parentOf', () => {
  it.each([
    ['a.md', ''],
    ['notes/a.md', 'notes'],
    ['notes/2026/a.md', 'notes/2026'],
  ])('gives the directory of %j as %j', (path, expected) => {
    expect(parentOf(path)).toBe(expected)
  })
})
