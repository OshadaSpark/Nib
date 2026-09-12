/** A question for the user, with a button to confirm and one to cancel. */
export interface Question {
  title: string
  message: string
  /** Label of the button that confirms. */
  confirm: string
  /** Label of the button that cancels. */
  cancel: string
}

/** Asks the user a question, resolving to whether they confirmed. */
export type Confirm = (question: Question) => Promise<boolean>

interface Pending {
  question: Question
  resolve: (confirmed: boolean) => void
}

/** The question awaiting an answer, which `ConfirmDialog` shows. */
export class Confirmation {
  #pending: Pending | null = $state.raw(null)

  get question(): Question | null {
    return this.#pending?.question ?? null
  }

  /** Asks a question, cancelling the one still open, if any. Bound, so it can be passed around. */
  ask: Confirm = (question) => {
    this.#pending?.resolve(false)
    return new Promise((resolve) => {
      this.#pending = { question, resolve }
    })
  }

  answer(confirmed: boolean): void {
    this.#pending?.resolve(confirmed)
    this.#pending = null
  }
}
