import { render, screen } from '@testing-library/svelte'
import { userEvent } from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Confirmation, type Question } from './confirmation.svelte'
import ConfirmDialog from './ConfirmDialog.svelte'

const question: Question = {
  title: 'Discard unsaved changes?',
  message: 'Your changes will be lost.',
  confirm: 'Discard',
  cancel: 'Cancel',
}

describe('ConfirmDialog', () => {
  it('shows nothing until asked', () => {
    render(ConfirmDialog, { confirmation: new Confirmation() })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows the question, with the cancel button focused', async () => {
    const confirmation = new Confirmation()
    render(ConfirmDialog, { confirmation })

    void confirmation.ask(question)

    const dialog = await screen.findByRole('dialog', { name: 'Discard unsaved changes?' })
    expect(dialog).toHaveAccessibleDescription('Your changes will be lost.')
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
  })

  it.each([
    ['Discard', true],
    ['Cancel', false],
  ])('answers %s with %s and closes', async (button, confirmed) => {
    const user = userEvent.setup()
    const confirmation = new Confirmation()
    render(ConfirmDialog, { confirmation })
    const answer = confirmation.ask(question)

    await user.click(await screen.findByRole('button', { name: button }))

    expect(await answer).toBe(confirmed)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('Confirmation', () => {
  it('cancels an open question when asked another', async () => {
    const confirmation = new Confirmation()
    const first = confirmation.ask(question)
    const second = confirmation.ask({ ...question, title: 'Reload?' })

    expect(await first).toBe(false)
    expect(confirmation.question?.title).toBe('Reload?')

    confirmation.answer(true)
    expect(await second).toBe(true)
    expect(confirmation.question).toBeNull()
  })
})
