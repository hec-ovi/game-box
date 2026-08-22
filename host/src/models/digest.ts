/** Streaming sha256 of a cached file, so a multi-gigabyte model never lands in memory. */
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'

export interface Digest {
  readonly sha256: string
  readonly sizeBytes: number
}

export async function sha256Of(path: string): Promise<Digest> {
  const hash = createHash('sha256')
  let sizeBytes = 0
  for await (const chunk of createReadStream(path, { highWaterMark: 1 << 20 })) {
    const bytes = chunk as Buffer
    sizeBytes += bytes.length
    hash.update(bytes)
  }
  return { sha256: hash.digest('hex'), sizeBytes }
}
