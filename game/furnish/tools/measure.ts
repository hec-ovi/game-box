/**
 * Measures a piece straight out of the KayKit source files: its bounds, the
 * materials on it, and the evidence for which way it faces. This is where the
 * numbers and the `front` in src/catalog/pieces.ts come from, and the test that
 * keeps them honest.
 *
 * Print the table:  node game/furnish/tools/print-catalog.ts
 */
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { PIECES, type Pack, type PieceId } from '../src/catalog/pieces.ts'

const ROOT = resolve(import.meta.dirname, '../../..')

/** Where each pack lands when the assets are unpacked. */
export const PACK_DIRECTORY: Record<Pack, string> = {
  furniture:
    process.env['GB_KAYKIT_FURNITURE'] ??
    join(ROOT, 'assets/src/kaykit-furniture/extracted/KayKit_Furniture_Bits_1.0_FREE/Assets/gltf'),
  dungeon:
    process.env['GB_KAYKIT_DUNGEON'] ??
    join(ROOT, 'assets/src/kaykit-dungeon/extracted/KayKit_Dungeon_Pack_1.1_FREE/Assets/gltf'),
}

export type Point = [number, number, number]
export type Axis = 'x' | 'z'
export type Sign = '+' | '-'

/** How closed and how detailed one side of a piece is. */
export interface Side {
  /** Triangle area sitting on that face and looking out of it, in the piece's own units. */
  readonly area: number
  /** How many triangles that is. A flat back is one or two; a front with doors and handles is dozens. */
  readonly triangles: number
}

export interface Measured {
  readonly node: string
  readonly min: Point
  readonly max: Point
  readonly materials: string[]
  readonly triangles: number
  /** The four horizontal faces, keyed `+x`, `-x`, `+z`, `-z`. */
  readonly sides: Record<string, Side>
  /** Where the mass above mid height sits, as a fraction of the piece: a backrest, a headboard. */
  readonly upper: { x: number; z: number }
}

export function measurePiece(id: PieceId): Measured {
  return measureFile(join(PACK_DIRECTORY[PIECES[id].pack], `${id}.gltf`))
}

/**
 * Which way a piece faces along one axis, read off the geometry.
 *
 * An open piece (a shelf) gives itself away by area: its back is a panel and
 * its front is a hole. A closed piece (a cabinet, a chest) has a panel both
 * ways, and gives itself away by detail: doors, handles and hinges are dozens
 * of triangles against a back panel's two. A seat gives itself away before
 * either: the mass above mid height is the backrest, and the front is opposite
 * it. Anything symmetric comes back undecided, and the catalog may point it
 * whichever way it likes.
 */
export function frontOn(measured: Measured, axis: Axis): Sign | undefined {
  const extent = measured.max[axis === 'x' ? 0 : 2] - measured.min[axis === 'x' ? 0 : 2]
  const offset = axis === 'x' ? measured.upper.x : measured.upper.z
  if (Math.abs(offset) > 0.15 * extent) return offset > 0 ? '-' : '+'

  const positive = measured.sides[`+${axis}`]!
  const negative = measured.sides[`-${axis}`]!
  if (positive.area > 3 * negative.area) return '-'
  if (negative.area > 3 * positive.area) return '+'
  if (positive.triangles > 1.5 * negative.triangles) return '+'
  if (negative.triangles > 1.5 * positive.triangles) return '-'
  return undefined
}

// --- reading the file ------------------------------------------------------

type Matrix = number[]

interface Node {
  name?: string
  mesh?: number
  children?: number[]
  matrix?: number[]
  translation?: number[]
  rotation?: number[]
  scale?: number[]
}

interface Accessor {
  bufferView: number
  byteOffset?: number
  componentType: number
  count: number
  type: string
}

interface Gltf {
  scene?: number
  scenes: { nodes: number[] }[]
  nodes: Node[]
  meshes: { primitives: { material?: number; attributes: { POSITION: number }; indices?: number }[] }[]
  accessors: Accessor[]
  bufferViews: { buffer: number; byteOffset?: number; byteLength: number; byteStride?: number }[]
  buffers: { uri?: string; byteLength: number }[]
  materials?: { name?: string }[]
}

