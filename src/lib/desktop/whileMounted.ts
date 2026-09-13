/**
 * For `onMount`: returns the function that stops what `watching` starts (resolving to its own stop
 * function), even before it has started. A failure to start is logged, and leaves nothing to stop.
 */
export const whileMounted = (watching: Promise<() => void>): (() => void) => {
  const started = watching.catch((error: unknown) => {
    console.error(error)
    return () => undefined
  })
  return () => {
    void started.then((stop) => {
      stop()
    })
  }
}
