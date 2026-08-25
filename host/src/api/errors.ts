import type { ErrorBody, ErrorCode, ErrorType } from './schema.ts'

/** Every non-2xx answer carries this body. */
export function errorBody(message: string, type: ErrorType, code?: ErrorCode): ErrorBody {
  return code === undefined ? { error: { message, type } } : { error: { message, type, code } }
}
