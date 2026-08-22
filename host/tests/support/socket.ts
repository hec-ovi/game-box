/** A WebSocket client that hands back one parsed server event at a time. */
import { once } from 'node:events'

export class TestSocket {
  #socket: WebSocket
  #received: unknown[] = []
  #waiting: ((event: unknown) => void) | undefined

  private constructor(socket: WebSocket) {
    this.#socket = socket
    socket.addEventListener('message', (event: MessageEvent) => {
      const parsed: unknown = JSON.parse(String(event.data))
      const waiting = this.#waiting
      if (waiting) {
        this.#waiting = undefined
        waiting(parsed)
      } else this.#received.push(parsed)
    })
  }

  static async connect(url: string): Promise<TestSocket> {
    const socket = new WebSocket(url)
    await once(socket, 'open')
    return new TestSocket(socket)
  }

  send(value: unknown): void {
    this.#socket.send(JSON.stringify(value))
  }

  next(): Promise<unknown> {
    const queued = this.#received.shift()
    if (queued !== undefined) return Promise.resolve(queued)
    return new Promise((resolve) => {
      this.#waiting = resolve
    })
  }

  close(): void {
    this.#socket.close()
  }
}
