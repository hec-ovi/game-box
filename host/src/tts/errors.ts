import { violationText, type SchemaViolation } from '../contract.ts'

/** The closed error set of the synthesis layer. */
export type TtsError =
  | { readonly code: 'invalid-request'; readonly message: string }
  | { readonly code: 'unknown-voice'; readonly message: string; readonly voice: string }

export function invalidRequest(violations: readonly SchemaViolation[]): TtsError {
  return { code: 'invalid-request', message: `invalid speak request: ${violationText(violations)}` }
}

export function unknownVoice(voice: string): TtsError {
  return { code: 'unknown-voice', message: `unknown voice: ${voice}`, voice }
}
