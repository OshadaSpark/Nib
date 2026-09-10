import Editor from '$lib/editor/Editor.svelte'
import { render, screen } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'

describe('Editor', () => {
  it('renders an accessible, focused text box', () => {
    render(Editor)

    const textbox = screen.getByRole('textbox', { name: 'Document' })

    expect(textbox).toHaveAttribute('contenteditable', 'true')
    expect(textbox).toHaveFocus()
  })

  it('shows the initial document', () => {
    render(Editor, { doc: '# Hello' })

    expect(screen.getByRole('textbox', { name: 'Document' })).toHaveTextContent('# Hello')
  })

  it('removes the editor when unmounted', () => {
    const { container, unmount } = render(Editor)

    unmount()

    expect(container.querySelector('.cm-editor')).not.toBeInTheDocument()
  })
})
