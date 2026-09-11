import { describe, expect, it } from 'vitest'
import { isShowableImage, linkAt } from './links'
import { markdownState } from './testState'

describe('linkAt', () => {
  const urlAt = (input: string, side?: -1 | 1): string | undefined => {
    const state = markdownState(input)
    return linkAt(state, state.selection.main.head, side)
  }

  it.each([
    ['[te‸xt](https://example.com)', 'https://example.com'],
    ['[text](<https://example.com/a b>‸)', 'https://example.com/a b'],
    ['[text](‸)', ''],
    ['[te‸xt][Ref]\n\n[ref]: https://a.com\n[ref]: https://b.com', 'https://a.com'],
    ['> [te‸xt]\n>\n> [text]: <https://example.com>', 'https://example.com'],
    ['[*te‸xt*](https://example.com)', 'https://example.com'],
    ['<https://exa‸mple.com>', 'https://example.com'],
    ['<me@exa‸mple.com>', 'mailto:me@example.com'],
    ['www.exa‸mple.com', 'https://www.example.com'],
    ['me@exa‸mple.com', 'mailto:me@example.com'],
    ['‸[text](https://example.com)', 'https://example.com'],
  ])('finds the URL in %j', (input, expected) => {
    expect(urlAt(input)).toBe(expected)
  })

  it.each([
    'plain‸ text',
    '[s‸ic]',
    '![al‸t](image.png)',
    '[ref]: https://exa‸mple.com',
    '```md\n[te‸xt](https://example.com)\n```',
  ])('finds no link in %j', (input) => {
    expect(urlAt(input)).toBeUndefined()
  })

  it('finds a link that ends at the position when looking backwards', () => {
    expect(urlAt('[text](https://example.com)‸ after')).toBeUndefined()
    expect(urlAt('[text](https://example.com)‸ after', -1)).toBe('https://example.com')
  })
})

describe('isShowableImage', () => {
  it.each(['https://example.com/a.png', 'http://example.com/a.png', 'data:image/png;base64,AA=='])(
    'shows %s',
    (src) => {
      expect(isShowableImage(src)).toBe(true)
    },
  )

  it.each(['a.png', '../a.png', '/a.png', 'javascript:alert(1)', 'data:text/html,x'])(
    'does not show %s',
    (src) => {
      expect(isShowableImage(src)).toBe(false)
    },
  )
})
