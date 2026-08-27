import { err, ok, type Contract, type Result } from '@gb/kit'
import type { ProvidersError } from './errors.ts'

/** One call to the service: where it goes, what it carries, and how long it may take. */
export interface Sent {
  readonly method: 'GET' | 'PUT' | 'POST'
  readonly path: string
  /** Sent as JSON when it is there. A `GET` carries nothing. */
  readonly body?: unknown
  readonly ms: number
  readonly signal?: AbortSignal | undefined
}

/**
 * The only place in this box that touches `fetch`. It runs one call against a
 * clock and against the caller's own signal, tells the two apart, and hands
 * back the reply only once it has passed the schema it is published under.
 */
export class Wire {
  #base: string
  #fetch: typeof fetch

  constructor(base: string, doFetch: typeof fetch) {
    this.#base = base.replace(/\/$/, '')
    this.#fetch = doFetch
  }

  get base(): string {
    return this.#base
  }

  async ask<T>(shape: Contract<T>, sent: Sent): Promise<Result<T, ProvidersError>> {
    if (sent.signal?.aborted) return err(stopped())

    const clock = new AbortController()
    let late = false
    const timer = setTimeout(() => {
      late = true
      clock.abort()
    }, sent.ms)
    const relay = (): void => clock.abort()
    sent.signal?.addEventListener('abort', relay, { once: true })

    try {
      const url = `${this.#base}${sent.path}`
      let response: Response
      try {
        response = await this.#fetch(url, {
          method: sent.method,
          signal: clock.signal,
          ...(sent.body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(sent.body) }),
        })
      } catch (cause) {
        if (sent.signal?.aborted) return err(stopped())
        if (late) return err({ code: 'timeout', ms: sent.ms, message: `${url} did not answer in ${sent.ms} ms` })
        return err({ code: 'unreachable', message: `${this.#base}: ${String(cause)}` })
      }

      const text = await response.text().catch(() => '')
      if (sent.signal?.aborted) return err(stopped())
      if (!response.ok) return err(refusal(response.status, text))

      let payload: unknown
      try {
        payload = JSON.parse(text)
      } catch {
        return err({ code: 'off-contract', violations: [{ path: '(root)', message: 'the answer is not JSON' }] })
      }
      const checked = shape.parse(payload)
      return checked.ok ? ok(checked.value) : err({ code: 'off-contract', violations: checked.error })
    } finally {
      clearTimeout(timer)
      sent.signal?.removeEventListener('abort', relay)
    }
  }
}

function stopped(): ProvidersError {
  return { code: 'aborted', message: 'the caller stopped the call' }
}

/** A non-2xx answer, with whatever the service said about it in words. */
function refusal(status: number, text: string): ProvidersError {
  const message = said(text) ?? text.slice(0, 400)
  if (status === 404) return { code: 'no-such-provider', message }
  return { code: 'refused', status, message }
}

/** The service's own error body says why in one line; anything else is quoted as it came. */
function said(text: string): string | undefined {
  try {
    const body = JSON.parse(text) as { error?: { message?: unknown } }
    const message = body.error?.message
    return typeof message === 'string' ? message : undefined
  } catch {
    return undefined
  }
}
