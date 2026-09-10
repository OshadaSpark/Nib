import { undo } from '@codemirror/commands'
import { syntaxTree } from '@codemirror/language'
import { EditorState, type Transaction } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import { editorExtensions } from './extensions'

const createState = (doc: string): EditorState =>
  EditorState.create({ doc, extensions: editorExtensions })

describe('editorExtensions', () => {
  it('parses GitHub Flavored Markdown', () => {
    const nodes: string[] = []

    syntaxTree(createState('# Title\n\n~~struck~~')).iterate({
      enter: (node) => {
        nodes.push(node.name)
      },
    })

    expect(nodes).toEqual(expect.arrayContaining(['ATXHeading1', 'Strikethrough']))
  })

  it('records history so edits can be undone', () => {
    let state = createState('draft').update({ changes: { from: 5, insert: ' two' } }).state
    const dispatch = (transaction: Transaction): void => {
      state = transaction.state
    }

    expect(undo({ state, dispatch })).toBe(true)
    expect(state.doc.toString()).toBe('draft')
  })
})
