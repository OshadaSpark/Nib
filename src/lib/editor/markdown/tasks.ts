import { syntaxTree } from '@codemirror/language'
import type { EditorState, Text, TransactionSpec } from '@codemirror/state'
import type { SyntaxNode } from '@lezer/common'

/** Whether a task's `TaskMarker` node, `[ ]` or `[x]`, marks it done. */
export const isChecked = (doc: Text, marker: SyntaxNode): boolean =>
  doc.sliceString(marker.from + 1, marker.to - 1).trim() !== ''

/** A change that toggles the task on the line at `pos` between `[ ]` and `[x]`, if there is one. */
export const toggleTask = (state: EditorState, pos: number): TransactionSpec | null => {
  const line = state.doc.lineAt(pos)
  const markers: SyntaxNode[] = []
  syntaxTree(state).iterate({
    from: line.from,
    to: line.to,
    enter: (node) => {
      if (node.name === 'TaskMarker') markers.push(node.node)
    },
  })
  const [marker] = markers
  if (!marker) return null
  const insert = isChecked(state.doc, marker) ? ' ' : 'x'
  return { changes: { from: marker.from + 1, to: marker.to - 1, insert } }
}
