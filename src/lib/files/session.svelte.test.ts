import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadSession, saveSession } from './session'

describe('session', () => {
  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('saves what is open, to open again', () => {
    saveSession({ folder: '/Notes', file: '/Notes/a.md' })

    expect(loadSession()).toEqual({ folder: '/Notes', file: '/Notes/a.md' })
  })

  it.each(['not JSON', 'null', '{"folder": 1}'])('opens nothing again after %j', (saved) => {
    localStorage.setItem('nib:session', saved)

    expect(loadSession()).toEqual({ folder: null, file: null })
  })

  it('makes do without storage', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Full', 'QuotaExceededError')
    })

    expect(() => {
      saveSession({ folder: null, file: '/a.md' })
    }).not.toThrow()
  })
})
