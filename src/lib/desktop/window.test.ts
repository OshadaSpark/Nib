import { invoke, isTauri } from '@tauri-apps/api/core'
import { getCurrentWindow, type CloseRequestedEvent, type Window } from '@tauri-apps/api/window'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  closeWindow,
  guardClosing,
  setDocumentEdited,
  setWindowTheme,
  setWindowTitle,
  watchFullScreen,
} from './window'

vi.mock('@tauri-apps/api/core')
vi.mock('@tauri-apps/api/window')

/** A stand-in for the app's window, with what the functions call on it. */
const appWindow = () => {
  const window = {
    setTitle: vi.fn(),
    setTheme: vi.fn(),
    close: vi.fn(),
    isFullscreen: vi.fn().mockResolvedValue(false),
    onResized: vi.fn().mockResolvedValue(vi.fn()),
    onCloseRequested: vi.fn().mockResolvedValue(vi.fn()),
  }
  vi.mocked(isTauri).mockReturnValue(true)
  vi.mocked(getCurrentWindow).mockReturnValue(window as unknown as Window)
  return window
}

describe('window', () => {
  afterEach(() => {
    vi.resetAllMocks()
  })

  it('sets the title, the edited dot and the theme', async () => {
    const window = appWindow()

    await setWindowTitle('notes.md — Nib')
    await setDocumentEdited(true)
    await setWindowTheme(null)

    expect(window.setTitle).toHaveBeenCalledWith('notes.md — Nib')
    expect(invoke).toHaveBeenCalledWith('set_document_edited', { edited: true })
    expect(window.setTheme).toHaveBeenCalledWith(null)
  })

  it('tells when the window goes in and out of full screen', async () => {
    const window = appWindow()
    const onchange = vi.fn()

    await watchFullScreen(onchange)
    expect(onchange).toHaveBeenLastCalledWith(false)

    window.isFullscreen.mockResolvedValue(true)
    const [[resized]] = window.onResized.mock.calls as [[() => void]]
    resized()

    await vi.waitFor(() => {
      expect(onchange).toHaveBeenLastCalledWith(true)
    })
  })

  it('keeps the window open when closing isn’t allowed', async () => {
    const window = appWindow()
    const allowed = vi.fn().mockResolvedValue(false)
    await guardClosing(allowed)
    const [[handler]] = window.onCloseRequested.mock.calls as [
      [(event: CloseRequestedEvent) => Promise<void>],
    ]
    const event = { preventDefault: vi.fn() }

    await handler(event as unknown as CloseRequestedEvent)
    expect(event.preventDefault).toHaveBeenCalledOnce()

    allowed.mockResolvedValue(true)
    await handler(event as unknown as CloseRequestedEvent)
    expect(event.preventDefault).toHaveBeenCalledOnce()

    await closeWindow()
    expect(window.close).toHaveBeenCalledOnce()
  })

  it('does nothing outside the app', async () => {
    vi.mocked(isTauri).mockReturnValue(false)
    const onchange = vi.fn()

    await setWindowTitle('Nib')
    await setDocumentEdited(true)
    await setWindowTheme('dark')
    ;(await watchFullScreen(onchange))()
    ;(await guardClosing(() => Promise.resolve(true)))()
    await closeWindow()

    expect(getCurrentWindow).not.toHaveBeenCalled()
    expect(invoke).not.toHaveBeenCalled()
    expect(onchange).not.toHaveBeenCalled()
  })
})
