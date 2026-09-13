import { invoke, isTauri } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { onDiskChange, watchDisk } from './diskWatch'

vi.mock('@tauri-apps/api/core')
vi.mock('@tauri-apps/api/event')

describe('diskWatch', () => {
  afterEach(() => {
    vi.resetAllMocks()
  })

  it('watches what is open, and tells of changes', async () => {
    const unlisten = vi.fn()
    vi.mocked(isTauri).mockReturnValue(true)
    vi.mocked(listen).mockResolvedValue(unlisten)
    const onchange = vi.fn()

    await watchDisk('/Notes')
    await watchDisk(null)
    const stop = await onDiskChange(onchange)

    expect(invoke).toHaveBeenNthCalledWith(1, 'watch', { path: '/Notes' })
    expect(invoke).toHaveBeenNthCalledWith(2, 'watch', { path: null })
    expect(listen).toHaveBeenCalledWith('disk-changed', onchange)
    stop()
    expect(unlisten).toHaveBeenCalledOnce()
  })

  it('does nothing outside the app', async () => {
    vi.mocked(isTauri).mockReturnValue(false)

    await watchDisk('/Notes')
    ;(await onDiskChange(vi.fn()))()

    expect(invoke).not.toHaveBeenCalled()
    expect(listen).not.toHaveBeenCalled()
  })
})
