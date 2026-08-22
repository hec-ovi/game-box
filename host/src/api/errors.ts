import type { ErrorBody, ErrorType } from './schema.ts'

/** Every non-2xx answer carries this body. */
export function errorBody(message: string, type: ErrorType): ErrorBody {
  return { error: { message, type } }
}
