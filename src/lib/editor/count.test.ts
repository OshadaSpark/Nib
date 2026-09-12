import { Text } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import { countString, countText } from './count'

describe('countString', () => {
  it.each([
    ['', 0],
    ['one two  three', 3],
    ["don't stop, well-known", 3],
    ['# Heading\n\n- **bold** item', 3],
    ['café naïve 42', 3],
    ['日本語のテキスト', 8],
    ['Hello 世界', 3],
    ['— * - ---', 0],
  ])('counts the words in %j as %i', (text, words) => {
    expect(countString(text).words).toBe(words)
  })

  it('counts characters by code point, without line breaks', () => {
    expect(countString('ab\ncd').characters).toBe(4)
    expect(countString('a 😀').characters).toBe(3)
  })
})

describe('countText', () => {
  const lines = Array.from({ length: 5000 }, (_, i) => `Line ${String(i)} has five words`)

  it('counts a document split into many nodes', () => {
    const doc = Text.of(lines)

    expect(doc.children).not.toBeNull()
    expect(countText(doc)).toEqual(countString(lines.join('\n')))
  })

  it('counts an edited document', () => {
    const doc = Text.of(lines)
    countText(doc)

    const edited = doc.replace(10, 10, Text.of(['new words', 'and more']))

    expect(countText(edited)).toEqual(countString(edited.toString()))
  })
})
