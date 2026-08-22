/** A mock OpenAI-compatible server, so the proxy engine can be tested for real. */
import { createServer, type Server } from 'node:http'
import { stop } from './host.ts'

export interface RunningUpstream {
  readonly base: string
  /** Every request body the engine received. */
  readonly seen: Array<Record<string, unknown>>
  close(): Promise<void>
}

/** Answers `POST /v1/chat/completions` with one SSE event per payload. */
export async function startUpstream(payloads: readonly string[]): Promise<RunningUpstream> {
  const seen: Array<Record<string, unknown>> = []
  const server = createServer((request, response) => {
    const chunks: Buffer[] = []
    request.on('data', (chunk: Buffer) => chunks.push(chunk))
    request.on('end', () => {
      seen.push(JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>)
      response.writeHead(200, { 'content-type': 'text/event-stream' })
      for (const payload of payloads) response.write(`data: ${payload}\n\n`)
      response.end()
    })
  })
  const port = await open(server)
  return { base: `http://127.0.0.1:${port}`, seen, close: () => stop(server) }
}

function open(server: Server): Promise<number> {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      resolve(typeof address === 'object' && address !== null ? address.port : 0)
    })
  })
}
