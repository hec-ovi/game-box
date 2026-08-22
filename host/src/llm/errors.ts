import { violationText, type SchemaViolation } from '../contract.ts'

/** The closed error set of the generation layer. */
export type LlmError =
  | { readonly code: 'invalid-request'; readonly message: string; readonly violations: readonly SchemaViolation[] }
  | { readonly code: 'upstream'; readonly message: string }

export function invalidRequest(violations: readonly SchemaViolation[]): LlmError {
  return { code: 'invalid-request', message: violationText(violations), violations }
}

export function upstreamFailed(message: string): LlmError {
  return { code: 'upstream', message }
}
