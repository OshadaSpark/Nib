import { expect, test } from '@playwright/test'

test.describe('offline', () => {
  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'Offline emulation covers service workers in Chromium',
  )

  test('keeps working without a network once loaded', async ({ page, context }) => {
    await page.goto('/')
    await page.evaluate(() => navigator.serviceWorker.ready)

    await context.setOffline(true)
    await page.reload()

    await expect(page.getByRole('textbox', { name: 'Document' })).toBeFocused()
    // Code blocks' languages load on first use: from the cache, too.
    await page.keyboard.type('```python\nimport os')
    await expect(page.locator('.tok-keyword', { hasText: 'import' })).toBeVisible()
  })

  test('can be installed', async ({ page }) => {
    await page.goto('/')
    const manifest: unknown = await page.evaluate(async () => {
      const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')
      return link && ((await (await fetch(link.href)).json()) as unknown)
    })

    expect(manifest).toMatchObject({ name: 'typer', display: 'standalone', start_url: './' })
  })
})
