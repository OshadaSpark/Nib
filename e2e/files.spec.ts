import { expect, test, type Page } from '@playwright/test'
import { installFakeDisk, type FakeDisk, type FakeFiles } from '../src/lib/files/fakeDisk.ts'

const lines = (page: Page) => page.getByRole('textbox', { name: 'Document' }).locator('.cm-line')

/** Opens the file menu and runs its command `name`. */
const runCommand = async (page: Page, name: string) => {
  await page.getByRole('button', { name: 'File', exact: true }).click()
  await page.getByRole('button', { name, exact: true }).click()
}

/** A one-pixel PNG. */
const dot =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

const files: FakeFiles = {
  '/Docs/notes.md': 'first\r\nsecond',
  '/Docs/bom.txt': '\uFEFFtext',
  '/Docs/latin1.txt': { base64: 'Y+k=' },
  '/Docs/list.txt': '',
  '/Notes/ideas.md': '# Ideas',
  '/Notes/todo.txt': 'milk',
  '/Notes/index.md': 'See [today](journal/today.md).\n\n![A dot](img/dot.png)',
  '/Notes/journal/today.md': '# Today',
  '/Notes/img/dot.png': { base64: dot },
}

// The disk sits behind the app's calls to Tauri, as the native pickers and the Rust commands can't
// run in a browser: the app's own code runs as in the app, down to those calls.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(installFakeDisk, files)
  await page.goto('/')
})

/** Sets what the picker of `kind` gives next. */
const pick = (page: Page, kind: keyof FakeDisk['picks'], location: string) =>
  page.evaluate(
    ([kind, location]) => {
      if (window.fakeDisk) window.fakeDisk.picks[kind] = location
    },
    [kind, location] as const,
  )

const readText = (page: Page, location: string) =>
  page.evaluate((location) => window.fakeDisk?.text(location), location)

/** Changes the file on disk, as another app would. */
const writeText = (page: Page, location: string, text: string) =>
  page.evaluate(([location, text]) => window.fakeDisk?.write(location, text), [
    location,
    text,
  ] as const)

const open = async (page: Page, location: string) => {
  await pick(page, 'open', location)
  await page.keyboard.press('ControlOrMeta+o')
}

test('saves back to the opened file, with its line breaks', async ({ page }) => {
  await open(page, '/Docs/notes.md')
  await expect(page.getByText('notes.md')).toBeVisible()
  await page.keyboard.type('new ')
  await expect(page).toHaveTitle('• notes.md — Nib')
  await page.keyboard.press('ControlOrMeta+s')

  await expect(page).toHaveTitle('notes.md — Nib')
  expect(await readText(page, '/Docs/notes.md')).toBe('new first\r\nsecond')
})

test('asks where to save a new file', async ({ page }) => {
  await pick(page, 'save', '/Docs/saved.md')
  await page.keyboard.type('# Draft')
  await runCommand(page, 'Save')

  await expect(page).toHaveTitle('saved.md — Nib')
  expect(await readText(page, '/Docs/saved.md')).toBe('# Draft')
})

test('keeps a UTF-8 byte-order mark', async ({ page }) => {
  await open(page, '/Docs/bom.txt')
  await expect(lines(page)).toHaveText(['text'])
  await page.keyboard.type('the ')
  await page.keyboard.press('ControlOrMeta+s')

  await expect(page).toHaveTitle('bom.txt — Nib')
  expect(await readText(page, '/Docs/bom.txt')).toBe('\uFEFFthe text')
})

test('refuses files that aren’t UTF-8 text', async ({ page }) => {
  await open(page, '/Docs/latin1.txt')

  await expect(page.getByRole('alert')).toHaveText('latin1.txt isn’t a UTF-8 text file.')
  await expect(page).toHaveTitle('Untitled.md — Nib')
})

test('treats files without a Markdown extension as plain text', async ({ page }) => {
  await open(page, '/Docs/list.txt')
  await expect(page.getByText('list.txt')).toBeVisible()

  await page.keyboard.type('- one')
  await page.keyboard.press('Enter')

  // In Markdown, Enter would have continued the list with another `- `.
  await expect(lines(page)).toHaveText(['- one', ''])
})

