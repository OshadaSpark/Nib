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
      window.showDirectoryPicker = () => navigator.storage.getDirectory()
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

  test('reloads the file when it changed on disk', async ({ page }) => {
    await writeText(page, 'notes.md', 'one two three')
    await page.keyboard.press('ControlOrMeta+o')
    await expect(lines(page)).toHaveText(['one two three'])
    await page.keyboard.press('End')

    // As when coming back from the app that changed the file.
    await writeText(page, 'notes.md', 'one 2 three')
    await page.evaluate(() => window.dispatchEvent(new Event('focus')))
    await expect(lines(page)).toHaveText(['one 2 three'])
    await expect(page).toHaveTitle('notes.md — typer')

    // The cursor stayed at the end of the line.
    await page.keyboard.type('!')
    await expect(lines(page)).toHaveText(['one 2 three!'])

    await writeText(page, 'notes.md', 'changed again')
    await page.evaluate(() => window.dispatchEvent(new Event('focus')))
    await page
      .getByRole('dialog', { name: 'notes.md changed on disk' })
      .getByRole('button', { name: 'Reload' })
      .click()

    await expect(lines(page)).toHaveText(['changed again'])
    await expect(page).toHaveTitle('notes.md — typer')
  })

  test('opens a folder, and switches between its files, keeping their edits', async ({ page }) => {
    await writeText(page, 'ideas.md', '# Ideas')
    await writeText(page, 'todo.txt', 'milk')
    const files = page.getByRole('navigation', { name: 'Files' })

    await page.getByRole('button', { name: 'Open folder' }).click()
    await files.getByRole('button', { name: 'ideas.md' }).click()
    await expect(lines(page)).toHaveText(['# Ideas'])
    await page.keyboard.press('ControlOrMeta+End')
    await page.keyboard.type(' and more')

    await files.getByRole('button', { name: 'todo.txt' }).click()
    await expect(lines(page)).toHaveText(['milk'])
    await expect(files.getByRole('button', { name: 'ideas.md (edited)' })).toBeVisible()

    // The cursor is back where it was, at the end of the heading, so its markup shows.
    await files.getByRole('button', { name: 'ideas.md (edited)' }).click()
    await expect(lines(page)).toHaveText(['# Ideas and more'])
    await page.keyboard.press('ControlOrMeta+s')

    await expect(files.getByRole('button', { name: 'ideas.md', exact: true })).toBeVisible()
    expect(await readText(page, 'ideas.md')).toBe('# Ideas and more')
  })

  test('creates, renames and deletes files in the folder', async ({ page }) => {
    const files = page.getByRole('navigation', { name: 'Files' })
    const exists = (name: string) =>
      page.evaluate(async (name) => {
        const root = await navigator.storage.getDirectory()
        return root.getFileHandle(name).then(
          () => true,
          () => false,
        )
      }, name)
    await page.getByRole('button', { name: 'Open folder' }).click()

    await files.getByRole('button', { name: 'New file' }).click()
    await page.keyboard.type('plans')
    await page.keyboard.press('Enter')
    await expect(page).toHaveTitle('plans.md — typer')
    await page.keyboard.type('# Plans')
    await page.keyboard.press('ControlOrMeta+s')
    await expect(page).toHaveTitle('plans.md — typer')

    await files.getByRole('button', { name: 'plans.md', exact: true }).hover()
    await files.getByRole('button', { name: 'Rename plans.md' }).click()
    await page.keyboard.type('goals')
    await page.keyboard.press('Enter')
    await expect(page).toHaveTitle('goals.md — typer')
    expect(await readText(page, 'goals.md')).toBe('# Plans')
    expect(await exists('plans.md')).toBe(false)

    await files.getByRole('button', { name: 'goals.md', exact: true }).hover()
    await files.getByRole('button', { name: 'Delete goals.md' }).click()
    await page
      .getByRole('dialog', { name: 'Delete goals.md?' })
      .getByRole('button', { name: 'Delete' })
      .click()
    await expect(files.getByRole('button', { name: 'goals.md', exact: true })).toBeHidden()
    expect(await exists('goals.md')).toBe(false)
    await expect(page).toHaveTitle('Untitled.md — typer')
  })

  test('shows images and opens notes from relative paths in the folder', async ({ page }) => {
    await writeText(page, 'index.md', 'See [today](journal/today.md).\n\n![A dot](img/dot.png)')
    await page.evaluate(async () => {
      const root = await navigator.storage.getDirectory()
      const journal = await root.getDirectoryHandle('journal', { create: true })
      const today = await (
        await journal.getFileHandle('today.md', { create: true })
      ).createWritable()
      await today.write('# Today')
      await today.close()
      // A one-pixel PNG.
      const png = Uint8Array.from(
        atob(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=',
        ),
        (char) => char.charCodeAt(0),
      )
      const images = await root.getDirectoryHandle('img', { create: true })
      const dot = await (await images.getFileHandle('dot.png', { create: true })).createWritable()
      await dot.write(png)
      await dot.close()
    })

    await page.getByRole('button', { name: 'Open folder' }).click()
    await page
      .getByRole('navigation', { name: 'Files' })
      .getByRole('button', { name: 'index.md' })
      .click()

    const image = page.getByRole('img', { name: 'A dot' })
    await expect(image).toBeVisible()
    expect(await image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBe(1)

    await page.getByText('today', { exact: true }).click({ modifiers: ['ControlOrMeta'] })
    await expect(page).toHaveTitle('today.md — typer')
    await expect(lines(page)).toHaveText(['# Today'])
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
      delete window.showDirectoryPicker
    })
    await page.goto('/')
  })

  test('doesn’t offer to open folders', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Open', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Open folder' })).toBeHidden()
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
