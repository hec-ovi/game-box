/**
 * Measures a kit piece straight out of the Downtown kit's own glTF file: its
 * bounds in its own frame and the materials on it. This is where the numbers
 * in src/catalog/pieces.ts come from, and the test that keeps them honest.
 *
 * Print the catalog table:  node game/kitbash/tools/measure.ts
 */
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

export interface Measured {
  /** What the piece's root node is called inside the file. */
  node: string
  min: [number, number, number]
  max: [number, number, number]
  materials: string[]
}

/** Where the kit lands when tools/fetch-assets.mjs unpacks it. Override with GB_DOWNTOWN_KIT. */
export const KIT_DIRECTORY = process.env['GB_DOWNTOWN_KIT'] ?? resolve(
  import.meta.dirname,
  '../../../assets/src/quaternius-downtown/extracted/Exports/glTF (Godot)',
)

type Matrix = number[]
type Point = [number, number, number]

const IDENTITY: Matrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]

interface Node {
  name?: string
  mesh?: number
  children?: number[]
  matrix?: number[]
  translation?: number[]
  rotation?: number[]
  scale?: number[]
}

interface Gltf {
  scene?: number
  scenes: { nodes: number[] }[]
  nodes: Node[]
  meshes: { primitives: { material?: number; attributes: { POSITION: number } }[] }[]
  accessors: { min: number[]; max: number[] }[]
  materials: { name: string }[]
}

export function measurePiece(id: string, directory = KIT_DIRECTORY): Measured {
  const gltf = JSON.parse(readFileSync(join(directory, `${id}.gltf`), 'utf8')) as Gltf
  const min: Point = [Infinity, Infinity, Infinity]
  const max: Point = [-Infinity, -Infinity, -Infinity]
  const materials: string[] = []

  const walk = (index: number, parent: Matrix): void => {
    const node = gltf.nodes[index]!
    const world = multiply(parent, localMatrix(node))
    if (node.mesh !== undefined) {
      for (const primitive of gltf.meshes[node.mesh]!.primitives) {
        const name = primitive.material === undefined ? undefined : gltf.materials[primitive.material]?.name
        if (name && !materials.includes(name)) materials.push(name)
        const box = gltf.accessors[primitive.attributes.POSITION]!
        for (let corner = 0; corner < 8; corner++) {
          const point = apply(world, [
            (corner & 1 ? box.max : box.min)[0]!,
            (corner & 2 ? box.max : box.min)[1]!,
            (corner & 4 ? box.max : box.min)[2]!,
          ])
          for (let axis = 0; axis < 3; axis++) {
            min[axis] = Math.min(min[axis]!, point[axis]!)
            max[axis] = Math.max(max[axis]!, point[axis]!)
          }
        }
      }
    }
    for (const child of node.children ?? []) walk(child, world)
  }
  const roots = gltf.scenes[gltf.scene ?? 0]!.nodes
  for (const root of roots) walk(root, IDENTITY)

  return {
    node: gltf.nodes[roots[0]!]!.name ?? id,
    min: min.map(round) as Point,
    max: max.map(round) as Point,
    materials,
  }
}

const round = (value: number): number => {
  const at = Math.round(value * 1000) / 1000
  return at === 0 ? 0 : at // -0 and 0 are the same wall plane
}

function localMatrix(node: Node): Matrix {
  if (node.matrix) return node.matrix
  const [tx, ty, tz] = node.translation ?? [0, 0, 0]
  const [x, y, z, w] = (node.rotation ?? [0, 0, 0, 1]) as [number, number, number, number]
  const [sx, sy, sz] = (node.scale ?? [1, 1, 1]) as [number, number, number]
  const [x2, y2, z2] = [x + x, y + y, z + z]
  return [
    (1 - (y * y2 + z * z2)) * sx, (x * y2 + w * z2) * sx, (x * z2 - w * y2) * sx, 0,
    (x * y2 - w * z2) * sy, (1 - (x * x2 + z * z2)) * sy, (y * z2 + w * x2) * sy, 0,
    (x * z2 + w * y2) * sz, (y * z2 - w * x2) * sz, (1 - (x * x2 + y * y2)) * sz, 0,
    tx!, ty!, tz!, 1,
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
