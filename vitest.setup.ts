// Registers DOM matchers (e.g. `toBeInTheDocument`) and their types for component tests.
import '@testing-library/jest-dom/vitest'

// jsdom does not implement modal dialogs. This covers what the app uses: opening, and closing with
// a return value, which fires `close`. Escape is left to the E2E tests.
HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
  this.open = true
  this.returnValue = ''
}
HTMLDialogElement.prototype.close = function (this: HTMLDialogElement, returnValue?: string) {
  if (!this.open) return
  if (returnValue !== undefined) this.returnValue = returnValue
  this.open = false
  this.dispatchEvent(new Event('close'))
}
