import type { Rng } from '@gb/kit'
import { BODY_KINDS, type Npc, type NpcRole } from '@gb/world'

/** Ids the crowd mints start here, well past anything a generated city holds. */
const FIRST_ID = 900000

/** Who is out on the street. Nobody behind a counter, nobody asleep. */
const STREET_ROLES: readonly NpcRole[] = ['resident', 'worker', 'courier', 'wanderer', 'vendor']

/**
 * A pedestrian, shaped like a world NPC so `@gb/cast` can give them a body,
 * but never written into the world: they are scenery with legs, they own
 * nothing, know nothing and are not in anybody's quest.
 */
export function pedestrian(serial: number, rng: Rng): Npc {
  return {
    id: `npc_${FIRST_ID + serial}`,
    name: 'Passer-by',
    role: rng.pick(STREET_ROLES),
    appearance: { base: rng.pick(BODY_KINDS), variant: rng.int(0, 64) },
    personality: 'Crossing town on their own business.',
    knowledge: [],
  }
}
