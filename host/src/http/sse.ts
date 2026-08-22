import { once } from 'node:events'
import type { ServerResponse } from 'node:http'

/** Server-sent events: one `data:` line per payload, then a blank line. */
export function openStream(response: ServerResponse): void {
  response.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache',
    connection: 'keep-alive',
  })
}

export async function send(response: ServerResponse, data: string): Promise<void> {
  if (!response.write(`data: ${data}\n\n`)) await once(response, 'drain')
}
