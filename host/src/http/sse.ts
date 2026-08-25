import type { ServerResponse } from 'node:http'

/** Server-sent events: one `data:` line per payload, then a blank line. */
export function openStream(response: ServerResponse, headers: Record<string, string> = {}): void {
  response.writeHead(200, {
    ...headers,
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache',
    connection: 'keep-alive',
  })
}

/** Waits for room to write; a response that closes meanwhile stops the wait rather than holding it forever. */
export async function send(response: ServerResponse, data: string): Promise<void> {
  if (response.destroyed) return
  if (!response.write(`data: ${data}\n\n`)) await drained(response)
}

function drained(response: ServerResponse): Promise<void> {
  return new Promise((resolve) => {
    const done = (): void => {
      response.off('drain', done)
      response.off('close', done)
      resolve()
    }
    response.on('drain', done)
    response.on('close', done)
  })
}
