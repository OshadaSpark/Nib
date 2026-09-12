import { describe, expect, it } from 'vitest'
import { isEditableName, isMarkdownName, withExtension } from './fileTypes'

describe('file types', () => {
  it.each(['a.md', 'b.MARKDOWN'])('treats %s as Markdown', (name) => {
    expect(isMarkdownName(name)).toBe(true)
    expect(isEditableName(name)).toBe(true)
  })

  it('treats .txt files as editable plain text', () => {
    expect(isMarkdownName('a.md.txt')).toBe(false)
    expect(isEditableName('a.md.txt')).toBe(true)
  })

  it.each(['photo.png', 'Makefile', 'md'])('leaves out %s', (name) => {
    expect(isEditableName(name)).toBe(false)
  })
})

describe('withExtension', () => {
  it.each([
    ['plans', 'plans.md'],
    [' plans.txt ', 'plans.txt'],
    ['notes.Markdown', 'notes.Markdown'],
    ['photo.png', 'photo.png.md'],
  ])('names %j as %j', (name, expected) => {
    expect(withExtension(name)).toBe(expected)
  })
})
