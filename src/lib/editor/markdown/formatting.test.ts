import type { EditorState, StateCommand } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import { toggleBold, toggleItalic, toggleLink } from './formatting'
import { markdownState } from './testState'

/** Runs `command` on `input` and returns the result, with `‸` marking the new selection. */
const run = (command: StateCommand, input: string): string => {
  let state: EditorState = markdownState(input)
  command({
    state,
    dispatch: (transaction) => {
      state = transaction.state
    },
  })
  const { from, to } = state.selection.main
  const doc = state.doc.toString()
  return from === to
    ? doc.slice(0, from) + '‸' + doc.slice(from)
    : doc.slice(0, from) + '‸' + doc.slice(from, to) + '‸' + doc.slice(to)
}

describe('toggleBold', () => {
  it.each([
    ['wraps the selection', 'a ‸word‸ b', 'a **‸word‸** b'],
    ['leaves whitespace at the selection’s ends outside', 'a‸ word ‸b', 'a **‸word‸** b'],
    ['inserts markers around the cursor', 'a ‸b', 'a **‸**b'],
    ['removes bold around the cursor', 'a **wo‸rd** b', 'a wo‸rd b'],
    ['removes bold around the selected text', 'a **‸word‸** b', 'a ‸word‸ b'],
    ['removes bold when all of it is selected', 'a ‸**word**‸ b', 'a ‸word‸ b'],
    ['removes bold written with underscores', '__wo‸rd__', 'wo‸rd'],
    ['adds bold next to a bold word, not in it', '**word**‸', '**word****‸**'],
    ['adds bold inside italic text', '*a ‸b‸ c*', '*a **‸b‸** c*'],
  ])('%s', (_, input, expected) => {
    expect(run(toggleBold, input)).toBe(expected)
  })
})

describe('toggleItalic', () => {
  it.each([
    ['wraps the selection in asterisks', '‸word‸', '*‸word‸*'],
    ['removes italic', '_wo‸rd_', 'wo‸rd'],
    ['removes the italic around bold text', '***bo‸ld***', '**bo‸ld**'],
    ['adds italic inside bold text', '**a ‸b‸ c**', '**a *‸b‸* c**'],
  ])('%s', (_, input, expected) => {
    expect(run(toggleItalic, input)).toBe(expected)
  })
})

describe('toggleLink', () => {
  it.each([
    ['links the selected text, with the cursor on the URL', 'see ‸docs‸', 'see [docs](‸)'],
    [
      'links a selected URL, with the cursor on the text',
      '‸https://example.com‸',
      '[‸](https://example.com)',
    ],
    ['inserts an empty link at the cursor', 'a ‸', 'a [‸]()'],
    ['removes the link around the cursor, keeping its text', '[do‸cs](https://x.y) b', 'do‸cs b'],
    [
      'removes a reference link',
      '[do‸cs][ref]\n\n[ref]: https://x.y',
      'do‸cs\n\n[ref]: https://x.y',
    ],
  ])('%s', (_, input, expected) => {
    expect(run(toggleLink, input)).toBe(expected)
  })
})
