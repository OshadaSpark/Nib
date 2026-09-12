import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'

const lines = (page: Page) => page.getByRole('textbox', { name: 'Document' }).locator('.cm-line')

test.describe('with the File System Access API', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Only Chromium implements the API')

  // Stands in for the native pickers, which automation cannot drive, with files in the origin
  // private file system. The handles are real, so reads and writes go through the actual API.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const fileHandle = async (name: string): Promise<FileSystemFileHandle> => {
        const root = await navigator.storage.getDirectory()
        return root.getFileHandle(name, { create: true })
      }
      window.showOpenFilePicker = async () => [await fileHandle('notes.md')]
      window.showSaveFilePicker = () => fileHandle('saved.md')
    })
    await page.goto('/')
  })

  const writeText = (page: Page, name: string, text: string) =>
    page.evaluate(
      async (file) => {
        const root = await navigator.storage.getDirectory()
        const handle = await root.getFileHandle(file.name, { create: true })
        const writable = await handle.createWritable()
        await writable.write(file.text)
        await writable.close()
      },
      { name, text },
    )

  const readText = (page: Page, name: string) =>
    page.evaluate(async (name) => {
      const root = await navigator.storage.getDirectory()
      const handle = await root.getFileHandle(name)
      return (await handle.getFile()).text()
    }, name)

  test('saves back to the opened file', async ({ page }) => {
    await writeText(page, 'notes.md', 'first\r\nsecond')

    await page.keyboard.press('ControlOrMeta+o')
    await expect(page.getByText('notes.md')).toBeVisible()
    await page.keyboard.type('new ')
    await expect(page).toHaveTitle('• notes.md — typer')
    await page.keyboard.press('ControlOrMeta+s')

    await expect(page).toHaveTitle('notes.md — typer')
    expect(await readText(page, 'notes.md')).toBe('new first\r\nsecond')
  })

  test('asks where to save a new file', async ({ page }) => {
    await page.keyboard.type('# Draft')
    await page.getByRole('button', { name: 'Save', exact: true }).click()

    await expect(page).toHaveTitle('saved.md — typer')
    expect(await readText(page, 'saved.md')).toBe('# Draft')
  })
})

test.describe('without the File System Access API', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      delete window.showOpenFilePicker
      delete window.showSaveFilePicker
    })
    await page.goto('/')
  })

  const openFile = async (page: Page, name: string, text: string) => {
    const fileChooser = page.waitForEvent('filechooser')
    await page.getByRole('button', { name: 'Open' }).click()
    await (await fileChooser).setFiles({ name, mimeType: 'text/plain', buffer: Buffer.from(text) })
    await expect(page.getByText(name)).toBeVisible()
  }

  test('opens with a file input and saves as a download', async ({ page }) => {
    await openFile(page, 'notes.txt', 'one\r\ntwo')
    await expect(lines(page)).toHaveText(['one', 'two'])

    await page.keyboard.type('zero ')
    const downloadEvent = page.waitForEvent('download')
    await page.keyboard.press('ControlOrMeta+s')
    const download = await downloadEvent

    expect(download.suggestedFilename()).toBe('notes.txt')
    expect(await readFile(await download.path(), 'utf8')).toBe('zero one\r\ntwo')
    await expect(page).toHaveTitle('notes.txt — typer')
  })

  test('keeps a UTF-8 byte-order mark', async ({ page }) => {
    await openFile(page, 'bom.txt', '\uFEFFtext')
    await expect(lines(page)).toHaveText(['text'])

    const downloadEvent = page.waitForEvent('download')
    await page.keyboard.press('ControlOrMeta+s')
    const bytes = await readFile(await (await downloadEvent).path())

    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    expect(bytes.subarray(3).toString()).toBe('text')
  })

  test('refuses files that aren’t UTF-8 text', async ({ page }) => {
    const fileChooser = page.waitForEvent('filechooser')
    await page.getByRole('button', { name: 'Open' }).click()
    await (
      await fileChooser
    ).setFiles({ name: 'latin1.txt', mimeType: 'text/plain', buffer: Buffer.from([0x63, 0xe9]) })

    await expect(page.getByRole('alert')).toHaveText('latin1.txt isn’t a UTF-8 text file.')
    await expect(page).toHaveTitle('Untitled.md — typer')
  })

  test('treats files without a Markdown extension as plain text', async ({ page }) => {
    await openFile(page, 'list.txt', '')

    await page.keyboard.type('- one')
    await page.keyboard.press('Enter')

    // In Markdown, Enter would have continued the list with another `- `.
    await expect(lines(page)).toHaveText(['- one', ''])
  })
})

test.describe('dropping a file', () => {
  test('opens it, rather than inserting its text', async ({ page }) => {
    await page.goto('/')
    const editor = page.getByRole('textbox', { name: 'Document' })
    const dataTransfer = await page.evaluateHandle(() => {
      const data = new DataTransfer()
      data.items.add(new File(['# Dropped'], 'dropped.md', { type: 'text/markdown' }))
      return data
    })

    await editor.dispatchEvent('dragenter', { dataTransfer })
    await expect(page.getByText('Drop to open')).toBeVisible()
    await editor.dispatchEvent('drop', { dataTransfer })

    await expect(page).toHaveTitle('dropped.md — typer')
    // The cursor is on the heading, so its markup shows.
    await expect(lines(page)).toHaveText(['# Dropped'])
    await expect(page.getByText('Drop to open')).toBeHidden()
  })
})
