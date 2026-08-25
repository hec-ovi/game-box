import type { CastMember } from '@gb/cast'

/** A set of bodies by NPC id, as `@gb/crowd` and `@gb/cast` both publish one. */
export type Bodies = () => ReadonlyMap<string, CastMember> | undefined

/**
 * The body somebody is wearing right now, out of every set that draws one.
 * Asked in order: the pavement first, because somebody out walking is not also
 * standing behind their own counter; then the room the player is standing in,
 * which is dressed by its own art and hands out its own bodies; then the
 * city's own dressing, which draws whoever is left.
 *
 * Asked again every time and never kept: a retired walker's body goes to the
 * next person out and a room let go takes its bodies with it, so a member held
 * from one turn to the next is a stranger's arms.
 */
export class Members {
  #where: readonly Bodies[]

  constructor(...where: Bodies[]) {
    this.#where = where
  }

  /** Whoever is drawing this person, or nothing while nobody is. */
  of(npcId: string): CastMember | undefined {
    for (const bodies of this.#where) {
      const found = bodies()?.get(npcId)
      if (found) return found
    }
    return undefined
  }
}
