import { afterEach, describe, expect, it, vi } from 'vitest'
import { failedWith, FileSystemError, readBytes, trashFile } from './fileSystem'

/** Answers Tauri calls with `invoke`, as the app's runtime would. */
const runtime = (invoke: (command: string, args: unknown) => Promise<unknown>) => {
  const spy = vi.fn(invoke)
  // These tests run in Node, which has no window.
  vi.stubGlobal('window', { __TAURI_INTERNALS__: { invoke: spy } })
  return spy
}

/** Makes every Tauri call fail with `failure`, which Tauri rejects with as it is. */
const failWith = (failure: unknown) =>
  runtime(() =>
    Promise.resolve().then(() => {
      throw failure
    }),
  )

describe('fileSystem', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reads the modified time before the bytes', async () => {
    const bytes = new ArrayBuffer(2)
    const invoke = runtime((command) => Promise.resolve(command === 'modified' ? 7 : bytes))

    expect(await readBytes('/Notes/a.md')).toEqual({ bytes, modified: 7 })
    expect(invoke.mock.calls.map(([command]) => command)).toEqual(['modified', 'read_file'])
  })

  it('tells failures apart by the kind the command reports', async () => {
    failWith({ kind: 'notFound', message: 'No such file' })

    const error: unknown = await trashFile('/Notes/a.md').catch((error: unknown) => error)

    expect(error).toBeInstanceOf(FileSystemError)
    expect(error).toHaveProperty('message', 'No such file')
    expect(failedWith(error, 'notFound')).toBe(true)
    expect(failedWith(error, 'alreadyExists')).toBe(false)
    expect(failedWith(new Error('No such file'), 'notFound')).toBe(false)
  })

  it.each([['Denied'], [{ kind: 'strange', message: 'Denied' }], [null]])(
    'reports other failures, such as %j, as such',
    async (failure) => {
      failWith(failure)

      const error: unknown = await trashFile('/Notes/a.md').catch((error: unknown) => error)

      expect(failedWith(error, 'other')).toBe(true)
    },
  )
})
