import { languageFor } from '$lib/editor/extensions'
import Editor from '$lib/editor/Editor.svelte'
import { localFiles, type LocalFiles } from '$lib/editor/markdown/links'
import { Text, type Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { fireEvent, render, screen } from '@testing-library/svelte'
import { openUrl } from '@tauri-apps/plugin-opener'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tauri-apps/plugin-opener')

const renderEditor = (doc: string, fileName = 'notes.md', extensions: Extension = []) => {
  render(Editor, { doc: Text.of(doc.split('\n')), language: languageFor(fileName), extensions })
  return screen.getByRole('textbox', { name: 'Document' })
}

/** Local files with one image, `cat.png`, which open every link. */
const files = () => {
  const local = {
    open: vi.fn<LocalFiles['open']>().mockReturnValue(true),
    imageURL: vi.fn<LocalFiles['imageURL']>((src) =>
      Promise.resolve(src === 'cat.png' ? 'blob:cat' : null),
    ),
  }
  return { local, extension: localFiles.of(local) }
}

const getView = (textbox: HTMLElement): EditorView => {
  const view = EditorView.findFromDOM(textbox)
  if (!view) throw new Error('No editor view found')
  return view
}

describe('live preview', () => {
  afterEach(() => {
    vi.resetAllMocks()
    vi.restoreAllMocks()
  })

  it('renders Markdown in place, away from the cursor', () => {
    const textbox = renderEditor('Some **bold** and &amp; [a link](https://example.com)')

    expect(textbox).toHaveTextContent('Some bold and & a link')
    expect(screen.getByText('a link').closest('.cm-link')).toBeInTheDocument()
  })

  it('reveals the markup of the element the cursor moves into', () => {
    const textbox = renderEditor('Some **bold** text')

    getView(textbox).dispatch({ selection: { anchor: 8 } })

    expect(textbox).toHaveTextContent('Some **bold** text')
  })

  it('leaves plain text as written', () => {
    const textbox = renderEditor('Some **bold** text', 'notes.txt')

    expect(textbox).toHaveTextContent('Some **bold** text')
  })

  it('opens a link in its app on ⌘/Ctrl+click', async () => {
    const open = vi.mocked(openUrl).mockResolvedValue()
    renderEditor('A [link](https://example.com)')

    await fireEvent.mouseDown(screen.getByText('link'), { button: 0, ctrlKey: true })

    expect(open).toHaveBeenCalledExactlyOnceWith('https://example.com')
  })

  it('opens the link at the cursor on Alt+Enter', async () => {
    const open = vi.mocked(openUrl).mockResolvedValue()
    const textbox = renderEditor('A <https://example.com>')
    getView(textbox).dispatch({ selection: { anchor: 23 } })

    await fireEvent.keyDown(textbox, { key: 'Enter', altKey: true })

    expect(open).toHaveBeenCalledExactlyOnceWith('https://example.com')
  })

  it.each([
    ['a plain click', { button: 0 }, '[link](https://example.com)'],
    ['a relative link', { button: 0, metaKey: true }, '[link](other.md)'],
    ['a script link', { button: 0, metaKey: true }, '[link](javascript:alert(1))'],
  ])('does not open a link on %s', async (_, init, doc) => {
    const open = vi.mocked(openUrl).mockResolvedValue()
    renderEditor(`A ${doc}`)

    await fireEvent.mouseDown(screen.getByText('link'), init)

    expect(open).not.toHaveBeenCalled()
  })

  it('draws bullets in place of list markers', () => {
    const textbox = renderEditor('Intro\n- one\n  - two')

    expect(textbox).toHaveTextContent('Intro• one ◦ two')
  })

  it('toggles a task when its checkbox is clicked', async () => {
    const textbox = renderEditor('Intro\n- [ ] to do')
    const checkbox = screen.getByRole('checkbox', { name: 'Done' })
    expect(checkbox).not.toBeChecked()

    await fireEvent.mouseDown(checkbox, { button: 0 })

    expect(getView(textbox).state.doc.toString()).toBe('Intro\n- [x] to do')
    expect(screen.getByRole('checkbox', { name: 'Done' })).toBeChecked()
  })

  it('toggles the task at the cursor on Alt+Enter', async () => {
    const textbox = renderEditor('- [x] done')
    getView(textbox).dispatch({ selection: { anchor: 8 } })

    await fireEvent.keyDown(textbox, { key: 'Enter', altKey: true })

    expect(getView(textbox).state.doc.toString()).toBe('- [ ] done')
  })

  it('shows images below their Markdown', () => {
    const textbox = renderEditor('Intro\n![A cat](data:image/png,cat)')

    expect(screen.getByRole('img', { name: 'A cat' })).toHaveAttribute('src', 'data:image/png,cat')
    expect(textbox).toHaveTextContent('![A cat](data:image/png,cat)')
  })

  it('hides images that fail to load', async () => {
    renderEditor('Intro\n![A cat](data:image/png,cat)')
    const image = screen.getByRole('img', { name: 'A cat' })

    await fireEvent.error(image)

    expect(image.parentElement).not.toBeVisible()
  })

  it('shows relative images from local files, and hides those it can’t find', async () => {
    const { extension } = files()
    renderEditor('![A cat](cat.png)\n\n![A dog](dog.png)', 'notes.md', extension)

    await vi.waitFor(() => {
      expect(screen.getByRole('img', { name: 'A cat' })).toHaveAttribute('src', 'blob:cat')
    })
    expect(screen.getByRole('img', { name: 'A dog', hidden: true }).parentElement).not.toBeVisible()
  })

  it('opens relative links through local files on ⌘/Ctrl+click', async () => {
    const { local, extension } = files()
    renderEditor('A [link](other.md)', 'notes.md', extension)

    await fireEvent.mouseDown(screen.getByText('link'), { button: 0, metaKey: true })

    expect(local.open).toHaveBeenCalledExactlyOnceWith('other.md')
  })

  describe('tables', () => {
    const table = '| Drink | Price |\n| - | --: |\n| **Tea** &amp; [cake](https://a.com) | 2 |'

    it('renders a table in place of its source', () => {
      const textbox = renderEditor(`Intro\n${table}`)

      expect(screen.getByRole('columnheader', { name: 'Price' })).toHaveStyle({
        textAlign: 'right',
      })
      expect(screen.getByRole('cell', { name: 'Tea & cake' })).toContainHTML('<strong>Tea</strong>')
      expect(textbox).not.toHaveTextContent('| Drink |')
    })

    it('renders inline Markdown in cells', () => {
      renderEditor(
        'Intro\n| a | b |\n| - | - |\n| ~~s~~ `c` | ![i](data:image/png,i) ![r](r.png) ![w](https://a.com/w.png) |',
      )

      expect(screen.getByRole('cell', { name: 's c' })).toContainHTML('<s>s</s> <code>c</code>')
      expect(screen.getByRole('img', { name: 'i' })).toHaveAttribute('src', 'data:image/png,i')
      // Without local files, relative images show their alt text, as images from the web always do.
      expect(screen.getByRole('cell', { name: 'i r w' })).toHaveTextContent('r w')
    })

    it('shows the source with the cursor in a cell when the cell is clicked', async () => {
      const textbox = renderEditor(`Intro\n${table}`)

      await fireEvent.mouseDown(screen.getByRole('cell', { name: '2' }))

      const { state } = getView(textbox)
      expect(state.sliceDoc(state.selection.main.head)).toBe('2 |')
      expect(textbox).toHaveTextContent('| Drink | Price |')
    })

    it('opens a link in a cell on ⌘/Ctrl+click', async () => {
      const open = vi.mocked(openUrl).mockResolvedValue()
      renderEditor(`Intro\n${table}`)

      await fireEvent.mouseDown(screen.getByText('cake'), { metaKey: true })

      expect(open).toHaveBeenCalledExactlyOnceWith('https://a.com')
    })
  })
})
