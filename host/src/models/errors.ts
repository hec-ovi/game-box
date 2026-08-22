import { violationText, type SchemaViolation } from '../contract.ts'

/** The closed error set of the model cache. */
export type ModelsError =
  | { readonly code: 'invalid-entry'; readonly message: string; readonly violations: readonly SchemaViolation[] }
  | { readonly code: 'missing'; readonly message: string; readonly path: string }
  | { readonly code: 'integrity'; readonly message: string; readonly expected: string; readonly actual: string }
  | { readonly code: 'unreadable'; readonly message: string }

export function invalidEntry(violations: readonly SchemaViolation[]): ModelsError {
  return { code: 'invalid-entry', message: `invalid model entry: ${violationText(violations)}`, violations }
}

export function missing(path: string): ModelsError {
  return { code: 'missing', message: `model not cached: ${path}`, path }
}

export function integrity(expected: string, actual: string): ModelsError {
  return { code: 'integrity', message: `sha256 mismatch: expected ${expected}, found ${actual}`, expected, actual }
}

export function unreadable(cause: unknown): ModelsError {
  return { code: 'unreadable', message: `cached model unreadable: ${String(cause)}` }
}
