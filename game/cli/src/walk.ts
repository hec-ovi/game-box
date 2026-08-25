import { CityNav } from '@gb/nav'
import type { World } from '@gb/world'
import type { Io } from './index.ts'

/**
 * The one thing a schema cannot say about a city: that every building can be
 * walked to. One walk from the first door answers for all of them at once;
 * asking per building was minutes of work on a large map.
 */
export function walk(world: World, io: Io): boolean {
  const start = world.plots()[0]?.entrance.cell
  const stranded = start ? CityNav.from(world).reachableFrom(start).unreachablePlots(world) : []
  if (stranded.length) {
    const named = stranded.slice(0, 5).map((id) => world.plot(id)?.name ?? id)
    io.err(`  ${stranded.length} buildings cannot be walked to: ${named.join(', ')}`)
    return false
  }
  io.out('  every building can be walked to')
  return true
}
