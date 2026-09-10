import { render, screen } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import App from './App.svelte'

describe('App', () => {
  it('renders the main heading', () => {
    render(App)

    expect(screen.getByRole('heading', { level: 1, name: 'Get started' })).toBeInTheDocument()
  })

  it('renders the counter', () => {
    render(App)

    expect(screen.getByRole('button', { name: 'Count is 0' })).toBeInTheDocument()
  })

  it('opens external links in a new tab without leaking the referrer', () => {
    render(App)

    const externalLinks = screen.getAllByRole('link')

    expect(externalLinks).not.toHaveLength(0)
    for (const link of externalLinks) {
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noreferrer')
    }
  })
})
