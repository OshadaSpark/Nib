import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import type { Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { tags } from '@lezer/highlight'

/** Maximum width of the text column. */
const contentWidth = '72ch'

// Colours reference the custom properties in `app.css`, which resolve per colour scheme, so a
// single theme serves both light and dark mode.
const editorTheme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '1.0625rem',
    color: 'var(--color-text)',
    backgroundColor: 'var(--color-bg)',
  },
  '&.cm-focused': {
    outline: 'none',
  },
  '.cm-scroller': {
    fontFamily: 'inherit',
    lineHeight: '1.7',
  },
  '.cm-content': {
    paddingBlock: 'clamp(2rem, 10vh, 6rem)',
  },
  '.cm-line': {
    // Centres the text column with padding rather than margins, so the whole width stays clickable.
    // It is set on lines rather than the content, as selections span the line's padding box.
    paddingInline: `max(1.5rem, (100% - ${contentWidth}) / 2)`,
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: 'var(--color-accent)',
  },
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground':
    {
      backgroundColor: 'var(--color-selection)',
    },
  '.cm-placeholder': {
    color: 'var(--color-muted)',
  },
  // Rendered Markdown, from the live preview.
  '.cm-link': {
    textDecoration: 'underline',
    textDecorationColor: 'color-mix(in srgb, currentColor 40%, transparent)',
    textUnderlineOffset: '0.2em',
  },
  '.cm-inlineCode': {
    paddingInline: '0.2em',
    borderRadius: '0.25em',
    backgroundColor: 'var(--color-code-bg)',
    // Rounds and pads each line of code that wraps, not only its ends.
    boxDecorationBreak: 'clone',
  },
})

const highlightStyle = HighlightStyle.define([
  { tag: tags.heading1, fontSize: '1.75em', fontWeight: '700' },
  { tag: tags.heading2, fontSize: '1.4em', fontWeight: '700' },
  { tag: tags.heading3, fontSize: '1.2em', fontWeight: '600' },
  { tag: tags.heading4, fontSize: '1.1em', fontWeight: '600' },
  { tag: tags.heading6, fontSize: '0.9em', fontWeight: '600' },
  // Parent of all heading levels, so this applies to the levels without a rule of their own.
  { tag: tags.heading, fontWeight: '600' },
  { tag: tags.strong, fontWeight: '700' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: [tags.link, tags.url], color: 'var(--color-accent)' },
  { tag: tags.monospace, fontFamily: 'var(--font-mono)', fontSize: '0.9em' },
  // Markup characters (`#`, `*`, `>`, …) and other secondary syntax recede into the background.
  {
    tag: [
      tags.processingInstruction,
      tags.labelName,
      tags.quote,
      tags.contentSeparator,
      tags.comment,
    ],
    color: 'var(--color-muted)',
  },
])

/** Editor appearance: layout, chrome and syntax highlighting. */
export const theme: Extension = [editorTheme, syntaxHighlighting(highlightStyle)]
