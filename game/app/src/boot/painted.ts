/**
 * Let the browser draw what was just said before the next stretch of work
 * blocks it again. Without this the panel's progress line only appears after
 * the thing it was announcing has already finished.
 *
 * A tab nobody is looking at has nothing to draw, and its timers are throttled
 * to a second apiece, so waiting there would cost seconds and show nobody
 * anything.
 */
export function painted(): Promise<void> {
  if (typeof document !== 'undefined' && document.hidden) return Promise.resolve()
  return new Promise((resolve) => {
    const done = () => resolve()
    setTimeout(done, 50)
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => requestAnimationFrame(done))
  })
}
