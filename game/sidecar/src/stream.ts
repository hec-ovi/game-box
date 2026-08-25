import type { Deadline } from './deadline.ts'
import { broken } from './errors.ts'
import type { ConverseEvent } from './options.ts'
import { sseData } from './sse.ts'
import type { StreamChunk } from './wire.ts'

/**
 * A streamed reply, judged on progress rather than on length.
 *
 * The clock restarts twice per piece: when bytes land, and again once the
 * consumer comes back for more. So a model that keeps talking is never cut
 * off, and a model that goes quiet is, in `idleMs`.
 *
 * A stream that breaks off ends with one `error` event carrying the reason,
 * and nothing follows it: the connection dropped, a clock ran out, the caller
 * left, or the sidecar itself said the engine died (`finish_reason: "error"`).
 * However it ends, the deadline is released and the body reader is cancelled.
 */
export async function* converseEvents(
  body: ReadableStream<Uint8Array>,
  deadline: Deadline,
  idleMs: number,
): AsyncGenerator<ConverseEvent> {
  const progressed = () => deadline.restart('token', idleMs)
  try {
    for await (const data of sseData(body, progressed)) {
      if (data === '[DONE]') return
      for (const event of eventsIn(data)) {
        yield event
        if (event.kind === 'error') return
      }
      progressed()
    }
  } catch (cause) {
    const error = deadline.failure() ?? { code: 'unreachable' as const, message: `the reply broke off: ${String(cause)}` }
    yield { kind: 'error', error }
  } finally {
    deadline.release()
  }
}

function* eventsIn(data: string): Generator<ConverseEvent> {
  let chunk: StreamChunk
  try {
    chunk = JSON.parse(data) as StreamChunk
  } catch {
    return // not a chunk we understand; the reply is still alive
  }
  const choice = chunk.choices?.[0]
  const text = choice?.delta?.content
  if (text) yield { kind: 'text', text }

  for (const call of choice?.delta?.tool_calls ?? []) {
    let args: unknown
    try {
      args = JSON.parse(call.function.arguments)
    } catch {
      continue // a call whose arguments do not parse is not an action
    }
    yield { kind: 'call', name: call.function.name, arguments: args }
  }
  if (choice?.finish_reason === 'error') yield { kind: 'error', error: broken() }
  else if (choice?.finish_reason) yield { kind: 'end', reason: choice.finish_reason }
}
