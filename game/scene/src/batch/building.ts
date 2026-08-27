import type * as THREE from 'three'
import type { Placing } from './batcher.ts'

/**
 * How a building is drawn: its massing (the box it occupies, in the charter's
 * colour), its shell (the walls and the roof its dressing drew) or its detail
 * (the whole building, signs and screens and all).
 */
export type BuildingStep = 'massing' | 'shell' | 'detail'

/** The steps finest first: a building is drawn at the finest one standing. */
const FINEST: readonly BuildingStep[] = ['detail', 'shell', 'massing']

/**
 * One building, still addressable after the city has been batched.
 *
 * Its meshes have gone into the batches, but the building keeps the box it
 * stands in and can be hidden and shown again, which is what a batch has over a
 * merge: nothing is rebuilt to take a building out of the city or put one back.
 *
 * It is drawn one of three ways: as its massing, from across town, as its shell
 * from down the street, or in detail with everything its dressing hangs on it
 * when the player is near. Which is the city's call as the player moves;
 * whether it is in the city at all is the caller's, and the two do not get in
 * each other's way. Only the finest step standing is drawn, so a building is
 * one draw at any distance.
 */
export class CityBuilding {
  readonly plotId: string
  /** The box it occupies, in city metres: its footprint and its height. */
  readonly bounds: THREE.Box3
  readonly #worn = new Map<BuildingStep, Placing>()
  #visible = true

  constructor(plotId: string, massing: Placing) {
    this.plotId = plotId
    this.bounds = massing.bounds
    this.#worn.set('massing', massing)
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

  /** How it is drawn right now. */
  get step(): BuildingStep {
    return FINEST.find((step) => this.#worn.has(step)) ?? 'massing'
  }

  /** Whether it is drawn in detail right now, rather than as its shell or its massing. */
  get detailed(): boolean {
    return this.#worn.has('detail')
  }

  /** Draws it at that step from now on: the coarser ones step aside. */
  wear(step: BuildingStep, placing: Placing): void {
    this.#worn.get(step)?.remove()
    this.#worn.set(step, placing)
    this.#apply()
  }

  /** Back to the next step down: what it wore at that one is taken out of the city. */
  strip(step: BuildingStep): void {
    this.#worn.get(step)?.remove()
    this.#worn.delete(step)
    this.#apply()
  }

  #apply(): void {
    let drawn = false
    for (const step of FINEST) {
      const placing = this.#worn.get(step)
      if (!placing) continue
      placing.show(this.#visible && !drawn)
      drawn = true
    }
  }
}
