import { Text } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import { difference } from './difference'

const text = (value: string): Text => Text.of(value.split('\n'))

describe('difference', () => {
  it.each([
    ['one two three', 'one 2 three', { from: 4, to: 7, insert: '2' }],
    ['abc', 'abXc', { from: 2, to: 2, insert: 'X' }],
    ['abc', 'ac', { from: 1, to: 2, insert: '' }],
    ['aaa', 'aaaa', { from: 3, to: 3, insert: 'a' }],
    ['same', 'same', { from: 4, to: 4, insert: '' }],
    ['', 'new\ntext', { from: 0, to: 0, insert: 'new\ntext' }],
  ])('turns %j into %j', (before, after, change) => {
    expect(difference(text(before), text(after))).toEqual(change)
    expect(text(before).replace(change.from, change.to, text(change.insert)).toString()).toBe(after)
  })
})
