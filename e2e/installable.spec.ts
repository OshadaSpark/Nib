import { expect, test } from '@playwright/test'

test.describe('installed app', () => {
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

    expect(manifest).toMatchObject({
      name: 'typer',
      display: 'standalone',
      start_url: './',
      file_handlers: [
        { accept: { 'text/markdown': ['.md', '.markdown'], 'text/plain': ['.txt'] } },
      ],
    })
  })

  test('opens the file it was launched with', async ({ page }) => {
    // Stands in for the system, which launches the installed app with a handle. Chromium's own
    // launch queue is read-only, so it's replaced rather than assigned.
    await page.addInitScript(() => {
      const launchQueue: LaunchQueue = {
        setConsumer: (consumer) => {
          void (async () => {
            const root = await navigator.storage.getDirectory()
            const handle = await root.getFileHandle('launched.md', { create: true })
            const writable = await handle.createWritable()
            await writable.write('# Launched')
            await writable.close()
            consumer({ files: [handle] })
          })()
        },
      }
      Object.defineProperty(window, 'launchQueue', { value: launchQueue })
    })

    await page.goto('/')

    await expect(page).toHaveTitle('launched.md — typer')
    await expect(page.getByRole('textbox', { name: 'Document' })).toContainText('Launched')
  })
})
