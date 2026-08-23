import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { canonical } from '../../kit/geometry.ts'
import { LAMP_ATTRIBUTES, type Group } from './design.ts'

/** A point in the lamp's own frame, in metres. */
export type Point = readonly [number, number, number]

const UP = new THREE.Vector3(0, 1, 0)
const FORWARD = new THREE.Vector3(0, 0, 1)
const ONE = new THREE.Vector3(1, 1, 1)

/**
 * The three shapes a street lamp is made of, and the tags that ride on them.
 *
 * A tapered tube is the column, the arm and every bracket on it; a box is the
 * head, the lit panel, the service box; a patch is a lit face too small to be
 * worth a solid. Everything comes out in one shape (float position, normal and
 * UV, indexed) so the whole lamp welds into one buffer, and every vertex knows
 * which surface it is on and which fitting it belongs to.
 */
export class LampShape {
  readonly #parts: THREE.BufferGeometry[] = []

  /** A tapered tube between two points. Cap it unless both ends are buried. */
  tube(part: number, group: Group, from: Point, to: Point, fromRadius: number, toRadius: number, sides: number, capped = true): this {
    const start = new THREE.Vector3(...from)
    const end = new THREE.Vector3(...to)
    const along = end.clone().sub(start)
    const cylinder = new THREE.CylinderGeometry(toRadius, fromRadius, along.length(), sides, 1, !capped)
    const turn = new THREE.Quaternion().setFromUnitVectors(UP, along.clone().normalize())
    const middle = start.clone().add(end).multiplyScalar(0.5)
    return this.#add(cylinder, part, group, new THREE.Matrix4().compose(middle, turn, ONE))
  }

  /** A box, turned on the spot and then placed. */
  slab(part: number, group: Group, size: Point, at: Point, euler: Point = [0, 0, 0]): this {
    const box = new THREE.BoxGeometry(size[0], size[1], size[2])
    const turn = new THREE.Quaternion().setFromEuler(new THREE.Euler(...euler))
    return this.#add(box, part, group, new THREE.Matrix4().compose(new THREE.Vector3(...at), turn, ONE))
  }

  /** A flat square looking along `normal`. Two triangles, for a face that only has to glow. */
  patch(part: number, group: Group, size: number, at: Point, normal: Point): this {
    const plane = new THREE.PlaneGeometry(size, size)
    const turn = new THREE.Quaternion().setFromUnitVectors(FORWARD, new THREE.Vector3(...normal).normalize())
    return this.#add(plane, part, group, new THREE.Matrix4().compose(new THREE.Vector3(...at), turn, ONE))
  }

  /** The whole lamp as one indexed buffer. */
  build(): THREE.BufferGeometry {
    const merged = mergeGeometries(this.#parts)
    if (!merged) throw new Error('kitbash: the lamp\'s own shapes do not share one set of vertex attributes')
    for (const part of this.#parts) part.dispose()
    return merged
  }

  #add(source: THREE.BufferGeometry, part: number, group: Group, matrix: THREE.Matrix4): this {
    const geometry = canonical(source).applyMatrix4(matrix)
    source.dispose()
    const count = geometry.getAttribute('position').count
    geometry.setAttribute(LAMP_ATTRIBUTES.part, new THREE.BufferAttribute(new Float32Array(count).fill(part), 1))
    geometry.setAttribute(LAMP_ATTRIBUTES.group, new THREE.BufferAttribute(new Float32Array(count).fill(group), 1))
    this.#parts.push(geometry)
    return this
  }
}

/** A point offset in a fitting's own frame, once that fitting has been turned. */
export function turned(at: Point, offset: Point, euler: Point): Point {
  const moved = new THREE.Vector3(...offset).applyEuler(new THREE.Euler(...euler))
  return [at[0] + moved.x, at[1] + moved.y, at[2] + moved.z]
}
