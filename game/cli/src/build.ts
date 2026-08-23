import { writeFileSync } from 'node:fs'
import { Bundle } from '@gb/bundle'
import { Forge, OfflineNarrator, type Narrator } from '@gb/forge'
import { Scribe } from '@gb/scribe'
import type { BuildArgs, Io } from './index.ts'

/** Generate a city and write it out as one bundle file. */
export async function build(args: BuildArgs, io: Io): Promise<number> {
  const [across, down] = args.blocks.split('x').map((n) => Number.parseInt(n, 10))
  const scribe = args.model ? new Scribe({ seed: args.seed }) : undefined
  const narrator: Narrator = scribe ?? new OfflineNarrator(args.seed)

  const started = Date.now()
  const built = await new Forge(narrator).build({
    theme: args.theme,
    seed: args.seed,
    blocksX: across,
    blocksY: down,
    blockCells: Number.parseInt(args.cells, 10),
    density: Number.parseFloat(args.density),
    maxStoreys: Number.parseInt(args.storeys, 10),
    exits: Number.parseInt(args.exits, 10),
  })
  if (!built.ok) {
    io.err(`cannot build: ${built.error.code}`)
    for (const problem of problemsOf(built.error)) io.err(`  ${problem}`)
    return 1
  }

  const { world, quests, rejected } = built.value
  const bundle = await Bundle.pack(world, quests, { generator: 'gb build' })

  // read it back the way the game will: writing a file nobody can open is a
  // worse failure than not writing one, and it used to be reported as success
  const reopened = await Bundle.open(JSON.parse(JSON.stringify(bundle)))
  if (!reopened.ok) {
    io.err(`built a bundle that will not open: ${reopened.error.code}`)
    for (const problem of problemsOf(reopened.error)) io.err(`  ${problem}`)
    return 1
  }
  writeFileSync(args.out, `${JSON.stringify(bundle, null, 2)}\n`)

  const seconds = ((Date.now() - started) / 1000).toFixed(1)
  io.out(`${world.name} (${world.theme})`)
  io.out(`  ${world.grid.width}x${world.grid.height} cells at ${world.cellSize}m, ${world.plots().length} buildings, ${world.npcs().length} people, ${world.items().length} things`)
  io.out(`  ${quests.length} quests${rejected.length ? `, ${rejected.length} rejected` : ''}`)
  for (const bad of rejected) {
    io.out(`    quest ${bad.index} rejected: ${bad.problems[0]?.message ?? 'unknown'}`)
  }
  if (scribe?.problems().length) {
    io.out(`  ${scribe.problems().length} model calls fell back to the offline narrator`)
  }
  io.out(`  written to ${args.out} in ${seconds}s (${bundle.contentHash.slice(0, 12)})`)
  return 0
}

function problemsOf(error: { code: string } & Record<string, unknown>): string[] {
  const list = (error.problems ?? error.violations) as Array<Record<string, string>> | undefined
  return (list ?? []).slice(0, 10).map((p) => `${p.where ?? p.path}: ${p.message}`)
}
