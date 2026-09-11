import { syntaxTree } from '@codemirror/language'
import type { EditorSelection, EditorState, Extension, Range } from '@codemirror/state'
import {
  Decoration,
  EditorView,
  keymap,
  ViewPlugin,
  WidgetType,
  type Command,
  type DecorationSet,
  type ViewUpdate,
} from '@codemirror/view'
import type { SyntaxNode, Tree } from '@lezer/common'

/** Hides markup. Shared, as every hidden range looks the same. */
const hidden = Decoration.replace({})
const linkText = Decoration.mark({ class: 'cm-link' })
const inlineCode = Decoration.mark({ class: 'cm-inlineCode' })

/** Shows an HTML entity, such as `&amp;`, as the character it stands for. */
class EntityWidget extends WidgetType {
  readonly entity: string

  constructor(entity: string) {
    super()
    this.entity = entity
  }

  override eq(other: EntityWidget): boolean {
    return other.entity === this.entity
  }

  toDOM(): HTMLElement {
    const span = document.createElement('span')
    // Safe as HTML: the parser only accepts `&name;`, `&#digits;` and `&#xhex;` as entities.
    span.innerHTML = this.entity
    return span
  }
}

/** Nodes whose `URL` child belongs to them, rather than being a bare URL in the text. */
const urlOwners = new Set(['Link', 'Image', 'Autolink', 'LinkReference'])

/** Block nodes that can contain link reference definitions. */
const referenceContainers = new Set([
  'Document',
  'Blockquote',
  'BulletList',
  'OrderedList',
  'ListItem',
])

const referenceCache = new WeakMap<Tree, Map<string, string>>()

/** Link reference labels match case-insensitively, with runs of whitespace collapsed. */
const normalizeLabel = (label: string): string => label.trim().replace(/\s+/g, ' ').toLowerCase()

/** Removes the angle brackets that may enclose a link destination. */
const destination = (url: string): string => url.replace(/^<(.*)>$/, '$1')

/** The URL an autolink or bare URL points to: GFM links `www.` hosts and email addresses too. */
const autolinkTarget = (url: string): string => {
  if (/^www\./i.test(url)) return `https://${url}`
  if (!/^[a-z][\w+.-]*:/i.test(url) && url.includes('@')) return `mailto:${url}`
  return url
}

/** The document's link reference definitions (`[label]: url`), by normalized label. */
const references = (state: EditorState): Map<string, string> => {
  const tree = syntaxTree(state)
  const cached = referenceCache.get(tree)
  if (cached) return cached

  const definitions = new Map<string, string>()
  tree.iterate({
    enter: (node) => {
      if (node.name === 'LinkReference') {
        const label = node.node.getChild('LinkLabel')
        const url = node.node.getChild('URL')
        const key = label && normalizeLabel(state.sliceDoc(label.from + 1, label.to - 1))
        // The first definition of a label wins.
        if (key && url && !definitions.has(key)) {
          definitions.set(key, destination(state.sliceDoc(url.from, url.to)))
        }
      }
      return referenceContainers.has(node.name)
    },
  })
  referenceCache.set(tree, definitions)
  return definitions
}

/**
 * The URL a `Link`, `Autolink` or bare `URL` node points to. Undefined for reference links whose
 * label is not defined, as Markdown shows those as plain text.
 */
const linkTarget = (state: EditorState, node: SyntaxNode): string | undefined => {
  const text = (from: number, to: number): string => state.sliceDoc(from, to)
  switch (node.name) {
    case 'Link': {
      const [open, close, paren] = node.getChildren('LinkMark')
      if (!open || !close) return undefined
      // Inline link: `[text](url)`, where the destination may be empty.
      if (paren) {
        const url = node.getChild('URL')
        return url ? destination(text(url.from, url.to)) : ''
      }
      // Reference link: `[text][label]`, or `[text][]` and `[text]`, which use the text as label.
      const label = node.getChild('LinkLabel')
      const key =
        label && label.to - label.from > 2
          ? text(label.from + 1, label.to - 1)
          : text(open.to, close.from)
      return references(state).get(normalizeLabel(key))
    }
    case 'Autolink': {
      const url = node.getChild('URL')
      return url ? autolinkTarget(text(url.from, url.to)) : undefined
    }
    case 'URL':
      return urlOwners.has(node.parent?.name ?? '')
        ? undefined
        : autolinkTarget(text(node.from, node.to))
    default:
      return undefined
  }
}

/**
 * The URL of the link at `pos`, if any. `side` picks the link that starts (1) or ends (-1) at
 * `pos` when it sits on a link's edge.
 */
export const linkAt = (state: EditorState, pos: number, side: -1 | 1 = 1): string | undefined => {
  for (
    let node: SyntaxNode | null = syntaxTree(state).resolveInner(pos, side);
    node;
    node = node.parent
  ) {
    const url = linkTarget(state, node)
    if (url !== undefined) return url
  }
  return undefined
}

/** Opens web and email links in a new tab. Others, such as relative paths, have no target yet. */
const openLink = (url: string | undefined): boolean => {
  if (!url || !/^(?:https?|mailto):/i.test(url)) return false
  window.open(url, '_blank', 'noopener,noreferrer')
  return true
}

