import type { Primitive } from '@gltf-transform/core'

/** One part of a model before it is flattened: its own arrays, and the layer every vertex wears. */
export interface Piece {
  readonly position: Float32Array
  readonly normal: Float32Array
  readonly uv: Float32Array
  readonly layer: number
  readonly index: Uint32Array
}

/** A producer primitive, lifted to where its band stands. */
export function pieceOf(prim: Primitive, lift: number, layer: number): Piece {
  const positions = prim.getAttribute('POSITION')!
  const normals = prim.getAttribute('NORMAL')
  const uvs = prim.getAttribute('TEXCOORD_0')
  const count = positions.getCount()
  const position = new Float32Array(count * 3)
  const normal = new Float32Array(count * 3)
  const uv = new Float32Array(count * 2)
  const point: number[] = []

  for (let i = 0; i < count; i++) {
    positions.getElement(i, point)
    position[i * 3] = point[0]!
    position[i * 3 + 1] = point[1]! + lift
    position[i * 3 + 2] = point[2]!

    if (normals) normals.getElement(i, point)
    normal[i * 3] = normals ? point[0]! : 0
    normal[i * 3 + 1] = normals ? point[1]! : 1
    normal[i * 3 + 2] = normals ? point[2]! : 0

    if (uvs) uvs.getElement(i, point)
    uv[i * 2] = uvs ? point[0]! : 0.5
    uv[i * 2 + 1] = uvs ? point[1]! : 0.5
  }

  const source = prim.getIndices()
  const index = new Uint32Array(source?.getCount() ?? 0)
  for (let i = 0; i < index.length; i++) index[i] = source!.getScalar(i)
  return { position, normal, uv, layer, index }
}

/** A box from `low` to `high`, six faces wound outward, each face's uv read at `metres` a picture. */
export function box(low: readonly [number, number, number], high: readonly [number, number, number], layer: number, metres: number): Piece {
  const position: number[] = []
  const normal: number[] = []
  const uv: number[] = []
  const index: number[] = []
  const [x0, y0, z0] = low
  const [x1, y1, z1] = high

  // each face: its outward normal, then its four corners anticlockwise seen from outside,
  // with the two axes the picture runs along
  const faces: Array<{ n: [number, number, number]; corners: Array<[number, number, number]>; u: number; v: number }> = [
    { n: [0, 0, 1], corners: [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], u: 0, v: 1 },
    { n: [0, 0, -1], corners: [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], u: 0, v: 1 },
    { n: [1, 0, 0], corners: [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], u: 2, v: 1 },
    { n: [-1, 0, 0], corners: [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], u: 2, v: 1 },
    { n: [0, 1, 0], corners: [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], u: 0, v: 2 },
    { n: [0, -1, 0], corners: [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], u: 0, v: 2 },
  ]

  for (const face of faces) {
    const first = position.length / 3
    for (const corner of face.corners) {
      position.push(...corner)
      normal.push(...face.n)
      uv.push(corner[face.u]! / metres, corner[face.v]! / metres)
    }
    index.push(first, first + 1, first + 2, first, first + 2, first + 3)
  }

  return { position: Float32Array.from(position), normal: Float32Array.from(normal), uv: Float32Array.from(uv), layer, index: Uint32Array.from(index) }
}
