import type { Rng } from '@gb/kit'
import { BODY_KINDS, type Npc, type NpcRole } from '@gb/world'
import type { CrowdPeople } from './ports.ts'

/** Ids the crowd mints start here, well past anything a generated city holds. */
const FIRST_ID = 900000

/** Who is out on the street. Nobody behind a counter, nobody asleep. */
const STREET_ROLES: readonly NpcRole[] = ['resident', 'worker', 'courier', 'wanderer', 'vendor']

/**
 * A pedestrian, shaped like a world NPC so `@gb/cast` can give them a body,
 * but never written into the world: they own nothing, know nothing and are in
 * nobody's quest. The crowd still answers for them by id, so the game can put
 * a name over their head; what they have to say is somebody else's box.
 */
function pedestrian(serial: number, rng: Rng): Npc {
  return {
    id: `npc_${FIRST_ID + serial}`,
    name: 'Passer-by',
    role: rng.pick(STREET_ROLES),
    appearance: { base: rng.pick(BODY_KINDS), variant: rng.int(0, 64) },
    personality: 'Crossing town on their own business.',
    knowledge: [],
  }
}

/** The crowd's own people: strangers, minted on the spot, when the game names nobody. */
export const STRANGERS: CrowdPeople = {
  street(serial: number, rng: Rng): Npc {
    return pedestrian(serial, rng)
  },
}
