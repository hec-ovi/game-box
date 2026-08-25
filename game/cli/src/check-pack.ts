import { Pack } from '@gb/bundle'
import type { Io } from './index.ts'
import { detail, openBundle } from './open.ts'
import { walk } from './walk.ts'

/** A file is a pack when it says so; whether it is a whole one is `Pack.apply`'s to say. */
export function isPack(document: unknown): boolean {
  return (document as { format?: unknown } | null)?.format === 'game-box.pack'
}

/**
 * Say which base a pack names and what it adds, off the file alone. Given a
 * base, apply it the way the game would, which is what proves its seal, and
 * walk the city that gives.
 */
export async function checkPack(file: string, document: unknown, base: string | undefined, io: Io): Promise<number> {
  const named = baseOf(document)
  if (!named) {
    io.err(`${file} is not a pack: it names no base`)
    return 1
  }
  io.out(`${file}: a pack for ${named.worldId} at ${named.contentHash.slice(0, 12)}`)
  const world = field(document, 'world')
  io.out(
    `  ${count(world, 'plots')} buildings, ${count(world, 'interiors')} interiors, ${count(world, 'npcs')} people, ${count(world, 'items')} things, ${count(document, 'quests')} quests`,
  )
  if (!base) {
    io.out(`  its seal and what it adds are proved against its base: gb check ${file} --base <bundle>`)
    return 0
  }

  const opened = await openBundle(base, io)
  if (!opened) return 1
  const applied = await Pack.apply(opened, document)
  if (!applied.ok) {
    io.err(`${file} will not apply to ${base}: ${applied.error.code}`)
    for (const line of detail(applied.error)) io.err(`  ${line}`)
    return 1
  }
  const city = applied.value
  io.out(`  applies to ${city.world.name}: ${city.world.plots().length} buildings, ${city.world.npcs().length} people, ${city.quests.length} quests`)
  io.out(`  content ${city.contentHash.slice(0, 12)}`)
  return walk(city.world, io) ? 0 : 1
}

/** The base a pack names, when the file carries one. */
function baseOf(document: unknown): { worldId: string; contentHash: string } | undefined {
  const base = field(document, 'base') as { worldId?: unknown; contentHash?: unknown } | undefined
  if (typeof base?.worldId !== 'string' || typeof base.contentHash !== 'string') return undefined
  return { worldId: base.worldId, contentHash: base.contentHash }
}

function field(document: unknown, key: string): unknown {
  return (document as Record<string, unknown> | null)?.[key]
}

/** How many of something a file lists, counting nothing where it lists none. */
function count(document: unknown, key: string): number {
  const list = field(document, key)
  return Array.isArray(list) ? list.length : 0
}
