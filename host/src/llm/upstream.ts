import { err, ok, type Result } from '../result.ts'
import { Backoff } from './backoff.ts'
import { modelBusy, upstreamFailed, type LlmError } from './errors.ts'
import { PendingCall } from './pending-call.ts'
import { retryAfterSeconds } from './retry-after.ts'
import { samplingOf } from './sampling.ts'
import type { GenerateRequest, TokenEvent } from './schema.ts'
import { payloadsOf, prepend, type Payload } from './sse.ts'

/** Where an OpenAI-compatible server is, what it wants, and what it answers as. */
export interface Upstream {
  /** The full chat-completions URL, not a base to join onto. */
  readonly completions: string
  /** Sent on every request. */
  readonly headers?: Readonly<Record<string, string>>
  /** The model asked for when the caller names none. */
  readonly model: string
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
 */
export async function generate(
  upstream: Upstream,
  request: GenerateRequest,
): Promise<Result<AsyncIterable<TokenEvent>, LlmError>> {
  const body: Record<string, unknown> = {
    model: request.model ?? upstream.model,
    messages: request.messages,
    stream: true,
    ...samplingOf(request),
  }
  if (request.tools !== undefined) body.tools = request.tools
  if (request.tool_choice !== undefined) body.tool_choice = request.tool_choice

  let response: Response
  try {
    response = await fetch(upstream.completions, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...upstream.headers },
      body: JSON.stringify(body),
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
  return ok(read(first.done ? payloads : prepend(first.value, payloads)))
}

function busy(retryAfter: number | undefined): LlmError {
  return modelBusy(retryAfter ?? backoff.next())
}

function isBusy(payload: Payload): boolean {
  const error = payload.error
  return error !== null && typeof error === 'object' && (error as { code?: unknown }).code === BUSY
}

/**
 * A credential must never come back out, whatever a transport error put in its
 * message, so it is scrubbed from every failure this reports.
 */
function failed(upstream: Upstream, message: string): LlmError {
  const secret = upstream.secret ?? ''
  return upstreamFailed(secret === '' ? message : message.split(secret).join('***'))
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
