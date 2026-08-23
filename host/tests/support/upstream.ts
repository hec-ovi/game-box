/** A mock OpenAI-compatible server, so the proxy engine can be tested for real. */
import { createServer, type Server } from 'node:http'
import { stop } from './host.ts'

/** One request the engine received, as it arrived on the wire. */
export interface SeenRequest {
  readonly url: string
  readonly headers: Readonly<Record<string, string | string[] | undefined>>
  readonly body: Record<string, unknown>
}

export interface RunningUpstream {
  readonly base: string
  /** Every request the engine received. */
  readonly seen: SeenRequest[]
  /** Change what it answers with, for a test that needs the engine to break. */
  answerWith(payloads: readonly string[]): void
  close(): Promise<void>
}

/** Answers `POST /v1/chat/completions` with one SSE event per payload. */
export async function startUpstream(payloads: readonly string[]): Promise<RunningUpstream> {
  const seen: SeenRequest[] = []
  let answer = payloads
  const server = createServer((request, response) => {
    const chunks: Buffer[] = []
    request.on('data', (chunk: Buffer) => chunks.push(chunk))
    request.on('end', () => {
      seen.push({
        url: request.url ?? '',
        headers: request.headers,
        body: JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>,
      })
      response.writeHead(200, { 'content-type': 'text/event-stream' })
      for (const payload of answer) response.write(`data: ${payload}\n\n`)
      response.end()
    })
  })
  const port = await open(server)
  return {
    base: `http://127.0.0.1:${port}`,
    seen,
    answerWith: (next) => {
      answer = next
    },
    close: () => stop(server),
  }
}

function open(server: Server): Promise<number> {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      resolve(typeof address === 'object' && address !== null ? address.port : 0)
    })
  })
}
