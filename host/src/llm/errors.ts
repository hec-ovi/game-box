import { violationText, type SchemaViolation } from '../contract.ts'

/** The closed error set of the generation layer. */
export type LlmError =
  | { readonly code: 'invalid-request'; readonly message: string; readonly violations: readonly SchemaViolation[] }
  | { readonly code: 'upstream'; readonly message: string }
  | { readonly code: 'busy'; readonly message: string; readonly retryAfterSeconds: number }

export function invalidRequest(violations: readonly SchemaViolation[]): LlmError {
  return { code: 'invalid-request', message: violationText(violations), violations }
}

export function upstreamFailed(message: string): LlmError {
  return { code: 'upstream', message }
}

/** The upstream is rate-limited: not broken, just not now. */
export function modelBusy(retryAfterSeconds: number): LlmError {
  return { code: 'busy', message: `the model is busy, retry in ${retryAfterSeconds} s`, retryAfterSeconds }
}
