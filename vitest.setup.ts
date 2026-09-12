// Registers DOM matchers (e.g. `toBeInTheDocument`) and their types for component tests.
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'

// Preferences are saved in local storage, which jsdom keeps between tests.
afterEach(() => {
  localStorage.clear()
})

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

// jsdom has no media queries: report a wide screen, where none of the app's queries match, and
// never a change (CodeMirror listens for print).
window.matchMedia = (query: string): MediaQueryList =>
  ({
    matches: false,
    media: query,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }) as unknown as MediaQueryList

// jsdom has no layout, nor these for ranges, which CodeMirror measures text with (as when scrolling
// the selection into view).
Range.prototype.getClientRects = () => [] as unknown as DOMRectList
Range.prototype.getBoundingClientRect = () => new DOMRect()

// jsdom has no layout, so nothing resizes: elements keep a width of 0 (Svelte measures bound sizes,
// such as the header's, with a resize observer).
window.ResizeObserver = class {
  observe = (): undefined => undefined
  unobserve = (): undefined => undefined
  disconnect = (): undefined => undefined
}