const IDENTITY: Matrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
const COMPONENT: Record<number, { bytes: number; read: (view: DataView, at: number) => number }> = {
  5120: { bytes: 1, read: (v, at) => v.getInt8(at) },
  5121: { bytes: 1, read: (v, at) => v.getUint8(at) },
  5122: { bytes: 2, read: (v, at) => v.getInt16(at, true) },
  5123: { bytes: 2, read: (v, at) => v.getUint16(at, true) },
  5125: { bytes: 4, read: (v, at) => v.getUint32(at, true) },
  5126: { bytes: 4, read: (v, at) => v.getFloat32(at, true) },
}
const COMPONENTS: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }

export function measureFile(file: string): Measured {
  const gltf = JSON.parse(readFileSync(file, 'utf8')) as Gltf
  const directory = file.slice(0, file.lastIndexOf('/'))
  const buffers = gltf.buffers.map((buffer) =>
    buffer.uri ? new DataView(bytes(join(directory, decodeURIComponent(buffer.uri)))) : new DataView(new ArrayBuffer(0)),
  )

  const triangles: Point[][] = []
  const materials: string[] = []

  const walk = (index: number, parent: Matrix): void => {
    const node = gltf.nodes[index]!
    const world = multiply(parent, localMatrix(node))
    if (node.mesh !== undefined) {
      for (const primitive of gltf.meshes[node.mesh]!.primitives) {
        const name = primitive.material === undefined ? undefined : gltf.materials?.[primitive.material]?.name
        if (name && !materials.includes(name)) materials.push(name)

        const points = read(gltf, buffers, primitive.attributes.POSITION).map(
          (point) => apply(world, [point[0]!, point[1]!, point[2]!]) satisfies Point,
        )
        const index =
          primitive.indices === undefined
            ? points.map((_, at) => at)
            : read(gltf, buffers, primitive.indices).map((value) => value[0]!)
        for (let at = 0; at + 2 < index.length; at += 3) {
          triangles.push([points[index[at]!]!, points[index[at + 1]!]!, points[index[at + 2]!]!])
        }
      }
    }
    for (const child of node.children ?? []) walk(child, world)
  }
  const roots = gltf.scenes[gltf.scene ?? 0]!.nodes
  for (const root of roots) walk(root, IDENTITY)

  const min: Point = [Infinity, Infinity, Infinity]
  const max: Point = [-Infinity, -Infinity, -Infinity]
  for (const triangle of triangles) {
    for (const point of triangle) {
      for (const axis of [0, 1, 2] as const) {
        min[axis] = Math.min(min[axis], point[axis])
        max[axis] = Math.max(max[axis], point[axis])
      }
    }
  }

  return {
    node: gltf.nodes[roots[0]!]!.name ?? '',
    min: min.map(round) as Point,
    max: max.map(round) as Point,
    materials,
    triangles: triangles.length,
    sides: sidesOf(triangles, min, max),
    upper: upperMass(triangles, min, max),
  }
}

/** How much surface sits on each of the four vertical faces, and how finely it is cut. */
function sidesOf(triangles: readonly Point[][], min: Point, max: Point): Record<string, Side> {
  const sides: Record<string, { area: number; triangles: number }> = {
    '+x': { area: 0, triangles: 0 },
    '-x': { area: 0, triangles: 0 },
    '+z': { area: 0, triangles: 0 },
    '-z': { area: 0, triangles: 0 },
  }

  for (const triangle of triangles) {
    const normal = cross(minus(triangle[1]!, triangle[0]!), minus(triangle[2]!, triangle[0]!))
    const area = length(normal) / 2
    if (area <= 0) continue
    for (const [axis, key] of [[0, 'x'], [2, 'z']] as const) {
      const facing = normal[axis] / (2 * area)
      if (Math.abs(facing) < 0.7) continue
      const middle = (triangle[0]![axis] + triangle[1]![axis] + triangle[2]![axis]) / 3
      const span = max[axis] - min[axis] || 1
      const depth = facing > 0 ? max[axis] - middle : middle - min[axis]
      if (depth > 0.12 * span) continue
      const side = sides[`${facing > 0 ? '+' : '-'}${key}`]!
      side.area += area * Math.abs(facing)
      side.triangles += 1
    }
  }
  return sides
}

