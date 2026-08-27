import * as THREE from 'three'
import { DOOR_FINISH, OPEN_DOOR_FINISH } from './entrance.ts'
import { LAYER_ATTRIBUTE } from './pack.ts'
import { windowsOn } from './windows.ts'

/**
 * Where the entrance stands on the wall behind it, so no window is cut there.
 *
 * A door is a face and a window is a face, and one face is one thing. The
 * producer stands the entrance plate on the street level band, and on half the
 * pack that band is the shopfront glazing: the bay grid ran on underneath it,
 * so the wall drew a shop window behind the door, the glass put a pane over it
 * and the room raymarch drew a shop inside it. What was left of that window
 * round the edges of the door plate is what read as a window behind a door.
 *
 * The plate says where it is. This reads it off the model and writes it onto
 * the wall it stands on as the patch of that face's own uv the entrance
 * covers, so `Bays` can drop every bay the entrance reaches. The wall, the
 * glass and the shell all cut their windows from `Bays`, so all three agree
 * with no second rule.
 *
 * It rides on the vertices because the whole city is one material and one
 * draw: which layer a face wears already travels that way, and where the
 * entrance is on that face is the same kind of fact.
 */

/**
 * The patch of a face's own uv the entrance covers, as `(u0, u1, v0, v1)`.
 * All zeroes on every face the entrance does not stand on, which is an empty
 * range and blocks nothing.
 */
export const ENTRANCE_ATTRIBUTE = '_entrance'

/** One outward face of a model: every triangle on one layer at one plane. */
interface Plate {
  readonly layer: number
  readonly triangles: number[]
  x: [number, number]
  y: [number, number]
  /** The uv at the least and greatest x, and at the least and greatest y, so the map keeps its direction. */
  uAtX: [number, number]
  vAtY: [number, number]
}

/** A face this far off level is a cap or a chamfer, not the wall the entrance stands on. */
const FORWARD = 0.9

export class Doorway {
  readonly #door: ReadonlySet<number>
  readonly #windowed: ReadonlySet<number>

  constructor(finishes: readonly string[]) {
    this.#door = new Set(finishes.flatMap((finish, at) => (finish === DOOR_FINISH || finish === OPEN_DOOR_FINISH ? [at] : [])))
    this.#windowed = new Set(finishes.flatMap((finish, at) => (windowsOn(finish) ? [at] : [])))
  }

  /**
   * Writes the attribute onto one model, in place. Every model gets one, empty
   * where there is nothing to block, because `@gb/scene` only batches
   * geometries that agree attribute for attribute.
   *
   * The model is in its own frame, so the entrance is on the south wall and
   * the faces that matter are the ones looking out of it.
   */
  on(geometry: THREE.BufferGeometry): void {
    const position = geometry.getAttribute('position')
    const covered = new Float32Array(position.count * 4)
    geometry.setAttribute(ENTRANCE_ATTRIBUTE, new THREE.BufferAttribute(covered, 4))

    const index = geometry.getIndex()
    if (!index) return
    const plates = this.#plates(geometry, index)
    const door = plates.find((plate) => this.#door.has(plate.layer))
    if (!door) return

    for (const plate of plates) {
      if (!this.#windowed.has(plate.layer)) continue
      if (plate.x[1] <= door.x[0] || plate.x[0] >= door.x[1]) continue
      if (plate.y[1] <= door.y[0] || plate.y[0] >= door.y[1]) continue
      const u = span(door.x, plate.x, plate.uAtX)
      const v = span(door.y, plate.y, plate.vAtY)
      for (const vertex of plate.triangles) covered.set([u[0], u[1], v[0], v[1]], vertex * 4)
    }
  }

  /** Every outward face of the model, merged per layer and per plane, which is how the producer stands one. */
  #plates(geometry: THREE.BufferGeometry, index: THREE.BufferAttribute): Plate[] {
    const position = geometry.getAttribute('position')
    const uv = geometry.getAttribute('uv')
    const layer = geometry.getAttribute(LAYER_ATTRIBUTE)
    const normal = geometry.getAttribute('normal')
    const plates = new Map<string, Plate>()

    for (let triangle = 0; triangle < index.count; triangle += 3) {
      const corners = [index.getX(triangle), index.getX(triangle + 1), index.getX(triangle + 2)]
      if (normal.getZ(corners[0]!) < FORWARD) continue
      const at = Math.round(layer.getX(corners[0]!))
      if (!this.#door.has(at) && !this.#windowed.has(at)) continue
      const plane = Math.round(position.getZ(corners[0]!) * 1000) / 1000
      const key = `${at}@${plane}`
      const plate = plates.get(key) ?? {
        layer: at,
        triangles: [],
        x: [Infinity, -Infinity] as [number, number],
        y: [Infinity, -Infinity] as [number, number],
        uAtX: [0, 0] as [number, number],
        vAtY: [0, 0] as [number, number],
      }
      for (const corner of corners) {
        const x = position.getX(corner)
        const y = position.getY(corner)
        if (x <= plate.x[0]) plate.uAtX[0] = uv.getX(corner)
        if (x >= plate.x[1]) plate.uAtX[1] = uv.getX(corner)
        if (y <= plate.y[0]) plate.vAtY[0] = uv.getY(corner)
        if (y >= plate.y[1]) plate.vAtY[1] = uv.getY(corner)
        plate.x = [Math.min(plate.x[0], x), Math.max(plate.x[1], x)]
        plate.y = [Math.min(plate.y[0], y), Math.max(plate.y[1], y)]
        plate.triangles.push(corner)
      }
      plates.set(key, plate)
    }
    return [...plates.values()]
  }
}

/**
 * A patch of the wall, in the face's own uv. The face is a flat quad, so the
 * map from metres to uv is the straight line through its two ends, whichever
 * way round the producer laid the picture on it.
 */
function span(patch: readonly [number, number], face: readonly [number, number], ends: readonly [number, number]): [number, number] {
  const reach = face[1] - face[0]
  if (reach <= 0) return [0, 0]
  const rate = (ends[1] - ends[0]) / reach
  const low = ends[0] + (patch[0] - face[0]) * rate
  const high = ends[0] + (patch[1] - face[0]) * rate
  return low <= high ? [low, high] : [high, low]
}
