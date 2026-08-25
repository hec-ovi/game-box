import { writeFileSync } from 'node:fs'
import { Bundle, Pack } from '@gb/bundle'
import type { ApplyArgs } from './args.ts'
import type { Io } from './index.ts'
import { detail, openBundle, readJson } from './open.ts'

/** Apply a pack to its base and write the city that gives as a bundle file. */
export async function apply(args: ApplyArgs, io: Io): Promise<number> {
  if (!args.base || !args.pack) {
    io.err('apply needs the base bundle and the pack')
    return 1
  }
  const base = await openBundle(args.base, io)
  if (!base) return 1
  const read = readJson(args.pack)
  if ('unreadable' in read) {
    io.err(`${args.pack} cannot be read: ${read.unreadable}`)
    return 1
  }

  const applied = await Pack.apply(base, read.document)
  if (!applied.ok) {
    io.err(`${args.pack} will not apply to ${args.base}: ${applied.error.code}`)
    for (const problem of detail(applied.error)) io.err(`  ${problem}`)
    return 1
  }
  const city = applied.value

  // the file has to carry the hash apply gave the city, or the same base and
  // pack would name two cities: one on disk and one on anybody's shelf
  const generator = generatorOf(read.document)
  const bundle = await Bundle.pack(city.world, city.quests, { requires: city.requires, ...(generator ? { generator } : {}) })
  if (bundle.contentHash !== city.contentHash) {
    io.err(`sealed the city under ${bundle.contentHash.slice(0, 12)} where apply gave ${city.contentHash.slice(0, 12)}; nothing written`)
    return 1
  }
  writeFileSync(args.out, `${JSON.stringify(bundle, null, 2)}\n`)

  io.out(`${city.world.name} (${city.world.theme})`)
  io.out(`  ${city.world.plots().length} buildings, ${city.world.plots().length - base.world.plots().length} of them from the pack; ${city.world.npcs().length} people, ${city.quests.length} quests`)
  io.out(`  written to ${args.out} (${bundle.contentHash.slice(0, 12)})`)
  return 0
}

/** What the pack says generated the growth: `Pack.apply` seals the city with it, so the file written here hashes as apply reports. */
function generatorOf(pack: unknown): string | undefined {
  const created = (pack as { createdWith?: { generator?: unknown } }).createdWith
  return typeof created?.generator === 'string' ? created.generator : undefined
}
