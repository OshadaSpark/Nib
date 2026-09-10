import { render, screen } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import App from './App.svelte'

describe('App', () => {
  it('renders the editor in the main landmark', () => {
    render(App)

    expect(screen.getByRole('main')).toContainElement(
      screen.getByRole('textbox', { name: 'Document' }),
    )
  })
})
