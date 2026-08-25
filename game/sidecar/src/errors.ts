import type { SchemaViolation } from '@gb/kit'

/** Which clock ran out. `ask` only has one; a stream is judged on progress, not on length. */
export type TimeoutPhase = 'response' | 'first-token' | 'token'

export type SidecarError =
  | { readonly code: 'unreachable'; readonly message: string }
  | { readonly code: 'refused'; readonly status: number; readonly message: string }
  /** The model is rate-limited. `retryAfter` is the seconds before it is worth asking again. */
  | { readonly code: 'busy'; readonly retryAfter: number; readonly message: string }
  | { readonly code: 'no-tool-call'; readonly message: string }
  | { readonly code: 'invalid-arguments'; readonly violations: readonly SchemaViolation[] }
  /** The engine behind the sidecar died mid-reply. What arrived before is real; the answer is not. */
  | { readonly code: 'broken'; readonly message: string }
  | { readonly code: 'timeout'; readonly phase: TimeoutPhase; readonly ms: number; readonly message: string }
  | { readonly code: 'aborted'; readonly message: string }

export function broken(): SidecarError {
  return { code: 'broken', message: 'the engine broke off mid-reply' }
}
