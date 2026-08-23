import * as THREE from 'three'
import type { PropFootprint } from './footprint.ts'

/** Where the ray that measures a top starts: clear of the highest triangle of the piece. */
const ABOVE = 0.1

const DOWN = new THREE.Vector3(0, -1, 0)

/** How far out from the middle of the piece to look, nearest the asked-for place first. */
const INWARD = [1, 0.75, 0.5, 0.25, 0]

/**
 * The top of one piece of furniture: where on it a thing put down lands, and
 * how high that place is drawn.
 *
 * The height is measured, never looked up, the same rule the blockers follow. A
 * ray dropped where the thing is going says what is under it, so a chair holds
 * a cup at its seat and not at the top of its backrest, a counter holds one at
 * the shelf the thing is actually over, and a kit that draws a taller counter
 * gets a taller counter with no table to keep in step.
 */
export class PropSurface {
  /** The patch of floor the piece stands on, which is the edge of this top. */
  readonly footprint: PropFootprint
  readonly #object: THREE.Object3D
  readonly #ray = new THREE.Raycaster()

  constructor(footprint: PropFootprint, object: THREE.Object3D) {
    this.footprint = footprint
    this.#object = object
    object.updateWorldMatrix(true, true)
  }

  /**
   * Where a thing that size stands when it is put down at that point on the
   * floor: the nearest place on this piece that holds the whole of it, so
   * nothing overhangs the edge, at the height the piece is drawn to there. A
   * thing wider than the piece stands in the middle.
   */
  place(x: number, z: number, half: { x: number; z: number }): THREE.Vector3 {
    const footprint = this.footprint
    // the thing is not turned and the piece may be, so its reach is measured
    // along the piece's own axes rather than the room's
    const cos = Math.abs(Math.cos(footprint.rot))
    const sin = Math.abs(Math.sin(footprint.rot))
    const local = footprint.local(x, z)
    const along = clamp(local.along, footprint.halfWidth - (half.x * cos + half.z * sin))
    const through = clamp(local.through, footprint.halfDepth - (half.x * sin + half.z * cos))

    // in from the edge until there is something under it: a round seat in a
    // square footprint, or the gap between the legs of a table, has corners
    // with nothing drawn in them
    for (const reach of INWARD) {
      const on = footprint.world(along * reach, through * reach)
      const top = this.#topAt(on.x, on.z)
      if (top !== undefined) return new THREE.Vector3(on.x, top, on.z)
    }
    const middle = footprint.world(0, 0)
    return new THREE.Vector3(middle.x, footprint.height, middle.z)
  }

  /** The highest triangle of the piece under that point, if it is drawn there at all. */
  #topAt(x: number, z: number): number | undefined {
    const from = this.footprint.height + ABOVE
    this.#ray.set(new THREE.Vector3(x, from, z), DOWN)
    this.#ray.far = from
    return this.#ray.intersectObject(this.#object, true)[0]?.point.y
  }
}

/** Never past the edge, and never past the middle: a thing too big to fit stands in the centre. */
function clamp(value: number, limit: number): number {
  const edge = Math.max(0, limit)
  return Math.min(edge, Math.max(-edge, value))
}
