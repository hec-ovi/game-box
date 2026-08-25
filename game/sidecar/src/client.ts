import { err, ok, type Contract, type Result } from '@gb/kit'
import { BusySchedule, DEFAULT_BACKOFF, type Backoff, type BusyNotice } from './backoff.ts'
import { busyAnswer } from './busy.ts'
import { Deadline } from './deadline.ts'
import { FetchDispatcher } from './dispatcher.ts'
import { broken, type SidecarError } from './errors.ts'
import type { AskOptions, ConverseEvent, ConverseOptions } from './options.ts'
import { pause } from './pause.ts'
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
  /** How a call waits when the model is busy. */
  readonly backoff?: Partial<Backoff>
  /** Told before every wait on a busy model, so the screen can say so. */
  readonly onBusy?: (notice: BusyNotice) => void
}

/**
 * The client for the local AI sidecar. `ask` gets one structured answer: the
 * model is handed a single tool and told to call it, so what comes back is a
 * typed value checked against the very schema the tool was built from, never
 * prose. `converse` streams a reply as it is spoken, with any actions the
 * speaker takes arriving as calls in the same stream.
 *
 * No call can hang. Each one runs against a clock and against the caller's own
 * `AbortSignal`, and reports which of the two stopped it. A busy model is
 * waited out inside that same clock, never past it.
 */
export class Sidecar {
  #base: string
  #model: string
  #fetch: typeof fetch
  #timeouts: Timeouts
  #schedule: BusySchedule
  #onBusy: ((notice: BusyNotice) => void) | undefined
  #dispatcher = new FetchDispatcher()

  constructor(options: SidecarOptions = {}) {
    this.#base = (options.base ?? readEnv('GAME_BOX_URL') ?? DEFAULT_BASE).replace(/\/$/, '')
    this.#model = options.model ?? 'game-box/local'
    this.#fetch = options.fetch ?? globalThis.fetch.bind(globalThis)
    this.#timeouts = { ...DEFAULT_TIMEOUTS, ...options.timeouts }
    this.#schedule = new BusySchedule({ ...DEFAULT_BACKOFF, ...options.backoff })
    this.#onBusy = options.onBusy
  }

  get base(): string {
    return this.#base
  }

  async ask<T>(contract: Contract<T>, options: AskOptions): Promise<Result<T, SidecarError>> {
    const ms = options.timeoutMs ?? this.#timeouts.askMs
    const deadline = new Deadline({ signal: options.signal, phase: 'response', ms })
    try {
      const response = await this.#post(askBody(this.#model, options, contract.jsonSchema()), deadline, ms)
      if (!response.ok) return response

      const payload = await response.value.json().then((value) => value as ChatResponse, () => null)
      const stopped = deadline.failure()
      if (stopped) return err(stopped)

      const choice = payload?.choices?.[0]
      const call = choice?.message?.tool_calls?.[0]
      if (!call || call.function.name !== options.toolName) {
        if (choice?.finish_reason === 'error') return err(broken())
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
    const firstTokenMs = options.firstTokenMs ?? this.#timeouts.firstTokenMs
    const idleMs = options.idleMs ?? this.#timeouts.idleMs
    const deadline = new Deadline({ signal: options.signal, phase: 'first-token', ms: firstTokenMs })
    const response = await this.#post(converseBody(this.#model, options), deadline, Math.max(firstTokenMs, idleMs))
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
    return ok(converseEvents(body, deadline, idleMs))
  }

  /**
   * Sends the call, and sends it again after a busy answer for as long as the
   * schedule and the deadline both allow. `ms` is the longest this call may
   * run: the transport's clocks are set past it.
   */
  async #post(body: unknown, deadline: Deadline, ms: number): Promise<Result<Response, SidecarError>> {
    const payload = JSON.stringify(body)
    for (let attempt = 1; ; attempt += 1) {
      const sent = await this.#send(payload, deadline, ms, attempt)
      if (sent.ok || sent.error.code !== 'busy') return sent

      const waitMs = this.#schedule.waitBefore(attempt + 1, sent.error.retryAfter)
      if (waitMs === undefined || waitMs > deadline.remaining()) return sent

      this.#onBusy?.({ attempt, retryAfter: sent.error.retryAfter, waitMs })
      await pause(waitMs, deadline.signal)
      const stopped = deadline.failure()
      if (stopped) return err(stopped)
    }
  }

  async #send(payload: string, deadline: Deadline, ms: number, attempt: number): Promise<Result<Response, SidecarError>> {
    const before = deadline.failure()
    if (before) return err(before)

    let response: Response
    try {
      response = await this.#fetch(`${this.#base}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: payload,
        signal: deadline.signal,
        ...(await this.#dispatcher.forCall(ms)),
      } as RequestInit)
    } catch (cause) {
      return err(deadline.failure() ?? { code: 'unreachable', message: `${this.#base}: ${String(cause)}` })
    }
    if (response.ok) return ok(response)

    const text = await response.text().catch(() => '')
    const stopped = deadline.failure()
    if (stopped) return err(stopped)

    const busy = busyAnswer(response, text)
    if (busy) {
      const retryAfter = this.#schedule.retryAfter(attempt + 1, busy.retryAfter)
      return err({ code: 'busy', retryAfter, message: busy.message })
    }
    return err({ code: 'refused', status: response.status, message: text.slice(0, 400) })
  }
}

function readEnv(name: string): string | undefined {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
  return env?.[name]
}
