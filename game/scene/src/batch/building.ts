import * as THREE from 'three'

/**
 * One building, still addressable after the city has been batched.
 *
 * Its meshes have gone into the batches, but the building keeps the box it
 * stands in and can be hidden and shown again, which is what a batch has over a
 * merge: nothing is rebuilt to take a building out of the city or put one back.
 */
export class CityBuilding {
  readonly plotId: string
  /** The box it occupies, in city metres. */
  readonly bounds: THREE.Box3
  readonly #show: (visible: boolean) => void
  #visible = true

  constructor(plotId: string, bounds: THREE.Box3, show: (visible: boolean) => void) {
    this.plotId = plotId
    this.bounds = bounds
    this.#show = show
  }

  get visible(): boolean {
    return this.#visible
  }

  /** Takes it out of the city, or puts it back, without touching a buffer. */
  set visible(visible: boolean) {
    if (visible === this.#visible) return
    this.#visible = visible
    this.#show(visible)
  }
}
