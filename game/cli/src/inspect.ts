import { Bundle } from '@gb/bundle'
import { readJson } from './check.ts'
import type { Io } from './index.ts'

/** Print a bundle: the grid as characters, then its places and its quests. */
export async function inspect(file: string | undefined, io: Io): Promise<number> {
  if (!file) {
    io.err('inspect needs a bundle file')
    return 1
  }
  const opened = await Bundle.open(readJson(file))
  if (!opened.ok) {
    io.err(`${file} will not open: ${opened.error.code}`)
    return 1
  }
  const { world, quests } = opened.value

  io.out(`${world.name} (${world.theme})  ${world.grid.width}x${world.grid.height} cells at ${world.cellSize}m`)
  for (const row of world.grid.rows()) io.out(row)

  io.out('')
  io.out('places')
  for (const plot of world.plots()) {
    const people = world.npcsIn(plot.id).map((n) => `${n.name} (${n.role})`).join(', ')
    io.out(`  ${plot.kind.padEnd(10)} ${plot.name.padEnd(26)} ${plot.storeys}st  ${plot.rect.w * world.cellSize}x${plot.rect.h * world.cellSize}m  ${people}`)
  }

  io.out('')
  io.out('quests')
  for (const quest of quests) {
    io.out(`  [${quest.kind}] ${quest.title}  (${quest.reward.money} coin)`)
    for (const step of quest.steps) io.out(`      ${step.kind.padEnd(9)} ${step.objective}`)
  }
  return 0
}
