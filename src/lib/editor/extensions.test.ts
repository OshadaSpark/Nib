import { undo } from '@codemirror/commands'
import { language, syntaxTree } from '@codemirror/language'
import { EditorState, type Transaction } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import { editorExtensions, languageFor } from './extensions'
import { blockWidgets } from './markdown/blockWidgets'

const createState = (doc: string, fileName = 'notes.md'): EditorState =>
  EditorState.create({ doc, extensions: [editorExtensions, languageFor(fileName)] })

describe('languageFor', () => {
  it.each(['notes.md', 'README.markdown', 'SHOUT.MD'])('uses Markdown for %s', (fileName) => {
    expect(createState('', fileName).facet(language)?.name).toBe('markdown')
  })

  it.each(['notes.txt', 'notes.md.txt', 'Makefile'])('uses plain text for %s', (fileName) => {
    expect(createState('', fileName).facet(language)).toBeNull()
  })

  it('returns the same extension for files of the same language', () => {
    expect(languageFor('a.txt')).toBe(languageFor('b.txt'))
    expect(languageFor('a.md')).toBe(languageFor('b.md'))
    expect(languageFor('a.md', false)).toBe(languageFor('b.md', false))
  })

  it('renders Markdown live unless asked not to', () => {
    const rendered = EditorState.create({ extensions: languageFor('a.md') })
    const source = EditorState.create({ extensions: languageFor('a.md', false) })

    expect(source.facet(language)?.name).toBe('markdown')
    expect(rendered.field(blockWidgets, false)).toBeDefined()
    expect(source.field(blockWidgets, false)).toBeUndefined()
    expect(languageFor('a.txt', false)).toBe(languageFor('a.txt'))
  })
})

describe('editorExtensions', () => {
  it('parses GitHub Flavored Markdown in Markdown files', () => {
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
