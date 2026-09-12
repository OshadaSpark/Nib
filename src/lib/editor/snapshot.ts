import type { StateEffect } from '@codemirror/state'

/**
 * An editor's state, kept while it is unmounted so that it can be restored: the document,
 * selection and undo history, as JSON, and the scroll position.
 */
export interface EditorSnapshot {
  readonly state: unknown
  readonly scroll: StateEffect<unknown>
}
