import { expect, test } from '@playwright/test'

test.describe('home page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('renders the app', async ({ page }) => {
    await expect(page).toHaveTitle('typer')
    await expect(page.getByRole('heading', { level: 1, name: 'Get started' })).toBeVisible()
  })

  test('increments the counter when clicked', async ({ page }) => {
    const counter = page.getByRole('button', { name: /^Count is/ })

    await expect(counter).toHaveText('Count is 0')
    await counter.click()
    await expect(counter).toHaveText('Count is 1')
  })
})
