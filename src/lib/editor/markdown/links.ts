import { syntaxTree } from '@codemirror/language'
import type { EditorState } from '@codemirror/state'
import type { SyntaxNode, Tree } from '@lezer/common'

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
 * The destination of a `Link` or `Image` node. Undefined for reference links whose label is not
 * defined, as Markdown shows those as plain text.
 */
export const destinationOf = (state: EditorState, node: SyntaxNode): string | undefined => {
  const [open, close, paren] = node.getChildren('LinkMark')
  if (!open || !close) return undefined
  // Inline: `[text](url)`, where the destination may be empty.
  if (paren) {
    const url = node.getChild('URL')
    return url ? destination(state.sliceDoc(url.from, url.to)) : ''
  }
  // Reference: `[text][label]`, or `[text][]` and `[text]`, which use the text as label.
  const label = node.getChild('LinkLabel')
  const key =
    label && label.to - label.from > 2
      ? state.sliceDoc(label.from + 1, label.to - 1)
      : state.sliceDoc(open.to, close.from)
  return references(state).get(normalizeLabel(key))
}

/**
 * The URL a `Link`, `Autolink` or bare `URL` node points to, or undefined for other nodes and
 * undefined references.
 */
export const linkTarget = (state: EditorState, node: SyntaxNode): string | undefined => {
  switch (node.name) {
    case 'Link':
      return destinationOf(state, node)
    case 'Autolink': {
      const url = node.getChild('URL')
      return url ? autolinkTarget(state.sliceDoc(url.from, url.to)) : undefined
    }
    case 'URL':
      return urlOwners.has(node.parent?.name ?? '')
        ? undefined
        : autolinkTarget(state.sliceDoc(node.from, node.to))
    default:
      return undefined
  }
}

/**
 * The URL of the link at `pos`, if any. `side` picks the link that starts (1) or ends (-1) at
 * `pos` when it sits on a link's edge. Links in code blocks don't count.
 */
export const linkAt = (state: EditorState, pos: number, side: -1 | 1 = 1): string | undefined => {
  // `resolve` rather than `resolveInner`, so as not to enter the trees of code blocks' languages.
  for (
    let node: SyntaxNode | null = syntaxTree(state).resolve(pos, side);
    node;
    node = node.parent
  ) {
    const url = linkTarget(state, node)
    if (url !== undefined) return url
  }
  return undefined
}

/** Opens web and email links in a new tab. Others, such as relative paths, have no target yet. */
export const openLink = (url: string | undefined): boolean => {
  if (!url || !/^(?:https?|mailto):/i.test(url)) return false
  window.open(url, '_blank', 'noopener,noreferrer')
  return true
}

/** Whether an image can be shown: web and data URLs only, until relative paths resolve. */
export const isShowableImage = (src: string): boolean => /^(?:https?:|data:image\/)/i.test(src)
