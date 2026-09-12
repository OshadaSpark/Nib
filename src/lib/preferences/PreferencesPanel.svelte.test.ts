import { render, screen } from '@testing-library/svelte'
import { userEvent } from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Preferences } from './preferences.svelte'
import PreferencesPanel from './PreferencesPanel.svelte'

// jsdom has no popovers to open, so the panel stays hidden.
const hidden = { hidden: true }

describe('PreferencesPanel', () => {
  it('shows and changes the preferences', async () => {
    const user = userEvent.setup()
    const preferences = new Preferences(null)
    render(PreferencesPanel, { id: 'preferences', preferences })

    expect(screen.getByRole('radio', { name: 'Sans', ...hidden })).toBeChecked()
    await user.click(screen.getByRole('radio', { name: 'Mono', ...hidden }))
    await user.click(screen.getByRole('radio', { name: 'Narrow', ...hidden }))

    expect(preferences.font).toBe('mono')
    expect(preferences.width).toBe('narrow')
    expect(screen.getByRole('radiogroup', { name: 'Font', ...hidden })).toBeInTheDocument()
  })

  it('steps the text size within its bounds', async () => {
    const user = userEvent.setup()
    const preferences = new Preferences(null)
    preferences.size = 23
    render(PreferencesPanel, { id: 'preferences', preferences })
    const larger = screen.getByRole('button', { name: 'Larger text', ...hidden })
    const smaller = screen.getByRole('button', { name: 'Smaller text', ...hidden })

    await user.click(larger)
    expect(preferences.size).toBe(24)
    expect(larger).toBeDisabled()
    expect(screen.getByRole('status', hidden)).toHaveTextContent('24')

    preferences.size = 15
    await user.click(smaller)
    expect(preferences.size).toBe(14)
    expect(await screen.findByRole('button', { name: 'Smaller text', ...hidden })).toBeDisabled()
  })
})
