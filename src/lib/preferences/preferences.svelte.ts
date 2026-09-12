import type { Appearance } from '$lib/editor/theme'

const storageKey = 'typer:preferences'

export const themes = ['system', 'light', 'dark'] as const
export type Theme = (typeof themes)[number]

export const fonts = ['sans', 'serif', 'mono'] as const
export type Font = (typeof fonts)[number]

export const widths = ['narrow', 'medium', 'wide'] as const
export type Width = (typeof widths)[number]

/** What the status bar can show, in its order. */
export const statusItems = [
  'state',
  'cursor',
  'lines',
  'words',
  'characters',
  'type',
  'lineBreaks',
  'encoding',
] as const
export type StatusItem = (typeof statusItems)[number]

/** Status bar items shown unless the user picked otherwise. */
const defaultStatus: Readonly<Record<StatusItem, boolean>> = {
  state: true,
  cursor: false,
  lines: true,
  words: true,
  characters: true,
  type: false,
  lineBreaks: false,
  encoding: false,
}

/** Text sizes in pixels, in steps of one. */
export const sizes = { min: 14, max: 24 } as const

/** The text column's width for each preference, in `ch` of the text's font. */
const columnWidths: Record<Width, string> = { narrow: '60ch', medium: '72ch', wide: '90ch' }

/** The preferences that are on or off. */
const switches = [
  'livePreview',
  'lineNumbers',
  'spellcheck',
  'toolbar',
  'fadeWhileWriting',
] as const

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
  font: Font = $state('sans')
  /** The editor's text size, in pixels. */
  size: number = $state(17)
  /** The width of the text column. */
  width: Width = $state('medium')
  /** Whether Markdown renders live, rather than showing as written. */
  livePreview: boolean = $state(true)
  lineNumbers: boolean = $state(false)
  spellcheck: boolean = $state(true)
  /** Whether the toolbar has the formatting tools, for Markdown files. */
  toolbar: boolean = $state(true)
  /** Whether the header, toolbar and status bar fade while the user writes. */
  fadeWhileWriting: boolean = $state(true)
  /** Which items the status bar shows. */
  status: Record<StatusItem, boolean> = $state({ ...defaultStatus })

  /** How the editor shows the text, as it takes it. */
  readonly appearance: Appearance = $derived({
    font: `var(--font-${this.font})`,
    size: `${String(this.size / 16)}rem`,
    width: columnWidths[this.width],
    lineNumbers: this.lineNumbers,
    spellcheck: this.spellcheck,
  })

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
    this.font = oneOf(fonts, saved.font) ?? this.font
    this.width = oneOf(widths, saved.width) ?? this.width
    for (const key of switches) {
      const value = saved[key]
      if (typeof value === 'boolean') this[key] = value
    }
    const status: Partial<Record<string, unknown>> =
      typeof saved.status === 'object' && saved.status !== null ? saved.status : {}
    for (const item of statusItems) {
      const value = status[item]
      if (typeof value === 'boolean') this.status[item] = value
    }
    const { size } = saved
    if (
      typeof size === 'number' &&
      Number.isInteger(size) &&
      size >= sizes.min &&
      size <= sizes.max
    ) {
      this.size = size
    }
  }

  /** Saves the preferences. Reads all of them, so an effect that calls it runs on every change. */
  save(): void {
    const { theme, font, size, width, status } = this
    const values = {
      theme,
      font,
      size,
      width,
      ...Object.fromEntries(switches.map((key) => [key, this[key]])),
      status: { ...status },
    }
    try {
      this.#storage?.setItem(storageKey, JSON.stringify(values))
    } catch {
      // Full or blocked: the preferences last for this visit only.
    }
  }
}
