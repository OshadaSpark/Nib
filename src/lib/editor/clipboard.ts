import type { Command } from '@codemirror/view'

/**
 * Copies the selected text to the clipboard. The browser allows writing to it from a click, so a
 * failure is not expected, and there is nothing to do about one.
 */
export const copy: Command = (view) => {
  const { from, to } = view.state.selection.main
  if (from === to) return false
  navigator.clipboard.writeText(view.state.sliceDoc(from, to)).catch(() => undefined)
  return true
}

/** Copies the selected text to the clipboard and deletes it, as native cutting does at once. */
export const cut: Command = (view) => {
  if (!copy(view)) return false
  view.dispatch(view.state.replaceSelection(''), { userEvent: 'delete.cut', scrollIntoView: true })
  return true
}

/** Replaces the selection with the clipboard's text, once the browser (or the user) allows it. */
export const paste: Command = (view) => {
  navigator.clipboard.readText().then(
    (text) => {
      view.dispatch(view.state.replaceSelection(text), {
        userEvent: 'input.paste',
        scrollIntoView: true,
      })
    },
    // Refused, so there is nothing to paste.
    () => undefined,
  )
  return true
}
