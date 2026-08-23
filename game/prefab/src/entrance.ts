import type * as THREE from 'three'
import { LAYER_ATTRIBUTE } from './pack.ts'

/** The entrance of a building nobody can walk into: dark glass, a dim lobby behind it. */
export const DOOR_FINISH = 'door'

/** The entrance of a building you can walk into: the same door with the lights on. */
export const OPEN_DOOR_FINISH = 'door:open'

/**
 * Which of the pack's two entrances a building wears.
 *
 * Most buildings in a city do not open, so a door you can actually use has to
 * read as one from the pavement. It is the same door drawn twice rather than
 * two doors: same frame, same leaves, same pulls, with the lobby, the fanlight
 * and the threshold lit and the reader's marks green. What carries across the
 * street is the warm light on the pavement, which is what an open lobby looks
 * like at night.
 *
 * It costs one more layer in each of the two facade strips and nothing else: no
 * geometry, no draw, no second material. `@gb/world` says which doors open, and
 * says it once, in `plot.interiorId`.
 */
export class Entrances {
  readonly #plain: number
  readonly #open: number

  constructor(finishes: readonly string[]) {
    this.#plain = finishes.indexOf(DOOR_FINISH)
    this.#open = finishes.indexOf(OPEN_DOOR_FINISH)
  }

  /**
   * Puts this building's entrance on the door you can use, in place: the
   * geometry is the copy `orient` already made for this plot, so the swap is a
   * pass over one attribute and costs nothing else.
   *
   * A pack with only the one door picture leaves the building as it is, which
   * is a plain entrance rather than a wrong one.
   */
  open(geometry: THREE.BufferGeometry): void {
    if (this.#plain < 0 || this.#open < 0) return
    const layer = geometry.getAttribute(LAYER_ATTRIBUTE)
    let moved = false
    for (let i = 0; i < layer.count; i++) {
      if (Math.round(layer.getX(i)) !== this.#plain) continue
      layer.setX(i, this.#open)
      moved = true
    }
    if (moved) layer.needsUpdate = true
  }
}
