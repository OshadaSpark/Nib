import { expect, test } from '@playwright/test'

test.describe('preferences', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('open from the header and close on Escape', async ({ page }) => {
    const panel = page.getByRole('dialog', { name: 'Preferences' })

    await page.getByRole('button', { name: 'Preferences' }).click()
    await expect(panel).toBeVisible()
    await page.keyboard.press('Escape')

    await expect(panel).toBeHidden()
  })

  test('set the theme, which lasts', async ({ page }) => {
    const background = () =>
      page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor)

    await page.getByRole('button', { name: 'Preferences' }).click()
    await page.getByText('Dark', { exact: true }).click()
    await expect.poll(background).toBe('rgb(25, 25, 27)')
    await page.reload()
    await expect.poll(background).toBe('rgb(25, 25, 27)')

    await page.getByRole('button', { name: 'Preferences' }).click()
    await page.getByText('Light', { exact: true }).click()
    await expect.poll(background).toBe('rgb(253, 253, 252)')
  })

  test('set the text’s font, size and column width, which last', async ({ page }) => {
    const line = page.getByRole('textbox', { name: 'Document' }).locator('.cm-line')
    await page.keyboard.type('Text')
    const style = () =>
      line.evaluate((element) => {
        const { fontFamily, fontSize, paddingInlineStart } = getComputedStyle(element)
        return { fontFamily, fontSize, inset: parseFloat(paddingInlineStart) }
      })
    const before = await style()

    await page.getByRole('button', { name: 'Preferences' }).click()
    await page.getByText('Mono', { exact: true }).click()
    await page.getByRole('button', { name: 'Larger text' }).click()
    await page.getByRole('button', { name: 'Larger text' }).click()
    await page.getByText('Narrow', { exact: true }).click()
    await page.reload()

    const after = await style()
    expect(after.fontFamily).toContain('monospace')
    expect(after.fontSize).toBe('19px')
    // A narrower column leaves more space on either side, even in a wider font.
    expect(after.inset).toBeGreaterThan(before.inset)
  })
})
