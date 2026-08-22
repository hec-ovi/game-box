/** RFC 6455 framing: enough of it to carry JSON text both ways. */
import { err, ok, type Result } from '../result.ts'

export const OPCODE = {
  continuation: 0x0,
  text: 0x1,
  binary: 0x2,
  close: 0x8,
  ping: 0x9,
  pong: 0xa,
} as const

export interface Frame {
  readonly fin: boolean
  readonly opcode: number
  readonly payload: Buffer
}

export interface ProtocolError {
  readonly code: number
  readonly reason: string
}

/** Frames written by a server are never masked. */
export function encode(opcode: number, payload: Buffer): Buffer {
  const length = payload.length
  const header =
    length < 126 ? Buffer.alloc(2) : length < 0x10000 ? Buffer.alloc(4) : Buffer.alloc(10)
  header[0] = 0x80 | opcode
  if (length < 126) header[1] = length
  else if (length < 0x10000) {
    header[1] = 126
    header.writeUInt16BE(length, 2)
  } else {
    header[1] = 127
    header.writeBigUInt64BE(BigInt(length), 2)
  }
  return Buffer.concat([header, payload])
}

export function closeFrame(code: number, reason: string): Buffer {
  const body = Buffer.from(reason, 'utf8')
  const payload = Buffer.alloc(2 + body.length)
  payload.writeUInt16BE(code, 0)
  body.copy(payload, 2)
  return encode(OPCODE.close, payload)
}

/** Decodes whatever whole frames have arrived so far. */
export class FrameReader {
  #buffer: Buffer = Buffer.alloc(0)
  #maxPayload: number

  constructor(maxPayload: number) {
    this.#maxPayload = maxPayload
  }

  push(chunk: Buffer): Result<Frame[], ProtocolError> {
    this.#buffer = this.#buffer.length === 0 ? chunk : Buffer.concat([this.#buffer, chunk])
    const frames: Frame[] = []
    for (;;) {
      const frame = this.#next()
      if (!frame.ok) return frame
      if (frame.value === undefined) return ok(frames)
      frames.push(frame.value)
    }
  }

  #next(): Result<Frame | undefined, ProtocolError> {
    const view = this.#buffer
    if (view.length < 2) return ok(undefined)
    const first = view[0] as number
    const second = view[1] as number
    const masked = (second & 0x80) !== 0
    if (!masked) return err({ code: 1002, reason: 'client frames must be masked' })

    let length = second & 0x7f
    let offset = 2
    if (length === 126) {
      if (view.length < offset + 2) return ok(undefined)
      length = view.readUInt16BE(offset)
      offset += 2
    } else if (length === 127) {
      if (view.length < offset + 8) return ok(undefined)
      const big = view.readBigUInt64BE(offset)
      if (big > BigInt(this.#maxPayload)) return err({ code: 1009, reason: 'frame too large' })
      length = Number(big)
      offset += 8
    }
    if (length > this.#maxPayload) return err({ code: 1009, reason: 'frame too large' })
    if (view.length < offset + 4 + length) return ok(undefined)

    const mask = view.subarray(offset, offset + 4)
    offset += 4
    const payload = Buffer.from(view.subarray(offset, offset + length))
    for (let i = 0; i < payload.length; i += 1) {
      payload[i] = (payload[i] as number) ^ (mask[i % 4] as number)
    }
    this.#buffer = view.subarray(offset + length)
    return ok({ fin: (first & 0x80) !== 0, opcode: first & 0x0f, payload })
  }
}
