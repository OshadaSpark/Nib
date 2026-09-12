import { expect, test } from '@playwright/test'

test.describe('editor', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('is focused and ready for input on load', async ({ page }) => {
    await expect(page).toHaveTitle('Untitled.md — typer')
    await expect(page.getByRole('textbox', { name: 'Document' })).toBeFocused()
  })

  test('continues Markdown lists on Enter', async ({ page }) => {
    const lines = page.getByRole('textbox', { name: 'Document' }).locator('.cm-line')

    await page.keyboard.type('- first')
    await page.keyboard.press('Enter')
    await page.keyboard.type('second')

    // The markers render as bullets, as the cursor is past them.
    await expect(lines).toHaveText(['• first', '• second'])
  })

  test('asks before discarding unsaved changes', async ({ page }) => {
    const editor = page.getByRole('textbox', { name: 'Document' })
    const dialog = page.getByRole('dialog', { name: 'Discard unsaved changes?' })
    await page.keyboard.type('draft')

    await page.getByRole('button', { name: 'New' }).click()
    await expect(dialog).toBeVisible()
    await page.keyboard.press('Escape')

    await expect(dialog).toBeHidden()
    await expect(editor).toContainText('draft')

    await page.getByRole('button', { name: 'New' }).click()
    await dialog.getByRole('button', { name: 'Discard' }).click()

    await expect(editor).not.toContainText('draft')
    await expect(editor).toBeFocused()
  })

  test('undoes edits', async ({ page }) => {
    const editor = page.getByRole('textbox', { name: 'Document' })

    await page.keyboard.type('draft')
    await expect(editor).toContainText('draft')
    await page.keyboard.press('ControlOrMeta+z')

    await expect(editor).not.toContainText('draft')
  })
})
