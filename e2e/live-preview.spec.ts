import { expect, test } from '@playwright/test'

test.describe('live preview', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('hides markup except in the element at the cursor', async ({ page }) => {
    const lines = page.getByRole('textbox', { name: 'Document' }).locator('.cm-line')

    await page.keyboard.type('# Title')
    await page.keyboard.press('Enter')
    await page.keyboard.type('Some **bold** and `code`')

    await expect(lines).toHaveText(['Title', 'Some bold and `code`'])

    await page.keyboard.press('Home')
    await expect(lines).toHaveText(['Title', 'Some bold and code'])

    await page.keyboard.press('ArrowUp')
    await expect(lines).toHaveText(['# Title', 'Some bold and code'])
  })

  test('keeps the cursor out of hidden markup', async ({ page }) => {
    const lines = page.getByRole('textbox', { name: 'Document' }).locator('.cm-line')

    await page.keyboard.type('## Heading')
    await page.keyboard.press('Enter')
    await page.keyboard.type('text')
    await expect(lines.first()).toHaveText('Heading')

    // The cursor moves up by position on screen, which is inside the heading's text, as the `## ` is
    // hidden.
    await page.keyboard.press('ArrowUp')
    await page.keyboard.type('X')

    await expect(lines.first()).toHaveText(/^## \w*X\w*$/)
  })
})
