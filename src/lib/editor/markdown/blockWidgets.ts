import { syntaxTree } from '@codemirror/language'
import { StateField, type EditorState, type Range } from '@codemirror/state'
import { Decoration, EditorView, type DecorationSet } from '@codemirror/view'
import type { SyntaxNode, Tree } from '@lezer/common'
import { touches } from './decorations'
import { destinationOf, isShowableImage, linkTarget } from './links'
import { ImageWidget, TableWidget, type Inline, type Table, type TableCell } from './widgets'

interface Blocks {
  images: Range<Decoration>[]
  /** Tables, extended to whole lines, as block replacements must be. */
  tables: { from: number; to: number; widget: TableWidget }[]
}

const blocksCache = new WeakMap<Tree, Blocks>()

/** The inline content of `parent` between `from` and `to`, leaving out markup outside that range. */
const inlineContent = (
  state: EditorState,
  parent: SyntaxNode,
  from: number,
  to: number,
): Inline[] => {
  const content: Inline[] = []
  let pos = from
  for (let child = parent.firstChild; child; child = child.nextSibling) {
    if (child.from < from || child.to > to) continue
    if (child.from > pos) content.push(state.sliceDoc(pos, child.from))
    content.push(inlineElement(state, child))
    pos = child.to
  }
  if (pos < to) content.push(state.sliceDoc(pos, to))
  return content
}

/** The content of an element between its opening and closing marks. */
const markedContent = (state: EditorState, node: SyntaxNode, mark: string): Inline[] => {
  const marks = node.getChildren(mark)
  const open = marks[0]
  const close = marks.length > 1 ? marks.at(-1) : undefined
  return inlineContent(state, node, open?.to ?? node.from, close?.from ?? node.to)
}

const inlineElement = (state: EditorState, node: SyntaxNode): Inline => {
  const text = state.sliceDoc(node.from, node.to)
  switch (node.name) {
    case 'StrongEmphasis':
      return { type: 'strong', children: markedContent(state, node, 'EmphasisMark') }
    case 'Emphasis':
      return { type: 'em', children: markedContent(state, node, 'EmphasisMark') }
    case 'Strikethrough':
      return { type: 's', children: markedContent(state, node, 'StrikethroughMark') }
    case 'InlineCode':
      return { type: 'code', children: markedContent(state, node, 'CodeMark') }
    case 'Link': {
      const url = destinationOf(state, node)
      const [open, close] = node.getChildren('LinkMark')
      if (url === undefined || !open || !close) return text
      return { type: 'link', url, children: inlineContent(state, node, open.to, close.from) }
    }
    case 'Autolink':
    case 'URL': {
      const url = linkTarget(state, node)
      const shown = node.getChild('URL') ?? node
      return url === undefined
        ? text
        : { type: 'link', url, children: [state.sliceDoc(shown.from, shown.to)] }
    }
    case 'Image': {
      const src = destinationOf(state, node)
      const [open, close] = node.getChildren('LinkMark')
      if (src === undefined || !open || !close) return text
      return { type: 'image', src, alt: state.sliceDoc(open.to, close.from) }
    }
    case 'Escape':
      return text.slice(1)
    case 'Entity':
      return { type: 'entity', entity: text }
    default:
      return text
  }
}

/** Column alignments, from a delimiter row such as `| :-- | :-: | --: |`. */
const alignments = (delimiterRow: string): Table['align'] =>
  delimiterRow
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((cell) => {
      const dashes = cell.trim()
      if (dashes.startsWith(':')) return dashes.endsWith(':') ? 'center' : 'left'
      return dashes.endsWith(':') ? 'right' : null
    })

