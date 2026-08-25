import type * as THREE from 'three'
import type { Placing } from './batcher.ts'

/**
 * One building, still addressable after the city has been batched.
 *
 * Its meshes have gone into the batches, but the building keeps the box it
 * stands in and can be hidden and shown again, which is what a batch has over a
 * merge: nothing is rebuilt to take a building out of the city or put one back.
 *
 * It is drawn one of two ways: as its shell, from far off, or in detail, with
 * everything its dressing hangs on it, when the player is near. Which is the
 * city's call as the player moves; whether it is in the city at all is the
 * caller's, and the two do not get in each other's way.
 */
export class CityBuilding {
  readonly plotId: string
  /** The box it occupies, in city metres. */
  readonly bounds: THREE.Box3
  readonly #shell: Placing
  #detail: Placing | undefined
  #visible = true

  constructor(plotId: string, shell: Placing) {
    this.plotId = plotId
    this.bounds = shell.bounds
    this.#shell = shell
  }

  get visible(): boolean {
    return this.#visible
  }

  /** Takes it out of the city, or puts it back, without touching a buffer. */
  set visible(visible: boolean) {
    if (visible === this.#visible) return
    this.#visible = visible
    this.#apply()
  }

  /** Whether it is drawn in detail right now, rather than as its shell alone. */
  get detailed(): boolean {
    return this.#detail !== undefined
  }

  /** Draws it in detail from now on: the shell steps aside for what was handed over. */
  detail(placing: Placing): void {
    this.#detail?.remove()
    this.#detail = placing
    this.#apply()
  }

  /** Back to the shell: the detail is taken out of the city. */
  undetail(): void {
    this.#detail?.remove()
    this.#detail = undefined
    this.#apply()
  }

  #apply(): void {
    this.#shell.show(this.#visible && this.#detail === undefined)
    this.#detail?.show(this.#visible)
  }
}
