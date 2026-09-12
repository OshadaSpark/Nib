import type { EditorState, StateCommand } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import {
  insertCodeBlock,
  insertRule,
  insertTable,
  toggleBold,
  toggleBulletList,
  toggleHeading,
  toggleInlineCode,
  toggleItalic,
  toggleLink,
  toggleOrderedList,
  toggleQuote,
  toggleStrikethrough,
  toggleTaskList,
} from './formatting'
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

describe('toggleStrikethrough', () => {
  it.each([
    ['wraps the selection in tildes', 'a ‸word‸', 'a ~~‸word‸~~'],
    ['removes it around the cursor', '~~wo‸rd~~', 'wo‸rd'],
  ])('%s', (_, input, expected) => {
    expect(run(toggleStrikethrough, input)).toBe(expected)
  })
})

describe('toggleInlineCode', () => {
  it.each([
    ['wraps the selection in backticks', 'run ‸ls‸', 'run `‸ls‸`'],
    ['removes it around the cursor', '`l‸s`', 'l‸s'],
  ])('%s', (_, input, expected) => {
    expect(run(toggleInlineCode, input)).toBe(expected)
  })
})

describe('toggleHeading', () => {
  it.each([
    ['makes the line a heading, the cursor after its marks', '‸Title', 2, '## ‸Title'],
    ['keeps the cursor where it was in the text', 'Ti‸tle', 1, '# Ti‸tle'],
    ['changes the level', '### Ti‸tle', 1, '# Ti‸tle'],
    ['removes a heading of the same level', '## Ti‸tle', 2, 'Ti‸tle'],
    ['applies to every selected line with text', '‸a\n\nb‸', 1, '# ‸a\n\n# b‸'],
  ])('%s', (_, input, level, expected) => {
    expect(run(toggleHeading(level), input)).toBe(expected)
  })
})

describe('toggleQuote', () => {
  it.each([
    ['quotes the selected lines', '‸a\nb‸', '> ‸a\n> b‸'],
    ['unquotes them if all are quoted', '> ‸a\n>b‸', '‸a\nb‸'],
    ['quotes them all if only some are', '> ‸a\nb‸', '> > ‸a\n> b‸'],
  ])('%s', (_, input, expected) => {
    expect(run(toggleQuote, input)).toBe(expected)
  })
})

describe('list commands', () => {
  it.each([
    ['makes lines a bulleted list', toggleBulletList, '‸a\nb‸', '- ‸a\n- b‸'],
    ['numbers the lines', toggleOrderedList, '‸a\nb‸', '1. ‸a\n2. b‸'],
    ['makes lines tasks', toggleTaskList, '‸a‸', '- [ ] ‸a‸'],
    ['starts an item on an empty line', toggleBulletList, '‸', '- ‸'],
    ['removes the markers of a list of the kind', toggleBulletList, '* ‸a\n+ b‸', '‸a\nb‸'],
    ['replaces another kind of list', toggleOrderedList, '- [x] ‸a‸', '1. ‸a‸'],
    ['keeps the indentation', toggleTaskList, '  - ‸a', '  - [ ] ‸a'],
    ['removes tasks, done or not', toggleTaskList, '- [x] ‸a\n- [ ] b‸', '‸a\nb‸'],
  ])('%s', (_, command, input, expected) => {
    expect(run(command, input)).toBe(expected)
  })
})

describe('insertCodeBlock', () => {
  it.each([
    ['starts an empty block on an empty line', 'a\n‸', 'a\n```\n‸\n```'],
    ['puts the selected lines in a block', 'x\n‸a\nb‸', 'x\n```\n‸a\nb‸\n```'],
    ['puts the cursor’s line in a block', 'co‸de', '```\nco‸de\n```'],
  ])('%s', (_, input, expected) => {
    expect(run(insertCodeBlock, input)).toBe(expected)
  })
})

describe('insertRule', () => {
  it.each([
    ['inserts a rule after a blank line, so the text isn’t a heading', 'te‸xt', 'text\n\n---\n‸'],
    ['uses an empty line after text', 'text\n‸', 'text\n\n---\n‸'],
    ['uses an empty line at the start', '‸\nnext', '---\n‸\nnext'],
  ])('%s', (_, input, expected) => {
    expect(run(insertRule, input)).toBe(expected)
  })
})

describe('insertTable', () => {
  it('inserts a table after the line, selecting its first heading', () => {
    expect(run(insertTable, 'te‸xt\nnext')).toBe(
      'text\n\n| ‸Column‸ | Column |\n| ------ | ------ |\n|        |        |\n\nnext',
    )
  })
})
