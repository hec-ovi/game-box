import type { Rng } from '@gb/kit'
import { BUILDING_KINDS, type CellKind, type World } from '@gb/world'
import type { Cell, Point } from './ports.ts'
import { Ring } from './ring.ts'

/** Somewhere in town a walker can be going: a building, and the pavement cell at its door. */
export interface Place {
  readonly plotId: string
  readonly cell: Cell
}

/**
 * The doors in town. A plot's doorstep is its `entrance.cell`, the way
 * `@gb/nav` reads it; one that is not on the pavement is a door nobody can
 * walk up to, so that building is nowhere to go and nowhere to set off from.
 */
export class Places {
  #ring: Ring<Place>
  #doors = new Map<string, Cell>()

  private constructor(ring: Ring<Place>) {
    this.#ring = ring
  }

  static from(world: World, kinds: readonly CellKind[]): Places {
    const wanted = new Set(kinds)
    const places = new Places(new Ring<Place>(world.cellSize, world.grid.width, world.grid.height))
    for (const kind of BUILDING_KINDS) {
      for (const plot of world.plotsOfKind(kind)) {
        const cell = plot.entrance.cell
        const under = world.grid.at(cell.x, cell.y)
        if (under === undefined || !wanted.has(under)) continue
        places.#ring.add(cell, { plotId: plot.id, cell })
        places.#doors.set(plot.id, cell)
      }
    }
    return places
  }

  /** A door between two distances of a point, or nothing when there is none that far away. */
  pick(centre: Point, minMetres: number, maxMetres: number, rng: Rng): Place | undefined {
    return this.#ring.pick(centre, minMetres, maxMetres, rng)
  }

  /** The doorstep of a building, by plot id, or nothing for a plot nobody knows or one with no door on the pavement. */
  doorstep(plotId: string): Cell | undefined {
    return this.#doors.get(plotId)
  }
}
