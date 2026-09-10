import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { markdownKeymap, markdownLanguage, pasteURLAsLink } from '@codemirror/lang-markdown'
import { LanguageSupport } from '@codemirror/language'
import { Prec, type Extension } from '@codemirror/state'
import {
  drawSelection,
  dropCursor,
  EditorView,
  highlightSpecialChars,
  keymap,
  placeholder,
} from '@codemirror/view'
import { theme } from './theme'

/**
 * GitHub Flavored Markdown support, composed from the parts of `markdown()` that the editor uses.
 * `markdown()` itself always bundles the HTML, CSS and JavaScript languages to parse embedded HTML,
 * which adds about 50% to the bundle size.
 */
const markdownSupport = new LanguageSupport(markdownLanguage, [
  // Continues lists and blockquotes on Enter, and removes their markup on Backspace.
  Prec.high(keymap.of(markdownKeymap)),
  pasteURLAsLink,
])

/** Plain text needs no language extensions. */
const plainText: Extension = []

const markdownFileName = /\.(?:md|markdown)$/i

/** The language for a file, by its extension: Markdown or plain text. */
export const languageFor = (fileName: string): Extension =>
  markdownFileName.test(fileName) ? markdownSupport : plainText

/**
 * The editor's extensions, apart from the language: a small, hand-picked alternative to
 * CodeMirror's `basicSetup`, which targets code editing (line numbers, fold gutters, …) rather than
 * writing prose.
 */
export const editorExtensions: Extension = [
  history(),
  drawSelection(),
  dropCursor(),
  highlightSpecialChars(),
  EditorView.lineWrapping,
  EditorView.contentAttributes.of({ 'aria-label': 'Document', spellcheck: 'true' }),
  placeholder('Start writing…'),
  // Tab indents instead of moving focus; press Escape then Tab to leave the editor with the keyboard.
  keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
  theme,
]
