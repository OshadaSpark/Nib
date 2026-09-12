import { languageFor } from '$lib/editor/extensions'
import Editor from '$lib/editor/Editor.svelte'
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

  it('removes the editor when unmounted', () => {
    const { container, unmount } = render(Editor)

    unmount()

    expect(container.querySelector('.cm-editor')).not.toBeInTheDocument()
  })
})
