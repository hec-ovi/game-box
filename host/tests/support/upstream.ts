/** A mock OpenAI-compatible server, so the proxy engine can be tested for real. */
import { createServer, type Server, type ServerResponse } from 'node:http'
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
  /** Turn every request away with a status and, where a test needs one, a body. */
  refuseWith(status: number, body?: string, headers?: Readonly<Record<string, string>>): void
  /** Answer the next request with its payloads and then never end the reply, like an engine that keeps decoding. */
  hold(): HeldReply
  close(): Promise<void>
}

/** A reply held open: when the request reached the engine, and when the host hung up on it. */
export interface HeldReply {
  readonly arrived: Promise<void>
  readonly hungUp: Promise<void>
}

interface Answer {
  readonly status: number
  readonly headers: Readonly<Record<string, string>>
  readonly payloads: readonly string[]
  /** Written instead of the payloads when the answer is a refusal. */
  readonly body?: string
  /** Called with the reply instead of ending it. */
  readonly hold?: (response: ServerResponse) => void
}

/** What a provider lists on `GET /v1/models`, one entry named and one not. */
export const STUB_MODELS = { object: 'list', data: [{ id: 'stub-small' }, { id: 'stub-large', name: 'Stub Large' }] }

/** What it answers a non-streamed completion with, the shape the test probe reads. */
export const STUB_REPLY = {
  id: 'stub-1',
  model: 'stub-small',
  choices: [{ index: 0, message: { role: 'assistant', content: 'Hello from the stub.' }, finish_reason: 'stop' }],
}

/**
 * Answers `POST /v1/chat/completions` with one SSE event per payload, the same
 * request with `stream: false` as one JSON document, and `GET /v1/models` with
 * a list. A refusal set with `refuseWith` refuses all three alike.
 */
export async function startUpstream(payloads: readonly string[]): Promise<RunningUpstream> {
  const seen: SeenRequest[] = []
  let answer: Answer = { status: 200, headers: { 'content-type': 'text/event-stream' }, payloads }
  const server = createServer((request, response) => {
    const chunks: Buffer[] = []
    request.on('data', (chunk: Buffer) => chunks.push(chunk))
    request.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      const body = raw === '' ? {} : (JSON.parse(raw) as Record<string, unknown>)
      seen.push({ url: request.url ?? '', headers: request.headers, body })

      if (answer.status !== 200) {
        response.writeHead(answer.status, answer.headers)
        return response.end(answer.body ?? '')
      }
      if (request.method === 'GET') return document(response, STUB_MODELS)
      if (body.stream === false) return document(response, STUB_REPLY)

      response.writeHead(answer.status, answer.headers)
      for (const payload of answer.payloads) response.write(`data: ${payload}\n\n`)
      const { hold, ...ending } = answer
      if (hold === undefined) return response.end()
      hold(response)
      answer = ending
    })
  })
  const port = await open(server)
  return {
    base: `http://127.0.0.1:${port}`,
    seen,
    answerWith: (next) => {
      answer = { status: 200, headers: { 'content-type': 'text/event-stream' }, payloads: next }
    },
    refuseWith: (status, body, headers = {}) => {
      answer = { status, headers, payloads: [], ...(body === undefined ? {} : { body }) }
    },
    hold: () => {
      const arrival = deferred()
      const hangUp = deferred()
      answer = {
        ...answer,
        hold: (response) => {
          arrival.resolve()
          response.once('close', () => hangUp.resolve())
        },
      }
      return { arrived: arrival.promise, hungUp: hangUp.promise }
    },
    close: () => stop(server),
  }
}

function document(response: ServerResponse, body: unknown): void {
  response.writeHead(200, { 'content-type': 'application/json' })
  response.end(JSON.stringify(body))
}

function open(server: Server): Promise<number> {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      resolve(typeof address === 'object' && address !== null ? address.port : 0)
    })
  })
}

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve: () => void = () => {}
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
