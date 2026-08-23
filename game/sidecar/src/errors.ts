import type { SchemaViolation } from '@gb/kit'

/** Which clock ran out. `ask` only has one; a stream is judged on progress, not on length. */
export type TimeoutPhase = 'response' | 'first-token' | 'token'

export type SidecarError =
  | { readonly code: 'unreachable'; readonly message: string }
  | { readonly code: 'refused'; readonly status: number; readonly message: string }
  | { readonly code: 'no-tool-call'; readonly message: string }
  | { readonly code: 'invalid-arguments'; readonly violations: readonly SchemaViolation[] }
  | { readonly code: 'timeout'; readonly phase: TimeoutPhase; readonly ms: number; readonly message: string }
  | { readonly code: 'aborted'; readonly message: string }
