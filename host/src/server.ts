/**
 * The process surface: one loopback HTTP server carrying the chat endpoint,
 * the realtime socket and a health check.
 */
import { createServer as createHttpServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { Duplex } from 'node:stream'
import { chat } from './api/chat.ts'
import { errorBody } from './api/errors.ts'
import { health } from './api/health.ts'
import { RealtimeSession } from './api/realtime.ts'
import { readBody } from './http/body.ts'
import { corsHeaders, type Headers } from './http/cors.ts'
import { openStream, send } from './http/sse.ts'
import { Connection } from './ws/connection.ts'
import { accept } from './ws/handshake.ts'

export const CHAT_PATH = '/v1/chat/completions'
export const REALTIME_PATH = '/v1/realtime'
export const HEALTH_PATH = '/health'

export function createServer(): Server {
  const server = createHttpServer((request, response) => {
    void route(request, response).catch(() => response.destroy())
  })
  server.on('upgrade', upgrade)
  return server
}

/** Start on 127.0.0.1 only, by design: this is a local sidecar. */
export function listen(port: number, host = '127.0.0.1'): Promise<{ server: Server; port: number }> {
  const server = createServer()
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, host, () => {
      const address = server.address()
      resolve({ server, port: typeof address === 'object' && address !== null ? address.port : port })
    })
  })
}

async function route(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const path = pathOf(request.url)
  const cors = corsHeaders(request.headers.origin)

  // the browser asks before it sends; answer it here rather than in every route
  if (request.method === 'OPTIONS') {
    response.writeHead(204, { ...cors, 'content-length': 0 })
    response.end()
    return
  }

  if (path === HEALTH_PATH) {
    if (request.method !== 'GET') return refuse(response, 405, 'method not allowed', cors)
    return json(response, 200, health(), cors)
  }
  if (path === CHAT_PATH) {
    if (request.method !== 'POST') return refuse(response, 405, 'method not allowed', cors)
    return completions(request, response, cors)
  }
  if (path === REALTIME_PATH) {
    return refuse(response, 400, 'this endpoint is a websocket: send an upgrade request', cors)
  }
  return refuse(response, 404, `no such endpoint: ${path}`, cors)
}

async function completions(request: IncomingMessage, response: ServerResponse, cors: Headers): Promise<void> {
  const body = await readBody(request)
  if (!body.ok) return refuse(response, 413, 'request body is too large', cors)

  // A caller that hangs up takes the engine's work with it: nothing keeps
  // decoding for a reply nobody will read.
  const gone = new AbortController()
  response.once('close', () => gone.abort())
  const result = await chat(body.value, gone.signal)
  if (result.kind === 'json') return json(response, result.status, result.body, { ...cors, ...result.headers })

  openStream(response, cors)
  for await (const chunk of result.chunks) {
    if (response.destroyed) return
    await send(response, JSON.stringify(chunk))
  }
  await send(response, '[DONE]')
  response.end()
}

function upgrade(request: IncomingMessage, socket: Duplex, head: Buffer): void {
  if (pathOf(request.url) !== REALTIME_PATH) {
    socket.end('HTTP/1.1 404 Not Found\r\nconnection: close\r\n\r\n')
    return
  }
  if (!accept(request, socket)) return

  const session = new RealtimeSession()
  const connection = new Connection(socket, (text) => {
    for (const event of session.handle(text)) connection.sendText(JSON.stringify(event))
  })
  if (head.length > 0) socket.unshift(head)
}

function pathOf(url: string | undefined): string {
  const raw = url ?? '/'
  const query = raw.indexOf('?')
  return query === -1 ? raw : raw.slice(0, query)
}

function json(response: ServerResponse, status: number, body: unknown, cors: Headers = {}): void {
  const payload = JSON.stringify(body)
  response.writeHead(status, {
    ...cors,
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(payload),
  })
  response.end(payload)
}

function refuse(response: ServerResponse, status: number, message: string, cors: Headers = {}): void {
  json(response, status, errorBody(message, status >= 500 ? 'server_error' : 'invalid_request_error'), cors)
}
