import { readFileSync } from 'node:fs'
import { Bundle } from '@gb/bundle'
import { CityNav } from '@gb/nav'
import type { Io } from './index.ts'

/** Open a bundle the way the game would, and say what is wrong with it. */
export async function check(file: string | undefined, io: Io): Promise<number> {
  if (!file) {
    io.err('check needs a bundle file')
    return 1
  }
  const opened = await Bundle.open(readJson(file))
  if (!opened.ok) {
    io.err(`${file} will not open: ${opened.error.code}`)
    for (const line of detail(opened.error)) io.err(`  ${line}`)
    return 1
  }

  const { world, quests } = opened.value
  // one walk of the whole city answers for every building at once: asking per
  // building was minutes of work on a large map
  const start = world.plots()[0]?.entrance.cell
  const stranded = start ? CityNav.from(world).reachableFrom(start).unreachablePlots(world) : []

  io.out(`${world.name}: sound`)
  io.out(`  ${world.plots().length} buildings, ${world.npcs().length} people, ${quests.length} quests`)
  io.out(`  content ${opened.value.contentHash.slice(0, 12)}`)
  if (stranded.length) {
    const named = stranded.slice(0, 5).map((id) => world.plot(id)?.name ?? id)
    io.err(`  ${stranded.length} buildings cannot be walked to: ${named.join(', ')}`)
    return 1
  }
  io.out('  every building can be walked to')
  return 0
}

function detail(error: Record<string, unknown>): string[] {
  const list = (error.problems ?? error.violations) as Array<Record<string, string>> | undefined
  if (list) return list.slice(0, 10).map((p) => `${p.where ?? p.path}: ${p.message}`)
  if (typeof error.message === 'string') return [error.message]
  if (typeof error.expected === 'string') return [`expected ${error.expected}, got ${error.actual}`]
  return []
}

export function readJson(file: string): unknown {
  return JSON.parse(readFileSync(file, 'utf8'))
}
