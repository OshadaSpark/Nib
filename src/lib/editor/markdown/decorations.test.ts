import type { EditorState } from '@codemirror/state'
import type { WidgetType } from '@codemirror/view'
import { describe, expect, it } from 'vitest'
import { previewDecorations } from './decorations'
import { markdownState } from './testState'
import { BulletWidget, CheckboxWidget } from './widgets'

interface Decorated {
  from: number
  to: number
  point: boolean
  spec: { widget?: WidgetType; class?: string; attributes?: { style?: string } }
}

/** The decorations for the whole document, in document order. */
const decorate = (state: EditorState): Decorated[] => {
  const decorated: Decorated[] = []
  const iter = previewDecorations(state, [{ from: 0, to: state.doc.length }]).iter()
  while (iter.value) {
    const spec = iter.value.spec as Decorated['spec']
    decorated.push({ from: iter.from, to: iter.to, point: iter.value.point, spec })
    iter.next()
  }
  return decorated
}

/** How a widget shows: bullets and checkboxes as themselves, others as `{source}`. */
const shown = (widget: WidgetType, source: string): string => {
  if (widget instanceof BulletWidget) return widget.glyph
  if (widget instanceof CheckboxWidget) return widget.checked ? '☑' : '☐'
  return `{${source}}`
}

/** The document as displayed: hidden ranges left out, and widgets as they show. */
const display = (input: string): string => {
  const state = markdownState(input)
  let text = ''
  let pos = 0
  for (const { from, to, point, spec } of decorate(state)) {
    // Replacements only: line decorations are points too, but empty.
    if (!point || from === to) continue
    const source = state.sliceDoc(from, to)
    text += state.sliceDoc(pos, from) + (spec.widget ? shown(spec.widget, source) : '')
    pos = to
  }
  return text + state.sliceDoc(pos)
}

/** The text covered by mark decorations with the given class. */
const marked = (input: string, className: string): string[] => {
  const state = markdownState(input)
  return decorate(state)
    .filter(({ point, spec }) => !point && spec.class === className)
    .map(({ from, to }) => state.sliceDoc(from, to))
}

/** Each line's classes from line decorations, with any style attribute in brackets. */
const lineClasses = (input: string): string[] => {
  const state = markdownState(input)
  const lines = Array.from({ length: state.doc.lines }, (): string[] => [])
  for (const { from, to, point, spec } of decorate(state)) {
    if (!point || from !== to || spec.widget || !spec.class) continue
    const style = spec.attributes?.style
    lines[state.doc.lineAt(from).number - 1]?.push(spec.class + (style ? `(${style})` : ''))
  }
  return lines.map((classes) => classes.join(' '))
}

