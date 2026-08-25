import { NodeIO, type Document, type Node, type Primitive } from '@gltf-transform/core'
import { EXTMeshoptCompression, KHRMaterialsEmissiveStrength, KHRMeshQuantization } from '@gltf-transform/extensions'
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer'
import type { Bucket } from '../src/bucket.ts'
import { heightOf } from '../src/bucket.ts'
import { HEIGHT_TOLERANCE, PROUD } from '../src/fit.ts'
import { DOOR_FINISH } from '../src/entrance.ts'
import { pastThePlot } from './footprint.ts'
import type { Layers } from './layers.ts'
import { NEONS, type Look } from './look.ts'
import { pieceOf, type Piece } from './pieces.ts'

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
 * Reads what the producer wrote, adds what this repo builds on top of it, and
 * holds the whole to the plot it was built for.
 *
 * Anything standing entirely above the height the city gives the plot is left
 * out, which is how the `cyber` style's automatic roof mast (a lattice and its
 * guys, taller than the building it stands on) comes off without touching the
 * producer. The `extras` are the pieces generated here, the balconies, stood
 * on the model after the producer has drawn it. Then everything is measured:
 * it has to be exactly as tall as the plot, inside what the plot allows, on a
 * door facing the street, and made of finishes the pack has a layer for.
 * Anything else is refused by name.
 */
export async function intake(file: string, id: string, bucket: Bucket, look: Look, layers: Layers, extras: readonly Piece[] = []): Promise<Baked> {
  const doc = await io.read(file)
  refuseUris(doc, id)

  const height = heightOf(bucket.storeys)
  const pieces: Piece[] = []
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
      pieces.push(pieceOf(prim, lift, layers.forMaterial(prim.getMaterial()?.getName() ?? '', look)))
    }
  }

  const baked = flatten(id, [...pieces, ...extras], trimmed)
  measure(baked, id, bucket, height, layers)
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

/** Every kept piece in one indexed buffer, each vertex carrying the layer it wears. */
function flatten(id: string, pieces: readonly Piece[], trimmed: number): Baked {
  let vertices = 0
  let indices = 0
  for (const piece of pieces) {
    vertices += piece.position.length / 3
    indices += piece.index.length
  }

  const position = new Float32Array(vertices * 3)
  const normal = new Float32Array(vertices * 3)
  const uv = new Float32Array(vertices * 2)
  const layer = new Float32Array(vertices)
  const index = new Uint32Array(indices)

  let vertex = 0
  let at = 0
  for (const piece of pieces) {
    const count = piece.position.length / 3
    position.set(piece.position, vertex * 3)
    normal.set(piece.normal, vertex * 3)
    uv.set(piece.uv, vertex * 2)
    layer.fill(piece.layer, vertex, vertex + count)
    for (let i = 0; i < piece.index.length; i++) index[at + i] = piece.index[i]! + vertex
    vertex += count
    at += piece.index.length
  }

  return { id, position, normal, uv, layer, index, triangles: index.length / 3, trimmed }
}

/**
 * The three measurements every model has to pass before it enters the pack.
 *
 * The walls are held exactly: a building is as tall as the city says the plot
 * is, to the millimetre, so a doorstep, a roofline and a camera never disagree
 * with the mesh. The lit trim is held to the relief budget instead, because a
 * parapet tube by definition stands on the parapet, and a balcony to its own
 * reach over the pavement.
 */
function measure(baked: Baked, id: string, bucket: Bucket, height: number, layers: Layers): void {
  const lit = new Set(NEONS.map((neon) => layers.at(`neon:${neon}`)))
  let low = Infinity
  let walls = -Infinity
  let trim = -Infinity
  let past: string | undefined
  for (let i = 0; i < baked.layer.length; i++) {
    const x = baked.position[i * 3]!
    const y = baked.position[i * 3 + 1]!
    const z = baked.position[i * 3 + 2]!
    low = Math.min(low, y)
    trim = Math.max(trim, y)
    if (!lit.has(baked.layer[i]!)) walls = Math.max(walls, y)
    if (!past && pastThePlot(x, y, z, bucket, 0)) past = `${x.toFixed(3)}, ${y.toFixed(3)}, ${z.toFixed(3)}`
  }

  if (Math.abs(low) > HEIGHT_TOLERANCE || Math.abs(walls - height) > HEIGHT_TOLERANCE) {
    throw new Refused('wrong-height', id, `walls stand ${low.toFixed(3)} to ${walls.toFixed(3)} m, and the plot is 0 to ${height.toFixed(3)}`)
  }
  if (trim > height + PROUD) throw new Refused('overhangs', id, `rises to ${trim.toFixed(3)} m over a ${height} m plot`)
  if (past) throw new Refused('overhangs', id, `a vertex at ${past} stands past a ${bucket.front / 2} by ${bucket.depth / 2} plot`)
  if (!doorFacesTheStreet(baked, bucket, layers)) throw new Refused('faces-wrong-way', id, 'the door is not on the south wall')
}

/**
 * The door has to be on the south wall, because that is the wall the runtime
 * turns onto whichever street the plot's entrance is on. A model with its door
 * anywhere else would be turned to face a neighbour.
 */
function doorFacesTheStreet(baked: Baked, bucket: Bucket, layers: Layers): boolean {
  const door = layers.at(DOOR_FINISH)
  let back = Infinity
  let seen = false
  for (let i = 0; i < baked.layer.length; i++) {
    if (baked.layer[i] !== door) continue
    seen = true
    back = Math.min(back, baked.position[i * 3 + 2]!)
  }
  return seen && back > bucket.depth / 2 - 0.5
}
