import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import type { Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { tagHighlighter, tags } from '@lezer/highlight'

/** How the editor shows the text: font family, size and column width as CSS values, and more. */
export interface Appearance {
  font: string
  size: string
  width: string
  /** Line numbers in a gutter beside the text column. */
  lineNumbers: boolean
  /** Whether the browser marks misspelt words. */
  spellcheck: boolean
}

/**
 * Sets the custom properties the theme reads the text's font, size and column width from. It is a
 * theme of its own, so that changing it makes the editor measure the text again.
 */
export const appearanceTheme = ({ font, size, width }: Appearance): Extension =>
  EditorView.theme({
    '&': { '--editor-font': font, '--editor-size': size, '--editor-width': width },
  })

/** Maximum width of the text column. */
const contentWidth = 'var(--editor-width, 72ch)'

/**
 * Space on either side of the text column, which centres it in an element as wide as the editor,
 * such as the search panel.
 */
const centringInset = `max(1.5rem, (100% - ${contentWidth}) / 2)`

/**
 * Space before and after the text column in lines. Also valid in elements as wide as a line, such
 * as block widgets and lines' positioned pseudo-elements: the variables are resolved where they are
 * used, where `100%` is the line's width. With line numbers, the gutter takes the space before.
 */
const insetStart = 'var(--line-inset-start)'
const insetEnd = 'var(--line-inset-end)'

/** Space between the line numbers and the text. */
const gutterGap = '1rem'

/** Radius of the corners of blocks, such as code blocks, images and tables. */
const radius = '0.375rem'

/** Code in the text: in its own font, a little smaller, as monospace fonts look larger. */
const codeFont = { fontFamily: 'var(--font-mono)', fontSize: '0.9em' }

/** Inline code, in the text and in tables. */
const codeSpan = {
  ...codeFont,
  paddingInline: '0.2em',
  borderRadius: '0.25em',
  backgroundColor: 'var(--color-code-bg)',
}

/** Block widgets, which span the line and align their content with the text column. */
const blockWidget = {
  paddingInlineStart: insetStart,
  paddingInlineEnd: insetEnd,
  paddingBlock: '0.5rem',
}

// Colours reference the custom properties in `app.css`, which resolve per colour scheme, so a
// single theme serves both light and dark mode.
const editorTheme = EditorView.theme({
  '&': {
    '--line-inset-start': centringInset,
    '--line-inset-end': centringInset,
    height: '100%',
    fontSize: 'var(--editor-size, 1.0625rem)',
    color: 'var(--color-text)',
    backgroundColor: 'var(--color-bg)',
  },
  // The gutter fills the space before the text column, so that the numbers sit beside the text,
  // which stays where it was. `100%` is the editor's width in the gutter and the line's in lines.
  '&.cm-numbered': {
    '--line-inset-start': gutterGap,
    '--line-inset-end': `max(1.5rem, 100% - ${contentWidth} - ${gutterGap})`,
  },
  '.cm-gutters': {
    inlineSize: `max(2.5rem, (100% - ${contentWidth}) / 2 - ${gutterGap})`,
    border: 'none',
    color: 'var(--color-muted)',
    backgroundColor: 'var(--color-bg)',
  },
  '.cm-lineNumbers': {
    flex: '1',
  },
  // Smaller than the text, on its first line's baseline: the line height makes up for the size.
  '.cm-lineNumbers .cm-gutterElement': {
    paddingInline: '0',
    fontSize: '0.8em',
    lineHeight: 'calc(1.7em / 0.8)',
    fontVariantNumeric: 'tabular-nums',
  },
  '.cm-activeLineGutter': {
    color: 'var(--color-subtle)',
    backgroundColor: 'transparent',
  },
  '&.cm-focused': {
    outline: 'none',
  },
  '.cm-scroller': {
    fontFamily: 'var(--editor-font, inherit)',
    lineHeight: '1.7',
  },
  '.cm-content': {
    paddingBlock: 'clamp(2rem, 10vh, 6rem)',
  },
  '.cm-line': {
    // Centres the text column with padding rather than margins, so the whole width stays clickable.
    // It is set on lines rather than the content, as selections span the line's padding box.
    paddingInlineStart: insetStart,
    paddingInlineEnd: insetEnd,
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
  // The find and replace panel, aligned with the text column. The panel keeps the text's font and
  // size, so that `ch` in its inset resolves the same as in lines, and styles its controls instead.
  '.cm-panels': {
    color: 'var(--color-muted)',
    backgroundColor: 'var(--color-bg)',
  },
  '.cm-panels-top': {
    borderBlockEnd: '1px solid var(--color-border)',
  },
  '.cm-panel.cm-search': {
    fontFamily: 'var(--editor-font, inherit)',
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '0.375rem',
    paddingBlock: '0.5rem',
    paddingInline: centringInset,
    '& input, & button, & label': {
      margin: '0',
      fontFamily: 'var(--font-sans)',
      fontSize: '0.875rem',
    },
    // Line break before the replace controls, which wraps them instead. "All" selects every match,
    // which needs multiple selections.
    '& br, & [name=select]': {
      display: 'none',
    },
    // Moves the replace controls to a second row: this full-width item comes between the rows.
    '&::before': {
      content: '""',
      order: '1',
      flexBasis: '100%',
    },
    '& [name=replace], & [name=replaceAll]': {
      order: '2',
    },
    '& [name=close]': {
      position: 'static',
      marginInlineStart: 'auto',
      paddingInline: '0.5rem',
      fontSize: '1.125rem',
      lineHeight: '1.25',
    },
    '& label': {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.25rem',
      paddingInline: '0.25rem',
    },
    '& input[type=checkbox]': {
      margin: '0',
      accentColor: 'var(--color-accent)',
    },
  },
  '.cm-textfield': {
    // Grows to fill the row on narrow screens.
    flex: '1 1 10rem',
    maxInlineSize: '16rem',
    paddingBlock: '0.25rem',
    paddingInline: '0.5rem',
    border: '1px solid var(--color-border)',
    borderRadius: radius,
    color: 'var(--color-text)',
    backgroundColor: 'transparent',
    '&:focus-visible': {
      outline: '2px solid var(--color-accent)',
      outlineOffset: '-1px',
    },
  },
  // Text buttons, as in the header (see `app.css`), in place of the base theme's gradients.
  '.cm-button, .cm-button:active': {
    paddingBlock: '0.25rem',
    paddingInline: '0.625rem',
    border: 'none',
    borderRadius: radius,
    backgroundImage: 'none',
  },
  '.cm-searchMatch': {
    backgroundColor: 'var(--color-match)',
  },
  '.cm-searchMatch-selected': {
    backgroundColor: 'var(--color-match-current)',
  },
  // Rendered Markdown, from the live preview.
  '.cm-link': {
    textDecoration: 'underline',
    textDecorationColor: 'color-mix(in srgb, currentColor 40%, transparent)',
    textUnderlineOffset: '0.2em',
  },
  '.cm-inlineCode': {
    ...codeSpan,
    // Rounds and pads each line of code that wraps, not only its ends.
    boxDecorationBreak: 'clone',
  },
  '.cm-bullet': {
    color: 'var(--color-muted)',
  },
  '.cm-taskCheckbox': {
    inlineSize: '1em',
    blockSize: '1em',
    margin: '0',
    verticalAlign: '-0.125em',
    accentColor: 'var(--color-accent)',
    cursor: 'pointer',
  },
  '.cm-taskDone': {
    color: 'var(--color-muted)',
    textDecoration: 'line-through',
  },
  // One bar per level of nesting, in the gutter before the quote's text.
  '.cm-quote': {
    position: 'relative',
    paddingInlineStart: `calc(${insetStart} + var(--quote-depth) * 1rem)`,
  },
  '.cm-quote::before': {
    content: '""',
    position: 'absolute',
    insetBlock: '0',
    insetInlineStart: insetStart,
    inlineSize: 'calc(var(--quote-depth) * 1rem - 0.8125rem)',
    background:
      'repeating-linear-gradient(to right, var(--color-border) 0 0.1875rem, transparent 0.1875rem 1rem)',
  },
  '.cm-rule': {
    position: 'relative',
  },
  '.cm-rule::after': {
    content: '""',
    position: 'absolute',
    insetInlineStart: insetStart,
    insetInlineEnd: insetEnd,
    insetBlockStart: '50%',
    borderBlockStart: '1px solid var(--color-border)',
  },
  // A background behind each line, slightly wider than the text column. It sits below the
  // selection, which CodeMirror draws in layers at small negative z-indexes.
  '.cm-codeBlock': {
    position: 'relative',
    // Tokens of code blocks' languages, from `codeHighlighter`.
    '& .tok-keyword': { color: 'var(--color-syntax-keyword)' },
    '& .tok-string': { color: 'var(--color-syntax-string)' },
    '& .tok-literal': { color: 'var(--color-syntax-literal)' },
    '& .tok-function': { color: 'var(--color-syntax-function)' },
    '& .tok-type': { color: 'var(--color-syntax-type)' },
    '& .tok-meta': { color: 'var(--color-muted)' },
    '& .tok-invalid': { color: 'var(--color-danger)' },
  },
  '.cm-codeBlock::before': {
    content: '""',
    position: 'absolute',
    zIndex: '-10',
    insetBlock: '0',
    insetInlineStart: `calc(${insetStart} - 0.75rem)`,
    insetInlineEnd: `calc(${insetEnd} - 0.75rem)`,
    backgroundColor: 'var(--color-code-bg)',
  },
  // Line height rather than font size, which would change the `ch` in the line's inset.
  '.cm-codeFence': {
    lineHeight: '1',
  },
  '.cm-codeBlock-first::before': {
    borderStartStartRadius: radius,
    borderStartEndRadius: radius,
  },
  '.cm-codeBlock-last::before': {
    borderEndStartRadius: radius,
    borderEndEndRadius: radius,
  },
  '.cm-codeText': codeFont,
  '.cm-image': blockWidget,
  '.cm-image img': {
    display: 'block',
    maxInlineSize: '100%',
    maxBlockSize: '32rem',
    borderRadius: radius,
  },
  '.cm-table': {
    ...blockWidget,
    overflowX: 'auto',
    lineHeight: '1.5',
    cursor: 'text',
  },
  '.cm-table table': {
    borderCollapse: 'collapse',
  },
  '.cm-table th, .cm-table td': {
    paddingBlock: '0.375rem',
    paddingInline: '0.75rem',
    border: '1px solid var(--color-border)',
    verticalAlign: 'top',
  },
  '.cm-table th': {
    fontWeight: '600',
    backgroundColor: 'var(--color-code-bg)',
  },
  '.cm-table code': codeSpan,
  '.cm-table img': {
    maxInlineSize: '100%',
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

/**
 * Classes for the tokens of code blocks' languages. They are only coloured in code blocks (see
 * `.cm-codeBlock` above), so Markdown tokens sharing a tag, such as link titles, stay as they are.
 */
const codeHighlighter = tagHighlighter([
  { tag: tags.keyword, class: 'tok-keyword' },
  { tag: [tags.string, tags.regexp], class: 'tok-string' },
  { tag: [tags.number, tags.bool, tags.null, tags.atom], class: 'tok-literal' },
  {
    tag: [tags.function(tags.variableName), tags.function(tags.propertyName)],
    class: 'tok-function',
  },
  { tag: [tags.typeName, tags.className, tags.namespace, tags.tagName], class: 'tok-type' },
  { tag: tags.meta, class: 'tok-meta' },
  { tag: tags.invalid, class: 'tok-invalid' },
])

/** Editor appearance: layout, chrome, rendered Markdown and syntax highlighting. */
export const theme: Extension = [
  editorTheme,
  syntaxHighlighting(highlightStyle),
  syntaxHighlighting(codeHighlighter),
]
