import { ensureSyntaxTree, LanguageDescription } from '@codemirror/language'
import { describe, expect, it } from 'vitest'
import { codeLanguages } from './codeLanguages'
import { markdownState } from './testState'

/** The name of the innermost node at `pos`, looking into code blocks' languages. */
const nodeAt = (doc: string, pos: number): string | undefined => {
  const state = markdownState(doc)
  return ensureSyntaxTree(state, state.doc.length)?.resolveInner(pos, 1).name
}

describe('markdownSupport', () => {
  const doc = '```js\nconst answer = 42\n```'

  it('parses code blocks in their language once it has loaded', async () => {
    // Until then, the block is skipped.
    expect(nodeAt(doc, 8)).toBe('')

    await LanguageDescription.matchLanguageName(codeLanguages, 'js')?.load()

    expect(nodeAt(doc, 8)).toBe('keyword')
  })

  it.each([
    ['py', 'Python'],
    ['TS', 'TypeScript'],
    ['shell', 'Shell'],
    ['c++', 'C++'],
  ])('finds the language for %s', (info, name) => {
    expect(LanguageDescription.matchLanguageName(codeLanguages, info, true)?.name).toBe(name)
  })

  it.each(codeLanguages.map((description) => [description.name, description]))(
    'loads %s',
    async (_, description) => {
      const { language } = await description.load()

      expect(language.parser).toBeDefined()
    },
  )

  it('leaves code blocks of unknown languages as text', () => {
    expect(nodeAt('```nonsense\nx\n```', 12)).toBe('CodeText')
  })
})
