import { describe, expect, it } from 'vitest'
import { Preferences } from './preferences.svelte'

/** Storage in memory, starting with `saved` as the preferences. */
const storageWith = (saved?: string): Storage => {
  const items = new Map<string, string>()
  if (saved !== undefined) items.set('typer:preferences', saved)
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => {
      items.set(key, value)
    },
  } as Storage
}

describe('Preferences', () => {
  it('starts from the defaults', () => {
    expect(new Preferences(storageWith()).theme).toBe('system')
    expect(new Preferences(null).theme).toBe('system')
  })

  it('reads saved preferences', () => {
    expect(new Preferences(storageWith('{"theme":"dark"}')).theme).toBe('dark')
  })

  it.each(['{"theme":"sepia"}', '{"theme":1}', 'null', '[1]', 'not JSON'])(
    'keeps the defaults for %j',
    (saved) => {
      expect(new Preferences(storageWith(saved)).theme).toBe('system')
    },
  )

  it('saves preferences', () => {
    const storage = storageWith()
    const preferences = new Preferences(storage)

    preferences.theme = 'light'
    preferences.save()

    expect(new Preferences(storage).theme).toBe('light')
  })

  it('carries on when storage is full or blocked', () => {
    const storage = storageWith()
    storage.setItem = () => {
      throw new DOMException('Full', 'QuotaExceededError')
    }
    const preferences = new Preferences(storage)
    preferences.theme = 'dark'

    expect(() => {
      preferences.save()
    }).not.toThrow()
  })
})
