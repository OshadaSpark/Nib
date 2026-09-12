import { languageFor } from '$lib/editor/extensions'
import Editor from '$lib/editor/Editor.svelte'
import type { EditorSnapshot } from '$lib/editor/snapshot'
import { undo } from '@codemirror/commands'
import { language } from '@codemirror/language'
import { Text } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { render, screen } from '@testing-library/svelte'
import { userEvent } from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

const getView = (): EditorView => {
  const view = EditorView.findFromDOM(screen.getByRole('textbox', { name: 'Document' }))
  if (!view) throw new Error('No editor view found')
  return view
}

describe('Editor', () => {
  it('renders an accessible, focused text box', () => {
    render(Editor)

    const textbox = screen.getByRole('textbox', { name: 'Document' })

    expect(textbox).toHaveAttribute('contenteditable', 'true')
    expect(textbox).toHaveFocus()
  })

  it('shows the initial document', () => {
    render(Editor, { doc: Text.of(['# Hello', 'world']) })

    expect(getView().state.doc.toString()).toBe('# Hello\nworld')
  })

  it('reports changes to the document', () => {
    const onchange = vi.fn()
    render(Editor, { onchange })

    getView().dispatch({ changes: { from: 0, insert: 'typed' } })

    expect(onchange).toHaveBeenCalledOnce()
    expect(onchange).toHaveBeenCalledWith(expect.objectContaining({ length: 5 }))
  })

  it('takes over a new document, keeping the cursor and undo history', async () => {
    const { rerender } = render(Editor, { doc: Text.of(['one two three']) })
    const view = getView()
    view.dispatch({ selection: { anchor: 13 } })

    await rerender({ doc: Text.of(['one 2 three']) })

    expect(view.state.doc.toString()).toBe('one 2 three')
    expect(view.state.selection.main.head).toBe(11)
    expect(undo(view)).toBe(true)
    expect(view.state.doc.toString()).toBe('one two three')
  })

  it('hands over its state when unmounted, and restores it from that snapshot', () => {
    const onleave = vi.fn<(snapshot: EditorSnapshot) => void>()
    const { unmount } = render(Editor, { doc: Text.of(['one']), onleave })
    getView().dispatch({ changes: { from: 3, insert: ' two' }, selection: { anchor: 1 } })

    unmount()
    const [snapshot = null] = onleave.mock.lastCall ?? []
    expect(snapshot).not.toBeNull()
    render(Editor, { doc: Text.of(['one']), snapshot })

    const view = getView()
    expect(view.state.doc.toString()).toBe('one two')
    expect(view.state.selection.main.head).toBe(1)
    expect(undo(view)).toBe(true)
    expect(view.state.doc.toString()).toBe('one')
  })

  it('switches language when the prop changes', async () => {
    const { rerender } = render(Editor, { language: languageFor('notes.txt') })
    expect(getView().state.facet(language)).toBeNull()

    await rerender({ language: languageFor('notes.md') })

    expect(getView().state.facet(language)?.name).toBe('markdown')
  })

  it('finds and replaces text from a panel opened with Ctrl+F', async () => {
    const user = userEvent.setup()
    render(Editor, { doc: Text.of(['one cat, two cats']) })

    await user.keyboard('{Control>}f{/Control}')
    await user.type(screen.getByRole('textbox', { name: 'Find' }), 'cat')
    await user.type(screen.getByRole('textbox', { name: 'Replace' }), 'dog')
    await user.click(screen.getByRole('button', { name: 'Replace all' }))
    expect(getView().state.doc.toString()).toBe('one dog, two dogs')

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('textbox', { name: 'Find' })).not.toBeInTheDocument()
  })

  it('shows line numbers and checks spelling as the appearance says', async () => {
    const appearance = { font: 'serif', size: '1rem', width: '60ch' }
    const { container, rerender } = render(Editor, {
      doc: Text.of(['a', 'b']),
      appearance: { ...appearance, lineNumbers: false, spellcheck: true },
    })
    const textbox = screen.getByRole('textbox', { name: 'Document' })
    expect(container.querySelector('.cm-lineNumbers')).toBeNull()
    expect(textbox).toHaveAttribute('spellcheck', 'true')

    await rerender({ appearance: { ...appearance, lineNumbers: true, spellcheck: false } })

    expect(container.querySelector('.cm-lineNumbers')).toHaveTextContent('12')
    expect(textbox).toHaveAttribute('spellcheck', 'false')
  })

  it('hands over its view when created, and null when destroyed', () => {
    const onview = vi.fn()
    const { unmount } = render(Editor, { onview })
    expect(onview).toHaveBeenLastCalledWith(getView())

    unmount()

    expect(onview).toHaveBeenLastCalledWith(null)
  })

  it('removes the editor when unmounted', () => {
    const { container, unmount } = render(Editor)

    unmount()

    expect(container.querySelector('.cm-editor')).not.toBeInTheDocument()
  })
})
