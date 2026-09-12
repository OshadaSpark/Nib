import { Text } from '@codemirror/state'
import type { Confirm } from '$lib/dialog/confirmation.svelte'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { lastModified, openFile, readFile, saveFile } from './fileAccess'
import { handle, opened } from './testFiles'
import { Workspace } from './workspace.svelte'

vi.mock('./fileAccess')

/** Replaces the content of the workspace's file, as typing in the editor would. */
const type = (workspace: Workspace, text: string): void => {
  workspace.file.content = Text.of(text.split('\n'))
}

describe('Workspace', () => {
  let confirm: Mock<Confirm>
  let workspace: Workspace

  beforeEach(() => {
    confirm = vi.fn<Confirm>().mockResolvedValue(true)
    workspace = new Workspace(confirm)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.resetAllMocks()
    vi.restoreAllMocks()
  })

  it('starts with an empty, untitled Markdown file', () => {
    expect(workspace.file.name).toBe('Untitled.md')
    expect(workspace.file.content.length).toBe(0)
    expect(workspace.file.dirty).toBe(false)
  })

  describe('open', () => {
    it('replaces the file with the one the user picks', async () => {
      const notes = handle('notes.txt')
      vi.mocked(openFile).mockResolvedValue(opened('notes.txt', 'hello', notes))

      await workspace.open()

      expect(workspace.file.name).toBe('notes.txt')
      expect(workspace.file.content.toString()).toBe('hello')
      expect(workspace.file.handle).toBe(notes)
    })

    it('keeps the file when the user cancels', async () => {
      const { file } = workspace
      vi.mocked(openFile).mockResolvedValue(null)

      await workspace.open()

      expect(workspace.file).toBe(file)
    })

    it('asks before discarding unsaved changes', async () => {
      confirm.mockResolvedValue(false)
      vi.mocked(openFile).mockResolvedValue(opened('other.md', ''))
      type(workspace, 'unsaved')

      await workspace.open()

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
      vi.mocked(openFile).mockResolvedValue(opened('other.md', ''))
      type(workspace, 'unsaved')

      const opening = workspace.open()
      await vi.waitFor(() => {
        expect(confirm).toHaveBeenCalled()
      })
      await workspace.save()
      answer(true)
      await opening

      expect(saveFile).not.toHaveBeenCalled()
      expect(workspace.file.name).toBe('other.md')
    })

    it('refuses files that aren’t UTF-8 text', async () => {
      const { file } = workspace
      vi.mocked(openFile).mockResolvedValue({
        name: 'photo.png',
        bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0xff]).buffer,
        handle: null,
        modified: 0,
      })

      await workspace.open()

      expect(workspace.error).toBe('photo.png isn’t a UTF-8 text file.')
      expect(workspace.file).toBe(file)
    })

    it('reports failures', async () => {
      vi.mocked(openFile).mockRejectedValue(new DOMException('Denied', 'NotAllowedError'))

      await workspace.open()

      expect(workspace.error).toBe('Couldn’t open the file.')
    })
  })

  describe('openDropped', () => {
    it('opens the dropped file, after asking to discard unsaved changes', async () => {
      const notes = handle('notes.md')
      type(workspace, 'unsaved')

      await workspace.openDropped(() => Promise.resolve(opened('notes.md', 'dropped', notes)))

      expect(confirm).toHaveBeenCalledOnce()
      expect(workspace.file.content.toString()).toBe('dropped')
      expect(workspace.file.handle).toBe(notes)
    })

    it('reports files that can’t be read', async () => {
      await workspace.openDropped(() => Promise.reject(new DOMException('Gone', 'NotFoundError')))

      expect(workspace.error).toBe('Couldn’t open the file.')
    })
  })

  describe('save', () => {
    it('saves to the file’s handle and marks it clean', async () => {
      const notes = handle('notes.md')
      vi.mocked(openFile).mockResolvedValue(opened('notes.md', 'a\r\nb', notes))
      vi.mocked(saveFile).mockResolvedValue({ name: 'notes.md', handle: notes, modified: 1 })
      await workspace.open()
      type(workspace, 'a\nb\nc')

      await workspace.save()

      expect(saveFile).toHaveBeenCalledWith('a\r\nb\r\nc', 'notes.md', notes)
      expect(workspace.file.dirty).toBe(false)
    })

    it('takes the name and handle chosen for a new file', async () => {
      const chosen = handle('chosen.md')
      vi.mocked(saveFile).mockResolvedValue({ name: 'chosen.md', handle: chosen, modified: 1 })
      type(workspace, 'text')

      await workspace.save()

      expect(saveFile).toHaveBeenCalledWith('text', 'Untitled.md', null)
      expect(workspace.file.name).toBe('chosen.md')
      expect(workspace.file.handle).toBe(chosen)
    })

    it('stays dirty when the user cancels', async () => {
      vi.mocked(saveFile).mockResolvedValue(null)
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
      vi.mocked(saveFile).mockRejectedValueOnce(new Error('Disk full'))

      await workspace.save()
      expect(workspace.error).toBe('Couldn’t save Untitled.md.')

      vi.mocked(saveFile).mockResolvedValue(null)
      await workspace.save()
      expect(workspace.error).toBeNull()
    })
  })

  describe('saveAs', () => {
    it('asks where to save even when the file has a handle', async () => {
      const notes = handle('notes.md')
      vi.mocked(openFile).mockResolvedValue(opened('notes.md', '', notes))
      vi.mocked(saveFile).mockResolvedValue({
        name: 'copy.md',
        handle: handle('copy.md'),
        modified: 1,
      })
      await workspace.open()

      await workspace.saveAs()

      expect(saveFile).toHaveBeenCalledWith('', 'notes.md', null)
      expect(workspace.file.name).toBe('copy.md')
    })
  })

  describe('newFile', () => {
    it('replaces the file with an empty, untitled one', async () => {
      vi.mocked(openFile).mockResolvedValue(opened('notes.md', 'hi'))
      await workspace.open()

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
    const notes = handle('notes.md')

    /** Opens notes.md, modified at time 1, and makes the disk hold `text`, modified at `modified`. */
    const openThenChangeOnDisk = async (text: string, modified = 2): Promise<void> => {
      vi.mocked(openFile).mockResolvedValue(opened('notes.md', 'saved', notes, 1))
      await workspace.open()
      vi.mocked(lastModified).mockResolvedValue(modified)
      vi.mocked(readFile).mockResolvedValue(opened('notes.md', text, notes, modified))
    }

    it('does nothing while the file is unchanged on disk', async () => {
      await openThenChangeOnDisk('saved', 1)

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
      await openThenChangeOnDisk('saved')
      type(workspace, 'edited')

      await workspace.checkDisk()

      expect(confirm).not.toHaveBeenCalled()
      expect(workspace.file.content.toString()).toBe('edited')
    })

    it('doesn’t notice its own saves', async () => {
      await openThenChangeOnDisk('saved')
      vi.mocked(saveFile).mockResolvedValue({ name: 'notes.md', handle: notes, modified: 2 })
      type(workspace, 'edited')
      await workspace.save()

      await workspace.checkDisk()

      expect(readFile).not.toHaveBeenCalled()
    })

    it('doesn’t hold up saving, which it then leaves alone', async () => {
      await openThenChangeOnDisk('changed')
      let finishCheck: (modified: number) => void = () => undefined
      vi.mocked(lastModified).mockReturnValueOnce(
        new Promise((resolve) => {
          finishCheck = resolve
        }),
      )
      vi.mocked(saveFile).mockResolvedValue({ name: 'notes.md', handle: notes, modified: 3 })
      type(workspace, 'edited')

      const checking = workspace.checkDisk()
      await workspace.save()
      finishCheck(2)
      await checking

      expect(saveFile).toHaveBeenCalledOnce()
      expect(confirm).not.toHaveBeenCalled()
      expect(workspace.file.content.toString()).toBe('edited')
    })

    it('ignores files without a handle, and failures', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => undefined)
      await workspace.checkDisk()
      expect(lastModified).not.toHaveBeenCalled()

      await openThenChangeOnDisk('changed')
      vi.mocked(lastModified).mockRejectedValue(new DOMException('Gone', 'NotFoundError'))
      await workspace.checkDisk()

      expect(workspace.error).toBeNull()
      expect(workspace.file.content.toString()).toBe('saved')
    })
  })
})
