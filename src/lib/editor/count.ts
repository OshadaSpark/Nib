import type { Text } from '@codemirror/state'

export interface Counts {
  words: number
  /** Characters (code points), not counting line breaks. */
  characters: number
}

/** Chinese and Japanese are written without spaces, so each of their characters counts as a word. */
const ideograph = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu

/**
 * Runs of letters and digits, joined by apostrophes and hyphens (as in "don't" and "well-known").
 * Markdown markup, such as `#`, `-` and `**`, doesn't count.
 */
const word = /[\p{L}\p{M}\p{N}]+(?:['’-][\p{L}\p{M}\p{N}]+)*/gu

/** Each surrogate pair and line break, which `length` counts once too many. */
const overcounted = /[\uD800-\uDBFF][\uDC00-\uDFFF]|\n/g

const count = (text: string, pattern: RegExp): number => text.match(pattern)?.length ?? 0

export const countString = (text: string): Counts => ({
  words: count(text, ideograph) + count(text.replace(ideograph, ' '), word),
  characters: text.length - count(text, overcounted),
})

const cache = new WeakMap<Text, Counts>()

/**
 * Counts a document. Edits share the unchanged nodes of the document's tree, which are cached, so
 * counting after an edit only visits the changed ones. Nodes hold whole lines, so no word spans two.
 */
export const countText = (doc: Text): Counts => {
  let counts = cache.get(doc)
  if (!counts) {
    counts = doc.children
      ? doc.children.map(countText).reduce((a, b) => ({
          words: a.words + b.words,
          characters: a.characters + b.characters,
        }))
      : countString(doc.toString())
    cache.set(doc, counts)
  }
  return counts
}
