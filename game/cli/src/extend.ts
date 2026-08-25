import { writeFileSync } from 'node:fs'
import { Bundle } from '@gb/bundle'
import { Forge } from '@gb/forge'
import type { AssetPackRef } from '@gb/world'
import type { ExtendArgs } from './args.ts'
import type { Io } from './index.ts'
import { narratorFor } from './narrator.ts'
import { detail, openBundle } from './open.ts'
import { label, pinDesigns, samePack, type Pinning } from './pins.ts'

/**
 * What a grown city and the pack cut from it say generated them. `Pack.apply`
 * seals the city it gives with the pack's own generator, so one label on both
 * is what makes the file `gb apply` writes the file `gb extend` wrote.
 */
export const GROWTH = 'gb extend'

/** Grow a finished city into a new bundle file, the base file untouched. */
export async function extend(args: ExtendArgs, io: Io): Promise<number> {
  if (!args.base) {
    io.err('extend needs a bundle file')
    return 1
  }
  const count = Number.parseInt(args.count, 10)
  if (!Number.isInteger(count) || count < 1) {
    io.err(`extend needs a count of buildings to add, not ${args.count}`)
    return 1
  }
  const opened = await openBundle(args.base, io)
  if (!opened) return 1
  const { world, quests } = opened
  const before = { plots: world.plots().length, interiors: world.interiors().length, npcs: world.npcs().length, items: world.items().length }

  const started = Date.now()
  const { scribe, narrator } = narratorFor(world.seed, args.model)
  const grown = await new Forge(narrator).extend(world, count)
  if (!grown.ok) {
    io.err(`cannot extend: ${grown.error.code}`)
    for (const problem of detail(grown.error)) io.err(`  ${problem}`)
    return 1
  }

  // the growth is pinned the way a build is, against the pack the base names,
  // so nothing in it is re-skinned by whoever applies the pack later
  const pins = await pinDesigns(world, grown.value)
  if (pins.state === 'refused') {
    io.err(`cannot pin the growth to its art: ${pins.why}`)
    return 1
  }
  const bundle = await Bundle.pack(world, quests, { generator: GROWTH, requires: requiresOf(opened.requires, pins) })
  const reopened = await Bundle.open(JSON.parse(JSON.stringify(bundle)))
  if (!reopened.ok) {
    io.err(`grew a bundle that will not open: ${reopened.error.code}`)
    for (const problem of detail(reopened.error)) io.err(`  ${problem}`)
    return 1
  }
  writeFileSync(args.out, `${JSON.stringify(bundle, null, 2)}\n`)

  const seconds = ((Date.now() - started) / 1000).toFixed(1)
  const added = (key: keyof typeof before, now: number) => now - before[key]
  io.out(`${world.name} (${world.theme})`)
  const asked = grown.value.length === count ? '' : ` (${count} asked, the land ran out)`
  io.out(
    `  ${grown.value.length} buildings added${asked}, ${added('interiors', world.interiors().length)} of them open, ${added('npcs', world.npcs().length)} people, ${added('items', world.items().length)} things`,
  )
  io.out(`  ${world.plots().length} buildings, ${world.npcs().length} people, ${quests.length} quests in all`)
  io.out(
    pins.state === 'pinned'
      ? `  designed against ${label(pins.pack)}, ${pins.plots} of ${grown.value.length} added buildings pinned`
      : `  no added building pinned, so the growth names no art: ${pins.why}`,
  )
  if (scribe?.problems().length) {
    io.out(`  ${scribe.problems().length} model calls fell back to the offline narrator`)
  }
  io.out(`  written to ${args.out} in ${seconds}s (${bundle.contentHash.slice(0, 12)})`)
  return 0
}

/** The base's art list, with the pack the growth was pinned to on the end when the base did not name it. */
function requiresOf(base: readonly AssetPackRef[], pins: Pinning): AssetPackRef[] {
  if (pins.state !== 'pinned') return [...base]
  return base.some((ref) => samePack(ref, pins.pack)) ? [...base] : [...base, pins.pack]
}
