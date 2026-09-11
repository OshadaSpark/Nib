import { EditorSelection, EditorState } from '@codemirror/state'
import { markdownSupport } from './language'

/**
 * For tests: a Markdown editor state from a document in which `‸` marks the cursor, or two `‸` the
 * selection.
 */
export const markdownState = (input: string): EditorState => {
  const [before = '', selected = '', after] = input.split('‸')
  const doc = before + selected + (after ?? '')
  const selection =
    after === undefined
      ? EditorSelection.cursor(before.length)
      : EditorSelection.single(before.length, before.length + selected.length)
  return EditorState.create({ doc, selection, extensions: markdownSupport })
}
