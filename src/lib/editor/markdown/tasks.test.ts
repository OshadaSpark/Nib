import { describe, expect, it } from 'vitest'
import { toggleTask } from './tasks'
import { markdownState } from './testState'

describe('toggleTask', () => {
  const toggled = (input: string): string | null => {
    const state = markdownState(input)
    const toggle = toggleTask(state, state.selection.main.head)
    return toggle && state.update(toggle).state.doc.toString()
  }

  it.each([
    ['- [ ] to d‸o', '- [x] to do'],
    ['- [x] ‸done', '- [ ] done'],
    ['‸* [X] done', '* [ ] done'],
    ['1. [ ] to do‸', '1. [x] to do'],
    ['- [ ] a\n  - [ ] ‸b', '- [ ] a\n  - [x] b'],
  ])('toggles the task in %j', (input, expected) => {
    expect(toggled(input)).toBe(expected)
  })

  it.each(['- no ‸task', 'plain ‸text', '- [ ] a\n\n‸b'])('does nothing in %j', (input) => {
    expect(toggled(input)).toBeNull()
  })
})
