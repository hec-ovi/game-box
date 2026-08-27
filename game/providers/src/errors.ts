import type { SchemaViolation } from '@gb/kit'

/**
 * Everything that can come back instead of an answer. A probe's own bad news
 * (nothing answered, the key is wrong, the model is busy) is not in here: that
 * is a verdict the service answers 200 with, and it is data, not a failure.
 */
export type ProvidersError =
  /** The service could not be contacted. Nothing was read and nothing was written. */
  | { readonly code: 'unreachable'; readonly message: string }
  /** It answered with a status this box cannot use: a configuration it will not take, a file it cannot write. */
  | { readonly code: 'refused'; readonly status: number; readonly message: string }
  /** No provider of that id. The configuration moved under the caller. */
  | { readonly code: 'no-such-provider'; readonly message: string }
  /** The answer did not fit the schema it is published under, so none of it is used. */
  | { readonly code: 'off-contract'; readonly violations: readonly SchemaViolation[] }
  | { readonly code: 'timeout'; readonly ms: number; readonly message: string }
  /** The caller stopped the call. Never retry this one; someone decided it was no longer wanted. */
  | { readonly code: 'aborted'; readonly message: string }
