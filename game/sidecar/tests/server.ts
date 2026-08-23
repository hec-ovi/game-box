import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'

export interface Call {
  readonly body: Record<string, unknown>
  /** Resolves when the client hangs up, which is what an abort looks like from this side. */
  readonly closed: Promise<void>
}

export type Answer = (call: Call, response: ServerResponse) => void

/**
 * A real sidecar on a real socket for one test: real headers, a real body and a
 * real hang-up, so a stalled call is a stalled call and not a mocked promise.
 *
 * It binds 127.0.0.1 on port 0, so the operating system hands out a free
 * ephemeral port well above 9100 and no test can ever land on the dev server,
 * on llama or on the sidecar itself.
 */
export class TestSidecar {
  readonly #server: Server
  readonly #port: number
  readonly #calls: Call[]

  private constructor(server: Server, port: number, calls: Call[]) {
    this.#server = server
    this.#port = port
    this.#calls = calls
  }

  static async start(answer: Answer): Promise<TestSidecar> {
    const calls: Call[] = []
    const server = createServer((request, response) => {
      // The socket, not the request: an IncomingMessage closes as soon as its
      // body is read, which says nothing about whether the client is still there.
      const closed = new Promise<void>((resolve) => request.socket.once('close', () => resolve()))
      void body(request).then((parsed) => {
        const call: Call = { body: parsed, closed }
        calls.push(call)
        answer(call, response)
      })
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    return new TestSidecar(server, (server.address() as AddressInfo).port, calls)
  }

  get base(): string {
    return `http://127.0.0.1:${this.#port}`
  }

  /** Every call this server received, in order. */
  get calls(): readonly Call[] {
    return this.#calls
  }

  async stop(): Promise<void> {
    this.#server.closeAllConnections()
    await new Promise<void>((resolve, reject) => this.#server.close((error) => (error ? reject(error) : resolve())))
  }
}

/** An open server-sent-event response the test writes to by hand. */
export class Sse {
  #response: ServerResponse
  #sent = 0

  constructor(response: ServerResponse) {
    this.#response = response
    response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' })
    response.flushHeaders()
  }

  /** How many frames actually reached the wire. Stops growing once the client hangs up. */
  get sent(): number {
    return this.#sent
  }

  send(payload: unknown): boolean {
    if (this.#response.destroyed || !this.#response.writable) return false
    this.#response.write(`data: ${JSON.stringify(payload)}\n\n`)
    this.#sent += 1
    return true
  }

  /** Sends payloads `everyMs` apart, giving up the moment the client stops listening. */
  async pump(payloads: readonly unknown[], everyMs: number): Promise<void> {
    for (const payload of payloads) {
      await wait(everyMs)
      if (!this.send(payload)) return
    }
    if (!this.#response.destroyed) this.#response.end('data: [DONE]\n\n')
  }
}

export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms)
    ;(timer as { unref?: () => void }).unref?.()
  })
}

function body(request: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let raw = ''
    request.setEncoding('utf8')
    request.on('data', (piece: string) => (raw += piece))
    request.on('end', () => resolve(raw ? (JSON.parse(raw) as Record<string, unknown>) : {}))
  })
}
