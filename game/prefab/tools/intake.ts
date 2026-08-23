import { NodeIO, type Document, type Node, type Primitive } from '@gltf-transform/core'
import { EXTMeshoptCompression, KHRMaterialsEmissiveStrength, KHRMeshQuantization } from '@gltf-transform/extensions'
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer'
import type { Bucket } from '../src/bucket.ts'
import { heightOf } from '../src/bucket.ts'
import { HEIGHT_TOLERANCE, PROUD } from '../src/fit.ts'
import { DOOR_FINISH } from '../src/entrance.ts'
import { layerFor, LAYER_OF } from './layers.ts'
import { NEONS, type Family } from './look.ts'

export const io = new NodeIO()
  .registerExtensions([KHRMaterialsEmissiveStrength, KHRMeshQuantization, EXTMeshoptCompression])
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder })

export type RefusalCode = 'wrong-height' | 'overhangs' | 'faces-wrong-way' | 'absolute-path' | 'placed-crooked'

export class Refused extends Error {
  readonly code: RefusalCode
  readonly model: string

  constructor(code: RefusalCode, model: string, detail: string) {
    super(`${model}: ${code}, ${detail}`)
    this.name = 'Refused'
    this.code = code
    this.model = model
  }
}

/** One model, flattened into the single primitive the pack ships it as. */
export interface Baked {
  readonly id: string
  readonly position: Float32Array
  readonly normal: Float32Array
  readonly uv: Float32Array
  readonly layer: Float32Array
  readonly index: Uint32Array
  readonly triangles: number
  /** Parts left out because they stood above the plot's own height. */
  readonly trimmed: number
}

/**
 * Reads what the producer wrote and holds it to the plot it was built for.
 *
 * Two things happen here and nothing else. Anything standing entirely above the
 * height the city gives the plot is left out, which is how the `cyber` style's
 * automatic roof mast (a lattice and its guys, taller than the building it
 * stands on) comes off without touching the producer. Then what is left is
 * measured: it has to be exactly as tall as the plot, inside the plot's
 * footprint, on a door facing the street, and made of finishes the pack has a
 * layer for. Anything else is refused by name.
 */
export async function intake(file: string, id: string, bucket: Bucket, family: Family): Promise<Baked> {
  const doc = await io.read(file)
  refuseUris(doc, id)

  const height = heightOf(bucket.storeys)
  const parts: Array<{ prim: Primitive; lift: number; layer: number }> = []
  let trimmed = 0

  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh()
    if (!mesh) continue
    const lift = placement(node, id)
    for (const prim of mesh.listPrimitives()) {
      // the `cyber` style stands a lattice mast and its guys on every roof,
      // taller than any building the forge cuts; nothing may rise past the
      // relief a tube is allowed, so the mast comes off here
      if (bounds(prim)[1][1]! + lift > height + PROUD) {
        trimmed++
        continue
      }
      parts.push({ prim, lift, layer: layerFor(prim.getMaterial()?.getName() ?? '', family) })
    }
  }

  const baked = flatten(id, parts, trimmed)
  measure(baked, id, bucket, height)
  return baked
}

/** A band is a node lifted straight up. Anything turned or scaled would move its picture. */
function placement(node: Node, id: string): number {
  const [x, , z] = node.getTranslation()
  const scale = node.getScale()
  const rotation = node.getRotation()
  const upright = rotation[0] === 0 && rotation[1] === 0 && rotation[2] === 0 && Math.abs(rotation[3]) === 1
  const plain = scale[0] === 1 && scale[1] === 1 && scale[2] === 1
  if (x !== 0 || z !== 0 || !upright || !plain) throw new Refused('placed-crooked', id, `${node.getName()} is not a plain lift`)
  return node.getTranslation()[1]!
}

/** Nothing may point at a file on the machine that built it. */
function refuseUris(doc: Document, id: string): void {
  for (const texture of doc.getRoot().listTextures()) {
    const uri = texture.getURI()
    if (uri) throw new Refused('absolute-path', id, `texture ${texture.getName()} points at ${uri}`)
  }
  for (const buffer of doc.getRoot().listBuffers()) {
    const uri = buffer.getURI()
    if (uri) throw new Refused('absolute-path', id, `buffer points at ${uri}`)
  }
}

function bounds(prim: Primitive): [number[], number[]] {
  const position = prim.getAttribute('POSITION')!
  return [position.getMinNormalized([]), position.getMaxNormalized([])]
}

