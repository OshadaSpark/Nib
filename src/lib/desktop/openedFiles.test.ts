import { invoke, isTauri } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { watchOpenedFiles } from './openedFiles'

vi.mock('@tauri-apps/api/core')
vi.mock('@tauri-apps/api/event')

describe('watchOpenedFiles', () => {
  afterEach(() => {
    vi.resetAllMocks()
  })

  it('takes the files the app started with, then those opened later', async () => {
    const unlisten = vi.fn()
    vi.mocked(isTauri).mockReturnValue(true)
    vi.mocked(listen).mockResolvedValue(unlisten)
    vi.mocked(invoke).mockResolvedValueOnce(['/Docs/a.md']).mockResolvedValue([])
    const onopen = vi.fn()

    const stop = await watchOpenedFiles(onopen)
    expect(onopen).toHaveBeenCalledExactlyOnceWith(['/Docs/a.md'])

    // Told of more, which aren't there by the time it asks: nothing to open.
    const [[event, handler]] = vi.mocked(listen).mock.calls as [[string, () => void]]
    expect(event).toBe('files-opened')
    handler()
    vi.mocked(invoke).mockResolvedValue(['/Docs/b.md'])
    handler()
    await vi.waitFor(() => {
      expect(onopen).toHaveBeenLastCalledWith(['/Docs/b.md'])
    })
    expect(onopen).toHaveBeenCalledTimes(2)

    stop()
    expect(unlisten).toHaveBeenCalledOnce()
  })

  it('does nothing outside the app', async () => {
    vi.mocked(isTauri).mockReturnValue(false)

    ;(await watchOpenedFiles(vi.fn()))()

    expect(invoke).not.toHaveBeenCalled()
  })
})
