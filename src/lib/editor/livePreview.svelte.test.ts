import { languageFor } from '$lib/editor/extensions'
import Editor from '$lib/editor/Editor.svelte'
import { Text } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { fireEvent, render, screen } from '@testing-library/svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'

const renderEditor = (doc: string, fileName = 'notes.md'): HTMLElement => {
  render(Editor, { doc: Text.of(doc.split('\n')), language: languageFor(fileName) })
  return screen.getByRole('textbox', { name: 'Document' })
}

const getView = (textbox: HTMLElement): EditorView => {
  const view = EditorView.findFromDOM(textbox)
  if (!view) throw new Error('No editor view found')
  return view
}

describe('live preview', () => {
  afterEach(() => {
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

  it('opens a link in a new tab on ⌘/Ctrl+click', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    renderEditor('A [link](https://example.com)')

    await fireEvent.mouseDown(screen.getByText('link'), { button: 0, ctrlKey: true })

    expect(open).toHaveBeenCalledExactlyOnceWith(
      'https://example.com',
      '_blank',
      'noopener,noreferrer',
    )
  })

  it('opens the link at the cursor on Alt+Enter', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    const textbox = renderEditor('A <https://example.com>')
    getView(textbox).dispatch({ selection: { anchor: 23 } })

    await fireEvent.keyDown(textbox, { key: 'Enter', altKey: true })

    expect(open).toHaveBeenCalledExactlyOnceWith(
      'https://example.com',
      '_blank',
      'noopener,noreferrer',
    )
  })

  it.each([
    ['a plain click', { button: 0 }, '[link](https://example.com)'],
    ['a relative link', { button: 0, metaKey: true }, '[link](other.md)'],
    ['a script link', { button: 0, metaKey: true }, '[link](javascript:alert(1))'],
  ])('does not open a link on %s', async (_, init, doc) => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    renderEditor(`A ${doc}`)

    await fireEvent.mouseDown(screen.getByText('link'), init)

    expect(open).not.toHaveBeenCalled()
  })
})
