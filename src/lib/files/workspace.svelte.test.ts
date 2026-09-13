import { Text } from '@codemirror/state'
import type { Confirm } from '$lib/dialog/confirmation.svelte'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { installFakeDisk, type FakeDisk } from './fakeDisk'
import { readFile, saveFile } from './fileAccess'
import { modifiedTime } from './fileSystem'
import { opened } from './testFiles'
import { Workspace } from './workspace.svelte'

// The real functions, over the fake disk, unless a test replaces one.
vi.mock('./fileAccess', { spy: true })
vi.mock('./fileSystem', { spy: true })

/** Replaces the content of the workspace's file, as typing in the editor would. */
const type = (workspace: Workspace, text: string): void => {
  workspace.file.content = Text.of(text.split('\n'))
}

describe('Workspace', () => {
  let confirm: Mock<Confirm>
  let workspace: Workspace
  let disk: FakeDisk

  beforeEach(() => {
    disk = installFakeDisk({
      '/Docs/notes.md': 'a\r\nb',
      '/Docs/photo.png': { base64: 'iVBORw0K/w==' },
      '/Notes/ideas.md': '# Ideas',
      '/Notes/journal/today.md': '# Today',
    })
    confirm = vi.fn<Confirm>().mockResolvedValue(true)
    workspace = new Workspace(confirm)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.resetAllMocks()
    vi.restoreAllMocks()
  })

  /** Opens `location` from the picker. */
  const open = async (location: string): Promise<void> => {
    disk.picks.open = location
    await workspace.open()
  }

  it('starts with an empty, untitled Markdown file', () => {
    expect(workspace.file.name).toBe('Untitled.md')
    expect(workspace.file.content.length).toBe(0)
    expect(workspace.file.dirty).toBe(false)
  })

  describe('open', () => {
    it('replaces the file with the one the user picks', async () => {
      await open('/Docs/notes.md')

      expect(workspace.file.name).toBe('notes.md')
      expect(workspace.file.content.toString()).toBe('a\nb')
      expect(workspace.file.location).toBe('/Docs/notes.md')
    })

    it('keeps the file when the user cancels', async () => {
      const { file } = workspace

      await workspace.open()

      expect(workspace.file).toBe(file)
    })

    it('asks before discarding unsaved changes', async () => {
      confirm.mockResolvedValue(false)
      type(workspace, 'unsaved')

      await open('/Docs/notes.md')

      expect(confirm).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Your changes to Untitled.md will be lost.' }),
      )
      expect(workspace.file.content.toString()).toBe('unsaved')
    })

    it('ignores other actions while asking', async () => {
      let answer: (confirmed: boolean) => void = () => undefined
      confirm.mockReturnValue(
        new Promise((resolve) => {
          answer = resolve
        }),
      )
      type(workspace, 'unsaved')

      const opening = open('/Docs/notes.md')
      await vi.waitFor(() => {
        expect(confirm).toHaveBeenCalled()
      })
      await workspace.save()
      answer(true)
      await opening

      expect(saveFile).not.toHaveBeenCalled()
      expect(workspace.file.name).toBe('notes.md')
    })

    it('refuses files that aren’t UTF-8 text', async () => {
      const { file } = workspace

      await open('/Docs/photo.png')

      expect(workspace.error).toBe('photo.png isn’t a UTF-8 text file.')
      expect(workspace.file).toBe(file)
    })

    it('reports failures', async () => {
      await open('/Docs/gone.md')

      expect(workspace.error).toBe('Couldn’t open the file.')
    })
  })

  describe('openWith', () => {
    it('opens the dropped file, after asking to discard unsaved changes', async () => {
      type(workspace, 'unsaved')

      await workspace.openWith(() => Promise.resolve(opened('notes.md', 'dropped')))

      expect(confirm).toHaveBeenCalledOnce()
      expect(workspace.file.content.toString()).toBe('dropped')
      expect(workspace.file.location).toBeNull()
    })

    it('reports files that can’t be read', async () => {
      await workspace.openWith(() => Promise.reject(new Error('Gone')))

      expect(workspace.error).toBe('Couldn’t open the file.')
    })
  })

  describe('save', () => {
    it('saves to the file, with its line breaks, and marks it clean', async () => {
      await open('/Docs/notes.md')
      type(workspace, 'a\nb\nc')

      await workspace.save()

      expect(disk.text('/Docs/notes.md')).toBe('a\r\nb\r\nc')
      expect(workspace.file.dirty).toBe(false)
    })

    it('asks where to save a new file, and takes the name and location chosen', async () => {
      disk.picks.save = '/Docs/chosen.md'
      type(workspace, 'text')

      await workspace.save()

      expect(disk.lastPicker).toEqual({ defaultPath: 'Untitled.md' })
      expect(disk.text('/Docs/chosen.md')).toBe('text')
      expect(workspace.file.name).toBe('chosen.md')
      expect(workspace.file.location).toBe('/Docs/chosen.md')
    })

    it('stays dirty when the user cancels', async () => {
      type(workspace, 'text')

      await workspace.save()

      expect(workspace.file.dirty).toBe(true)
    })

    it('ignores repeated requests while a save is in progress', async () => {
      let finishSave = (): void => undefined
      vi.mocked(saveFile).mockReturnValue(
        new Promise((resolve) => {
          finishSave = () => {
            resolve(null)
          }
        }),
      )

      const saving = workspace.save()
      await workspace.save()
      finishSave()
      await saving

      expect(saveFile).toHaveBeenCalledOnce()
    })

    it('reports failures and clears them on the next action', async () => {
      disk.picks.save = '/Nowhere/notes.md'

      await workspace.save()
      expect(workspace.error).toBe('Couldn’t save Untitled.md.')

      disk.picks.save = null
      await workspace.save()
      expect(workspace.error).toBeNull()
    })
  })

  describe('saveAs', () => {
    it('asks where to save even when the file has a location', async () => {
      await open('/Docs/notes.md')
      disk.picks.save = '/Docs/copy.md'

      await workspace.saveAs()

      expect(disk.lastPicker).toEqual({ defaultPath: 'notes.md' })
      expect(workspace.file.name).toBe('copy.md')
      expect(disk.text('/Docs/copy.md')).toBe('a\r\nb')
    })
  })

  describe('newFile', () => {
    it('replaces the file with an empty, untitled one', async () => {
      await open('/Docs/notes.md')

      await workspace.newFile()

      expect(workspace.file.name).toBe('Untitled.md')
      expect(workspace.file.content.length).toBe(0)
    })

    it('keeps unsaved changes unless the user discards them', async () => {
      confirm.mockResolvedValueOnce(false)
      type(workspace, 'unsaved')

      await workspace.newFile()
      expect(workspace.file.content.toString()).toBe('unsaved')

      await workspace.newFile()
      expect(workspace.file.content.length).toBe(0)
      expect(confirm).toHaveBeenCalledTimes(2)
    })
  })

  describe('checkDisk', () => {
    /** Opens notes.md, then makes the disk hold `text`, as another app would. */
    const openThenChangeOnDisk = async (text: string | null): Promise<void> => {
      await open('/Docs/notes.md')
      if (text !== null) disk.write('/Docs/notes.md', text)
      vi.mocked(readFile).mockClear()
    }

    it('does nothing while the file is unchanged on disk', async () => {
      await openThenChangeOnDisk(null)

      await workspace.checkDisk()

      expect(readFile).not.toHaveBeenCalled()
    })

    it('reloads a file without unsaved changes', async () => {
      await openThenChangeOnDisk('changed')
      const { file } = workspace

      await workspace.checkDisk()

      expect(confirm).not.toHaveBeenCalled()
      expect(workspace.file).toBe(file)
      expect(file.content.toString()).toBe('changed')
      expect(file.dirty).toBe(false)
    })

    it('asks before replacing unsaved changes', async () => {
      await openThenChangeOnDisk('changed')
      type(workspace, 'edited')

      await workspace.checkDisk()

      expect(confirm).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'notes.md changed on disk', confirm: 'Reload' }),
      )
      expect(workspace.file.content.toString()).toBe('changed')
    })

    it('keeps unsaved changes if the user wants, and asks again only on the next change', async () => {
      await openThenChangeOnDisk('changed')
      type(workspace, 'edited')
      confirm.mockResolvedValue(false)

      await workspace.checkDisk()
      await workspace.checkDisk()

      expect(confirm).toHaveBeenCalledOnce()
      expect(workspace.file.content.toString()).toBe('edited')
      expect(workspace.file.dirty).toBe(true)
    })

    it('doesn’t ask when the file on disk still has the saved text', async () => {
      await openThenChangeOnDisk('a\r\nb')
      type(workspace, 'edited')

      await workspace.checkDisk()

      expect(confirm).not.toHaveBeenCalled()
      expect(workspace.file.content.toString()).toBe('edited')
    })

    it('doesn’t notice its own saves', async () => {
      await openThenChangeOnDisk(null)
      type(workspace, 'edited')
      await workspace.save()

      await workspace.checkDisk()

      expect(readFile).not.toHaveBeenCalled()
    })

    it('doesn’t hold up saving, which it then leaves alone', async () => {
      await openThenChangeOnDisk('changed')
      let finishCheck: (modified: number) => void = () => undefined
      vi.mocked(modifiedTime).mockReturnValueOnce(
        new Promise((resolve) => {
          finishCheck = resolve
        }),
      )
      type(workspace, 'edited')

      const checking = workspace.checkDisk()
      await workspace.save()
      finishCheck(0)
      await checking

      expect(saveFile).toHaveBeenCalledOnce()
      expect(confirm).not.toHaveBeenCalled()
      expect(workspace.file.content.toString()).toBe('edited')
      expect(disk.text('/Docs/notes.md')).toBe('edited')
    })

    it('ignores files without a location, and failures', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => undefined)
      await workspace.checkDisk()
      expect(modifiedTime).not.toHaveBeenCalled()

      await openThenChangeOnDisk('changed')
      vi.mocked(modifiedTime).mockRejectedValue(new Error('Gone'))
      await workspace.checkDisk()

      expect(workspace.error).toBeNull()
      expect(workspace.file.content.toString()).toBe('a\nb')
    })
  })

  describe('folders', () => {
    const openNotes = async (): Promise<void> => {
      disk.picks.folder = '/Notes'
      await workspace.openFolder()
    }

    it('opens a folder, listing its files', async () => {
      await openNotes()

      expect(workspace.folder?.name).toBe('Notes')
      expect(workspace.folder?.root.children?.map((node) => node.name)).toEqual([
        'journal',
        'ideas.md',
      ])
      expect(workspace.file.name).toBe('Untitled.md')
    })

    it('keeps the folder when the user cancels', async () => {
      await openNotes()
      const { folder } = workspace
      disk.picks.folder = null

      await workspace.openFolder()

      expect(workspace.folder).toBe(folder)
    })

    it('opens files by path, and reveals them in the tree', async () => {
      await openNotes()

      await workspace.openPath('journal/today.md')

      expect(workspace.file.name).toBe('today.md')
      expect(workspace.file.path).toBe('journal/today.md')
      expect(workspace.file.location).toBe('/Notes/journal/today.md')
      expect(workspace.file.content.toString()).toBe('# Today')
      const journal = workspace.folder?.root.children?.[0]
      expect(journal?.kind === 'directory' && journal.expanded).toBe(true)
    })

    it('keeps each file’s unsaved changes while switching, without asking', async () => {
      await openNotes()
      await workspace.openPath('ideas.md')
      const ideas = workspace.file
      type(workspace, 'edited ideas')

      await workspace.openPath('journal/today.md')
      expect(workspace.dirty).toBe(true)
      await workspace.openPath('ideas.md')

      expect(confirm).not.toHaveBeenCalled()
      expect(workspace.file).toBe(ideas)
      expect(workspace.file.content.toString()).toBe('edited ideas')
    })

    it('asks before leaving an unsaved file that isn’t in the folder', async () => {
      await openNotes()
      type(workspace, 'scratch')
      confirm.mockResolvedValue(false)

      await workspace.openPath('ideas.md')

      expect(confirm).toHaveBeenCalledOnce()
      expect(workspace.file.content.toString()).toBe('scratch')
    })

    it('asks before opening another folder over unsaved changes', async () => {
      await openNotes()
      await workspace.openPath('ideas.md')
      type(workspace, 'edited')
      await workspace.openPath('journal/today.md')
      type(workspace, 'edited too')
      confirm.mockResolvedValue(false)

      await workspace.openFolder()

      expect(confirm).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Your changes to 2 files will be lost.' }),
      )
      expect(workspace.opened.size).toBe(2)
    })

    it('reports paths without a file, and files that aren’t text', async () => {
      await openNotes()
      await workspace.openPath('gone.md')
      expect(workspace.error).toBe('There’s no gone.md in the folder.')

      disk.write('/Notes/binary.md', '\0')
      await workspace.openPath('binary.md')
      expect(workspace.error).toBe('binary.md isn’t a UTF-8 text file.')
    })

    it('saves new files into the folder, and tracks them there', async () => {
      await openNotes()
      disk.picks.save = '/Notes/new.md'
      type(workspace, 'new')

      await workspace.save()

      expect(disk.lastPicker).toEqual({ defaultPath: '/Notes/Untitled.md' })
      expect(workspace.file.path).toBe('new.md')
      expect(workspace.opened.get('new.md')).toBe(workspace.file)
      expect(workspace.folder?.root.children?.map((node) => node.name)).toContain('new.md')
    })

    it('switches to a folder’s file that is opened again from the picker', async () => {
      await openNotes()
      await workspace.openPath('ideas.md')
      const ideas = workspace.file
      type(workspace, 'edited')
      await workspace.openPath('journal/today.md')

      await open('/Notes/ideas.md')

      expect(disk.lastPicker).toMatchObject({ defaultPath: '/Notes' })
      expect(workspace.file).toBe(ideas)
      expect(workspace.file.content.toString()).toBe('edited')
    })

    it('creates files, adding .md to names without a listed extension', async () => {
      await openNotes()

      await workspace.createFile('journal', 'tomorrow')

      expect(workspace.file.name).toBe('tomorrow.md')
      expect(workspace.file.path).toBe('journal/tomorrow.md')
      expect(workspace.file.location).toBe('/Notes/journal/tomorrow.md')
      expect(disk.text('/Notes/journal/tomorrow.md')).toBe('')

      await workspace.createFile('', 'list.txt')
      expect(workspace.file.path).toBe('list.txt')
    })

    it('ignores names that aren’t file names', async () => {
      await openNotes()

      await workspace.createFile('', 'a/b')
      await workspace.renameFile('ideas.md', '  ')

      expect(workspace.file.name).toBe('Untitled.md')
      expect(workspace.folder?.root.children?.map((node) => node.name)).toEqual([
        'journal',
        'ideas.md',
      ])
    })

    it('renames an open file, keeping its unsaved changes', async () => {
      await openNotes()
      await workspace.openPath('ideas.md')
      const ideas = workspace.file
      type(workspace, 'edited')

      await workspace.renameFile('ideas.md', 'plans.txt')

      expect(workspace.file).toBe(ideas)
      expect(ideas.name).toBe('plans.txt')
      expect(ideas.path).toBe('plans.txt')
      expect(ideas.location).toBe('/Notes/plans.txt')
      expect(ideas.content.toString()).toBe('edited')
      expect(workspace.opened.get('plans.txt')).toBe(ideas)
      expect(workspace.opened.has('ideas.md')).toBe(false)
    })

    it('renames files that aren’t open', async () => {
      await openNotes()

      await workspace.renameFile('journal/today.md', 'yesterday.md')

      expect(disk.text('/Notes/journal/yesterday.md')).toBe('# Today')
    })

    it('reports failures, such as a name that’s taken', async () => {
      await openNotes()

      await workspace.createFile('', 'ideas')

      expect(workspace.error).toBe('Couldn’t create ideas.')
    })

    it('moves files to the Trash after asking, closing them if open', async () => {
      await openNotes()
      await workspace.openPath('ideas.md')
      confirm.mockResolvedValueOnce(false)

      await workspace.deleteFile('ideas.md')
      expect(disk.text('/Notes/ideas.md')).toBe('# Ideas')

      await workspace.deleteFile('ideas.md')
      expect(confirm).toHaveBeenLastCalledWith(
        expect.objectContaining({
          title: 'Delete ideas.md?',
          message: 'It will be moved to the Trash.',
          confirm: 'Delete',
        }),
      )
      expect(disk.text('/Notes/ideas.md')).toBeUndefined()
      expect(workspace.file.name).toBe('Untitled.md')
      expect(workspace.opened.size).toBe(0)
    })

    it('opens notes that relative links in the open file point to', async () => {
      await openNotes()
      expect(workspace.openLink('ideas.md')).toBe(false)
      await workspace.openPath('journal/today.md')

      expect(workspace.openLink('../ideas.md#top')).toBe(true)

      await vi.waitFor(() => {
        expect(workspace.file.path).toBe('ideas.md')
      })
      expect(workspace.openLink('../../outside.md')).toBe(false)
    })

    it('gives URLs for images relative to the open file', async () => {
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:cat')
      vi.spyOn(console, 'warn').mockImplementation(() => undefined)
      await openNotes()
      disk.write('/Notes/journal/cat.png', 'meow')
      expect(await workspace.imageURL('journal/cat.png')).toBeNull()
      await workspace.openPath('journal/today.md')

      expect(await workspace.imageURL('cat.png')).toBe('blob:cat')
      expect(await workspace.imageURL('dog.png')).toBeNull()
    })

    it('lists the folder again when checking for changes on disk', async () => {
      await openNotes()
      disk.write('/Notes/added.md', '')

      await workspace.checkDisk()

      expect(workspace.folder?.root.children?.map((node) => node.name)).toContain('added.md')
    })
  })
})