/** A row's cells, including empty ones, which the parser has no nodes for. */
const rowCells = (state: EditorState, row: SyntaxNode, tableFrom: number): TableCell[] => {
  const cells: TableCell[] = []
  let start = row.from
  let cell: SyntaxNode | null = null
  const addCell = (): void => {
    cells.push(
      cell
        ? { offset: cell.from - tableFrom, content: inlineContent(state, cell, cell.from, cell.to) }
        : { offset: start - tableFrom, content: [] },
    )
  }
  for (let child = row.firstChild; child; child = child.nextSibling) {
    if (child.name === 'TableCell') {
      cell = child
    } else if (child.name === 'TableDelimiter') {
      // A leading pipe opens the first cell rather than closing one.
      if (child.from > row.from) addCell()
      start = child.to
      cell = null
    }
  }
  // The last cell, unless the row ends with a pipe.
  if (cell || state.sliceDoc(start, row.to).trim()) addCell()
  return cells
}

const tableModel = (state: EditorState, node: SyntaxNode, from: number): Table => {
  const rows = node.getChildren('TableHeader').concat(node.getChildren('TableRow'))
  const cells = rows.map((row) => rowCells(state, row, from))
  const delimiter = node.getChild('TableDelimiter')
  const align = alignments(delimiter ? state.sliceDoc(delimiter.from, delimiter.to) : '')
  return { align: (cells[0] ?? []).map((_, column) => align[column] ?? null), rows: cells }
}

/** The image starting at `pos`, unless it is in a table, which shows its own images. */
const imageAt = (tree: Tree, pos: number): SyntaxNode | null => {
  // `resolve` rather than `resolveInner`, so as not to enter the trees of code blocks' languages.
  let image: SyntaxNode | null = null
  for (let node: SyntaxNode | null = tree.resolve(pos, 1); node; node = node.parent) {
    if (node.name === 'Table') return null
    if (node.name === 'Image' && node.from === pos) image = node
  }
  return image
}

/** Finds the document's tables and images. Cached per syntax tree, so selection changes are cheap. */
const blocks = (state: EditorState): Blocks => {
  const tree = syntaxTree(state)
  const cached = blocksCache.get(tree)
  if (cached) return cached

  const { doc } = state
  const found: Blocks = { images: [], tables: [] }
  // Tables are blocks, so only the block structure needs walking, not blocks' text.
  tree.iterate({
    enter: (node) => {
      if (node.name !== 'Table') return !node.type.is('LeafBlock')
      const from = doc.lineAt(node.from).from
      const widget = new TableWidget(tableModel(state, node.node, from))
      found.tables.push({ from, to: doc.lineAt(node.to).to, widget })
      return false
    },
  })
  // Images are inline, and searching the text for their `![` is much faster than walking all of it.
  for (let pos = 0, lines = doc.iter(); !lines.next().done; pos += lines.value.length) {
    for (let at = lines.value.indexOf('!['); at >= 0; at = lines.value.indexOf('![', at + 2)) {
      const node = imageAt(tree, pos + at)
      const image = node && inlineElement(state, node)
      if (
        image &&
        typeof image !== 'string' &&
        image.type === 'image' &&
        isShowableImage(state, image.src)
      ) {
        const widget = new ImageWidget(image.src, image.alt)
        found.images.push(
          Decoration.widget({ widget, block: true, side: 1 }).range(doc.lineAt(node.to).to),
        )
      }
    }
  }
  blocksCache.set(tree, found)
  return found
}

/**
 * Block decorations: images below the line with their Markdown, and tables rendered in place of
 * their source unless the selection touches them.
 */
export const blockDecorations = (state: EditorState): DecorationSet => {
  const { images, tables } = blocks(state)
  const decorations = [...images]
  for (const { from, to, widget } of tables) {
    if (!touches(state.selection, from, to)) {
      decorations.push(Decoration.replace({ widget, block: true }).range(from, to))
    }
  }
  return Decoration.set(decorations, true)
}

/** Block decorations must come from state rather than a view plugin, as they affect layout. */
export const blockWidgets = StateField.define<DecorationSet>({
  create: blockDecorations,
  update: (decorations, transaction) =>
    transaction.docChanged ||
    transaction.selection ||
    syntaxTree(transaction.startState) !== syntaxTree(transaction.state)
      ? blockDecorations(transaction.state)
      : decorations,
  provide: (field) => EditorView.decorations.from(field),
})