/** Every kept part in one indexed buffer, each vertex carrying the layer it wears. */
function flatten(id: string, parts: ReadonlyArray<{ prim: Primitive; lift: number; layer: number }>, trimmed: number): Baked {
  let vertices = 0
  let indices = 0
  for (const part of parts) {
    vertices += part.prim.getAttribute('POSITION')!.getCount()
    indices += part.prim.getIndices()?.getCount() ?? 0
  }

  const position = new Float32Array(vertices * 3)
  const normal = new Float32Array(vertices * 3)
  const uv = new Float32Array(vertices * 2)
  const layer = new Float32Array(vertices)
  const index = new Uint32Array(indices)

  let vertex = 0
  let at = 0
  const point: number[] = []
  for (const part of parts) {
    const positions = part.prim.getAttribute('POSITION')!
    const normals = part.prim.getAttribute('NORMAL')
    const uvs = part.prim.getAttribute('TEXCOORD_0')
    const count = positions.getCount()

    for (let i = 0; i < count; i++) {
      positions.getElement(i, point)
      position[(vertex + i) * 3] = point[0]!
      position[(vertex + i) * 3 + 1] = point[1]! + part.lift
      position[(vertex + i) * 3 + 2] = point[2]!

      if (normals) normals.getElement(i, point)
      normal[(vertex + i) * 3] = normals ? point[0]! : 0
      normal[(vertex + i) * 3 + 1] = normals ? point[1]! : 1
      normal[(vertex + i) * 3 + 2] = normals ? point[2]! : 0

      if (uvs) uvs.getElement(i, point)
      uv[(vertex + i) * 2] = uvs ? point[0]! : 0.5
      uv[(vertex + i) * 2 + 1] = uvs ? point[1]! : 0.5

      layer[vertex + i] = part.layer
    }

    const source = part.prim.getIndices()
    const length = source?.getCount() ?? 0
    for (let i = 0; i < length; i++) index[at + i] = source!.getScalar(i) + vertex
    vertex += count
    at += length
  }

  return { id, position, normal, uv, layer, index, triangles: index.length / 3, trimmed }
}

/**
 * The three measurements every model has to pass before it enters the pack.
 *
 * The walls are held exactly: a building is as tall as the city says the plot
 * is, to the millimetre, so a doorstep, a roofline and a camera never disagree
 * with the mesh. The lit trim is held to the relief budget instead, because a
 * parapet tube by definition stands on the parapet.
 */
function measure(baked: Baked, id: string, bucket: Bucket, height: number): void {
  const lit = new Set(NEONS.map((neon) => LAYER_OF.get(`neon:${neon}`)!))
  let low = Infinity
  let walls = -Infinity
  let trim = -Infinity
  let wide = 0
  let deep = 0
  for (let i = 0; i < baked.layer.length; i++) {
    const y = baked.position[i * 3 + 1]!
    low = Math.min(low, y)
    trim = Math.max(trim, y)
    if (!lit.has(baked.layer[i]!)) walls = Math.max(walls, y)
    wide = Math.max(wide, Math.abs(baked.position[i * 3]!))
    deep = Math.max(deep, Math.abs(baked.position[i * 3 + 2]!))
  }

  if (Math.abs(low) > HEIGHT_TOLERANCE || Math.abs(walls - height) > HEIGHT_TOLERANCE) {
    throw new Refused('wrong-height', id, `walls stand ${low.toFixed(3)} to ${walls.toFixed(3)} m, and the plot is 0 to ${height.toFixed(3)}`)
  }
  if (trim > height + PROUD || wide > bucket.front / 2 + PROUD || deep > bucket.depth / 2 + PROUD) {
    throw new Refused(
      'overhangs',
      id,
      `reaches ${wide.toFixed(3)} by ${deep.toFixed(3)} by ${trim.toFixed(3)} m out of a ${bucket.front / 2} by ${bucket.depth / 2} by ${height} box`,
    )
  }
  if (!doorFacesTheStreet(baked, bucket)) throw new Refused('faces-wrong-way', id, 'the door is not on the south wall')
}

/**
 * The door has to be on the south wall, because that is the wall the runtime
 * turns onto whichever street the plot's entrance is on. A model with its door
 * anywhere else would be turned to face a neighbour.
 */
function doorFacesTheStreet(baked: Baked, bucket: Bucket): boolean {
  const door = LAYER_OF.get(DOOR_FINISH)!
  let back = Infinity
  let seen = false
  for (let i = 0; i < baked.layer.length; i++) {
    if (baked.layer[i] !== door) continue
    seen = true
    back = Math.min(back, baked.position[i * 3 + 2]!)
  }
  return seen && back > bucket.depth / 2 - 0.5
}
