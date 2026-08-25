import { Forge, OfflineNarrator } from '@gb/forge'
import type { World } from '@gb/world'

const built = new Map<string, Promise<World>>()

/** One generated town, the same one every time: the builders only read it. */
export function town(): Promise<World> {
  return cached('scene', 1)
}

/** A town of a size the draw budget has to hold: 25 blocks of it. */
export function bigTown(): Promise<World> {
  return cached('ceiling', 5)
}

/** A second town, so a rule proved on one city is proved on a city it was not written against. */
export function otherTown(): Promise<World> {
  return cached('streaming', 3)
}

function cached(seed: string, blocks: number): Promise<World> {
  let world = built.get(seed)
  if (!world) {
    world = generate(seed, blocks)
    built.set(seed, world)
  }
  return world
}

async function generate(seed: string, blocks: number): Promise<World> {
  const result = await new Forge(new OfflineNarrator(seed)).build({
    theme: 'quiet coastal town',
    seed,
    blocksX: blocks,
    blocksY: blocks,
    blockCells: 14,
  })
  if (!result.ok) throw new Error(JSON.stringify(result.error).slice(0, 400))
  return result.value.world
}
