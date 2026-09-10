import { Text } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import { TextFile } from './textFile.svelte'

const edit = (file: TextFile, insert: string): Text =>
  file.content.replace(file.content.length, file.content.length, Text.of([insert]))

describe('TextFile', () => {
  it('starts out clean with its initial content', () => {
    const file = new TextFile('notes.md', 'one\ntwo')

    expect(file.content.toString()).toBe('one\ntwo')
    expect(file.content).toBe(file.initial)
    expect(file.dirty).toBe(false)
  })

  it('is dirty while its content differs from the saved content', () => {
    const file = new TextFile('notes.md', 'draft')

    file.content = edit(file, '!')
    expect(file.dirty).toBe(true)

    file.content = Text.of(['draft'])
    expect(file.dirty).toBe(false)
  })

  it('is clean after saving, under the name and handle it was saved as', () => {
    const file = new TextFile('Untitled.md')
    const handle = { name: 'saved.md' } as FileSystemFileHandle

    file.content = edit(file, 'text')
    file.markSaved(file.content, 'saved.md', handle)

    expect(file.dirty).toBe(false)
    expect(file.name).toBe('saved.md')
    expect(file.handle).toBe(handle)
  })

  it('stays dirty when edited after the content that was saved', () => {
    const file = new TextFile('notes.md')
    const saved = edit(file, 'saved')

    file.content = edit(file, 'saved, then edited')
    file.markSaved(saved, file.name, null)

    expect(file.dirty).toBe(true)
  })

  it.each([
    ['LF', 'one\ntwo\n'],
    ['CRLF', 'one\r\ntwo\r\n'],
  ])('keeps %s line breaks when serialized', (_, text) => {
    const file = new TextFile('notes.md', text)

    expect(file.content.lines).toBe(3)
    expect(file.serialize()).toBe(text)
  })

  it('serializes given content with the file’s line breaks', () => {
    const file = new TextFile('notes.txt', 'a\r\nb')

    expect(file.serialize(Text.of(['x', 'y', 'z']))).toBe('x\r\ny\r\nz')
  })
})
