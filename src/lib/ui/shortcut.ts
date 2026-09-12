/** Whether the platform writes shortcuts with ⌘ rather than Ctrl. */
export const isApple = /Mac|iPhone|iPad/.test(navigator.userAgent)

/** A ⌘/Ctrl shortcut for `key`, in the platform's notation: ⇧⌘S on Apple devices, else Ctrl+Shift+S. */
export const shortcut = (key: string, shift = false): string =>
  isApple ? `${shift ? '⇧' : ''}⌘${key}` : `Ctrl+${shift ? 'Shift+' : ''}${key}`

/** The same shortcut, as `aria-keyshortcuts` has it. */
export const keyShortcuts = (key: string, shift = false): string => {
  const keys = `${shift ? 'Shift+' : ''}${key}`
  return `Control+${keys} Meta+${keys}`
}
