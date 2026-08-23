import { createHash } from 'node:crypto'
import { Forge, OfflineNarrator } from '../src/index.ts'

/** Builds a town the way an app does, and says why if it will not build. */
export async function buildTown(seed: string, overrides: Record<string, unknown> = {}) {
  const forge = new Forge(new OfflineNarrator(seed))
  const built = await forge.build({ theme: 'dusty western mining town', seed, blocksX: 2, blocksY: 2, ...overrides })
  if (!built.ok) throw new Error(JSON.stringify(built.error).slice(0, 800))
  return { forge, ...built.value }
}

export const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 32)
