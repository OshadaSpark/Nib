/** What was open when the app last closed, to open again: a folder, and a file (in it or not). */
export interface Session {
  folder: string | null
  file: string | null
}

const storageKey = 'nib:session'

const stringOrNull = (value: unknown): string | null => (typeof value === 'string' ? value : null)

/** The session saved last, or an empty one. */
export const loadSession = (): Session => {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? '{}') as Partial<
      Record<string, unknown>
    >
    return { folder: stringOrNull(saved.folder), file: stringOrNull(saved.file) }
  } catch {
    // Not JSON, or no storage: nothing to open again.
    return { folder: null, file: null }
  }
}

export const saveSession = (session: Session): void => {
  try {
    localStorage.setItem(storageKey, JSON.stringify(session))
  } catch {
    // Full or blocked: the next launch starts afresh.
  }
}
