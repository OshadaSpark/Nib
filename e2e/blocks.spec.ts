import { expect, test, type Page } from '@playwright/test'

/** A 1×1 transparent PNG. */
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
)

const editor = (page: Page) => page.getByRole('textbox', { name: 'Document' })

test.describe('block rendering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('toggles tasks with their checkboxes', async ({ page }) => {
    await page.keyboard.insertText('- [ ] first\n- [ ] second\n\nEnd')
    const checkboxes = page.getByRole('checkbox', { name: 'Done' })
    await expect(checkboxes).toHaveCount(2)

    await checkboxes.last().click()

    // Checkboxes are drawn from the source, so this shows the source changed.
    await expect(checkboxes.last()).toBeChecked()
    await expect(checkboxes.first()).not.toBeChecked()
  })

  test('highlights code blocks once their language loads, and hides their fences', async ({
    page,
  }) => {
    await page.keyboard.insertText('```js\nconst answer = 42\n```\n\nEnd')

    const keyword = editor(page).locator('.tok-keyword', { hasText: 'const' })
    await expect(keyword).toBeVisible()
    await expect(editor(page).locator('.cm-codeBlock')).toHaveText(['', 'const answer = 42', ''])
  })

  test('renders tables in place, and shows the source of a clicked cell', async ({ page }) => {
    await page.keyboard.insertText('| Drink | Price |\n| --- | ---: |\n| Tea | 2 |\n\nEnd')
    const table = editor(page).getByRole('table')
    await expect(table.getByRole('cell')).toHaveText(['Tea', '2'])
    await expect(table.getByRole('columnheader', { name: 'Price' })).toHaveCSS(
      'text-align',
      'right',
    )

    await table.getByRole('cell', { name: 'Tea' }).click()
    await page.keyboard.type('Green ')

    await expect(table).toBeHidden()
    await expect(editor(page).locator('.cm-line').nth(2)).toHaveText('| Green Tea | 2 |')
  })

  test('shows the table source when the cursor moves into it', async ({ page }) => {
    await page.keyboard.insertText('Start\n\n| a | b |\n| - | - |\n| 1 | 2 |')
    await page.keyboard.press('ControlOrMeta+Home')
    await expect(editor(page).getByRole('table')).toBeVisible()

    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')

    await expect(editor(page).getByRole('table')).toBeHidden()
    await expect(editor(page)).toContainText('| a | b |')
  })

  test('shows images below their Markdown', async ({ page }) => {
    const src = `data:image/png;base64,${png.toString('base64')}`
    await page.keyboard.insertText(`![A pixel](${src})`)

    const image = editor(page).getByRole('img', { name: 'A pixel' })
    await expect(image).toBeVisible()
    expect(await image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBe(1)
    await expect(editor(page).locator('.cm-line')).toHaveText([`![A pixel](${src})`])
  })

  test('never loads images from the web', async ({ context, page }) => {
    let requested = false
    await context.route('https://example.com/pixel.png', (route) => {
      requested = true
      return route.fulfill({ body: png, contentType: 'image/png' })
    })

    await page.keyboard.insertText('![A pixel](https://example.com/pixel.png)\n\nEnd')

    await expect(editor(page)).toContainText('End')
    await expect(editor(page).getByRole('img')).toHaveCount(0)
    expect(requested).toBe(false)
  })
})
