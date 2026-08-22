/** RFC 6455 opening handshake, done by hand so this service has no dependencies. */
import { createHash } from 'node:crypto'
import type { IncomingMessage } from 'node:http'
import type { Duplex } from 'node:stream'

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'

export function acceptKey(key: string): string {
  return createHash('sha1')
    .update(key + GUID)
    .digest('base64')
}

/** Answer 101 and hand the socket over, or refuse it and say why. */
export function accept(request: IncomingMessage, socket: Duplex): boolean {
  const key = request.headers['sec-websocket-key']
  const version = request.headers['sec-websocket-version']
  const upgrade = String(request.headers.upgrade ?? '').toLowerCase()
  if (upgrade !== 'websocket' || typeof key !== 'string' || version !== '13') {
    socket.end('HTTP/1.1 400 Bad Request\r\nconnection: close\r\n\r\n')
    return false
  }
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
      'upgrade: websocket\r\n' +
      'connection: Upgrade\r\n' +
      `sec-websocket-accept: ${acceptKey(key)}\r\n\r\n`,
  )
  return true
}
