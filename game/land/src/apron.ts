import { METRICS, type World } from '@gb/world'
import type { HeightField } from './height.ts'
import { smoothstep01 } from './height.ts'

/** Cell kinds whose top stands a kerb above the roadway. */
const RAISED = new Set(['sidewalk', 'park'])

/** One corner of the apron lattice, in cell coordinates. */
export interface Corner {
  readonly gx: number
  readonly gz: number
}

/**
 * The heights of the ground where it meets the city: the verge the grid marks
 * `mountain`, and a shoulder one coarse step wide outside the map.
 *
 * A corner the city touches is pinned to what it touches: the pavement's top
 * where a pavement or a park meets it, the roadway where a street does, so
 * nothing can be seen under either. Every other corner takes the land's own
 * height plus a lift that carries the pavement's top out across the verge and
 * dies away by its far edge, so the verge rises from the kerb line instead of
 * dipping under it before the bank picks it up.
 */
export class Apron {
  readonly #world: World
  readonly #height: HeightField
  /** Metres over which the pavement's lift fades: the verge's own width. */
  readonly #fade: number

  constructor(world: World, height: HeightField, corners: Iterable<Corner>) {
    this.#world = world
    this.#height = height
    let width = world.cellSize
    for (const corner of corners) {
      if (!this.#inside(corner)) continue
      width = Math.max(width, height.awayFromTown(corner.gx * world.cellSize, corner.gz * world.cellSize))
    }
    this.#fade = width
  }

  /** Whether this cell of the lattice is ground this box draws: verge inside the map, everything outside it. */
  covers(gx: number, gz: number): boolean {
    const kind = this.#world.grid.at(gx, gz)
    return kind === undefined || kind === 'mountain'
  }

  /** Height of one corner of the lattice, in metres. */
  at(corner: Corner): number {
    const cell = this.#world.cellSize
    const x = corner.gx * cell
    const z = corner.gz * cell
    const touching = this.#kindsAround(corner)
    if (touching.some((kind) => RAISED.has(kind))) return METRICS.street.curbHeight
    if (touching.some((kind) => kind !== 'mountain')) return 0

    const lift = METRICS.street.curbHeight * (1 - smoothstep01(this.#toPavement(corner) / this.#fade))
    return this.#height.at(x, z) + lift
  }

  /** Whether the corner has a grid cell on at least one side. */
  #inside(corner: Corner): boolean {
    return this.#kindsAround(corner).length > 0
  }

  #kindsAround(corner: Corner): string[] {
    const kinds: string[] = []
    for (const dx of [-1, 0]) {
      for (const dz of [-1, 0]) {
        const kind = this.#world.grid.at(corner.gx + dx, corner.gz + dz)
        if (kind !== undefined) kinds.push(kind)
      }
    }
    return kinds
  }

  /** Exact metres from a corner to the nearest raised cell, out to where the lift has faded anyway. */
  #toPavement(corner: Corner): number {
    const cell = this.#world.cellSize
    const reach = Math.ceil(this.#fade / cell)
    let nearest = this.#fade
    for (let gz = corner.gz - reach; gz < corner.gz + reach; gz++) {
      for (let gx = corner.gx - reach; gx < corner.gx + reach; gx++) {
        const kind = this.#world.grid.at(gx, gz)
        if (kind === undefined || !RAISED.has(kind)) continue
        // the corner is on the lattice, so the nearest point of the cell is one of its own corners
        const dx = Math.max(0, gx - corner.gx, corner.gx - (gx + 1))
        const dz = Math.max(0, gz - corner.gz, corner.gz - (gz + 1))
        nearest = Math.min(nearest, Math.hypot(dx, dz) * cell)
      }
    }
    return nearest
  }
}
