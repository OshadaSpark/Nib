import { EditorSelection, EditorState } from '@codemirror/state'
import type { WidgetType } from '@codemirror/view'
import { describe, expect, it } from 'vitest'
import { languageFor } from './extensions'
import { inlineDecorations, linkAt } from './livePreview'

/** Creates a Markdown state from a document in which `|` marks the cursor, or two `|` a selection. */
const createState = (input: string): EditorState => {
  const [before = '', selected = '', after] = input.split('|')
  const doc = before + selected + (after ?? '')
  const selection =
    after === undefined
      ? EditorSelection.cursor(before.length)
      : EditorSelection.single(before.length, before.length + selected.length)
  return EditorState.create({ doc, selection, extensions: languageFor('notes.md') })
}

interface Decorated {
  from: number
  to: number
  point: boolean
  spec: { widget?: WidgetType; class?: string }
}

/** The decorations for the whole document, in document order. */
const decorate = (state: EditorState): Decorated[] => {
  const decorated: Decorated[] = []
  const iter = inlineDecorations(state, [{ from: 0, to: state.doc.length }]).iter()
  while (iter.value) {
    const spec = iter.value.spec as Decorated['spec']
    decorated.push({ from: iter.from, to: iter.to, point: iter.value.point, spec })
    iter.next()
  }
  return decorated
}

/** The document as displayed: hidden ranges left out, and widgets written as `{source}`. */
const display = (input: string): string => {
  const state = createState(input)
  let text = ''
  let pos = 0
  for (const { from, to, point, spec } of decorate(state)) {
    if (!point) continue
    text += state.sliceDoc(pos, from) + (spec.widget ? `{${state.sliceDoc(from, to)}}` : '')
    pos = to
  }
  return text + state.sliceDoc(pos)
}

/** The text covered by mark decorations with the given class. */
const marked = (input: string, className: string): string[] => {
  const state = createState(input)
  return decorate(state)
    .filter(({ spec }) => spec.class === className)
    .map(({ from, to }) => state.sliceDoc(from, to))
}

