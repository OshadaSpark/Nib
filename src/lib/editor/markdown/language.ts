import { markdownKeymap, markdownLanguage, pasteURLAsLink } from '@codemirror/lang-markdown'
import { Language, LanguageDescription, LanguageSupport, ParseContext } from '@codemirror/language'
import { Prec } from '@codemirror/state'
import { keymap } from '@codemirror/view'
import type { Parser } from '@lezer/common'
import { parseCode, type MarkdownParser } from '@lezer/markdown'
import { codeLanguages } from './codeLanguages'
import { formattingKeymap } from './formatting'
import { livePreview } from './livePreview'

/**
 * The parser for a fenced code block, by the language named in its info string (```` ```js ````).
 * Languages load on first use: until then the block is skipped, and parsed again once it arrives.
 */
const codeParser = (info: string): Parser | null => {
  const [name] = info.split(/\s/, 1)
  const description = name ? LanguageDescription.matchLanguageName(codeLanguages, name, true) : null
  if (!description) return null
  return description.support?.language.parser ?? ParseContext.getSkippingParser(description.load())
}

// `markdownLanguage` is built on a Markdown parser, though typed as any parser.
const parser = (markdownLanguage.parser as MarkdownParser).configure(parseCode({ codeParser }))

/**
 * GitHub Flavored Markdown, as `markdownLanguage`, with code blocks parsed in their own language.
 * It shares `markdownLanguage`'s language data, so the Markdown commands recognise it. `markdown()`
 * would do the same, but always bundles the HTML, CSS and JavaScript languages.
 */
const markdownWithCode = new Language(markdownLanguage.data, parser, [], 'markdown')

const editing = [
  // Continues lists and blockquotes on Enter, and removes their markup on Backspace; formatting
  // shortcuts. High precedence, as they replace some default bindings.
  Prec.high(keymap.of([...markdownKeymap, ...formattingKeymap])),
  pasteURLAsLink,
]

/** Markdown support: the language, its editing commands and live rendering. */
export const markdownSupport = new LanguageSupport(markdownWithCode, [editing, livePreview])

/** Markdown support without live rendering, which shows the Markdown as written (highlighted). */
export const markdownSourceSupport = new LanguageSupport(markdownWithCode, editing)
