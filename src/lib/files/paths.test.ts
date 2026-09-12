import { describe, expect, it } from 'vitest'
import { isValidName, join, nameOf, parentOf, resolvePath } from './paths'

describe('resolvePath', () => {
  it.each([
    ['a.md', 'b.md', 'b.md'],
    ['notes/a.md', 'b.md', 'notes/b.md'],
    ['notes/a.md', './img/cat.png', 'notes/img/cat.png'],
    ['notes/a.md', '../b.md', 'b.md'],
    ['notes/a.md', '/b.md', 'b.md'],
    ['a.md', 'my%20note.md#heading', 'my note.md'],
    ['a.md', 'b.md?x=1', 'b.md'],
    ['a.md', '100%.md', '100%.md'],
  ])('resolves %j + %j to %j', (from, target, expected) => {
    expect(resolvePath(from, target)).toBe(expected)
  })

  it.each([
    ['a.md', '../b.md'],
    ['a.md', '#heading'],
    ['notes/a.md', '#heading'],
    ['a.md', 'notes/'],
  ])('finds nothing in the folder for %j + %j', (from, target) => {
    expect(resolvePath(from, target)).toBeNull()
  })
})

describe('parentOf', () => {
  it.each([
    ['a.md', ''],
    ['notes/a.md', 'notes'],
    ['notes/2026/a.md', 'notes/2026'],
  ])('gives the directory of %j as %j', (path, expected) => {
    expect(parentOf(path)).toBe(expected)
  })
})

describe('join and nameOf', () => {
  it('put together and take apart paths', () => {
    expect(join('', 'a.md')).toBe('a.md')
    expect(join('notes/2026', 'a.md')).toBe('notes/2026/a.md')
    expect(nameOf('notes/2026/a.md')).toBe('a.md')
    expect(nameOf('a.md')).toBe('a.md')
  })
})

describe('isValidName', () => {
  it.each(['a.md', ' plans ', '.hidden'])('accepts %j', (name) => {
    expect(isValidName(name)).toBe(true)
  })

  it.each(['', '  ', '.', '..', 'a/b.md', 'a\\b.md'])('refuses %j', (name) => {
    expect(isValidName(name)).toBe(false)
  })
})
