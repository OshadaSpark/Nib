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
  const defaults = {
    theme: 'system',
    font: 'sans',
    size: 17,
    width: 'medium',
    livePreview: true,
    lineNumbers: false,
    spellcheck: true,
    toolbar: true,
    fadeWhileWriting: true,
    status: {
      state: true,
      cursor: false,
      lines: true,
      words: true,
      characters: true,
      type: false,
      lineBreaks: false,
      encoding: false,
    },
  }

  const values = (preferences: Preferences) => ({
    theme: preferences.theme,
    font: preferences.font,
    size: preferences.size,
    width: preferences.width,
    livePreview: preferences.livePreview,
    lineNumbers: preferences.lineNumbers,
    spellcheck: preferences.spellcheck,
    toolbar: preferences.toolbar,
    fadeWhileWriting: preferences.fadeWhileWriting,
    status: { ...preferences.status },
  })

  it('starts from the defaults', () => {
    expect(values(new Preferences(storageWith()))).toEqual(defaults)
    expect(values(new Preferences(null))).toEqual(defaults)
  })

  it('reads saved preferences', () => {
    const saved = {
      theme: 'dark',
      font: 'serif',
      size: 20,
      width: 'wide',
      livePreview: false,
      lineNumbers: true,
      spellcheck: false,
      toolbar: false,
      fadeWhileWriting: false,
      status: { ...defaults.status, state: false, cursor: true },
    }

    expect(values(new Preferences(storageWith(JSON.stringify(saved))))).toEqual(saved)
  })

  it.each([
    '{"theme":"sepia","font":"comic","width":"huge"}',
    '{"theme":1,"size":"20","livePreview":"no","lineNumbers":1}',
    '{"status":{"words":"yes","bogus":true}}',
    '{"status":[false]}',
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
    preferences.lineNumbers = true
    preferences.status.words = false
    preferences.save()

    expect(values(new Preferences(storage))).toEqual({
      ...defaults,
      theme: 'light',
      size: 14,
      lineNumbers: true,
      status: { ...defaults.status, words: false },
    })
  })

  it('reads a partial status bar, keeping the defaults for the rest', () => {
    const preferences = new Preferences(storageWith('{"status":{"cursor":true}}'))

    expect(preferences.status).toEqual({ ...defaults.status, cursor: true })
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
