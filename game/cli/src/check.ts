import { CityNav } from '@gb/nav'
import type { Io } from './index.ts'
import { openBundle } from './open.ts'

/** Open a bundle the way the game would, and say what is wrong with it. */
export async function check(file: string | undefined, io: Io): Promise<number> {
  if (!file) {
    io.err('check needs a bundle file')
    return 1
  }
  const opened = await openBundle(file, io)
  if (!opened) return 1

  const { world, quests } = opened
  // one walk of the whole city answers for every building at once: asking per
  // building was minutes of work on a large map
  const start = world.plots()[0]?.entrance.cell
  const stranded = start ? CityNav.from(world).reachableFrom(start).unreachablePlots(world) : []

  io.out(`${world.name}: sound`)
  io.out(`  ${world.plots().length} buildings, ${world.npcs().length} people, ${quests.length} quests`)
  io.out(`  content ${opened.contentHash.slice(0, 12)}`)
  if (stranded.length) {
    const named = stranded.slice(0, 5).map((id) => world.plot(id)?.name ?? id)
    io.err(`  ${stranded.length} buildings cannot be walked to: ${named.join(', ')}`)
    return 1
  }
  io.out('  every building can be walked to')
  return 0
}
