import { isolateHistory } from '@codemirror/commands'
import { syntaxTree } from '@codemirror/language'
import {
  ChangeSet,
  EditorSelection,
  type ChangeSpec,
  type EditorState,
  type Line,
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

/**
 * Wraps each range of the selection in `mark`, or removes the `node` around it, whose marks are
 * `markNode`s.
 */
const toggleInline =
  (node: string, markNode: string, mark: string): StateCommand =>
  ({ state, dispatch }) => {
    const transaction = state.changeByRange((range) => {
      const inline = enclosing(state, range, node)
      if (inline) {
        const marks = inline.getChildren(markNode)
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
export const toggleBold: StateCommand = toggleInline('StrongEmphasis', 'EmphasisMark', '**')

/** Toggles italic text (`*italic*`). Asterisks, unlike underscores, work inside words. */
export const toggleItalic: StateCommand = toggleInline('Emphasis', 'EmphasisMark', '*')

/** Toggles struck-through text (`~~struck~~`). */
export const toggleStrikethrough: StateCommand = toggleInline(
  'Strikethrough',
  'StrikethroughMark',
  '~~',
)

/** Toggles inline code (`` `code` ``). */
export const toggleInlineCode: StateCommand = toggleInline('InlineCode', 'CodeMark', '`')

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

/** The lines `range` touches: all of them for a cursor or a single line, else those with text. */
const linesOf = (state: EditorState, range: SelectionRange): Line[] => {
  const lines: Line[] = []
  const last = state.doc.lineAt(range.to).number
  for (let number = state.doc.lineAt(range.from).number; number <= last; number++) {
    lines.push(state.doc.line(number))
  }
  const withText = lines.filter((line) => line.text.trim() !== '')
  return withText.length > 0 ? withText : lines
}

/**
 * A command that changes the lines of each range of the selection. Text typed at the start of a
 * line goes before the cursor there, so a cursor at the start of a line ends up after new markup.
 */
const lineCommand =
  (edit: (lines: Line[]) => ChangeSpec[]): StateCommand =>
  ({ state, dispatch }) => {
    const transaction = state.changeByRange((range) => {
      const changes = state.changes(edit(linesOf(state, range)))
      return { changes, range: range.map(changes, 1) }
    })
    dispatch(state.update(transaction, formatting))
    return true
  }

/** A heading's marks and the space after them. */
const headingMarks = /^#{1,6}(?:[ \t]+|$)/

/** Makes the lines headings of `level`, or plain paragraphs if they all are already. */
export const toggleHeading = (level: number): StateCommand => {
  const marks = `${'#'.repeat(level)} `
  return lineCommand((lines) => {
    const existing = lines.map((line) => headingMarks.exec(line.text)?.[0] ?? '')
    const all = existing.every((mark) => mark.trimEnd().length === level)
    return lines.map((line, index) => ({
      from: line.from,
      to: line.from + (existing[index]?.length ?? 0),
      insert: all ? '' : marks,
    }))
  })
}

const quoteMark = /^> ?/

/** Quotes the lines, or unquotes them if they all are quoted. */
export const toggleQuote: StateCommand = lineCommand((lines) => {
  const all = lines.every((line) => quoteMark.test(line.text))
  return lines.map((line) =>
    all
      ? { from: line.from, to: line.from + (quoteMark.exec(line.text)?.[0].length ?? 0) }
      : { from: line.from, insert: '> ' },
  )
})

type ListKind = 'bullet' | 'ordered' | 'task'

/** A line's indentation, then its list marker and task box if it has them. */
const listMarker = /^([ \t]*)((?:[-*+]|\d+[.)])[ \t]+(\[[ xX]\][ \t]+)?)?/

const listKind = (marker: string | undefined, task: string | undefined): ListKind | null => {
  if (!marker) return null
  if (task) return 'task'
  return /^\d/.test(marker) ? 'ordered' : 'bullet'
}

/**
 * Makes the lines items of a `kind` of list, replacing any other list marker, or plain lines if
 * they all are such items already.
 */
const toggleList = (kind: ListKind): StateCommand =>
  lineCommand((lines) => {
    const markers = lines.map((line) => listMarker.exec(line.text) ?? [])
    const all = markers.every(([, , marker, task]) => listKind(marker, task) === kind)
    return lines.map((line, index) => {
      const [, indentation = '', marker = ''] = markers[index] ?? []
      const from = line.from + indentation.length
      const markup = { bullet: '- ', ordered: `${String(index + 1)}. `, task: '- [ ] ' }[kind]
      return { from, to: from + marker.length, insert: all ? '' : markup }
    })
  })

export const toggleBulletList: StateCommand = toggleList('bullet')
export const toggleOrderedList: StateCommand = toggleList('ordered')
export const toggleTaskList: StateCommand = toggleList('task')

/**
 * Puts the selected lines in a code block, or starts an empty one on an empty line, with the cursor
 * inside.
 */
export const insertCodeBlock: StateCommand = ({ state, dispatch }) => {
  const transaction = state.changeByRange((range) => {
    const first = state.doc.lineAt(range.from)
    const last = state.doc.lineAt(range.to)
    if (range.empty && first.text.trim() === '') {
      return {
        changes: { from: first.from, to: first.to, insert: '```\n\n```' },
        range: EditorSelection.cursor(first.from + 4),
      }
    }
    return {
      changes: [
        { from: first.from, insert: '```\n' },
        { from: last.to, insert: '\n```' },
      ],
      range: EditorSelection.range(range.anchor + 4, range.head + 4),
    }
  })
  dispatch(state.update(transaction, formatting))
  return true
}

/**
 * Inserts `block` after the cursor's line, with a blank line before it (which keeps a rule from
 * making the text above it a heading) and one after it (which keeps the text below out of a table).
 * `select` is the part of the block to select, as offsets into it.
 */
const insertBlock =
  (block: string, select: [number, number] = [block.length + 1, block.length + 1]): StateCommand =>
  ({ state, dispatch }) => {
    const transaction = state.changeByRange((range) => {
      const line = state.doc.lineAt(range.head)
      const above = line.number > 1 ? state.doc.line(line.number - 1).text : ''
      const before = line.text.trim() !== '' ? '\n\n' : above.trim() !== '' ? '\n' : ''
      const start = line.to + before.length
      return {
        changes: { from: line.to, insert: `${before}${block}\n` },
        range: EditorSelection.range(start + select[0], start + select[1]),
      }
    })
    dispatch(state.update(transaction, formatting))
    return true
  }

/** Inserts a horizontal rule, with the cursor on the line after it. */
export const insertRule: StateCommand = insertBlock('---')

/** Inserts a table with two columns, with the first heading selected to type over. */
export const insertTable: StateCommand = insertBlock(
  '| Column | Column |\n| ------ | ------ |\n|        |        |',
  [2, 8],
)

/** ⌘/Ctrl+B, I and K. `Mod-i` takes over the default binding, which selects the parent node. */
export const formattingKeymap: readonly KeyBinding[] = [
  { key: 'Mod-b', run: toggleBold },
  { key: 'Mod-i', run: toggleItalic },
  { key: 'Mod-k', run: toggleLink },
]
