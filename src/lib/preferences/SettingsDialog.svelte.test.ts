import { render, screen } from '@testing-library/svelte'
import { userEvent } from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Preferences } from './preferences.svelte'
import SettingsDialog from './SettingsDialog.svelte'

describe('SettingsDialog', () => {
  it('shows and changes the preferences', async () => {
    const user = userEvent.setup()
    const preferences = new Preferences(null)
    render(SettingsDialog, { open: true, preferences })

    expect(screen.getByRole('radio', { name: 'Sans' })).toBeChecked()
    await user.click(screen.getByRole('radio', { name: 'Mono' }))
    await user.click(screen.getByRole('radio', { name: 'Narrow' }))
    await user.click(screen.getByRole('switch', { name: 'Line numbers' }))
    await user.click(screen.getByRole('switch', { name: 'Words' }))

    expect(preferences.font).toBe('mono')
    expect(preferences.width).toBe('narrow')
    expect(preferences.lineNumbers).toBe(true)
    expect(preferences.status.words).toBe(false)
    expect(screen.getByRole('region', { name: 'Status bar' })).toBeInTheDocument()
  })

  it('steps the text size within its bounds', async () => {
    const user = userEvent.setup()
    const preferences = new Preferences(null)
    preferences.size = 23
    render(SettingsDialog, { open: true, preferences })
    const larger = screen.getByRole('button', { name: 'Larger text' })
    const smaller = screen.getByRole('button', { name: 'Smaller text' })

    await user.click(larger)
    expect(preferences.size).toBe(24)
    expect(larger).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent('24')

    preferences.size = 15
    await user.click(smaller)
    expect(preferences.size).toBe(14)
    expect(await screen.findByRole('button', { name: 'Smaller text' })).toBeDisabled()
  })

  it('shows nothing until opened', () => {
    render(SettingsDialog, { open: false, preferences: new Preferences(null) })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
