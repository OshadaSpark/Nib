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

    await page.getByRole('button', { name: 'File', exact: true }).click()
    await page.getByRole('button', { name: 'New' }).click()
    await expect(dialog).toBeVisible()
    await page.keyboard.press('Escape')

    await expect(dialog).toBeHidden()
    await expect(editor).toContainText('draft')

    await page.getByRole('button', { name: 'File', exact: true }).click()
    await page.getByRole('button', { name: 'New' }).click()
    await dialog.getByRole('button', { name: 'Discard' }).click()

    await expect(editor).not.toContainText('draft')
    await expect(editor).toBeFocused()
  })

  test('finds and replaces text', async ({ page }) => {
    const editor = page.getByRole('textbox', { name: 'Document' })
    await page.keyboard.type('one cat, two cats')

    await page.keyboard.press('ControlOrMeta+f')
    await page.getByRole('textbox', { name: 'Find' }).pressSequentially('cat')
    await page.keyboard.press('Enter')
    await page.keyboard.press('Enter')
    await page.getByRole('textbox', { name: 'Replace' }).pressSequentially('dog')
    // Replaces the selected match, the second one, and selects the next.
    await page.keyboard.press('Enter')

    await expect(editor).toHaveText('one cat, two dogs')

    await page.getByRole('button', { name: 'Replace all' }).click()
    await expect(editor).toHaveText('one dog, two dogs')

    await page.getByRole('textbox', { name: 'Find' }).press('Escape')
    await expect(page.getByRole('textbox', { name: 'Find' })).toBeHidden()
    await expect(editor).toBeFocused()
  })

  test('undoes edits', async ({ page }) => {
    const editor = page.getByRole('textbox', { name: 'Document' })

    await page.keyboard.type('draft')
    await expect(editor).toContainText('draft')
    await page.keyboard.press('ControlOrMeta+z')

    await expect(editor).not.toContainText('draft')
  })

  test('formats the selection from the toolbar, keeping the editor focused', async ({ page }) => {
    const editor = page.getByRole('textbox', { name: 'Document' })
    const toolbar = page.getByRole('toolbar', { name: 'Formatting' })
    await page.keyboard.type('Plans')
    await page.keyboard.press('Shift+Home')

    await toolbar.getByRole('button', { name: 'Bold' }).click()
    await toolbar.getByRole('button', { name: 'Heading 1' }).click()

    await expect(editor).toBeFocused()
    await page.keyboard.press('End')
    await expect(editor.locator('.cm-line')).toHaveText(['# **Plans**'])
    await toolbar.getByRole('button', { name: 'Undo' }).click()
    await expect(editor.locator('.cm-line')).toHaveText(['**Plans**'])
  })
})
