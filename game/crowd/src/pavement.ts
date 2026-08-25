import type { CellKind, World } from '@gb/world'
import type { Cell } from './ports.ts'
import { Ring } from './ring.ts'

/** Every cell a pedestrian may stand on, ready to be picked from by distance. */
export function pavementOf(world: World, kinds: readonly CellKind[]): Ring<Cell> {
  const wanted = new Set(kinds)
  const { width, height } = world.grid
  const ring = new Ring<Cell>(world.cellSize, width, height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const kind = world.grid.at(x, y)
      if (kind !== undefined && wanted.has(kind)) ring.add({ x, y }, { x, y })
    }
  }
  return ring
}
