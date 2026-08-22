import { err, ok, type Result } from '../result.ts'
import { upstreamFailed, type LlmError } from './errors.ts'
import { PendingCall } from './pending-call.ts'
import type { GenerateRequest, TokenEvent } from './schema.ts'

interface Delta {
  readonly content?: unknown
  readonly tool_calls?: unknown
}

interface Choice {
  readonly delta?: Delta
  readonly finish_reason?: unknown
}

/**
 * Proxy generation to an OpenAI-compatible server. No output-length cap is
 * ever sent: the model must finish naturally.
 */
export async function generate(
  base: string,
  request: GenerateRequest,
): Promise<Result<AsyncIterable<TokenEvent>, LlmError>> {
  const body: Record<string, unknown> = {
    model: request.model ?? 'default',
    messages: request.messages,
    stream: true,
  }
  if (request.temperature !== undefined) body.temperature = request.temperature
  if (request.tools !== undefined) body.tools = request.tools
  if (request.tool_choice !== undefined) body.tool_choice = request.tool_choice

  let response: Response
  try {
    response = await fetch(`${base}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch (cause) {
    return err(upstreamFailed(String(cause)))
  }
  if (!response.ok) return err(upstreamFailed(`status ${response.status}`))
  if (!response.body) return err(upstreamFailed('the upstream reply had no body'))
  return ok(read(response.body))
}

/** OpenAI SSE deltas turned into token events, with tool calls reassembled. */
async function* read(body: ReadableStream<Uint8Array>): AsyncGenerator<TokenEvent> {
  const decoder = new TextDecoder()
  const reader = body.getReader()
  let buffer = ''
  // A tool call arrives split across deltas; it is only an event once it is
  // whole and its arguments parse.
  let call: PendingCall | undefined
  try {
    for (;;) {
      let chunk: Awaited<ReturnType<typeof reader.read>>
      try {
        chunk = await reader.read()
      } catch {
        yield { type: 'done', finishReason: 'error' }
        return
      }
      if (chunk.done) break
      buffer += decoder.decode(chunk.value, { stream: true })

      let newline = buffer.indexOf('\n')
      while (newline !== -1) {
        const line = buffer.slice(0, newline).trim()
        buffer = buffer.slice(newline + 1)
        newline = buffer.indexOf('\n')
        if (!line.startsWith('data: ')) continue

        const data = line.slice(6)
        if (data === '[DONE]') {
          const finished = call?.finish()
          if (finished) yield finished
          yield { type: 'done', finishReason: 'stop' }
          return
        }

        const choice = choiceOf(data)
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
    }
    yield { type: 'done', finishReason: 'stop' }
  } finally {
    await reader.cancel().catch(() => {})
  }
}

function reasonFor(upstreamReason: string, unparseable: boolean): 'stop' | 'length' | 'error' {
  if (upstreamReason === 'length') return 'length'
  return unparseable ? 'error' : 'stop'
}

function choiceOf(data: string): Choice | undefined {
  let payload: unknown
  try {
    payload = JSON.parse(data)
  } catch {
    return undefined
  }
  if (payload === null || typeof payload !== 'object') return undefined
  const choices = (payload as { choices?: unknown }).choices
  if (!Array.isArray(choices)) return undefined
  const first: unknown = choices[0]
  return first === null || typeof first !== 'object' ? undefined : (first as Choice)
}
