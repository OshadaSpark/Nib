import { Text } from '@codemirror/state'
import type { Confirm } from '$lib/dialog/confirmation.svelte'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { openFile, saveFile } from './fileAccess'
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
      vi.mocked(saveFile).mockResolvedValue({ name: 'notes.md', handle: notes })
      await workspace.open()
      type(workspace, 'a\nb\nc')

      await workspace.save()

      expect(saveFile).toHaveBeenCalledWith('a\r\nb\r\nc', 'notes.md', notes)
      expect(workspace.file.dirty).toBe(false)
    })

    it('takes the name and handle chosen for a new file', async () => {
      const chosen = handle('chosen.md')
      vi.mocked(saveFile).mockResolvedValue({ name: 'chosen.md', handle: chosen })
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
      vi.mocked(saveFile).mockResolvedValue({ name: 'copy.md', handle: handle('copy.md') })
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
})
