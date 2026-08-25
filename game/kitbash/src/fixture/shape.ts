import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { canonical } from '../kit/geometry.ts'
import type { Fixture } from './fixture.ts'

/** A point or a size in a fixture's own frame, in metres. */
export type Point = readonly [number, number, number]

/** Metres one repeat of a kit texture covers on a fixture: a kit module is 2 m across. */
const TILE = 2

const ONE = new THREE.Vector3(1, 1, 1)

/**
 * Boxes on kit materials, welded per material. Every box is UV'd in metres so
 * the kit's own concrete and trim tile across it at the size they tile across
 * a wall, and every part comes out in the one shape the kit's parts are in, so
 * a fixture welds into the building it is on.
 */
export class FixtureShape {
  readonly #piece: string
  readonly #parts = new Map<string, THREE.BufferGeometry[]>()

  constructor(piece: string) {
    this.#piece = piece
  }

  /** A box, turned on the spot and then placed. A box with no size is left out. */
  slab(material: string, size: Point, at: Point, euler: Point = [0, 0, 0]): this {
    if (size.some((side) => side <= 0)) return this
    const turn = new THREE.Quaternion().setFromEuler(new THREE.Euler(...euler))
    const box = boxInMetres(size).applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...at), turn, ONE))
    const parts = this.#parts.get(material) ?? []
    parts.push(box)
    this.#parts.set(material, parts)
    return this
  }

  /** Every part, one buffer a material, carried into `frame`. */
  build(frame: THREE.Matrix4): Fixture[] {
    return [...this.#parts].map(([material, parts]) => {
      const merged = mergeGeometries(parts)
      if (!merged) throw new Error(`kitbash: the ${this.#piece}'s own shapes do not share one set of vertex attributes`)
      for (const part of parts) part.dispose()
      return { piece: this.#piece, material, geometry: merged.applyMatrix4(frame) }
    })
  }
}

/** The frame a fixture stands in: its origin, turned about +Y. */
export function frameOf(position: Point, rotationY: number): THREE.Matrix4 {
  const turn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotationY)
  return new THREE.Matrix4().compose(new THREE.Vector3(...position), turn, ONE)
}

/** A point of a fixture's own frame, once the fixture stands at `position` turned by `rotationY`. */
export function standing(position: Point, rotationY: number, local: Point): Point {
  const [x, y, z] = local
  return [position[0] + x * Math.cos(rotationY) + z * Math.sin(rotationY), position[1] + y, position[2] - x * Math.sin(rotationY) + z * Math.cos(rotationY)]
}

/**
 * A box whose UVs are in metres over `TILE`. three lays each face of a box out
 * 0 to 1, four vertices a face in the order +x, -x, +y, -y, +z, -z, so each
 * face is stretched back to the metres it spans.
 */
function boxInMetres([width, height, depth]: Point): THREE.BufferGeometry {
  const box = new THREE.BoxGeometry(width, height, depth)
  const uv = box.getAttribute('uv')
  const spans: ReadonlyArray<readonly [number, number]> = [[depth, height], [depth, height], [width, depth], [width, depth], [width, height], [width, height]]
  for (let vertex = 0; vertex < uv.count; vertex++) {
    const [across, up] = spans[Math.floor(vertex / 4)]!
    uv.setXY(vertex, (uv.getX(vertex) * across) / TILE, (uv.getY(vertex) * up) / TILE)
  }
  const geometry = canonical(box)
  box.dispose()
  return geometry
}
