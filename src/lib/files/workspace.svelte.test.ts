import { Text } from '@codemirror/state'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openFile, saveFile } from './fileAccess'
import { Workspace } from './workspace.svelte'

vi.mock('./fileAccess')

const handle = (name: string): FileSystemFileHandle => ({ name }) as FileSystemFileHandle

/** Replaces the content of the workspace's file, as typing in the editor would. */
const type = (workspace: Workspace, text: string): void => {
  workspace.file.content = Text.of(text.split('\n'))
}

describe('Workspace', () => {
  let workspace: Workspace

  beforeEach(() => {
    workspace = new Workspace()
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
      vi.mocked(openFile).mockResolvedValue({ name: 'notes.txt', text: 'hello', handle: notes })

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
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
      vi.mocked(openFile).mockResolvedValue({ name: 'other.md', text: '', handle: null })
      type(workspace, 'unsaved')

      await workspace.open()

      expect(confirm).toHaveBeenCalledWith('Discard unsaved changes to Untitled.md?')
      expect(workspace.file.content.toString()).toBe('unsaved')
    })

    it('reports failures', async () => {
      vi.mocked(openFile).mockRejectedValue(new DOMException('Denied', 'NotAllowedError'))

      await workspace.open()

      expect(workspace.error).toBe('Couldn’t open the file.')
    })
  })

  describe('save', () => {
    it('saves to the file’s handle and marks it clean', async () => {
      const notes = handle('notes.md')
      vi.mocked(openFile).mockResolvedValue({ name: 'notes.md', text: 'a\r\nb', handle: notes })
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
      vi.mocked(openFile).mockResolvedValue({ name: 'notes.md', text: '', handle: notes })
      vi.mocked(saveFile).mockResolvedValue({ name: 'copy.md', handle: handle('copy.md') })
      await workspace.open()

      await workspace.saveAs()

      expect(saveFile).toHaveBeenCalledWith('', 'notes.md', null)
      expect(workspace.file.name).toBe('copy.md')
    })
  })

  describe('newFile', () => {
    it('replaces the file with an empty, untitled one', async () => {
      vi.mocked(openFile).mockResolvedValue({ name: 'notes.md', text: 'hi', handle: null })
      await workspace.open()

      workspace.newFile()

      expect(workspace.file.name).toBe('Untitled.md')
      expect(workspace.file.content.length).toBe(0)
    })

    it('keeps unsaved changes unless the user discards them', () => {
      const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValue(true)
      type(workspace, 'unsaved')

      workspace.newFile()
      expect(workspace.file.content.toString()).toBe('unsaved')

      workspace.newFile()
      expect(workspace.file.content.length).toBe(0)
      expect(confirm).toHaveBeenCalledTimes(2)
    })
  })
})
