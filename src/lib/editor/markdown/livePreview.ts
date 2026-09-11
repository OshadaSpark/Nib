import { syntaxTree } from '@codemirror/language'
import type { EditorState, Extension, TransactionSpec } from '@codemirror/state'
import {
  EditorView,
  keymap,
  ViewPlugin,
  type Command,
  type DecorationSet,
  type ViewUpdate,
} from '@codemirror/view'
import type { SyntaxNode } from '@lezer/common'
import { blockWidgets } from './blockWidgets'
import { previewDecorations } from './decorations'
import { linkAt, openLink } from './links'

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
  const checked = state.sliceDoc(marker.from + 1, marker.to - 1).trim() !== ''
  return { changes: { from: marker.from + 1, to: marker.to - 1, insert: checked ? ' ' : 'x' } }
}

/** Opens the link at the cursor, or else toggles the task on the cursor's line. */
const activate: Command = (view) => {
  const { state } = view
  const { head } = state.selection.main
  if (openLink(linkAt(state, head, 1) ?? linkAt(state, head, -1))) return true
  const toggle = toggleTask(state, head)
  if (toggle) view.dispatch(toggle)
  return toggle !== null
}

const previewPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet

    constructor(view: EditorView) {
      this.decorations = previewDecorations(view.state, view.visibleRanges)
    }

    update(update: ViewUpdate): void {
      if (
        update.docChanged ||
        update.selectionSet ||
        update.viewportChanged ||
        // The parser works in the background, so more of the tree can become available later.
        syntaxTree(update.startState) !== syntaxTree(update.state)
      ) {
        this.decorations = previewDecorations(update.state, update.view.visibleRanges)
      }
    }
  },
  { decorations: (plugin) => plugin.decorations },
)

/**
 * Live Markdown rendering: inline elements, lists, tasks, quotes, rules, code blocks, images and
 * tables. ⌘/Ctrl+click opens a link and clicking a checkbox toggles its task; Alt+Enter does either
 * at the cursor.
 */
export const livePreview: Extension = [
  previewPlugin,
  blockWidgets,
  keymap.of([{ key: 'Alt-Enter', run: activate }]),
  EditorView.domEventHandlers({
    mousedown: (event, view) => {
      if (event.button !== 0 || !(event.target instanceof Element)) return false
      if (event.target.matches('.cm-taskCheckbox')) {
        // Toggled here rather than by the checkbox, which is redrawn from the new source.
        event.preventDefault()
        const toggle = toggleTask(view.state, view.posAtDOM(event.target))
        if (toggle) view.dispatch(toggle)
        return true
      }
      if (!(event.metaKey || event.ctrlKey)) return false
      const link = event.target.closest('.cm-link')
      // The start of the clicked link's text maps to a position inside the link.
      return link !== null && openLink(linkAt(view.state, view.posAtDOM(link)))
    },
  }),
]
