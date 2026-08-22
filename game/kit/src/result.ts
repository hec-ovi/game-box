/** Every box boundary returns one of these instead of throwing. */
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E }

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value }
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error }
}

/** Unwrap or throw. Only for tests and top-level entry points. */
export function expect<T, E>(result: Result<T, E>, context: string): T {
  if (result.ok) return result.value
  throw new Error(`${context}: ${JSON.stringify(result.error)}`)
}
