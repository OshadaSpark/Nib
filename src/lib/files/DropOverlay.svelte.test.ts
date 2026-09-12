import { fireEvent, render, screen } from '@testing-library/svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import DropOverlay from './DropOverlay.svelte'
import { droppedFile } from './fileAccess'
import { opened } from './testFiles'

vi.mock('./fileAccess')

const files = { dataTransfer: { types: ['Files'] } }

describe('DropOverlay', () => {
  afterEach(() => {
    vi.resetAllMocks()
  })

  it('shows while files are dragged over the window, until they leave it', async () => {
    render(DropOverlay, { ondropfile: vi.fn() })

    await fireEvent.dragEnter(document.body, files)
    const overlay = screen.getByText('Drop to open').parentElement

    // Leaving the element under the overlay, as it appears, doesn't count.
    await fireEvent.dragLeave(document.body, files)
    expect(overlay).toBeInTheDocument()

    if (overlay) await fireEvent.dragLeave(overlay, files)
    expect(screen.queryByText('Drop to open')).not.toBeInTheDocument()
  })

  it('ignores drags without files', async () => {
    render(DropOverlay, { ondropfile: vi.fn() })

    await fireEvent.dragEnter(document.body, { dataTransfer: { types: ['text/plain'] } })

    expect(screen.queryByText('Drop to open')).not.toBeInTheDocument()
  })

  it('allows dropping files anywhere', async () => {
    render(DropOverlay, { ondropfile: vi.fn() })

    // `fireEvent` resolves to false when the default action was prevented.
    expect(await fireEvent.dragOver(document.body, files)).toBe(false)
    expect(await fireEvent.dragOver(document.body, { dataTransfer: { types: [] } })).toBe(true)
  })

  it('passes on the dropped file, rather than letting it reach the page', async () => {
    const read = () => Promise.resolve(opened('notes.md', 'hi'))
    vi.mocked(droppedFile).mockReturnValue(read)
    const ondropfile = vi.fn()
    const pageDrop = vi.fn()
    render(DropOverlay, { ondropfile })
    document.body.addEventListener('drop', pageDrop)

    await fireEvent.dragEnter(document.body, files)
    const notPrevented = await fireEvent.drop(document.body, files)

    expect(notPrevented).toBe(false)
    expect(ondropfile).toHaveBeenCalledWith(read)
    expect(pageDrop).not.toHaveBeenCalled()
    expect(screen.queryByText('Drop to open')).not.toBeInTheDocument()
    document.body.removeEventListener('drop', pageDrop)
  })
})