describe('previewDecorations', () => {
  describe('inline elements', () => {
    it.each([
      ['# Title\n‸', 'Title\n'],
      ['###   Title\n‸', 'Title\n'],
      ['## Title ##\n‸', 'Title\n'],
      ['###### Six\n‸', 'Six\n'],
    ])('hides heading marks in %j', (input, expected) => {
      expect(display(input)).toBe(expected)
    })

    it('reveals heading marks while the cursor is on the heading', () => {
      expect(display('# Ti‸tle ##\n## Next')).toBe('# Title ##\nNext')
    })

    it('leaves setext headings as written', () => {
      expect(display('Title\n=====\n‸')).toBe('Title\n=====\n')
    })

    it.each([
      ['**bold** ‸', 'bold '],
      ['__bold__ ‸', 'bold '],
      ['*italic* ‸', 'italic '],
      ['_italic_ ‸', 'italic '],
      ['~~struck~~ ‸', 'struck '],
      ['`code` ‸', 'code '],
      ['``a ` b`` ‸', 'a ` b '],
      ['***both*** ‸', 'both '],
    ])('hides the markup of %j', (input, expected) => {
      expect(display(input)).toBe(expected)
    })

    it('reveals the markup of the element the cursor touches, and only that one', () => {
      expect(display('**one** **tw‸o** *three*')).toBe('one **two** three')
      expect(display('**one**‸ **two**')).toBe('**one** two')
      expect(display('**one** ‸**two**')).toBe('one **two**')
    })

    it('reveals nested elements around the cursor', () => {
      expect(display('**bold *it‸alic*** end')).toBe('**bold *italic*** end')
      expect(display('**bo‸ld *italic*** end')).toBe('**bold italic** end')
    })

    it('reveals every element a selection touches', () => {
      expect(display('*a* ‸*b* *c*‸ *d*')).toBe('a *b* *c* d')
    })

    it('marks inline code, whether or not it is revealed', () => {
      expect(marked('`a` `b‸`', 'cm-inlineCode')).toEqual(['`a`', '`b`'])
    })

    it.each([
      ['[text](https://example.com) ‸', 'text '],
      ['[text](<https://example.com/a b> "Title") ‸', 'text '],
      ['[text][ref] ‸\n\n[ref]: https://example.com', 'text \n\n[ref]: https://example.com'],
      ['[text][] ‸\n\n[Text]: https://example.com', 'text \n\n[Text]: https://example.com'],
      ['[text] ‸\n\n[TEXT]: https://example.com', 'text \n\n[TEXT]: https://example.com'],
      ['<https://example.com> ‸', 'https://example.com '],
    ])('shows only the text of %j', (input, expected) => {
      expect(display(input)).toBe(expected)
    })

    it('marks link text', () => {
      expect(
        marked('[a](https://a.com) [b‸](https://b.com) <https://c.com> www.d.com', 'cm-link'),
      ).toEqual(['a', 'b', 'https://c.com', 'www.d.com'])
    })

    it('reveals the whole link while the cursor is in it', () => {
      expect(display('[te‸xt](https://example.com)')).toBe('[text](https://example.com)')
    })

    it.each([
      '[sic] or [text][missing] ‸',
      '[](https://example.com) ‸',
      '![alt](image.png) ‸',
      '[ref]: https://example.com ‸',
    ])('leaves %j as written', (input) => {
      expect(display(input)).toBe(input.replace('‸', ''))
    })

    it('renders elements inside link text', () => {
      expect(display('[**bold**](https://example.com) ‸')).toBe('bold ')
    })

    it('hides the backslash of escaped characters', () => {
      expect(display('\\*not italic\\* ‸')).toBe('*not italic* ')
      expect(display('\\‸* x')).toBe('\\* x')
    })

    it('shows HTML entities as widgets', () => {
      expect(display('&amp; &#35; &#x23; ‸')).toBe('{&amp;} {&#35;} {&#x23;} ')
      expect(display('&am‸p;')).toBe('&amp;')
    })

    it('never hides a line break', () => {
      expect(display('[a\nb](\nhttps://example.com) ‸')).toBe('a\nb](\nhttps://example.com) ')
    })
  })

  describe('lists', () => {
    it('draws bullets, by level of nesting', () => {
      expect(display('- a\n  * b\n    + c\n      - d\n‸')).toBe('• a\n  ◦ b\n    ▪ c\n      • d\n')
    })

    it('reveals a bullet only while the cursor touches it', () => {
      expect(display('- a\n-‸ b')).toBe('• a\n- b')
      expect(display('- a\n- ‸b')).toBe('• a\n• b')
    })

    it('keeps numbers as written', () => {
      expect(display('1. a\n2) b\n‸')).toBe('1. a\n2) b\n')
    })
  })

  describe('task lists', () => {
    it('draws checkboxes in place of the bullet and marker', () => {
      expect(display('- [ ] to do\n- [x] done\n* [X] done\n‸')).toBe('☐ to do\n☑ done\n☑ done\n')
    })

    it('draws checkboxes after numbers', () => {
      expect(display('1. [x] done\n‸')).toBe('1. ☑ done\n')
    })

    it('reveals the markup while the cursor touches it', () => {
      expect(display('- [‸x] done')).toBe('- [x] done')
      expect(display('- [x] ‸done')).toBe('☑ done')
    })

    it('marks the text of done tasks', () => {
      expect(marked('- [x] done\n- [ ] to do\n- [x]\n‸', 'cm-taskDone')).toEqual(['done'])
    })
  })

  describe('blockquotes', () => {
    it('draws a bar for each level of nesting', () => {
      expect(lineClasses('> a\n> > b\nlazy\n\n‸')).toEqual([
        'cm-quote(--quote-depth: 1)',
        'cm-quote(--quote-depth: 2)',
        'cm-quote(--quote-depth: 2)',
        '',
        '',
      ])
    })

    it('hides the quote marks, except the ones the cursor touches', () => {
      expect(display('> a\n> > b\n‸')).toBe('a\nb\n')
      expect(display('> a\n‸> > b')).toBe('a\n> b')
      expect(display('> a\n> ‸b')).toBe('a\nb')
    })
  })

  describe('horizontal rules', () => {
    it('draws a line in place of the rule', () => {
      expect(display('a\n\n---\n\n‸')).toBe('a\n\n\n\n')
      expect(lineClasses('a\n\n***\n\n‸')).toEqual(['', '', 'cm-rule', '', ''])
    })

    it('shows the rule while the cursor touches it', () => {
      expect(display('a\n\n---‸')).toBe('a\n\n---')
      expect(lineClasses('a\n\n---‸')).toEqual(['', '', ''])
    })
  })

  describe('code blocks', () => {
    it('styles fenced code blocks by line and hides their fences', () => {
      const input = '```js\nlet a\nlet b\n```\n‸'

      expect(lineClasses(input)).toEqual([
        'cm-codeBlock cm-codeBlock-first cm-codeFence',
        'cm-codeBlock',
        'cm-codeBlock',
        'cm-codeBlock cm-codeBlock-last cm-codeFence',
        '',
      ])
      expect(display(input)).toBe('\nlet a\nlet b\n\n')
      expect(marked(input, 'cm-codeText')).toEqual(['```js\nlet a\nlet b\n```'])
    })

    it('shows the fences while the cursor is in the block', () => {
      expect(display('~~~\nco‸de\n~~~')).toBe('~~~\ncode\n~~~')
    })

    it('keeps the last line of an unclosed block, which runs to the end of the document', () => {
      expect(display('‸a\n\n```\ncode')).toBe('a\n\n\ncode')
    })

    it('styles indented code blocks', () => {
      expect(lineClasses('a\n\n    code\n\n‸')).toEqual([
        '',
        '',
        'cm-codeBlock cm-codeBlock-first cm-codeBlock-last',
        '',
        '',
      ])
    })

    it('renders no Markdown inside code blocks', () => {
      expect(display('```md\n# **Not** a heading\n```\n‸')).toBe('\n# **Not** a heading\n\n')
    })
  })

  it('only decorates the given ranges', () => {
    const state = markdownState('‸**a**\n**b**')

    expect(previewDecorations(state, [{ from: 6, to: 11 }]).size).toBe(2)
  })
})
