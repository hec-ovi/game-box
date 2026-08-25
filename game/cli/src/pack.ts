import { writeFileSync } from 'node:fs'
import { Pack } from '@gb/bundle'
import type { PackArgs } from './args.ts'
import { GROWTH } from './extend.ts'
import type { Io } from './index.ts'
import { detail, openBundle } from './open.ts'

/** Cut what a grown city added to its base into a pack file. */
export async function pack(args: PackArgs, io: Io): Promise<number> {
  if (!args.base || !args.extended) {
    io.err('pack needs the base bundle and the grown one')
    return 1
  }
  const base = await openBundle(args.base, io)
  if (!base) return 1
  const extended = await openBundle(args.extended, io)
  if (!extended) return 1

  const cut = await Pack.cut(base, { world: extended.world, quests: extended.quests }, { generator: GROWTH })
  if (!cut.ok) {
    io.err(`cannot cut a pack: ${cut.error.code}`)
    for (const problem of detail(cut.error)) io.err(`  ${problem}`)
    return 1
  }
  const document = cut.value

  // apply it back through the same door everyone else will: a pack that will
  // not apply is worse than no pack
  const applied = await Pack.apply(base, JSON.parse(JSON.stringify(document)))
  if (!applied.ok) {
    io.err(`cut a pack that will not apply: ${applied.error.code}`)
    for (const problem of detail(applied.error)) io.err(`  ${problem}`)
    return 1
  }
  writeFileSync(args.out, `${JSON.stringify(document, null, 2)}\n`)

  const added = document.world
  io.out(`${base.world.name}: a pack for ${document.base.worldId} at ${document.base.contentHash.slice(0, 12)}`)
  io.out(`  ${added.plots.length} buildings, ${added.interiors.length} interiors, ${added.npcs.length} people, ${added.items.length} things, ${document.quests.length} quests`)
  io.out(`  applies to a city of ${applied.value.world.plots().length} buildings (${applied.value.contentHash.slice(0, 12)})`)
  io.out(`  written to ${args.out} (${document.contentHash.slice(0, 12)})`)
  return 0
}
