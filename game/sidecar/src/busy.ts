import type { ErrorBody } from './wire.ts'

/** What a rate-limited answer said: HTTP 429, or the sidecar's `model-busy` error code. */
export interface BusyAnswer {
  /** The sidecar's own `Retry-After`, in seconds, when it named one. */
  readonly retryAfter: number | undefined
  readonly message: string
}

export function busyAnswer(response: Response, text: string): BusyAnswer | undefined {
  const body = errorBody(text)
  if (response.status !== 429 && body?.code !== 'model-busy') return undefined
  return {
    retryAfter: retryAfterSeconds(response.headers.get('retry-after')),
    message: body?.message ?? 'the model is busy',
  }
}

function errorBody(text: string): ErrorBody['error'] {
  try {
    return (JSON.parse(text) as ErrorBody).error
  } catch {
    return undefined
  }
}

/** `Retry-After` is either whole seconds or an HTTP date. Anything else is no hint. */
function retryAfterSeconds(header: string | null): number | undefined {
  if (header === null) return undefined
  const value = header.trim()
  if (/^\d+$/.test(value)) return Number(value)
  const at = Date.parse(value)
  if (Number.isNaN(at)) return undefined
  return Math.max(0, Math.ceil((at - Date.now()) / 1000))
}
