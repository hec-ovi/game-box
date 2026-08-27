import { violationText, type SchemaViolation } from '../contract.ts'

/** The closed error set of the provider registry. */
export type ProvidersError =
  | { readonly code: 'invalid-config'; readonly message: string; readonly violations: readonly SchemaViolation[] }
  | { readonly code: 'no-such-provider'; readonly message: string; readonly id: string }
  | { readonly code: 'unreadable'; readonly message: string; readonly path: string }
  | { readonly code: 'unwritable'; readonly message: string; readonly path: string }

export function invalidConfig(violations: readonly SchemaViolation[]): ProvidersError {
  return { code: 'invalid-config', message: violationText(violations), violations }
}

export function noSuchProvider(id: string): ProvidersError {
  return { code: 'no-such-provider', message: `no such provider: ${id}`, id }
}

export function unreadable(path: string, why: string): ProvidersError {
  return { code: 'unreadable', message: `${path} cannot be read: ${why}`, path }
}

export function unwritable(path: string, why: string): ProvidersError {
  return { code: 'unwritable', message: `${path} cannot be written: ${why}`, path }
}
