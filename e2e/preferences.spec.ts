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
})
