import { describe, expect, it } from 'vitest'
import { droppedFile } from './fileAccess'

/** A drop's data, holding `files`. */
const drop = (...files: File[]): DataTransfer =>
  ({
    items: [
      { kind: 'string', getAsFile: () => null },
      ...files.map((file) => ({ kind: 'file', getAsFile: () => file })),
    ],
  }) as unknown as DataTransfer

describe('droppedFile', () => {
  it('reads the first file dropped, which has no location', async () => {
    const read = droppedFile(
      drop(new File(['# Hi'], 'a.md', { lastModified: 5 }), new File([''], 'b.md')),
    )

    const file = await read?.()

    expect(file).toMatchObject({ name: 'a.md', location: null, modified: 5 })
    expect(new TextDecoder().decode(file?.bytes)).toBe('# Hi')
  })

  it('finds nothing to read in drops without files', () => {
    expect(droppedFile(drop())).toBeNull()
  })
})
