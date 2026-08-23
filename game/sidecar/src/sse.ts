/**
 * Turns a byte stream of server-sent events into the payload of each `data:` line.
 *
 * `onProgress` is called for every chunk of bytes that arrives, which is what
 * "the model is still talking" means on the wire. However the loop ends, read
 * to the last byte, aborted mid-token or abandoned by the consumer, the reader
 * is cancelled on the way out so no half-consumed response is left behind.
 */
export async function* sseData(body: ReadableStream<Uint8Array>, onProgress?: () => void): AsyncGenerator<string> {
  const decoder = new TextDecoder()
  const reader = body.getReader()
  let buffer = ''
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      onProgress?.()
      buffer += decoder.decode(value, { stream: true })
      let newline = buffer.indexOf('\n')
      while (newline !== -1) {
        const line = buffer.slice(0, newline).trim()
        buffer = buffer.slice(newline + 1)
        if (line.startsWith('data: ')) yield line.slice(6)
        newline = buffer.indexOf('\n')
      }
    }
    const last = buffer.trim()
    if (last.startsWith('data: ')) yield last.slice(6)
  } finally {
    // Cancelling an already-broken stream rejects; that is not a new failure.
    await reader.cancel().catch(() => {})
  }
}