describe('inlineDecorations', () => {
  it.each([
    ['# Title\n|', 'Title\n'],
    ['###   Title\n|', 'Title\n'],
    ['## Title ##\n|', 'Title\n'],
    ['###### Six\n|', 'Six\n'],
  ])('hides heading marks in %j', (input, expected) => {
    expect(display(input)).toBe(expected)
  })

  it('reveals heading marks while the cursor is on the heading', () => {
    expect(display('# Ti|tle ##\n## Next')).toBe('# Title ##\nNext')
  })

  it('leaves setext headings as written', () => {
    expect(display('Title\n=====\n|')).toBe('Title\n=====\n')
  })

  it.each([
    ['**bold** |', 'bold '],
    ['__bold__ |', 'bold '],
    ['*italic* |', 'italic '],
    ['_italic_ |', 'italic '],
    ['~~struck~~ |', 'struck '],
    ['`code` |', 'code '],
    ['``a ` b`` |', 'a ` b '],
    ['***both*** |', 'both '],
  ])('hides the markup of %j', (input, expected) => {
    expect(display(input)).toBe(expected)
  })

  it('reveals the markup of the element the cursor touches, and only that one', () => {
    expect(display('**one** **tw|o** *three*')).toBe('one **two** three')
    expect(display('**one**| **two**')).toBe('**one** two')
    expect(display('**one** |**two**')).toBe('one **two**')
  })

  it('reveals nested elements around the cursor', () => {
    expect(display('**bold *it|alic*** end')).toBe('**bold *italic*** end')
    expect(display('**bo|ld *italic*** end')).toBe('**bold italic** end')
  })

  it('reveals every element a selection touches', () => {
    expect(display('*a* |*b* *c*| *d*')).toBe('a *b* *c* d')
  })

  it('marks inline code, whether or not it is revealed', () => {
    expect(marked('`a` `b|`', 'cm-inlineCode')).toEqual(['`a`', '`b`'])
  })

  it.each([
    ['[text](https://example.com) |', 'text '],
    ['[text](<https://example.com/a b> "Title") |', 'text '],
    ['[text][ref] |\n\n[ref]: https://example.com', 'text \n\n[ref]: https://example.com'],
    ['[text][] |\n\n[Text]: https://example.com', 'text \n\n[Text]: https://example.com'],
    ['[text] |\n\n[TEXT]: https://example.com', 'text \n\n[TEXT]: https://example.com'],
    ['<https://example.com> |', 'https://example.com '],
  ])('shows only the text of %j', (input, expected) => {
    expect(display(input)).toBe(expected)
  })

  it('marks link text', () => {
    expect(
      marked('[a](https://a.com) [b|](https://b.com) <https://c.com> www.d.com', 'cm-link'),
    ).toEqual(['a', 'b', 'https://c.com', 'www.d.com'])
  })

  it('reveals the whole link while the cursor is in it', () => {
    expect(display('[te|xt](https://example.com)')).toBe('[text](https://example.com)')
  })

  it.each([
    '[sic] or [text][missing] |',
    '[](https://example.com) |',
    '![alt](image.png) |',
    '[ref]: https://example.com |',
  ])('leaves %j as written', (input) => {
    expect(display(input)).toBe(input.replace('|', ''))
  })

  it('renders elements inside link text', () => {
    expect(display('[**bold**](https://example.com) |')).toBe('bold ')
  })

  it('hides the backslash of escaped characters', () => {
    expect(display('\\*not italic\\* |')).toBe('*not italic* ')
    expect(display('\\|* x')).toBe('\\* x')
  })

  it('shows HTML entities as widgets', () => {
    expect(display('&amp; &#35; &#x23; |')).toBe('{&amp;} {&#35;} {&#x23;} ')
    expect(display('&am|p;')).toBe('&amp;')
  })

  it('never hides a line break', () => {
    expect(display('[a\nb](\nhttps://example.com) |')).toBe('a\nb](\nhttps://example.com) ')
  })

  it('only decorates the given ranges', () => {
    const state = createState('|**a**\n**b**')

    expect(inlineDecorations(state, [{ from: 6, to: 11 }]).size).toBe(2)
  })
})

describe('linkAt', () => {
  const urlAt = (input: string, side?: -1 | 1): string | undefined => {
    const state = createState(input)
    return linkAt(state, state.selection.main.head, side)
  }

  it.each([
    ['[te|xt](https://example.com)', 'https://example.com'],
    ['[text](<https://example.com/a b>|)', 'https://example.com/a b'],
    ['[text](|)', ''],
    ['[te|xt][Ref]\n\n[ref]: https://a.com\n[ref]: https://b.com', 'https://a.com'],
    ['> [te|xt]\n>\n> [text]: <https://example.com>', 'https://example.com'],
    ['[*te|xt*](https://example.com)', 'https://example.com'],
    ['<https://exa|mple.com>', 'https://example.com'],
    ['<me@exa|mple.com>', 'mailto:me@example.com'],
    ['www.exa|mple.com', 'https://www.example.com'],
    ['me@exa|mple.com', 'mailto:me@example.com'],
    ['|[text](https://example.com)', 'https://example.com'],
  ])('finds the URL in %j', (input, expected) => {
    expect(urlAt(input)).toBe(expected)
  })

  it.each(['plain| text', '[s|ic]', '![al|t](image.png)', '[ref]: https://exa|mple.com'])(
    'finds no link in %j',
    (input) => {
      expect(urlAt(input)).toBeUndefined()
    },
  )

  it('finds a link that ends at the position when looking backwards', () => {
    expect(urlAt('[text](https://example.com)| after')).toBeUndefined()
    expect(urlAt('[text](https://example.com)| after', -1)).toBe('https://example.com')
  })
})
