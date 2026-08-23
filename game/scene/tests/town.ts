import { Forge, OfflineNarrator } from '@gb/forge'
import type { World } from '@gb/world'

let built: Promise<World> | undefined

/** One generated town, the same one every time: the builders only read it. */
export function town(): Promise<World> {
  built ??= generate()
  return built
}

async function generate(): Promise<World> {
  const result = await new Forge(new OfflineNarrator('scene')).build({
    theme: 'quiet coastal town',
    seed: 'scene',
    blocksX: 1,
    blocksY: 1,
    blockCells: 14,
  })
  if (!result.ok) throw new Error(JSON.stringify(result.error).slice(0, 400))
  return result.value.world
}
