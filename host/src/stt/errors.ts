import { violationText, type SchemaViolation } from '../contract.ts'

/** The closed error set of the recognition layer. */
export type SttError = { readonly code: 'invalid-chunk'; readonly message: string }

export function invalidChunk(reason: string | readonly SchemaViolation[]): SttError {
  const detail = typeof reason === 'string' ? reason : violationText(reason)
  return { code: 'invalid-chunk', message: `invalid chunk: ${detail}` }
}
