import { expect, test } from '@playwright/test'

test.describe('formatting shortcuts', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('toggle bold, italic and links on the selection', async ({ page }) => {
    const line = page.getByRole('textbox', { name: 'Document' }).locator('.cm-line')
    await page.keyboard.type('word')
    await page.keyboard.press('Shift+Home')

    // The markup shows, as the selection touches it.
    await page.keyboard.press('ControlOrMeta+b')
    await expect(line).toHaveText('**word**')
    await page.keyboard.press('ControlOrMeta+i')
    await expect(line).toHaveText('***word***')
    await page.keyboard.press('ControlOrMeta+b')
    await expect(line).toHaveText('*word*')
    await page.keyboard.press('ControlOrMeta+i')
    await expect(line).toHaveText('word')

    await page.keyboard.press('ControlOrMeta+k')
    await page.keyboard.type('https://example.com')
    await expect(line).toHaveText('[word](https://example.com)')

    await page.keyboard.press('ControlOrMeta+z')
    await expect(line).toHaveText('[word]()')
  })
})
