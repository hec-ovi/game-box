import { writeFileSync } from 'node:fs'
import { Bundle } from '@gb/bundle'
import { Forge, OfflineNarrator, type Narrator } from '@gb/forge'
import { Scribe } from '@gb/scribe'
import type { BuildArgs, Io } from './index.ts'
import { pinDesigns } from './pins.ts'

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
    // left out unless asked for: the seed picks the block size, and supplying a
    // default here would build a different city from the same brief
    ...(args.cells ? { blockCells: Number.parseInt(args.cells, 10) } : {}),
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

  // pin the city to the art it was designed against before it is sealed: the
  // hash covers the pins, and a file written without them is re-skinned by
  // whoever opens it against a newer pack
  const pins = await pinDesigns(world)
  if (pins.state === 'half') {
    io.err(`cannot pin the city to its art: ${pins.why}`)
    return 1
  }
  const requires = pins.state === 'pinned' ? [pins.pack] : []
  const bundle = await Bundle.pack(world, quests, { generator: 'gb build', requires })

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
  io.out(
    pins.state === 'pinned'
      ? `  designed against ${pins.pack.pack} ${pins.pack.version}, ${pins.plots} of ${world.plots().length} buildings pinned`
      : `  no buildings pinned, so the file names no art: ${pins.why}`,
  )
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
