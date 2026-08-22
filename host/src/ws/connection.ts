/** A WebSocket connection: text messages in, text messages out. */
import type { Duplex } from 'node:stream'
import { closeFrame, encode, FrameReader, OPCODE, type Frame } from './frames.ts'

/** 8 MiB is far above any audio chunk a client has reason to send. */
const MAX_PAYLOAD = 8 * 1024 * 1024

export class Connection {
  #socket: Duplex
  #reader = new FrameReader(MAX_PAYLOAD)
  #fragments: Buffer[] = []
  #fragmentOpcode: number = OPCODE.continuation
  #open = true

  constructor(socket: Duplex, onText: (text: string) => void) {
    this.#socket = socket
    socket.on('data', (chunk: Buffer) => this.#receive(chunk, onText))
    socket.on('error', () => this.#shutdown())
    socket.on('close', () => {
      this.#open = false
    })
  }

  get open(): boolean {
    return this.#open
  }

  sendText(text: string): void {
    if (!this.#open) return
    this.#socket.write(encode(OPCODE.text, Buffer.from(text, 'utf8')))
  }

  close(code = 1000, reason = ''): void {
    if (!this.#open) return
    this.#open = false
    this.#socket.end(closeFrame(code, reason))
  }

  #receive(chunk: Buffer, onText: (text: string) => void): void {
    const read = this.#reader.push(chunk)
    if (!read.ok) {
      this.close(read.error.code, read.error.reason)
      return
    }
    for (const frame of read.value) {
      if (!this.#handle(frame, onText)) return
    }
  }

  /** False once the connection is finished with. */
  #handle(frame: Frame, onText: (text: string) => void): boolean {
    if (frame.opcode === OPCODE.close) {
      this.close(1000, '')
      return false
    }
    if (frame.opcode === OPCODE.ping) {
      if (this.#open) this.#socket.write(encode(OPCODE.pong, frame.payload))
      return true
    }
    if (frame.opcode === OPCODE.pong) return true

    if (frame.opcode !== OPCODE.continuation) {
      this.#fragmentOpcode = frame.opcode
      this.#fragments = []
    }
    this.#fragments.push(frame.payload)
    if (!frame.fin) return true

    const message = Buffer.concat(this.#fragments)
    this.#fragments = []
    // Binary frames are not part of this surface: audio crosses as a base64
    // envelope in a text frame, never as bare bytes.
    if (this.#fragmentOpcode === OPCODE.text) onText(message.toString('utf8'))
    return true
  }

  #shutdown(): void {
    this.#open = false
    this.#socket.destroy()
  }
}
