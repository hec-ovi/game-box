import { Forge } from '@gb/forge'
import type { World } from '@gb/world'
import { openRooms } from './rooms.ts'

/**
 * The towns the builders are measured against. `Forge.plan` is the generator's
 * arithmetic half: the same streets, roads, parts of town and buildings a
 * build puts up, drawn straight off the brief with nothing asked of anybody,
 * so it answers at once. What it does not lay is anything behind a door, so a
 * handful of rooms are cut in afterwards (`rooms.ts`).
 */

/** How many doors open in a town: what a small city's build opens, whatever its size. */
const OPEN = 3

const built = new Map<string, World>()

/** One planned town, the same one every time: the builders only read it. */
export function town(): World {
  return cached('scene', 1)
}

/** A town of a size the draw budget has to hold: 25 blocks of it. */
export function bigTown(): World {
  return cached('ceiling', 5)
}

/** A second town, so a rule proved on one city is proved on a city it was not written against. */
export function otherTown(): World {
  return cached('streaming', 3)
}

/**
 * A town of that many blocks a side with its first few doors open. `blockCells`
 * is left to the seed when it is not given, which is what the benches ask for.
 */
export function plannedTown(seed: string, blocks: number, blockCells?: number): World {
  const result = Forge.plan({
    theme: 'quiet coastal town',
    seed,
    blocksX: blocks,
    blocksY: blocks,
    ...(blockCells === undefined ? {} : { blockCells }),
  })
  if (!result.ok) throw new Error(JSON.stringify(result.error).slice(0, 400))
  openRooms(result.value, OPEN)
  return result.value
}

function cached(seed: string, blocks: number): World {
  let world = built.get(seed)
  if (!world) {
    world = plannedTown(seed, blocks, 14)
    built.set(seed, world)
  }
  return world
}
