import { Text } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import { decodeText, TextFile } from './textFile.svelte'

const edit = (file: TextFile, insert: string): Text =>
  file.content.replace(file.content.length, file.content.length, Text.of([insert]))

describe('TextFile', () => {
  it('starts out clean with its initial content', () => {
    const file = new TextFile('notes.md', 'one\ntwo')

    expect(file.content.toString()).toBe('one\ntwo')
    expect(file.content).toBe(file.loaded)
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
    file.markSaved(file.content, 'saved.md', handle, 5)

    expect(file.dirty).toBe(false)
    expect(file.name).toBe('saved.md')
    expect(file.handle).toBe(handle)
    expect(file.modified).toBe(5)
  })

  it('stays dirty when edited after the content that was saved', () => {
    const file = new TextFile('notes.md')
    const saved = edit(file, 'saved')

    file.content = edit(file, 'saved, then edited')
    file.markSaved(saved, file.name, null, null)

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

  it('keeps a byte-order mark out of the content, and restores it when serialized', () => {
    const file = new TextFile('notes.md', '\uFEFF# Notes')

    expect(file.content.toString()).toBe('# Notes')
    expect(file.serialize()).toBe('\uFEFF# Notes')
  })

  it('tells its line endings and whether it has a byte-order mark', () => {
    const file = new TextFile('notes.md', 'a\nb')
    expect([file.crlf, file.byteOrderMark]).toEqual([false, false])

    file.reload('\uFEFFa\r\nb', 1)

    expect([file.crlf, file.byteOrderMark]).toEqual([true, true])
  })
})

describe('TextFile.reload', () => {
  it('replaces the content, line breaks and byte-order mark with the file’s new text', () => {
    const file = new TextFile('notes.md', 'old', null, 1)
    file.content = Text.of(['edited'])

    file.reload('\uFEFFnew\r\ntext', 2)

    expect(file.content.toString()).toBe('new\ntext')
    expect(file.loaded).toBe(file.content)
    expect(file.dirty).toBe(false)
    expect(file.modified).toBe(2)
    expect(file.serialize()).toBe('\uFEFFnew\r\ntext')
  })

  it('tells whether text matches the saved content', () => {
    const file = new TextFile('notes.md', 'a\r\nb')
    file.content = Text.of(['edited'])

    expect(file.matchesSaved('a\r\nb')).toBe(true)
    expect(file.matchesSaved('a\nb')).toBe(false)
  })
})

describe('decodeText', () => {
  const bytes = (...values: number[]): ArrayBuffer => new Uint8Array(values).buffer

  it('decodes UTF-8, keeping a byte-order mark', () => {
    expect(decodeText(bytes(0xef, 0xbb, 0xbf, 0x68, 0xc3, 0xa9))).toBe('\uFEFFhé')
    expect(decodeText(bytes(0x68, 0x69))).toBe('hi')
  })

  it.each([
    ['invalid UTF-8', bytes(0x68, 0xe9, 0x74, 0xe9)],
    ['NUL characters', bytes(0x50, 0x4b, 0x03, 0x04, 0x00, 0x00)],
  ])('refuses %s', (_, input) => {
    expect(decodeText(input)).toBeNull()
  })
})
