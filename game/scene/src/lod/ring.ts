import type { Plot, World } from '@gb/world'
import type * as THREE from 'three'
import type { CityBatcher, Placing } from '../batch/batcher.ts'
import type { BuildingStep, CityBuilding } from '../batch/building.ts'
import type { CityLights } from '../lights/city-lights.ts'
import type { LightEmitter } from '../lights/emitter.ts'
import { offerTo } from '../seam.ts'
import { isNear, type Cell } from './near.ts'

/** One plot dressed at one step: the object, what it throws light from, and where it stands. */
export interface Dressed {
  /** What the dressing answered, which may be nothing at all. */
  readonly object: THREE.Object3D | undefined
  readonly emitters: readonly LightEmitter[]
  readonly at: THREE.Matrix4
}

/**
 * How many buildings a ring dresses on a frame that was told its own elapsed
 * time. Building a tall one out of the shipped kit and copying it into a batch
 * is tens of milliseconds, and a step across a cell brings several of them into
 * a wide ring, so one a frame is as low as the ceiling goes. It is well ahead of
 * the demand either way: on the town the game builds, a 256 m ring takes about a
 * thirtieth of a building a frame at walking pace and about half at 20 m/s.
 */
export const STREAM_BUILDS = 1

/**
 * One ring of buildings round the player: the plots within `radius` of their
 * cell, dressed at one step and batched together.
 *
 * Which plots the ring wants is a pure function of the cell and nothing else.
 * As the cell changes, plots that went out are taken out at once with the
 * light they threw, and plots that came in are queued in the order the world
 * lists its plots; `catchUp` builds them, all of them on a frame that was not
 * told its own elapsed time and `STREAM_BUILDS` of them on one that was. A
 * plot waiting its turn is still standing in the city as its massing, so the
 * queue only ever means a building is drawn more coarsely for a few frames,
 * never that there is a hole where it should be.
 */
export class CityRing {
  readonly #world: World
  readonly #batcher: CityBatcher
  readonly #buildings: ReadonlyMap<string, CityBuilding>
  readonly #step: BuildingStep
  readonly #looks: ReadonlyArray<(plot: Plot) => Dressed>
  readonly #radius: number
  readonly #lights: CityLights | undefined
  readonly #held = new Set<string>()
  /** What the ring wants and has not built yet, in the order the world lists its plots. */
  #queue: Plot[] = []

  constructor(input: {
    world: World
    batcher: CityBatcher
    buildings: ReadonlyMap<string, CityBuilding>
    /** Which of a building's three looks this ring draws. */
    step: BuildingStep
    /** How to draw a plot at that step, in order: the first that draws anything is the one that stands. */
    looks: ReadonlyArray<(plot: Plot) => Dressed>
    radius: number
    /** The lights a building in this ring throws. Left out, the ring lights nothing. */
    lights?: CityLights
  }) {
    this.#world = input.world
    this.#batcher = input.batcher
    this.#buildings = input.buildings
    this.#step = input.step
    this.#looks = input.looks
    this.#radius = input.radius
    this.#lights = input.lights
  }

  /** Brings the ring to that cell: what went out is let go now, what came in is queued. */
  follow(cell: Cell): void {
    this.#queue = []
    for (const plot of this.#world.plots()) {
      const near = this.isNear(plot, cell)
      const held = this.#held.has(plot.id)
      if (near && !held) this.#queue.push(plot)
      else if (!near && held) this.#release(plot.id)
    }
  }

  /** Builds up to that many of the queued plots. Whatever is left waits for the next frame. */
  catchUp(builds: number): void {
    if (this.#queue.length === 0) return
    for (const plot of this.#queue.splice(0, builds)) this.#build(plot)
    this.#batcher.settle()
  }

  /** Every plot in the ring from that cell, built now: what a city standing up does. */
  open(cell: Cell): void {
    this.follow(cell)
    this.catchUp(Number.POSITIVE_INFINITY)
  }

  /** Builds one plot into the ring and hangs its lights, whether or not the batches are sealed yet. */
  hold(plot: Plot): void {
    this.#build(plot)
    this.#batcher.settle()
  }

  /** Whether a plot is in this ring from that cell. */
  isNear(plot: Plot, cell: Cell): boolean {
    return isNear(plot, cell, this.#radius, this.#world.cellSize)
  }

  /** The plots sealed in at open, handed to the buildings they belong to. */
  sealed(placings: ReadonlyMap<string, Placing>): void {
    for (const [plotId, placing] of placings) this.#buildings.get(plotId)?.wear(this.#step, placing)
  }

  #build(plot: Plot): void {
    this.#held.add(plot.id)
    // a plot the dressing draws nothing for at this step keeps the coarser look
    // it already stands as, and throws no light over a building that is not there
    for (const look of this.#looks) {
      const { object, emitters, at } = look(plot)
      const taken = offerTo(this.#batcher, plot.id, object, at)
      if (!taken.draws) continue
      if (taken.placing) this.#buildings.get(plot.id)?.wear(this.#step, taken.placing)
      this.#lights?.add(plot.id, emitters, at)
      return
    }
  }

  /** Taking one out is a visibility write and a freed range, so the whole arc goes on the frame the cell changed. */
  #release(plotId: string): void {
    this.#buildings.get(plotId)?.strip(this.#step)
    this.#lights?.remove(plotId)
    this.#held.delete(plotId)
  }
}
