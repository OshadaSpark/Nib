import { openFile, saveFile } from '$lib/files/fileAccess'
import { handle, opened } from '$lib/files/testFiles'
import { EditorView } from '@codemirror/view'
import { render, screen } from '@testing-library/svelte'
import { userEvent, type UserEvent } from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App.svelte'

vi.mock('$lib/files/fileAccess')

/** Types into the editor through its view, as jsdom does not support contenteditable input. */
const type = (text: string): void => {
  const view = EditorView.findFromDOM(screen.getByRole('textbox', { name: 'Document' }))
  view?.dispatch({ changes: { from: view.state.doc.length, insert: text } })
}

describe('App', () => {
  afterEach(() => {
    vi.resetAllMocks()
    vi.restoreAllMocks()
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

  it('counts words and characters, or those selected', async () => {
    render(App)
    const count = screen.getByText('0 words')
    expect(count).toHaveAttribute('title', '0 characters')

    type('# One two\nthree')
    await vi.waitFor(() => {
      expect(count).toHaveTextContent('3 words')
    })
    expect(count).toHaveAttribute('title', '14 characters')

    const view = EditorView.findFromDOM(screen.getByRole('textbox', { name: 'Document' }))
    view?.dispatch({ selection: { anchor: 2, head: 5 } })
    await vi.waitFor(() => {
      expect(count).toHaveTextContent('1 of 3 words')
    })
    expect(count).toHaveAttribute('title', '3 of 14 characters')
  })

  it.each([
    ['{Control>}s{/Control}', 'Ctrl+S'],
    ['{Meta>}s{/Meta}', '⌘S'],
  ])('saves on %s (%s)', async (keys) => {
    const user = userEvent.setup()
    render(App)
    type('text')

    await user.keyboard(keys)

    expect(saveFile).toHaveBeenCalledWith('text', 'Untitled.md', null)
  })

  it('saves from the Save button', async () => {
    const user = userEvent.setup()
    render(App)

    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(saveFile).toHaveBeenCalledOnce()
  })

  it('opens a file on Ctrl+O and from the Open button', async () => {
    const user = userEvent.setup()
    vi.mocked(openFile).mockResolvedValue(opened('notes.txt', 'hi'))
    render(App)

    await user.keyboard('{Control>}o{/Control}')
    await user.click(screen.getByRole('button', { name: 'Open' }))

    expect(openFile).toHaveBeenCalledTimes(2)
    expect(await screen.findByText('notes.txt')).toBeInTheDocument()
  })

  it.each([
    [
      'keyboard shortcut',
      (user: UserEvent) => user.keyboard('{Control>}{Shift>}s{/Shift}{/Control}'),
    ],
    ['button', (user: UserEvent) => user.click(screen.getByRole('button', { name: 'Save as' }))],
  ])('saves as a new file from the %s', async (_, saveAs) => {
    const user = userEvent.setup()
    vi.mocked(openFile).mockResolvedValue(opened('notes.md', '', handle('notes.md')))
    render(App)
    await user.click(screen.getByRole('button', { name: 'Open' }))
    await screen.findByText('notes.md')

    await saveAs(user)

    expect(saveFile).toHaveBeenCalledWith('', 'notes.md', null)
  })

  it('starts a new file from the New button', async () => {
    const user = userEvent.setup()
    vi.mocked(openFile).mockResolvedValue(opened('notes.md', 'hi'))
    render(App)
    await user.click(screen.getByRole('button', { name: 'Open' }))
    await screen.findByText('notes.md')

    await user.click(screen.getByRole('button', { name: 'New' }))

    expect(screen.getByText('Untitled.md')).toBeInTheDocument()
  })

  it('shows errors', async () => {
    const user = userEvent.setup()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.mocked(saveFile).mockRejectedValue(new Error('Disk full'))
    render(App)

    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Couldn’t save Untitled.md.')
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
