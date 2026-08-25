import type { Npc, NpcRole } from '@gb/world'
import { hash01 } from './hash.ts'

/** How a body is built: the pack's own proportions, or the heavy build cut from them at spawn. */
export type Build = 'regular' | 'heavy'

/** The roles a heavy build turns up in: on the door, in the yard, on the dock, under a car. */
const HEAVY_ROLES: readonly NpcRole[] = ['guard', 'worker', 'mechanic']

/** How many of those are heavy: a minority, so a door with two guards is not the same man twice. */
const HEAVY_SHARE = 0.3

/**
 * Which build this person has. Drawn off the id, so the same guard is the
 * same size every time the city is opened, here and on anyone else's machine.
 */
export function buildFor(npc: Pick<Npc, 'id' | 'role'>): Build {
  if (!HEAVY_ROLES.includes(npc.role)) return 'regular'
  return hash01(`${npc.id}/build`) < HEAVY_SHARE ? 'heavy' : 'regular'
}
