import { err, ok, type Result } from '../result.ts'
import { scrub } from '../secret.ts'
import { Backoff } from './backoff.ts'
import { modelBusy, upstreamFailed, type LlmError } from './errors.ts'
import type { Forcing } from './forced.ts'
import { ForcedReply } from './forced-reply.ts'
import { PendingCall } from './pending-call.ts'
import { upstreamRequest } from './request-body.ts'
import { retryAfterSeconds } from './retry-after.ts'
import type { GenerateRequest, TokenEvent } from './schema.ts'
import { payloadsOf, prepend, type Payload } from './sse.ts'

/** Where an OpenAI-compatible server is, what it wants, and what it answers as. */
export interface Upstream {
  readonly transport: 'http'
  /** The full chat-completions URL, not a base to join onto. */
  readonly completions: string
  /** Sent on every request. */
  readonly headers?: Readonly<Record<string, string>>
  /** The model asked for when the caller names none. */
  readonly model: string
  /** How a call the request insists on is asked for. */
  readonly forcing: Forcing
  /** A credential inside those headers. It never appears in an error. */
  readonly secret?: string
}

interface Delta {
  readonly content?: unknown
  readonly tool_calls?: unknown
}

interface Choice {
  readonly delta?: Delta
  readonly finish_reason?: unknown
}

const BUSY = 429

/** One upstream per process, so one wait to grow between its refusals. */
const backoff = new Backoff()

/**
 * Proxy generation to an OpenAI-compatible server. No output-length cap is
 * ever sent: the model must finish naturally. A rate limit is answered as
 * `busy` with how long to wait, never as a failure, and never retried here.
 * A call the request insists on comes back as one call whichever way the
 * engine wrote it. `gone` firing closes the connection to the engine, which
 * is how it learns to stop.
 */
export async function generate(
  upstream: Upstream,
  request: GenerateRequest,
  gone?: AbortSignal,
): Promise<Result<AsyncIterable<TokenEvent>, LlmError>> {
  const { body, forced } = upstreamRequest(upstream, request)

  let response: Response
  try {
    response = await fetch(upstream.completions, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...upstream.headers },
      body: JSON.stringify(body),
      signal: gone ?? null,
    })
  } catch (cause) {
    return err(failed(upstream, String(cause)))
  }
  if (response.status === BUSY) return err(busy(retryAfterSeconds(response.headers.get('retry-after'))))
  if (!response.ok) return err(failed(upstream, `status ${response.status}`))
  if (!response.body) return err(failed(upstream, 'the upstream reply had no body'))

  // A router can accept the request and only then learn the model is capped,
  // so the refusal arrives as the first streamed payload of a 200.
  const payloads = payloadsOf(response.body)
  let first: IteratorResult<Payload>
  try {
    first = await payloads.next()
  } catch {
    return err(failed(upstream, 'the upstream reply broke before its first event'))
  }
  if (!first.done && isBusy(first.value)) return err(busy(undefined))

  backoff.reset()
  const events = read(first.done ? payloads : prepend(first.value, payloads))
  return ok(forced === undefined ? events : new ForcedReply(forced.tool, forced.asked).through(events))
}

function busy(retryAfter: number | undefined): LlmError {
  return modelBusy(retryAfter ?? backoff.next())
}

function isBusy(payload: Payload): boolean {
  const error = payload.error
  return error !== null && typeof error === 'object' && (error as { code?: unknown }).code === BUSY
}

/**
 * The address is named. A connection that never opened says only "fetch
 * failed", which is the same sentence whether the engine is down, the port is
 * wrong, or the process is in a container where 127.0.0.1 is the container.
 */
function failed(upstream: Upstream, message: string): LlmError {
  return upstreamFailed(scrub(`${message} (${upstream.completions})`, upstream.secret))
}

/** OpenAI SSE payloads turned into token events, with tool calls reassembled. */
async function* read(payloads: AsyncIterable<Payload>): AsyncGenerator<TokenEvent> {
  // A tool call arrives split across deltas; it is only an event once it is
  // whole and its arguments parse.
  let call: PendingCall | undefined
  try {
    for await (const payload of payloads) {
      // An engine that breaks mid-reply still answers 200 and puts the
      // failure in the stream, so a reply carrying one has not stopped.
      if ('error' in payload) {
        yield { type: 'done', finishReason: 'error' }
        return
      }

      const choice = choiceOf(payload)
      if (!choice) continue
      if (typeof choice.delta?.content === 'string' && choice.delta.content !== '') {
        yield { type: 'token', text: choice.delta.content }
      }
      if (Array.isArray(choice.delta?.tool_calls)) {
        for (const delta of choice.delta.tool_calls) {
          call ??= new PendingCall()
          call.absorb(delta)
        }
      }
      if (typeof choice.finish_reason === 'string') {
        const finished = call?.finish()
        call = undefined
        const unparseable = choice.finish_reason === 'tool_calls' && finished === undefined
        if (finished) yield finished
        yield { type: 'done', finishReason: reasonFor(choice.finish_reason, unparseable) }
        return
      }
    }
  } catch {
    yield { type: 'done', finishReason: 'error' }
    return
  }
  const finished = call?.finish()
  if (finished) yield finished
  yield { type: 'done', finishReason: 'stop' }
}

function reasonFor(upstreamReason: string, unparseable: boolean): 'stop' | 'length' | 'error' {
  if (upstreamReason === 'length') return 'length'
  return unparseable ? 'error' : 'stop'
}

function choiceOf(payload: Payload): Choice | undefined {
  const choices = payload.choices
  if (!Array.isArray(choices)) return undefined
  const first: unknown = choices[0]
  return first === null || typeof first !== 'object' ? undefined : (first as Choice)
}
