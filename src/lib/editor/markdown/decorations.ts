import { syntaxTree } from '@codemirror/language'
import type { EditorSelection, EditorState, Range } from '@codemirror/state'
import { Decoration, type DecorationSet } from '@codemirror/view'
import type { SyntaxNode } from '@lezer/common'
import { linkTarget } from './links'
import { BulletWidget, CheckboxWidget, EntityWidget } from './widgets'

/** Hides markup. Shared, as every hidden range looks the same. */
const hidden = Decoration.replace({})
const linkText = Decoration.mark({ class: 'cm-link' })
const inlineCode = Decoration.mark({ class: 'cm-inlineCode' })
const codeText = Decoration.mark({ class: 'cm-codeText' })
const doneTask = Decoration.mark({ class: 'cm-taskDone' })
const codeLine = Decoration.line({ class: 'cm-codeBlock' })
const codeFirstLine = Decoration.line({ class: 'cm-codeBlock-first' })
const codeLastLine = Decoration.line({ class: 'cm-codeBlock-last' })
/** A line whose fence is hidden, which only pads the block. */
const fenceLine = Decoration.line({ class: 'cm-codeFence' })
const ruleLine = Decoration.line({ class: 'cm-rule' })
/** Bullets for each level of nesting, repeating after the last. */
const bullets = ['•', '◦', '▪'].map((glyph) =>
  Decoration.replace({ widget: new BulletWidget(glyph) }),
)
const checkboxes = {
  checked: Decoration.replace({ widget: new CheckboxWidget(true) }),
  unchecked: Decoration.replace({ widget: new CheckboxWidget(false) }),
}
const quoteLines: Decoration[] = []
/** Draws one bar per level of nesting. */
const quoteLine = (depth: number): Decoration =>
  (quoteLines[depth] ??= Decoration.line({
    class: 'cm-quote',
    attributes: { style: `--quote-depth: ${String(depth)}` },
  }))

/** Whether any selection range overlaps or touches `from`–`to`. */
export const touches = (selection: EditorSelection, from: number, to: number): boolean =>
  selection.ranges.some((range) => range.from <= to && range.to >= from)

/** How many lists `node` is nested in. */
const listDepth = (node: SyntaxNode): number => {
  let depth = 0
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (parent.name === 'BulletList' || parent.name === 'OrderedList') depth++
  }
  return depth
}

/**
 * Decorations that render the Markdown in `ranges` in place. Markup is hidden, except in elements
 * the selection touches, so that it can still be edited. Blocks that only change how lines look
 * (lists, quotes, rules, code) are here too; blocks that change the layout are in `blockWidgets`.
 */
export const previewDecorations = (
  state: EditorState,
  ranges: readonly { from: number; to: number }[],
): DecorationSet => {
  const { doc, selection } = state
  const decorations: Range<Decoration>[] = []
  /** Blockquote nesting depth, by line start. */
  const quoteDepths = new Map<number, number>()
  const hide = (from: number, to: number): void => {
    // View plugins may not replace line breaks, and markup never needs to.
    if (from < to && doc.lineAt(from).to >= to) decorations.push(hidden.range(from, to))
  }
  const hideMarks = (node: SyntaxNode, mark: string): void => {
    for (const child of node.getChildren(mark)) hide(child.from, child.to)
  }

  for (const { from, to } of ranges) {
    /** Calls `f` with the start of each line of `node` within the range. */
    const eachLine = (node: SyntaxNode, f: (lineFrom: number) => void): void => {
      const last = doc.lineAt(Math.min(node.to, to)).number
      for (let line = doc.lineAt(Math.max(node.from, from)).number; line <= last; line++) {
        f(doc.line(line).from)
      }
    }

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
            if (linkTarget(state, node) !== undefined) {
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
          case 'ListItem': {
            const mark = node.firstChild
            if (mark?.name !== 'ListMark') break
            const bulleted = node.parent?.name === 'BulletList'
            const task = node.getChild('Task')
            const marker = task?.getChild('TaskMarker')
            if (task && marker) {
              const checked = doc.sliceString(marker.from + 1, marker.to - 1).trim() !== ''
              const textFrom = Math.min(marker.to + 1, task.to)
              if (checked && textFrom < task.to) {
                decorations.push(doneTask.range(textFrom, task.to))
              }
              // A checkbox replaces the bullet, but goes after a number.
              const from = bulleted ? mark.from : marker.from
              if (!touches(selection, from, marker.to)) {
                const checkbox = checked ? checkboxes.checked : checkboxes.unchecked
                decorations.push(checkbox.range(from, marker.to))
              }
            } else if (bulleted && !touches(selection, mark.from, mark.to)) {
              const bullet = bullets[(listDepth(node) - 1) % bullets.length]
              if (bullet) decorations.push(bullet.range(mark.from, mark.to))
            }
            break
          }
          case 'Blockquote':
            eachLine(node, (lineFrom) => {
              quoteDepths.set(lineFrom, (quoteDepths.get(lineFrom) ?? 0) + 1)
            })
            break
          case 'QuoteMark': {
            // Hidden with the space after it, but revealed only by touching the `>` itself, so
            // that the cursor can sit at the start of the quote's text.
            const space = doc.sliceString(node.to, node.to + 1) === ' ' ? 1 : 0
            if (!revealed) hide(node.from, node.to + space)
            break
          }
          case 'HorizontalRule':
            if (!revealed) {
              decorations.push(ruleLine.range(doc.lineAt(node.from).from))
              hide(node.from, node.to)
            }
            break
          case 'FencedCode':
          case 'CodeBlock': {
            eachLine(node, (lineFrom) => {
              decorations.push(codeLine.range(lineFrom))
            })
            const first = doc.lineAt(node.from)
            decorations.push(
              codeFirstLine.range(first.from),
              codeLastLine.range(doc.lineAt(node.to).from),
              codeText.range(node.from, node.to),
            )
            if (node.name === 'FencedCode' && !revealed) {
              // The opening fence with its info string, and the closing fence if there is one.
              hide(node.from, first.to)
              decorations.push(fenceLine.range(first.from))
              const close = node.lastChild
              if (close?.name === 'CodeMark' && close.from > first.to) {
                hide(close.from, close.to)
                decorations.push(fenceLine.range(doc.lineAt(close.from).from))
              }
            }
            return false
          }
          // Images are shown as blocks, and definitions stay as written.
          case 'Image':
          case 'LinkReference':
            return false
        }
        return undefined
      },
    })
  }

  for (const [lineFrom, depth] of quoteDepths) {
    decorations.push(quoteLine(depth).range(lineFrom))
  }
  return Decoration.set(decorations, true)
}
