import { EditorState } from '@codemirror/state'
import { openUrl } from '@tauri-apps/plugin-opener'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { isShowableImage, linkAt, localFiles, openLink, type LocalFiles } from './links'
import { markdownState } from './testState'

vi.mock('@tauri-apps/plugin-opener')

/** Local files that open every link, and have no images. */
const files = () => ({
  open: vi.fn<LocalFiles['open']>().mockReturnValue(true),
  imageURL: vi.fn<LocalFiles['imageURL']>().mockResolvedValue(null),
})

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
  const plain = EditorState.create()
  const withFiles = EditorState.create({ extensions: localFiles.of(files()) })

  it('shows data URLs', () => {
    expect(isShowableImage(plain, 'data:image/png;base64,AA==')).toBe(true)
  })

  it.each(['a.png', '../a.png', '/a.png'])('shows %s only with local files', (src) => {
    expect(isShowableImage(plain, src)).toBe(false)
    expect(isShowableImage(withFiles, src)).toBe(true)
  })

  it.each([
    'https://example.com/a.png',
    'http://example.com/a.png',
    'javascript:alert(1)',
    'data:text/html,x',
    '#top',
    '//example.com/a.png',
  ])('does not show %s', (src) => {
    expect(isShowableImage(withFiles, src)).toBe(false)
  })
})

describe('openLink', () => {
  afterEach(() => {
    vi.resetAllMocks()
  })

  it.each(['https://example.com', 'mailto:me@example.com'])('opens %s in its app', (url) => {
    vi.mocked(openUrl).mockResolvedValue()

    expect(openLink(EditorState.create(), url)).toBe(true)
    expect(openUrl).toHaveBeenCalledExactlyOnceWith(url)
  })

  it('opens relative links through local files, if there are any', () => {
    const local = files()
    const state = EditorState.create({ extensions: localFiles.of(local) })

    expect(openLink(state, 'other.md')).toBe(true)
    expect(local.open).toHaveBeenCalledWith('other.md')
    expect(openLink(EditorState.create(), 'other.md')).toBe(false)
  })

  it.each([undefined, '', '#top', 'ftp://example.com'])('opens nothing for %j', (url) => {
    expect(openLink(EditorState.create({ extensions: localFiles.of(files()) }), url)).toBe(false)
  })
})
