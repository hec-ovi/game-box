import type { IncomingMessage } from 'node:http'
import { err, ok, type Result } from '../result.ts'

/** 8 MiB: room for a long conversation, not for a file upload. */
const MAX_BODY = 8 * 1024 * 1024

export async function readBody(request: IncomingMessage): Promise<Result<string, 'too-large'>> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    const bytes = chunk as Buffer
    size += bytes.length
    if (size > MAX_BODY) return err('too-large')
    chunks.push(bytes)
  }
  return ok(Buffer.concat(chunks).toString('utf8'))
}