/** Where the mass above mid height sits, relative to the middle of the piece. */
function upperMass(triangles: readonly Point[][], min: Point, max: Point): { x: number; z: number } {
  let total = 0
  let x = 0
  let z = 0
  for (const triangle of triangles) {
    const area = length(cross(minus(triangle[1]!, triangle[0]!), minus(triangle[2]!, triangle[0]!))) / 2
    const middle: Point = [0, 1, 2].map(
      (axis) => (triangle[0]![axis]! + triangle[1]![axis]! + triangle[2]![axis]!) / 3,
    ) as Point
    if (middle[1] <= min[1] + 0.55 * (max[1] - min[1])) continue
    total += area
    x += area * middle[0]
    z += area * middle[2]
  }
  if (!total) return { x: 0, z: 0 }
  return { x: round(x / total - (min[0] + max[0]) / 2), z: round(z / total - (min[2] + max[2]) / 2) }
}

function read(gltf: Gltf, buffers: DataView[], index: number): number[][] {
  const accessor = gltf.accessors[index]!
  const view = gltf.bufferViews[accessor.bufferView]!
  const buffer = buffers[view.buffer]!
  const component = COMPONENT[accessor.componentType]!
  const size = COMPONENTS[accessor.type]!
  const stride = view.byteStride ?? component.bytes * size
  const start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0)

  const values: number[][] = []
  for (let at = 0; at < accessor.count; at++) {
    const value: number[] = []
    for (let part = 0; part < size; part++) value.push(component.read(buffer, start + at * stride + part * component.bytes))
    values.push(value)
  }
  return values
}

function bytes(file: string): ArrayBuffer {
  const read = readFileSync(file)
  return read.buffer.slice(read.byteOffset, read.byteOffset + read.byteLength) as ArrayBuffer
}

const round = (value: number): number => {
  const at = Math.round(value * 1000) / 1000
  return at === 0 ? 0 : at
}

function localMatrix(node: Node): Matrix {
  if (node.matrix) return node.matrix
  const [tx = 0, ty = 0, tz = 0] = node.translation ?? []
  const [x = 0, y = 0, z = 0, w = 1] = node.rotation ?? []
  const [sx = 1, sy = 1, sz = 1] = node.scale ?? []
  const [x2, y2, z2] = [x + x, y + y, z + z]
  return [
    (1 - (y * y2 + z * z2)) * sx, (x * y2 + w * z2) * sx, (x * z2 - w * y2) * sx, 0,
    (x * y2 - w * z2) * sy, (1 - (x * x2 + z * z2)) * sy, (y * z2 + w * x2) * sy, 0,
    (x * z2 + w * y2) * sz, (y * z2 - w * x2) * sz, (1 - (x * x2 + y * y2)) * sz, 0,
    tx, ty, tz, 1,
  ]
}

function multiply(a: Matrix, b: Matrix): Matrix {
  const out: Matrix = new Array(16).fill(0)
  for (let column = 0; column < 4; column++) {
    for (let row = 0; row < 4; row++) {
      let sum = 0
      for (let k = 0; k < 4; k++) sum += a[k * 4 + row]! * b[column * 4 + k]!
      out[column * 4 + row] = sum
    }
  }
  return out
}

function apply(m: Matrix, [x, y, z]: Point): Point {
  return [
    m[0]! * x + m[4]! * y + m[8]! * z + m[12]!,
    m[1]! * x + m[5]! * y + m[9]! * z + m[13]!,
    m[2]! * x + m[6]! * y + m[10]! * z + m[14]!,
  ]
}

const minus = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const cross = (a: Point, b: Point): Point => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
const length = (a: Point): number => Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2])
