const storageKey = 'typer:preferences'

export const themes = ['system', 'light', 'dark'] as const
export type Theme = (typeof themes)[number]

/** `value` if it is one of `options`. */
const oneOf = <T>(options: readonly T[], value: unknown): T | undefined =>
  options.find((option) => option === value)

/** Local storage, unless the browser blocks it (as it may for privacy settings). */
const localStorageOrNull = (): Storage | null => {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/** The user's preferences, kept in local storage. */
export class Preferences {
  theme: Theme = $state('system')

  readonly #storage: Storage | null

  /** Reads the saved preferences, leaving the defaults for any missing or invalid ones. */
  constructor(storage: Storage | null = localStorageOrNull()) {
    this.#storage = storage
    let saved: Partial<Record<string, unknown>> = {}
    try {
      const parsed: unknown = JSON.parse(storage?.getItem(storageKey) ?? '{}')
      if (typeof parsed === 'object' && parsed !== null) saved = parsed
    } catch {
      // Not JSON: the defaults stand.
    }
    this.theme = oneOf(themes, saved.theme) ?? this.theme
  }

  /** Saves the preferences. Reads all of them, so an effect that calls it runs on every change. */
  save(): void {
    const values = { theme: this.theme }
    try {
      this.#storage?.setItem(storageKey, JSON.stringify(values))
    } catch {
      // Full or blocked: the preferences last for this visit only.
    }
  }
}
