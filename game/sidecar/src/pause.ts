/** Waits `ms`, or until `signal` fires, whichever comes first. Leaves no timer and no listener behind. */
export function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve()
    const done = () => {
      clearTimeout(timer)
      signal.removeEventListener('abort', done)
      resolve()
    }
    const timer = setTimeout(done, ms)
    // A pending wait must never be the reason a process stays alive.
    ;(timer as { unref?: () => void }).unref?.()
    signal.addEventListener('abort', done, { once: true })
  })
}
