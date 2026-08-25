export type Payload = Record<string, unknown>

/**
 * The `data:` payloads of an SSE body, parsed, in order. Ends at the literal
 * `[DONE]` or at the end of the body; a payload that is not a JSON object is
 * skipped. A transport failure mid-body throws, and the reader is released
 * whichever way the iteration ends.
 */
export async function* payloadsOf(body: ReadableStream<Uint8Array>): AsyncGenerator<Payload> {
  const decoder = new TextDecoder()
  const reader = body.getReader()
  let buffer = ''
  try {
    for (;;) {
      const chunk = await reader.read()
      if (chunk.done) return
      buffer += decoder.decode(chunk.value, { stream: true })

      let newline = buffer.indexOf('\n')
      while (newline !== -1) {
        const line = buffer.slice(0, newline).trim()
        buffer = buffer.slice(newline + 1)
        newline = buffer.indexOf('\n')
        if (!line.startsWith('data: ')) continue

        const data = line.slice(6)
        if (data === '[DONE]') return
        const payload = objectOf(data)
        if (payload) yield payload
      }
    }
  } finally {
    await reader.cancel().catch(() => {})
  }
}

/** The iterable again, with one payload already taken off the front put back. */
export async function* prepend(first: Payload, rest: AsyncIterable<Payload>): AsyncGenerator<Payload> {
  yield first
  yield* rest
}

function objectOf(data: string): Payload | undefined {
  let payload: unknown
  try {
    payload = JSON.parse(data)
  } catch {
    return undefined
  }
  return payload === null || typeof payload !== 'object' ? undefined : (payload as Payload)
}
