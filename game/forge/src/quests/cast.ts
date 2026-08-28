import type { NpcRole } from '@gb/world'
import type { WorldSummary } from '../narrator.ts'

/** Roles with a post to hold: the people a town brings its problems to. */
const GIVER_ROLES: ReadonlySet<NpcRole> = new Set(['bartender', 'clerk', 'vendor', 'receptionist', 'cook', 'mechanic', 'guard', 'worker'])

/** How many jobs one person may hand out before the town starts to look empty. */
const JOBS_PER_GIVER = 2

/**
 * The town as its appetite for work reads it: everybody a job could name, and
 * the most jobs it could hand out before it promises the same thing twice.
 *
 * A person behind a locked door is a person no line can point at until the door
 * is open, so the cast is everybody standing in front of one. A deed is bought
 * or won rather than fetched, and a thing behind a lock is a job for whoever
 * has the key, so neither counts as something an errand can be about.
 */
export class CityCast {
  /** Everybody a job can name: what the amount of work in a town is measured against. */
  readonly people: number
  /** A couple of jobs per person who gives work, and one unclaimed thing for each job to be about. */
  readonly capacity: number

  constructor(summary: WorldSummary) {
    let people = 0
    let givers = 0
    let things = 0
    for (const place of summary.places) {
      const behind = new Set((place.locks ?? []).flatMap((lock) => lock.behind))
      const shut = (place.locks ?? []).some((lock) => lock.street)
      for (const npc of place.npcs) {
        if (shut || (place.locks ?? []).some((lock) => lock.roomId === npc.roomId)) continue
        people++
        if (GIVER_ROLES.has(npc.role)) givers++
      }
      things += place.items.filter((item) => item.archetype !== 'deed' && !behind.has(item.itemId)).length
    }
    this.people = people
    this.capacity = Math.min((givers || people) * JOBS_PER_GIVER, things)
  }
}
