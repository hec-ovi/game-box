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
  const nav = CityNav.from(world)
  const doorsteps = world.plots().map((p) => ({ plot: p, cell: p.entrance.cell }))
  const start = doorsteps[0]
  const stranded = start ? doorsteps.filter((d) => !nav.reachable(start.cell, d.cell)) : []

  io.out(`${world.name}: sound`)
  io.out(`  ${world.plots().length} buildings, ${world.npcs().length} people, ${quests.length} quests`)
  io.out(`  content ${opened.value.contentHash.slice(0, 12)}`)
  if (stranded.length) {
    io.err(`  ${stranded.length} buildings cannot be walked to: ${stranded.slice(0, 5).map((d) => d.plot.name).join(', ')}`)
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