test('reloads the file when it changed on disk', async ({ page }) => {
  await writeText(page, '/Docs/notes.md', 'one two three')
  await open(page, '/Docs/notes.md')
  await expect(lines(page)).toHaveText(['one two three'])
  await page.keyboard.press('End')

  // As when coming back from the app that changed the file.
  await writeText(page, '/Docs/notes.md', 'one 2 three')
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(lines(page)).toHaveText(['one 2 three'])
  await expect(page).toHaveTitle('notes.md — Nib')

  // The cursor stayed at the end of the line.
  await page.keyboard.type('!')
  await expect(lines(page)).toHaveText(['one 2 three!'])

  await writeText(page, '/Docs/notes.md', 'changed again')
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await page
    .getByRole('dialog', { name: 'notes.md changed on disk' })
    .getByRole('button', { name: 'Reload' })
    .click()

  await expect(lines(page)).toHaveText(['changed again'])
  await expect(page).toHaveTitle('notes.md — Nib')
})

test.describe('a folder', () => {
  const files = (page: Page) => page.getByRole('navigation', { name: 'Files' })

  test.beforeEach(async ({ page }) => {
    await pick(page, 'folder', '/Notes')
    await runCommand(page, 'Open folder')
  })

  test('switches between its files, keeping their edits', async ({ page }) => {
    await files(page).getByRole('button', { name: 'ideas.md' }).click()
    await expect(lines(page)).toHaveText(['# Ideas'])
    await page.keyboard.press('ControlOrMeta+End')
    await page.keyboard.type(' and more')

    await files(page).getByRole('button', { name: 'todo.txt' }).click()
    await expect(lines(page)).toHaveText(['milk'])
    await expect(files(page).getByRole('button', { name: 'ideas.md (edited)' })).toBeVisible()

    // The cursor is back where it was, at the end of the heading, so its markup shows.
    await files(page).getByRole('button', { name: 'ideas.md (edited)' }).click()
    await expect(lines(page)).toHaveText(['# Ideas and more'])
    await page.keyboard.press('ControlOrMeta+s')

    await expect(files(page).getByRole('button', { name: 'ideas.md', exact: true })).toBeVisible()
    expect(await readText(page, '/Notes/ideas.md')).toBe('# Ideas and more')
  })

  test('creates, renames and deletes files', async ({ page }) => {
    await files(page).getByRole('button', { name: 'New file' }).click()
    await page.keyboard.type('plans')
    await page.keyboard.press('Enter')
    await expect(page).toHaveTitle('plans.md — Nib')
    await page.keyboard.type('# Plans')
    await page.keyboard.press('ControlOrMeta+s')
    await expect(page).toHaveTitle('plans.md — Nib')

    await files(page).getByRole('button', { name: 'plans.md', exact: true }).hover()
    await files(page).getByRole('button', { name: 'Rename plans.md' }).click()
    await page.keyboard.type('goals')
    await page.keyboard.press('Enter')
    await expect(page).toHaveTitle('goals.md — Nib')
    expect(await readText(page, '/Notes/goals.md')).toBe('# Plans')
    expect(await readText(page, '/Notes/plans.md')).toBeUndefined()

    await files(page).getByRole('button', { name: 'goals.md', exact: true }).hover()
    await files(page).getByRole('button', { name: 'Delete goals.md' }).click()
    await page
      .getByRole('dialog', { name: 'Delete goals.md?' })
      .getByRole('button', { name: 'Delete' })
      .click()
    await expect(files(page).getByRole('button', { name: 'goals.md', exact: true })).toBeHidden()
    expect(await readText(page, '/Notes/goals.md')).toBeUndefined()
    await expect(page).toHaveTitle('Untitled.md — Nib')
  })

  test('shows images and opens notes from relative paths', async ({ page }) => {
    await files(page).getByRole('button', { name: 'index.md', exact: true }).click()

    const image = page.getByRole('img', { name: 'A dot' })
    // Loaded, which can take a moment after the element shows.
    await expect
      .poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth))
      .toBe(1)

    await page.getByText('today', { exact: true }).click({ modifiers: ['ControlOrMeta'] })
    await expect(page).toHaveTitle('today.md — Nib')
    await expect(lines(page)).toHaveText(['# Today'])
  })
})

test('opens a dropped file, rather than inserting its text', async ({ page }) => {
  const editor = page.getByRole('textbox', { name: 'Document' })
  const dataTransfer = await page.evaluateHandle(() => {
    const data = new DataTransfer()
    data.items.add(new File(['# Dropped'], 'dropped.md', { type: 'text/markdown' }))
    return data
  })

  await editor.dispatchEvent('dragenter', { dataTransfer })
  await expect(page.getByText('Drop to open')).toBeVisible()
  await editor.dispatchEvent('drop', { dataTransfer })

  await expect(page).toHaveTitle('dropped.md — Nib')
  // The cursor is on the heading, so its markup shows.
  await expect(lines(page)).toHaveText(['# Dropped'])
  await expect(page.getByText('Drop to open')).toBeHidden()
})
