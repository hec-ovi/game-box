/** Turns a byte stream of server-sent events into the payload of each `data:` line. */
export async function* sseData(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const decoder = new TextDecoder()
  const reader = body.getReader()
  let buffer = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
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
}
