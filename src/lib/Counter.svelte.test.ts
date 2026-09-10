import Counter from '$lib/Counter.svelte'
import { render, screen } from '@testing-library/svelte'
import { userEvent } from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

describe('Counter', () => {
  it('starts at zero', () => {
    render(Counter)

    expect(screen.getByRole('button')).toHaveTextContent('Count is 0')
  })

  it('increments the count on each click', async () => {
    const user = userEvent.setup()
    render(Counter)
    const button = screen.getByRole('button')

    await user.click(button)
    await user.click(button)

    expect(button).toHaveTextContent('Count is 2')
  })
})
