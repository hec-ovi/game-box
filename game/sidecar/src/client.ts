import { err, ok, type Contract, type Result } from '@gb/kit'
import { Deadline } from './deadline.ts'
import type { SidecarError } from './errors.ts'
import type { AskOptions, ConverseEvent, ConverseOptions } from './options.ts'
import { converseEvents } from './stream.ts'
import { DEFAULT_TIMEOUTS, type Timeouts } from './timeouts.ts'
import { askBody, converseBody, type ChatResponse } from './wire.ts'

const DEFAULT_BASE = 'http://127.0.0.1:8976'

export interface SidecarOptions {
  readonly base?: string
  readonly model?: string
  readonly fetch?: typeof fetch
  /** Defaults for every call this client makes. A single call can still override them. */
  readonly timeouts?: Partial<Timeouts>
}

/**
 * The client for the local AI sidecar. `ask` gets one structured answer: the
 * model is handed a single tool and told to call it, so what comes back is a
 * typed value checked against the very schema the tool was built from, never
 * prose. `converse` streams a reply as it is spoken, with any actions the
 * speaker takes arriving as calls in the same stream.
 *
 * No call can hang. Each one runs against a clock and against the caller's own
 * `AbortSignal`, and reports which of the two stopped it.
 */
export class Sidecar {
  #base: string
  #model: string
  #fetch: typeof fetch
  #timeouts: Timeouts

  constructor(options: SidecarOptions = {}) {
    this.#base = (options.base ?? readEnv('GAME_BOX_URL') ?? DEFAULT_BASE).replace(/\/$/, '')
    this.#model = options.model ?? 'game-box/local'
    this.#fetch = options.fetch ?? globalThis.fetch.bind(globalThis)
    this.#timeouts = { ...DEFAULT_TIMEOUTS, ...options.timeouts }
  }

  get base(): string {
    return this.#base
  }

  async ask<T>(contract: Contract<T>, options: AskOptions): Promise<Result<T, SidecarError>> {
    const deadline = new Deadline({
      signal: options.signal,
      phase: 'response',
      ms: options.timeoutMs ?? this.#timeouts.askMs,
    })
    try {
      const response = await this.#post(askBody(this.#model, options, contract.jsonSchema()), deadline)
      if (!response.ok) return response

      const payload = await response.value.json().then((value) => value as ChatResponse, () => null)
      const stopped = deadline.failure()
      if (stopped) return err(stopped)

      const call = payload?.choices?.[0]?.message?.tool_calls?.[0]
      if (!call || call.function.name !== options.toolName) {
        return err({ code: 'no-tool-call', message: 'the model answered without calling the tool' })
      }

      let args: unknown
      try {
        args = JSON.parse(call.function.arguments)
      } catch (cause) {
        return err({
          code: 'invalid-arguments',
          violations: [{ path: '(root)', message: `arguments are not JSON: ${String(cause)}` }],
        })
      }

      const parsed = contract.parse(args)
      if (!parsed.ok) return err({ code: 'invalid-arguments', violations: parsed.error })
      return ok(parsed.value)
    } finally {
      deadline.release()
    }
  }

  /** A streamed reply. Text arrives in pieces; actions arrive as calls. */
  async converse(options: ConverseOptions): Promise<Result<AsyncIterable<ConverseEvent>, SidecarError>> {
    const deadline = new Deadline({
      signal: options.signal,
      phase: 'first-token',
      ms: options.firstTokenMs ?? this.#timeouts.firstTokenMs,
    })
    const response = await this.#post(converseBody(this.#model, options), deadline)
    if (!response.ok) {
      deadline.release()
      return response
    }
    const body = response.value.body
    if (!body) {
      deadline.release()
      return err({ code: 'refused', status: response.value.status, message: 'the reply had no body' })
    }
    // From here the stream owns the deadline and releases it however it ends.
    return ok(converseEvents(body, deadline, options.idleMs ?? this.#timeouts.idleMs))
  }

  async #post(body: unknown, deadline: Deadline): Promise<Result<Response, SidecarError>> {
    const before = deadline.failure()
    if (before) return err(before)

    let response: Response
    try {
      response = await this.#fetch(`${this.#base}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: deadline.signal,
      })
    } catch (cause) {
      return err(deadline.failure() ?? { code: 'unreachable', message: `${this.#base}: ${String(cause)}` })
    }
    if (!response.ok) {
      const text = await response.text().catch(() => '')
      return err(deadline.failure() ?? { code: 'refused', status: response.status, message: text.slice(0, 400) })
    }
    return ok(response)
  }
}

function readEnv(name: string): string | undefined {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
  return env?.[name]
}
