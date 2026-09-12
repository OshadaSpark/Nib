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
  highlightSpecialChars,
  keymap,
  placeholder,
} from '@codemirror/view'
import { markdownSupport } from './markdown/language'
import { theme } from './theme'

/** Plain text needs no language extensions. */
const plainText: Extension = []

const markdownFileName = /\.(?:md|markdown)$/i

/** The language for a file, by its extension: Markdown or plain text. */
export const languageFor = (fileName: string): Extension =>
  markdownFileName.test(fileName) ? markdownSupport : plainText

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
    close: 'Close',
  }),
]

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
  findAndReplace,
  theme,
]
