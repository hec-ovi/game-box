import type { SchemaViolation } from '@gb/kit'

export type SidecarError =
  | { readonly code: 'unreachable'; readonly message: string }
  | { readonly code: 'refused'; readonly status: number; readonly message: string }
  | { readonly code: 'no-tool-call'; readonly message: string }
  | { readonly code: 'invalid-arguments'; readonly violations: readonly SchemaViolation[] }
