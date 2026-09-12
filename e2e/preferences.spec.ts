import { expect, test } from '@playwright/test'

test.describe('settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('open from the header and on ⌘/Ctrl+comma, and close on Escape', async ({ page }) => {
    const settings = page.getByRole('dialog', { name: 'Settings' })

    await page.getByRole('button', { name: 'Settings' }).click()
    await expect(settings).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(settings).toBeHidden()

    await page.keyboard.press('ControlOrMeta+Comma')
    await expect(settings).toBeVisible()
  })

  test('set the theme, which lasts', async ({ page }) => {
    const background = () =>
      page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor)

    await page.getByRole('button', { name: 'Settings' }).click()
    await page.getByText('Dark', { exact: true }).click()
    await expect.poll(background).toBe('rgb(25, 25, 27)')
    await page.reload()
    await expect.poll(background).toBe('rgb(25, 25, 27)')

    await page.getByRole('button', { name: 'Settings' }).click()
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

    await page.getByRole('button', { name: 'Settings' }).click()
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

  test('turn live rendering off, to show Markdown as written', async ({ page }) => {
    const line = page.getByRole('textbox', { name: 'Document' }).locator('.cm-line')
    await page.keyboard.type('Some **bold**')
    await page.keyboard.press('Home')
    await expect(line).toHaveText('Some bold')

    await page.getByRole('button', { name: 'Settings' }).click()
    await page.getByRole('switch', { name: 'Render Markdown' }).uncheck()

    await expect(line).toHaveText('Some **bold**')
  })

  test('show line numbers beside the text, which stays where it was', async ({ page }) => {
    const editor = page.getByRole('textbox', { name: 'Document' })
    await page.keyboard.type('one\ntwo')
    const textStart = () =>
      editor
        .locator('.cm-line')
        .first()
        .evaluate((line) => {
          const range = document.createRange()
          range.selectNodeContents(line)
          return range.getBoundingClientRect().left
        })
    const before = await textStart()

    await page.getByRole('button', { name: 'Settings' }).click()
    await page.getByRole('switch', { name: 'Line numbers' }).check()
    await page.keyboard.press('Escape')

    const right = await page
      .locator('.cm-lineNumbers .cm-gutterElement', { hasText: /^1$/ })
      .evaluate((number) => number.getBoundingClientRect().right)
    expect(await textStart()).toBeCloseTo(before, 0)
    // Right-aligned, next to the text rather than at the window's edge.
    expect(before - right).toBeGreaterThan(8)
    expect(before - right).toBeLessThan(40)
  })

  test('turn the status bar’s items on and off, which lasts', async ({ page }) => {
    const status = page.getByRole('contentinfo')

    await page.getByRole('button', { name: 'Settings' }).click()
    await page.getByRole('switch', { name: 'Cursor position' }).check()
    await page.getByRole('switch', { name: 'Characters' }).uncheck()
    await page.reload()

    await expect(status).toContainText('Ln 1, Col 1')
    await expect(status).not.toContainText('characters')
  })
})
