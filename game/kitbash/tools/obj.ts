/**
 * Reads a Wavefront OBJ into plain triangle soup, one run per material it uses.
 * Some of the CC0 packs we ship from only publish OBJ and FBX, and the pack
 * builder speaks glTF, so this is the bridge.
 *
 * Only what those files actually contain is read: positions, normals, faces and
 * `usemtl`. Polygons are fanned into triangles and vertices are shared whenever
 * a face reuses the same position and normal.
 */
import { readFileSync } from 'node:fs'

/** One material's worth of an OBJ: an indexed mesh in the file's own units. */
export interface ObjRun {
  readonly material: string
  readonly position: Float32Array<ArrayBuffer>
  readonly normal: Float32Array<ArrayBuffer>
  readonly index: Uint32Array<ArrayBuffer>
}

/** Every run in the file, in the order the materials first appear. */
export function readObj(file: string, scale = 1): ObjRun[] {
  const positions: number[][] = []
  const normals: number[][] = []
  const runs = new Map<string, Builder>()
  let current = builderFor(runs, 'default')

  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const word = line.split(/\s+/).filter(Boolean)
    if (word.length === 0) continue
    switch (word[0]) {
      case 'v':
        positions.push([Number(word[1]) * scale, Number(word[2]) * scale, Number(word[3]) * scale])
        break
      case 'vn':
        normals.push([Number(word[1]), Number(word[2]), Number(word[3])])
        break
      case 'usemtl':
        current = builderFor(runs, word[1] ?? 'default')
        break
      case 'f':
        current.face(word.slice(1).map((corner) => current.vertex(corner, positions, normals)))
        break
    }
  }

  return [...runs].filter(([, builder]) => builder.index.length > 0).map(([material, builder]) => ({
    material,
    position: Float32Array.from(builder.position),
    normal: Float32Array.from(builder.normal),
    index: Uint32Array.from(builder.index),
  }))
}

function builderFor(runs: Map<string, Builder>, material: string): Builder {
  let builder = runs.get(material)
  if (!builder) {
    builder = new Builder()
    runs.set(material, builder)
  }
  return builder
}

/** One material's mesh under construction: an OBJ corner becomes a vertex once. */
class Builder {
  readonly position: number[] = []
  readonly normal: number[] = []
  readonly index: number[] = []
  readonly #seen = new Map<string, number>()

  /** The vertex an OBJ corner (`v`, `v/vt`, `v//vn`, `v/vt/vn`) stands for. */
  vertex(corner: string, positions: number[][], normals: number[][]): number {
    const found = this.#seen.get(corner)
    if (found !== undefined) return found

    const [v, , vn] = corner.split('/')
    const at = this.position.length / 3
    this.position.push(...(positions[reference(v, positions.length)] ?? [0, 0, 0]))
    this.normal.push(...(normals[reference(vn, normals.length)] ?? [0, 1, 0]))
    this.#seen.set(corner, at)
    return at
  }

  /** A polygon, fanned from its first corner. */
  face(corners: number[]): void {
    for (let i = 2; i < corners.length; i++) this.index.push(corners[0]!, corners[i - 1]!, corners[i]!)
  }
}

/** An OBJ index: one-based, and negative counts back from the end. */
function reference(token: string | undefined, count: number): number {
  if (!token) return -1
  const at = Number(token)
  return at < 0 ? count + at : at - 1
}
