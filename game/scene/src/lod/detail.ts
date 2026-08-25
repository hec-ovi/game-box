import type { Plot, World } from '@gb/world'
import type * as THREE from 'three'
import type { CityBatcher, Placing } from '../batch/batcher.ts'
import type { CityBuilding } from '../batch/building.ts'
import type { CityLights } from '../lights/city-lights.ts'
import type { LightEmitter } from '../lights/emitter.ts'
import { offerTo } from '../seam.ts'
import { isNear, type Cell } from './near.ts'

/** One plot dressed in detail: the object, what it throws light from, and where it stands. */
export interface Dressed {
  /** What the dressing answered, which may be nothing at all. */
  readonly object: THREE.Object3D | undefined
  readonly emitters: readonly LightEmitter[]
  readonly at: THREE.Matrix4
}

/**
 * Which buildings are drawn in detail: the ones near the player's cell. As
 * the cell changes, buildings that came near are dressed and batched, and
 * ones that went far are taken out again with the light they threw, so the
 * set standing in detail is a pure function of the cell and nothing else.
 */
export class CityDetail {
  readonly #world: World
  readonly #batcher: CityBatcher
  readonly #lights: CityLights
  readonly #buildings: ReadonlyMap<string, CityBuilding>
  readonly #dress: (plot: Plot) => Dressed
  readonly #radius: number
  readonly #near = new Set<string>()

  constructor(
    world: World,
    batcher: CityBatcher,
    lights: CityLights,
    buildings: ReadonlyMap<string, CityBuilding>,
    dress: (plot: Plot) => Dressed,
    radius: number,
  ) {
    this.#world = world
    this.#batcher = batcher
    this.#lights = lights
    this.#buildings = buildings
    this.#dress = dress
    this.#radius = radius
  }

  /** Brings the detail to that cell: what came near is built, what went far is let go. */
  follow(cell: Cell): void {
    for (const plot of this.#world.plots()) {
      const near = this.isNear(plot, cell)
      const held = this.#near.has(plot.id)
      if (near && !held) this.#build(plot)
      else if (!near && held) this.#release(plot.id)
    }
    this.#batcher.settle()
  }

  /** Whether a plot is drawn in detail from that cell. */
  isNear(plot: Plot, cell: Cell): boolean {
    return isNear(plot, cell, this.#radius, this.#world.cellSize)
  }

  /** Dresses one plot in detail and hangs its lights, whether or not the batches are sealed yet. */
  build(plot: Plot): void {
    this.#build(plot)
    this.#batcher.settle()
  }

  #build(plot: Plot): void {
    this.#near.add(plot.id)
    const { object, emitters, at } = this.#dress(plot)
    const taken = offerTo(this.#batcher, plot.id, object, at)
    // a plot the dressing draws nothing near keeps the shell it is drawn by
    // from far off, and throws no light over a building that is not there
    if (!taken.draws) return
    if (taken.placing) this.#buildings.get(plot.id)?.detail(taken.placing)
    this.#lights.add(plot.id, emitters, at)
  }

  /** The detail sealed in at open, handed to the buildings it belongs to. */
  sealed(placings: ReadonlyMap<string, Placing>): void {
    for (const [plotId, placing] of placings) this.#buildings.get(plotId)?.detail(placing)
  }

  #release(plotId: string): void {
    this.#buildings.get(plotId)?.undetail()
    this.#lights.remove(plotId)
    this.#near.delete(plotId)
  }
}
