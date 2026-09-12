import { isMarkdownName } from '$lib/files/fileTypes'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import {
  closeSearchPanel,
  findNext,
  findPrevious,
  openSearchPanel,
  search,
} from '@codemirror/search'
import { EditorState, type Extension } from '@codemirror/state'
import {
  drawSelection,
  dropCursor,
  EditorView,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  placeholder,
} from '@codemirror/view'
import { markdownSourceSupport, markdownSupport } from './markdown/language'
import { appearanceTheme, theme, type Appearance } from './theme'

/** Plain text needs no language extensions. */
const plainText: Extension = []

/**
 * The language for a file, by its extension: Markdown, rendered live unless `livePreview` is off,
 * or plain text.
 */
export const languageFor = (fileName: string, livePreview = true): Extension => {
  if (!isMarkdownName(fileName)) return plainText
  return livePreview ? markdownSupport : markdownSourceSupport
}

/** Line numbers, with the cursor's highlighted. The class makes room for them (see `theme.ts`). */
const numberedLines: Extension = [
  lineNumbers(),
  highlightActiveLineGutter(),
  EditorView.editorAttributes.of({ class: 'cm-numbered' }),
]

const spellchecked = EditorView.contentAttributes.of({ spellcheck: 'true' })
const notSpellchecked = EditorView.contentAttributes.of({ spellcheck: 'false' })

/** The extensions that show the text as `appearance` has it. */
export const appearanceExtensions = (appearance: Appearance): Extension => [
  appearanceTheme(appearance),
  appearance.lineNumbers ? numberedLines : [],
  appearance.spellcheck ? spellchecked : notSpellchecked,
]

/** Find and replace, in a panel above the text. */
const findAndReplace: Extension = [
  search({ top: true }),
  // `searchKeymap`, without its multiple-selection commands (the editor has a single selection) and
  // go to line, which suits code more than prose.
  keymap.of([
    { key: 'Mod-f', run: openSearchPanel, scope: 'editor search-panel' },
    { key: 'F3', run: findNext, shift: findPrevious, scope: 'editor search-panel' },
    { key: 'Mod-g', run: findNext, shift: findPrevious, scope: 'editor search-panel' },
    { key: 'Escape', run: closeSearchPanel, scope: 'editor search-panel' },
  ]),
  // The panel's labels, in sentence case like the rest of the UI.
  EditorState.phrases.of({
    next: 'Next',
    previous: 'Previous',
    'match case': 'Match case',
    regexp: 'Regex',
    'by word': 'Whole word',
    replace: 'Replace',
    'replace all': 'Replace all',
  }),
]

/**
 * The editor's extensions, apart from the language: a small, hand-picked alternative to
 * CodeMirror's `basicSetup`, which targets code editing (fold gutters, bracket matching, …) rather
 * than writing prose. Line numbers are optional, with the appearance.
 */
export const editorExtensions: Extension = [
  history(),
  drawSelection(),
  dropCursor(),
  highlightSpecialChars(),
  EditorView.lineWrapping,
  EditorView.contentAttributes.of({ 'aria-label': 'Document' }),
  placeholder('Start writing…'),
  // Tab indents instead of moving focus; press Escape then Tab to leave the editor with the keyboard.
  keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
  findAndReplace,
  theme,
]