/** Opens the link at the cursor. */
const openLinkAtCursor: Command = (view) => {
  const { head } = view.state.selection.main
  return openLink(linkAt(view.state, head, 1) ?? linkAt(view.state, head, -1))
}

/** Whether any selection range overlaps or touches `from`–`to`. */
const touches = (selection: EditorSelection, from: number, to: number): boolean =>
  selection.ranges.some((range) => range.from <= to && range.to >= from)

/**
 * Decorations that render the inline Markdown in `ranges` in place: markup is hidden, except in
 * elements the selection touches, so that it can still be edited.
 */
export const inlineDecorations = (
  state: EditorState,
  ranges: readonly { from: number; to: number }[],
): DecorationSet => {
  const { doc, selection } = state
  const decorations: Range<Decoration>[] = []
  const hide = (from: number, to: number): void => {
    // View plugins may not replace line breaks, and markup never needs to.
    if (from < to && doc.lineAt(from).to >= to) decorations.push(hidden.range(from, to))
  }
  const hideMarks = (node: SyntaxNode, mark: string): void => {
    for (const child of node.getChildren(mark)) hide(child.from, child.to)
  }

  for (const { from, to } of ranges) {
    syntaxTree(state).iterate({
      from,
      to,
      enter: (ref) => {
        const node = ref.node
        const revealed = touches(selection, node.from, node.to)
        switch (node.name) {
          case 'ATXHeading1':
          case 'ATXHeading2':
          case 'ATXHeading3':
          case 'ATXHeading4':
          case 'ATXHeading5':
          case 'ATXHeading6': {
            if (revealed) break
            // The opening `#`s with the space after them, and optional closing `#`s with the space
            // before them.
            let hiddenTo = node.from
            for (const mark of node.getChildren('HeaderMark')) {
              if (mark.from === node.from) {
                const after = doc.sliceString(mark.to, node.to)
                hiddenTo = mark.to + after.length - after.trimStart().length
                hide(mark.from, hiddenTo)
              } else {
                const before = doc.sliceString(hiddenTo, mark.from)
                hide(hiddenTo + before.trimEnd().length, mark.to)
              }
            }
            break
          }
          case 'Emphasis':
          case 'StrongEmphasis':
            if (!revealed) hideMarks(node, 'EmphasisMark')
            break
          case 'Strikethrough':
            if (!revealed) hideMarks(node, 'StrikethroughMark')
            break
          case 'InlineCode':
            decorations.push(inlineCode.range(node.from, node.to))
            if (!revealed) hideMarks(node, 'CodeMark')
            return false
          case 'Link': {
            const [open, close] = node.getChildren('LinkMark')
            // Empty or undefined links stay as written, as there would be nothing to show.
            if (
              !open ||
              !close ||
              open.to === close.from ||
              linkTarget(state, node) === undefined
            ) {
              break
            }
            decorations.push(linkText.range(open.to, close.from))
            if (!revealed) {
              hide(node.from, open.to)
              hide(close.from, node.to)
            }
            break
          }
          case 'Autolink': {
            const url = node.getChild('URL')
            if (url) decorations.push(linkText.range(url.from, url.to))
            if (!revealed) hideMarks(node, 'LinkMark')
            return false
          }
          case 'URL':
            if (!urlOwners.has(node.parent?.name ?? '')) {
              decorations.push(linkText.range(node.from, node.to))
            }
            break
          case 'Escape':
            if (!revealed) hide(node.from, node.from + 1)
            break
          case 'Entity':
            if (!revealed) {
              const widget = new EntityWidget(doc.sliceString(node.from, node.to))
              decorations.push(Decoration.replace({ widget }).range(node.from, node.to))
            }
            break
          // Images render as blocks, and definitions stay as written.
          case 'Image':
          case 'LinkReference':
            return false
        }
        return undefined
      },
    })
  }
  return Decoration.set(decorations, true)
}

const livePreviewPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet

    constructor(view: EditorView) {
      this.decorations = inlineDecorations(view.state, view.visibleRanges)
    }

    update(update: ViewUpdate): void {
      if (
        update.docChanged ||
        update.selectionSet ||
        update.viewportChanged ||
        // The parser works in the background, so more of the tree can become available later.
        syntaxTree(update.startState) !== syntaxTree(update.state)
      ) {
        this.decorations = inlineDecorations(update.state, update.view.visibleRanges)
      }
    }
  },
  { decorations: (plugin) => plugin.decorations },
)

/**
 * Live Markdown rendering of inline elements: headings, emphasis, strikethrough, inline code,
 * links, escapes and entities. ⌘/Ctrl+click or Alt+Enter opens a link.
 */
export const livePreview: Extension = [
  livePreviewPlugin,
  keymap.of([{ key: 'Alt-Enter', run: openLinkAtCursor }]),
  EditorView.domEventHandlers({
    mousedown: (event, view) => {
      if (event.button !== 0 || !(event.metaKey || event.ctrlKey)) return false
      const link = event.target instanceof Element ? event.target.closest('.cm-link') : null
      // The start of the clicked link's text maps to a position inside the link.
      return link !== null && openLink(linkAt(view.state, view.posAtDOM(link)))
    },
  }),
]
