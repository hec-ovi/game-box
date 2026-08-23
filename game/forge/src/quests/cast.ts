import type { Rng } from '@gb/kit'
import type { NpcRole } from '@gb/world'
import type { WorldSummary } from '../narrator.ts'

export type CastPlace = WorldSummary['places'][number]
export type CastNpc = CastPlace['npcs'][number]
export type CastItem = CastPlace['items'][number]

/** Somebody standing somewhere: everything a step needs to point at a person. */
export interface CastPerson {
  readonly place: CastPlace
  readonly npc: CastNpc
}

/** Roles with a post to hold: the people a town brings its problems to. */
const GIVER_ROLES: ReadonlySet<NpcRole> = new Set(['bartender', 'clerk', 'vendor', 'receptionist', 'cook', 'mechanic', 'guard', 'worker'])

/** Roles with nowhere they have to be: the people who will walk somewhere with you. */
const WALKER_ROLES: ReadonlySet<NpcRole> = new Set(['patron', 'wanderer', 'courier', 'resident', 'worker'])

/** How many jobs one person may hand out before the town starts to look empty. */
const JOBS_PER_GIVER = 2

/**
 * The city as a quest writer uses it: who can give work, who will walk with
 * you, what is lying about that no other quest has claimed, and how far apart
 * any two doors are. Everything it hands out is booked, so two quests never
 * send the player after the same thing.
 */
export class CityCast {
  readonly places: readonly CastPlace[]
  #takenItems = new Set<string>()
  #jobs = new Map<string, number>()

  constructor(summary: WorldSummary) {
    this.places = summary.places
  }

  /** Places with somebody in them. */
  get peopled(): readonly CastPlace[] {
    return this.places.filter((place) => place.npcs.length > 0)
  }

  /** Places holding at least this many things nobody has claimed. */
  stocked(least = 1): readonly CastPlace[] {
    return this.places.filter((place) => this.free(place).length >= least)
  }

  /** The things in a place no quest has taken yet. */
  free(place: CastPlace): readonly CastItem[] {
    return place.items.filter((item) => !this.#takenItems.has(item.itemId))
  }

  /** Metres between two street doors: what a walk actually costs the player. */
  metres(from: CastPlace, to: CastPlace): number {
    if (!from.door || !to.door) return 0
    return Math.hypot(from.door.x - to.door.x, from.door.z - to.door.z)
  }

  /** The busiest staffed place in town, and the person behind its counter. */
  hub(rng: Rng): CastPerson | undefined {
    const staffed = this.peopled.filter((place) => place.npcs.some((npc) => GIVER_ROLES.has(npc.role)))
    if (!staffed.length) return this.giver(rng)
    const most = Math.max(...staffed.map((place) => place.npcs.length))
    const busiest = staffed.filter((place) => place.npcs.length === most)
    const place = rng.pick(busiest)
    const npc = place.npcs.find((candidate) => GIVER_ROLES.has(candidate.role)) ?? place.npcs[0]!
    return { place, npc }
  }

  /** Somebody who can hand out work, and has not handed out too much already. */
  giver(rng: Rng, avoid: readonly string[] = []): CastPerson | undefined {
    const options = this.#people(
      (npc) => GIVER_ROLES.has(npc.role) && !avoid.includes(npc.npcId) && (this.#jobs.get(npc.npcId) ?? 0) < JOBS_PER_GIVER,
    )
    const fallback = this.#people((npc) => !avoid.includes(npc.npcId) && (this.#jobs.get(npc.npcId) ?? 0) < JOBS_PER_GIVER)
    const pool = options.length ? options : fallback
    return pool.length ? rng.pick(pool) : undefined
  }

  /** Somebody with no counter to stand behind, who can be walked across town. */
  walker(rng: Rng, avoid: readonly string[] = []): CastPerson | undefined {
    const pool = this.#people((npc) => WALKER_ROLES.has(npc.role) && !avoid.includes(npc.npcId))
    return pool.length ? rng.pick(pool) : undefined
  }

  /** Anybody at all, other than the people already in this quest. */
  anyone(rng: Rng, avoid: readonly string[] = []): CastPerson | undefined {
    const pool = this.#people((npc) => !avoid.includes(npc.npcId))
    return pool.length ? rng.pick(pool) : undefined
  }

  /** A stocked place, weighted towards the far side of town from where you start. */
  source(rng: Rng, from: CastPlace | undefined, least = 1): CastPlace | undefined {
    const options = this.stocked(least).filter((place) => place.plotId !== from?.plotId)
    if (!options.length) return undefined
    if (!from) return rng.pick(options)
    const ranked = [...options].sort((a, b) => this.metres(from, b) - this.metres(from, a))
    return rng.chance(0.6) ? ranked[rng.int(0, Math.min(3, ranked.length))]! : rng.pick(options)
  }

  /** A place with a surface to leave something on. */
  hidingPlace(rng: Rng, avoid: readonly string[] = []): CastPlace | undefined {
    const options = this.places.filter((place) => place.stashAnchorId !== undefined && !avoid.includes(place.plotId))
    return options.length ? rng.pick(options) : undefined
  }

  /** Books things and people so nothing is promised to two quests at once. */
  book(items: readonly CastItem[], givers: readonly string[] = []): void {
    for (const item of items) this.#takenItems.add(item.itemId)
    for (const npcId of givers) this.#jobs.set(npcId, (this.#jobs.get(npcId) ?? 0) + 1)
  }

  #people(wanted: (npc: CastNpc) => boolean): CastPerson[] {
    return this.peopled.flatMap((place) => place.npcs.filter(wanted).map((npc) => ({ place, npc })))
  }
}
