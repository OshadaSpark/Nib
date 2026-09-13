import { afterEach, describe, expect, it, vi } from 'vitest'
import { whileMounted } from './whileMounted'

describe('whileMounted', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('stops what started, even when asked before it has', async () => {
    const stop = vi.fn()
    let start: (stop: () => void) => void = () => undefined

    whileMounted(
      new Promise((resolve) => {
        start = resolve
      }),
    )()
    start(stop)

    await vi.waitFor(() => {
      expect(stop).toHaveBeenCalledOnce()
    })
  })

  it('logs a failure to start, leaving nothing to stop', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    whileMounted(Promise.reject(new Error('No window')))()

    await vi.waitFor(() => {
      expect(error).toHaveBeenCalledOnce()
    })
  })
})
