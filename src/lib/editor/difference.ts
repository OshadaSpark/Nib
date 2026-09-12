import type { Text } from '@codemirror/state'

/**
 * The change that turns `before` into `after`: one replacement, between their common start and
 * end. Positions outside it, such as the cursor's, stay where they are.
 */
export const difference = (
  before: Text,
  after: Text,
): { from: number; to: number; insert: string } => {
  const a = before.toString()
  const b = after.toString()
  const shorter = Math.min(a.length, b.length)
  let start = 0
  while (start < shorter && a.charCodeAt(start) === b.charCodeAt(start)) start++
  let end = 0
  while (
    end < shorter - start &&
    a.charCodeAt(a.length - 1 - end) === b.charCodeAt(b.length - 1 - end)
  ) {
    end++
  }
  return { from: start, to: a.length - end, insert: b.slice(start, b.length - end) }
}
