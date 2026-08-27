import type { Bucket } from '../src/bucket.ts'
import type { CatalogueDoc, ModelSpec } from '../src/catalogue.ts'
import type { Look } from './look.ts'

/** What the pack is called, and the version its bytes are at. Bump `VERSION` whenever any of the seven files changes. */
export const PACK = 'gb-buildings'
export const VERSION = '1.12.0'

/** One model's manifest entry: the look it came from, replayed at this shape. */
export function modelOf(look: Look, bucket: Bucket, id: string, triangles: number): ModelSpec {
  return {
    id,
    look: look.id,
    front: bucket.front,
    depth: bucket.depth,
    storeys: bucket.storeys,
    tags: [...look.tags],
    triangles,
    door: { along: 0 },
  }
}

/** The manifest's committed bytes. One writer, so a rebuild and a retag lay the file out the same. */
export function serialise(manifest: CatalogueDoc): string {
  return `${JSON.stringify(manifest, null, 2)}\n`
}
