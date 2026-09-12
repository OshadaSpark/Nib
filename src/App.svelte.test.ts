import {
  canOpenFolders,
  lastModified,
  openFile,
  openFolder,
  readFile,
  saveFile,
} from '$lib/files/fileAccess'
import { fakeFolder, fakeText, handle, opened } from '$lib/files/testFiles'
import { EditorView } from '@codemirror/view'
import { render, screen, within } from '@testing-library/svelte'
import { userEvent, type UserEvent } from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App.svelte'

vi.mock('$lib/files/fileAccess')

const editorView = (): EditorView | null =>
  EditorView.findFromDOM(screen.getByRole('textbox', { name: 'Document' }))

/** Types into the editor through its view, as jsdom does not support contenteditable input. */
const type = (text: string): void => {
  const view = editorView()
  view?.dispatch({ changes: { from: view.state.doc.length, insert: text } })
}

/** A command in the file menu, hidden as jsdom has no popovers to open. */
const command = (name: string): HTMLElement => screen.getByRole('button', { name, hidden: true })

/** Waits for the editor to show `text`. */
const shows = (text: string): Promise<void> =>
  vi.waitFor(() => {
    expect(editorView()?.state.doc.toString()).toBe(text)
  })

describe('App', () => {
  afterEach(() => {
    vi.resetAllMocks()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('renders the editor in the main landmark', () => {
    render(App)

    expect(screen.getByRole('main')).toContainElement(
      screen.getByRole('textbox', { name: 'Document' }),
    )
  })

  it('shows the file name and its unsaved state', async () => {
    render(App)

    expect(screen.getByText('Untitled.md')).toBeInTheDocument()
    expect(screen.queryByText('Edited')).not.toBeInTheDocument()
    await vi.waitFor(() => {
      expect(document.title).toBe('Untitled.md — typer')
    })

    type('text')

    expect(await screen.findByText('Edited')).toBeInTheDocument()
    expect(document.title).toBe('• Untitled.md — typer')
  })

  it('counts lines, words and characters, or those selected', async () => {
    render(App)
    const status = screen.getByRole('contentinfo')
    expect(status).toHaveTextContent('1 line 0 words 0 characters')

    type('# One two\nthree')
    await vi.waitFor(() => {
      expect(status).toHaveTextContent('2 lines 3 words 14 characters')
    })

    editorView()?.dispatch({ selection: { anchor: 2, head: 5 } })
    await vi.waitFor(() => {
      expect(status).toHaveTextContent('2 lines 1 of 3 words 3 of 14 characters')
    })
  })

  it('shows the items picked in the settings in the status bar', async () => {
    const user = userEvent.setup()
    vi.mocked(openFile).mockResolvedValue(
      opened('notes.txt', '\uFEFFone\r\ntwo', handle('notes.txt')),
    )
    render(App)
    await user.click(command('Open'))
    const status = await screen.findByRole('contentinfo')
    expect(status).toHaveTextContent(/^Saved/)

    await user.click(screen.getByRole('button', { name: 'Settings' }))
    for (const name of ['Cursor position', 'File type', 'Line endings', 'Encoding']) {
      await user.click(screen.getByRole('switch', { name }))
    }
    for (const name of ['Lines', 'Words', 'Characters']) {
      await user.click(screen.getByRole('switch', { name }))
    }
    editorView()?.dispatch({ selection: { anchor: 5 } })

    await vi.waitFor(() => {
      expect(status).toHaveTextContent('Saved Ln 2, Col 2 Plain text CRLF UTF-8 with BOM')
    })

    await user.click(screen.getByRole('switch', { name: 'Saved or edited' }))
    for (const name of ['Cursor position', 'File type', 'Line endings', 'Encoding']) {
      await user.click(screen.getByRole('switch', { name }))
    }
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument()
  })

  it.each([
    ['{Control>}s{/Control}', 'Ctrl+S'],
    ['{Meta>}s{/Meta}', '⌘S'],
  ])('saves on %s (%s)', async (keys) => {
    const user = userEvent.setup()
    render(App)
    type('text')

    await user.keyboard(keys)

    expect(saveFile).toHaveBeenCalledWith('text', 'Untitled.md', null, null)
  })

  it('saves from the file menu', async () => {
    const user = userEvent.setup()
    render(App)

    await user.click(command('Save'))

    expect(saveFile).toHaveBeenCalledOnce()
  })

  it('opens a file on Ctrl+O and from the file menu', async () => {
    const user = userEvent.setup()
    vi.mocked(openFile).mockResolvedValue(opened('notes.txt', 'hi'))
    render(App)

    await user.keyboard('{Control>}o{/Control}')
    await user.click(command('Open'))

    expect(openFile).toHaveBeenCalledTimes(2)
    expect(await screen.findByText('notes.txt')).toBeInTheDocument()
  })

  it.each([
    [
      'keyboard shortcut',
      (user: UserEvent) => user.keyboard('{Control>}{Shift>}s{/Shift}{/Control}'),
    ],
    ['file menu', (user: UserEvent) => user.click(command('Save as'))],
  ])('saves as a new file from the %s', async (_, saveAs) => {
    const user = userEvent.setup()
    vi.mocked(openFile).mockResolvedValue(opened('notes.md', '', handle('notes.md')))
    render(App)
    await user.click(command('Open'))
    await screen.findByText('notes.md')

    await saveAs(user)

    expect(saveFile).toHaveBeenCalledWith('', 'notes.md', null, null)
  })

  it('offers to open folders only where the browser can', () => {
    render(App)

    expect(
      screen.queryByRole('button', { name: 'Open folder', hidden: true }),
    ).not.toBeInTheDocument()
  })

  it('opens a folder, and switches between its files, keeping their edits', async () => {
    const user = userEvent.setup()
    vi.mocked(canOpenFolders).mockReturnValue(true)
    vi.mocked(openFolder).mockResolvedValue(
      fakeFolder('Notes', { 'ideas.md': '# Ideas', journal: { 'today.md': '# Today' } }),
    )
    vi.mocked(readFile).mockImplementation(async (file) => {
      const read = await file.getFile()
      return opened(read.name, await read.text(), file, read.lastModified)
    })
    vi.mocked(lastModified).mockImplementation(async (file) => (await file.getFile()).lastModified)
    render(App)

    await user.click(command('Open folder'))
    const files = await screen.findByRole('navigation', { name: 'Files' })
    await user.click(within(files).getByRole('button', { name: 'journal' }))
    await user.click(await within(files).findByRole('button', { name: 'today.md' }))
    await shows('# Today')
    type(' edited')

    await user.click(within(files).getByRole('button', { name: 'ideas.md' }))
    await shows('# Ideas')
    expect(within(files).getByRole('button', { name: 'today.md (edited)' })).toBeInTheDocument()

    await user.click(within(files).getByRole('button', { name: 'today.md (edited)' }))
    await shows('# Today edited')
    expect(within(files).getByRole('button', { name: 'today.md (edited)' })).toHaveAttribute(
      'aria-current',
      'page',
    )

    await user.click(screen.getByRole('button', { name: 'Files' }))
    expect(screen.queryByRole('navigation', { name: 'Files' })).not.toBeInTheDocument()
  })

  it('creates, renames and deletes files in the folder', async () => {
    const user = userEvent.setup()
    const notes = fakeFolder('Notes', { 'ideas.md': '# Ideas' })
    vi.mocked(canOpenFolders).mockReturnValue(true)
    vi.mocked(openFolder).mockResolvedValue(notes)
    vi.mocked(lastModified).mockImplementation(async (file) => (await file.getFile()).lastModified)
    render(App)
    await user.click(command('Open folder'))
    const files = await screen.findByRole('navigation', { name: 'Files' })

    await user.click(within(files).getByRole('button', { name: 'New file' }))
    await user.type(within(files).getByRole('textbox', { name: 'New file name' }), 'plans{Enter}')
    expect(await within(files).findByRole('button', { name: 'plans.md' })).toHaveAttribute(
      'aria-current',
      'page',
    )

    await user.click(within(files).getByRole('button', { name: 'Rename plans.md' }))
    const name = within(files).getByRole('textbox', { name: 'New name for plans.md' })
    await user.clear(name)
    await user.type(name, 'goals.md{Enter}')
    expect(await within(files).findByRole('button', { name: 'goals.md' })).toBeInTheDocument()
    expect(screen.getByText('goals.md', { selector: 'header *' })).toBeInTheDocument()

    await user.click(within(files).getByRole('button', { name: 'Rename goals.md' }))
    await user.keyboard('{Escape}')
    expect(within(files).queryByRole('textbox')).not.toBeInTheDocument()

    await user.click(within(files).getByRole('button', { name: 'Delete goals.md' }))
    await user.click(await screen.findByRole('button', { name: 'Delete' }))
    await vi.waitFor(() => {
      expect(within(files).queryByRole('button', { name: 'goals.md' })).not.toBeInTheDocument()
    })
    expect(fakeText(notes, 'goals.md')).toBeUndefined()
  })

  it('opens the file the installed app was launched with', async () => {
    // jsdom has neither handles nor a launch queue.
    class FileHandle {
      readonly name = 'launched.md'
    }
    vi.stubGlobal('FileSystemFileHandle', FileHandle)
    const launched = new FileHandle() as unknown as FileSystemFileHandle
    vi.stubGlobal('launchQueue', {
      setConsumer: (consumer: (params: LaunchParams) => void) => {
        consumer({ files: [launched] })
      },
    })
    vi.mocked(readFile).mockResolvedValue(opened('launched.md', '# Launched', launched))

    render(App)

    expect(await screen.findByText('launched.md')).toBeInTheDocument()
    expect(readFile).toHaveBeenCalledWith(launched)
  })

  it('opens the settings from the header and on Ctrl+,', async () => {
    const user = userEvent.setup()
    render(App)

    await user.click(screen.getByRole('button', { name: 'Settings' }))
    const settings = screen.getByRole('dialog', { name: 'Settings' })
    await user.click(within(settings).getByRole('button', { name: 'Close' }))
    expect(settings).not.toBeInTheDocument()

    await user.keyboard('{Control>},{/Control}')
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument()
  })

  it('applies and remembers the theme', async () => {
    const user = userEvent.setup()
    const option = (name: string) => screen.getByRole('radio', { name })
    const { unmount } = render(App)
    await user.click(screen.getByRole('button', { name: 'Settings' }))

    await user.click(option('Dark'))

    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute('content', '#19191b')
    unmount()
    render(App)
    await user.click(screen.getByRole('button', { name: 'Settings' }))
    expect(option('Dark')).toBeChecked()

    await user.click(option('System'))
    expect(document.documentElement).toHaveAttribute('data-theme', 'system')
  })

  it('shows Markdown as written when live rendering is off', async () => {
    const user = userEvent.setup()
    render(App)
    const textbox = screen.getByRole('textbox', { name: 'Document' })
    type('Some **bold**')
    editorView()?.dispatch({ selection: { anchor: 0 } })
    await vi.waitFor(() => {
      expect(textbox).toHaveTextContent(/^Some bold$/)
    })

    await user.click(screen.getByRole('button', { name: 'Settings' }))
    await user.click(screen.getByRole('switch', { name: 'Render Markdown' }))

    expect(textbox).toHaveTextContent('Some **bold**')
  })

  it('shows line numbers when turned on', async () => {
    const user = userEvent.setup()
    render(App)
    type('one\ntwo')
    expect(document.querySelector('.cm-lineNumbers')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Settings' }))
    await user.click(screen.getByRole('switch', { name: 'Line numbers' }))

    expect(document.querySelector('.cm-lineNumbers')).toHaveTextContent('12')
  })

  it('formats Markdown from the toolbar, which plain text files only get editing tools in', async () => {
    const user = userEvent.setup()
    vi.mocked(openFile).mockResolvedValue(opened('notes.txt', 'hi'))
    render(App)
    const toolbar = screen.getByRole('toolbar', { name: 'Formatting' })
    type('word')
    editorView()?.dispatch({ selection: { anchor: 0, head: 4 } })

    await user.click(within(toolbar).getByRole('button', { name: 'Bold' }))
    await shows('**word**')
    await user.click(within(toolbar).getByRole('button', { name: 'Undo' }))
    await shows('word')
    await user.click(within(toolbar).getByRole('button', { name: 'Heading 2' }))
    await shows('## word')

    await user.click(command('Open'))
    await user.click(await screen.findByRole('button', { name: 'Discard' }))
    await screen.findByText('notes.txt')
    expect(within(toolbar).queryByRole('button', { name: 'Bold' })).not.toBeInTheDocument()
    await user.click(within(toolbar).getByRole('button', { name: 'Find and replace' }))
    expect(screen.getByRole('textbox', { name: 'Find' })).toBeInTheDocument()
  })

  it('moves between the toolbar’s tools with the arrow keys', async () => {
    const user = userEvent.setup()
    render(App)
    const toolbar = screen.getByRole('toolbar', { name: 'Formatting' })
    const tool = (name: string) => within(toolbar).getByRole('button', { name })

    // Only the first tool is in the tab order, until another is focused.
    expect(tool('Bold')).toHaveAttribute('tabindex', '0')
    expect(tool('Italic')).toHaveAttribute('tabindex', '-1')
    tool('Bold').focus()
    await user.keyboard('{ArrowRight}')
    expect(tool('Italic')).toHaveFocus()
    expect(tool('Italic')).toHaveAttribute('tabindex', '0')
    expect(tool('Bold')).toHaveAttribute('tabindex', '-1')
    await user.keyboard('{ArrowLeft}{ArrowLeft}')
    expect(tool('Find and replace')).toHaveFocus()
    await user.keyboard('{Home}')
    expect(tool('Bold')).toHaveFocus()
  })

  it('hides the toolbar when turned off', async () => {
    const user = userEvent.setup()
    render(App)

    await user.click(screen.getByRole('button', { name: 'Settings' }))
    await user.click(screen.getByRole('switch', { name: 'Formatting toolbar' }))

    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument()
  })

  it('starts a new file from the file menu', async () => {
    const user = userEvent.setup()
    vi.mocked(openFile).mockResolvedValue(opened('notes.md', 'hi'))
    render(App)
    await user.click(command('Open'))
    await screen.findByText('notes.md')

    await user.click(command('New'))

    expect(screen.getByText('Untitled.md')).toBeInTheDocument()
  })

  it('shows errors until dismissed', async () => {
    const user = userEvent.setup()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.mocked(saveFile).mockRejectedValue(new Error('Disk full'))
    render(App)

    await user.click(command('Save'))

    expect(await screen.findByRole('alert')).toHaveTextContent('Couldn’t save Untitled.md.')

    await user.click(screen.getByRole('button', { name: 'Dismiss' }))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('warns before leaving the page with unsaved changes', () => {
    render(App)
    const leave = (): boolean =>
      window.dispatchEvent(new Event('beforeunload', { cancelable: true }))

    expect(leave()).toBe(true)

    type('text')

    expect(leave()).toBe(false)
  })
})
