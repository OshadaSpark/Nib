import { isolateHistory } from '@codemirror/commands'
import { syntaxTree } from '@codemirror/language'
import {
  ChangeSet,
  EditorSelection,
  type ChangeSpec,
  type EditorState,
  type SelectionRange,
  type StateCommand,
  type TransactionSpec,
} from '@codemirror/state'
import type { KeyBinding } from '@codemirror/view'
import type { SyntaxNode } from '@lezer/common'

/**
 * The innermost node named `name` around `range`. A cursor must be strictly inside, so that one
 * just before or after a node doesn't count.
 */
const enclosing = (state: EditorState, range: SelectionRange, name: string): SyntaxNode | null => {
  const { from, to } = range
  let found: SyntaxNode | null = null
  syntaxTree(state).iterate({
    from,
    to,
    enter: (node) => {
      const contains = node.from <= from && to <= node.to
      const strictly = node.from < from && to < node.to
      if (node.name === name && (from < to ? contains : strictly)) found = node.node
    },
  })
  return found
}

/** `range` without the whitespace at its ends, which Markdown doesn't allow inside emphasis. */
const trimmed = (state: EditorState, range: SelectionRange): SelectionRange => {
  const text = state.sliceDoc(range.from, range.to)
  const from = range.from + (text.length - text.trimStart().length)
  const to = Math.max(from, range.to - (text.length - text.trimEnd().length))
  return EditorSelection.range(from, to)
}

/** Applies `changes` to one range of the selection, mapping the range through them. */
const change = (state: EditorState, range: SelectionRange, changes: ChangeSpec) => ({
  changes,
  range: range.map(ChangeSet.of(changes, state.doc.length)),
})

/** Formatting is an undo step of its own, rather than joining the typing before or after it. */
const formatting: TransactionSpec = {
  scrollIntoView: true,
  userEvent: 'input.format',
  annotations: isolateHistory.of('full'),
}

/** Wraps each range of the selection in `mark`, or removes the `node` around it. */
const toggleEmphasis =
  (node: 'StrongEmphasis' | 'Emphasis', mark: string): StateCommand =>
  ({ state, dispatch }) => {
    const transaction = state.changeByRange((range) => {
      const emphasis = enclosing(state, range, node)
      if (emphasis) {
        const marks = emphasis.getChildren('EmphasisMark')
        const [open] = marks
        const close = marks.at(-1)
        if (open && close) {
          return change(state, range, [
            { from: open.from, to: open.to },
            { from: close.from, to: close.to },
          ])
        }
      }
      const { from, to } = trimmed(state, range)
      return {
        changes: [
          { from, insert: mark },
          { from: to, insert: mark },
        ],
        range: EditorSelection.range(from + mark.length, to + mark.length),
      }
    })
    dispatch(state.update(transaction, formatting))
    return true
  }

/** Toggles bold text (`**bold**`). */
export const toggleBold: StateCommand = toggleEmphasis('StrongEmphasis', '**')

/** Toggles italic text (`*italic*`). Asterisks, unlike underscores, work inside words. */
export const toggleItalic: StateCommand = toggleEmphasis('Emphasis', '*')

const url = /^(?:https?:\/\/|mailto:|www\.)\S+$/i

/**
 * Turns the selection into a link, with the cursor where the missing part goes: the text for a
 * selected URL, and the URL otherwise. In a link, removes it and keeps its text.
 */
export const toggleLink: StateCommand = ({ state, dispatch }) => {
  const transaction = state.changeByRange((range) => {
    const link = enclosing(state, range, 'Link')
    const [open, close] = link?.getChildren('LinkMark') ?? []
    if (link && open && close) {
      return change(state, range, [
        { from: link.from, to: open.to },
        { from: close.from, to: link.to },
      ])
    }
    const { from, to } = trimmed(state, range)
    const text = state.sliceDoc(from, to)
    if (url.test(text)) {
      return {
        changes: { from, to, insert: `[](${text})` },
        range: EditorSelection.cursor(from + 1),
      }
    }
    return {
      changes: [
        { from, insert: '[' },
        { from: to, insert: ']()' },
      ],
      // Inside the brackets when there is no text yet, else inside the parentheses.
      range: EditorSelection.cursor(from === to ? from + 1 : to + 3),
    }
  })
  dispatch(state.update(transaction, formatting))
  return true
}

/** ⌘/Ctrl+B, I and K. `Mod-i` takes over the default binding, which selects the parent node. */
export const formattingKeymap: readonly KeyBinding[] = [
  { key: 'Mod-b', run: toggleBold },
  { key: 'Mod-i', run: toggleItalic },
  { key: 'Mod-k', run: toggleLink },
]
