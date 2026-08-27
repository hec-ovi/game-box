import { writeFileSync } from 'node:fs'
import { Bundle } from '@gb/bundle'
import { Forge } from '@gb/forge'
import type { BuildArgs } from './args.ts'
import type { Io } from './index.ts'
import { narratorFor, storied } from './narrator.ts'
import { detail } from './open.ts'
import { label, pinDesigns } from './pins.ts'

/** Generate a city and write it out as one bundle file. */
export async function build(args: BuildArgs, io: Io): Promise<number> {
  const [across, down] = args.blocks.split('x').map((n) => Number.parseInt(n, 10))
  const { scribe, narrator: writer } = narratorFor(args.seed, args.model)
  const narrator = args.history ? storied(writer, args.history) : writer
  if (typeof narrator === 'string') {
    io.err(`cannot build: ${narrator}`)
    return 1
  }

  const started = Date.now()
  const built = await new Forge(narrator).build({
    theme: args.theme,
    seed: args.seed,
    blocksX: across,
    blocksY: down,
    // left out unless asked for: the seed picks the block size, and supplying a
    // default here would build a different city from the same brief
    ...(args.cells ? { blockCells: Number.parseInt(args.cells, 10) } : {}),
    density: Number.parseFloat(args.density),
    maxStoreys: Number.parseInt(args.storeys, 10),
    exits: Number.parseInt(args.exits, 10),
  })
  if (!built.ok) {
    io.err(`cannot build: ${built.error.code}`)
    for (const problem of detail(built.error)) io.err(`  ${problem}`)
    return 1
  }

  const { world, quests, rejected, dropped } = built.value

  // pin the city to the art it was designed against before it is sealed: the
  // hash covers the pins, and a file written without them is re-skinned by
  // whoever opens it against a newer pack
  const pins = await pinDesigns(
    world,
    world.plots().map((plot) => plot.id),
  )
  if (pins.state === 'refused') {
    io.err(`cannot pin the city to its art: ${pins.why}`)
    return 1
  }
  const requires = pins.state === 'pinned' ? [pins.pack] : []
  const bundle = await Bundle.pack(world, quests, { generator: 'gb build', requires })

  // read it back the way the game will: writing a file nobody can open is a
  // worse failure than not writing one
  const reopened = await Bundle.open(JSON.parse(JSON.stringify(bundle)))
  if (!reopened.ok) {
    io.err(`built a bundle that will not open: ${reopened.error.code}`)
    for (const problem of detail(reopened.error)) io.err(`  ${problem}`)
    return 1
  }
  writeFileSync(args.out, `${JSON.stringify(bundle, null, 2)}\n`)

  const seconds = ((Date.now() - started) / 1000).toFixed(1)
  io.out(`${world.name} (${world.theme})`)
  io.out(`  ${world.grid.width}x${world.grid.height} cells at ${world.cellSize}m, ${world.plots().length} buildings, ${world.npcs().length} people, ${world.items().length} things`)
  if (args.history && !world.premise()) io.out(`  nothing of ${args.history} could be read as a history, so the town has no story`)
  // a kind of place the history declared and the city would not take is the
  // one thing the file cannot say, so the report says it loud
  if (dropped.length) io.out(`  ${dropped.length} kinds of place the history declared were dropped`)
  for (const gone of dropped) io.out(`    ${gone.word}: ${gone.reason}`)
  io.out(`  ${quests.length} quests${rejected.length ? `, ${rejected.length} rejected` : ''}`)
  for (const bad of rejected) {
    io.out(`    quest ${bad.index} rejected: ${bad.problems[0]?.message ?? 'unknown'}`)
  }
  io.out(
    pins.state === 'pinned'
      ? `  designed against ${label(pins.pack)}, ${pins.plots} of ${world.plots().length} buildings pinned`
      : `  no buildings pinned, so the file names no art: ${pins.why}`,
  )
  if (scribe?.problems().length) {
    const problems = scribe.problems()
    io.out(`  ${problems.length} model calls fell back to the offline narrator`)
    // the count alone cannot be acted on: 115 fallbacks with no reason is a
    // build that looks like it worked. Group them, worst first, so one line
    // says whether the model is refusing, timing out or writing the wrong shape
    const byReason = new Map<string, { count: number; where: string[] }>()
    for (const one of problems) {
      const key = `${one.task} ${one.error.code ?? 'unknown'}`
      const held = byReason.get(key) ?? { count: 0, where: [] }
      held.count += 1
      if (held.where.length < 3) held.where.push(one.at)
      byReason.set(key, held)
    }
    for (const [reason, held] of [...byReason].sort((a, b) => b[1].count - a[1].count)) {
      io.out(`    ${held.count} x ${reason} (${held.where.join(', ')}${held.count > held.where.length ? ', ...' : ''})`)
    }
  }
  io.out(`  written to ${args.out} in ${seconds}s (${bundle.contentHash.slice(0, 12)})`)
  return 0
}
