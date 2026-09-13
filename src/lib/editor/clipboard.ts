import { readText, writeText } from '@tauri-apps/plugin-clipboard-manager'
import type { Command } from '@codemirror/view'

// The toolbar's clipboard commands, through the app rather than WebKit, which would ask the user
// before each paste. (Keyboard shortcuts go through the Edit menu instead.)

/** Copies the selected text to the clipboard. A failure isn't expected, nor can be helped. */
export const copy: Command = (view) => {
  const { from, to } = view.state.selection.main
  if (from === to) return false
  writeText(view.state.sliceDoc(from, to)).catch(console.error)
  return true
}

/** Copies the selected text to the clipboard and deletes it, as native cutting does at once. */
export const cut: Command = (view) => {
  if (!copy(view)) return false
  view.dispatch(view.state.replaceSelection(''), { userEvent: 'delete.cut', scrollIntoView: true })
  return true
}

/** Replaces the selection with the clipboard's text. */
export const paste: Command = (view) => {
  readText().then(
    (text) => {
      view.dispatch(view.state.replaceSelection(text), {
        userEvent: 'input.paste',
        scrollIntoView: true,
      })
    },
    // No text on the clipboard, so there is nothing to paste.
    () => undefined,
  )
  return true
}
