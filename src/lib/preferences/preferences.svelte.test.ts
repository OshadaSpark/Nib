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
  const defaults = { theme: 'system', font: 'sans', size: 17, width: 'medium' }

  const values = ({ theme, font, size, width }: Preferences) => ({ theme, font, size, width })

  it('starts from the defaults', () => {
    expect(values(new Preferences(storageWith()))).toEqual(defaults)
    expect(values(new Preferences(null))).toEqual(defaults)
  })

  it('reads saved preferences', () => {
    const saved = { theme: 'dark', font: 'serif', size: 20, width: 'wide' }

    expect(values(new Preferences(storageWith(JSON.stringify(saved))))).toEqual(saved)
  })

  it.each([
    '{"theme":"sepia","font":"comic","width":"huge"}',
    '{"theme":1,"size":"20"}',
    '{"size":13}',
    '{"size":25}',
    '{"size":17.5}',
    'null',
    '[1]',
    'not JSON',
  ])('keeps the defaults for %j', (saved) => {
    expect(values(new Preferences(storageWith(saved)))).toEqual(defaults)
  })

  it('saves preferences', () => {
    const storage = storageWith()
    const preferences = new Preferences(storage)

    preferences.theme = 'light'
    preferences.size = 14
    preferences.save()

    expect(values(new Preferences(storage))).toEqual({ ...defaults, theme: 'light', size: 14 })
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
