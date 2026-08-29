import { createHash } from 'node:crypto'
import type { World } from '@gb/world'
import { Forge } from '../src/index.ts'

/**
 * A town laid out the way the blueprint preview lays one out, and why if it will
 * not lay out. Everything about a city that is arithmetic is here: the grid, the
 * roads, the parts of town, every plot with its kind, its height and the part it
 * stands in. No interiors, so nobody is standing anywhere. No model is
 * involved.
 */
export function planned(seed: string, overrides: Record<string, unknown> = {}, history?: unknown): World {
  const out = Forge.plan({ theme: 'dusty western mining town', seed, blocksX: 2, blocksY: 2, ...overrides }, history)
  if (!out.ok) throw new Error(JSON.stringify(out.error).slice(0, 800))
  return out.value
}

export const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 32)
