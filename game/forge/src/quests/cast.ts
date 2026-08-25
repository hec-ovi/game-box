import type { Rng } from '@gb/kit'
import type { NpcRole } from '@gb/world'
import { GAMES } from '../interior/machines.ts'
import type { SummaryLock, SummaryMachine, WorldSummary } from '../narrator.ts'
import { metresBetween, pickNear } from './reach.ts'
import { Stock } from './stock.ts'

export type CastPlace = WorldSummary['places'][number]
export type CastNpc = CastPlace['npcs'][number]
export type CastItem = CastPlace['items'][number]

/** Somebody standing somewhere: everything a step needs to point at a person. */
export interface CastPerson {
  readonly place: CastPlace
  readonly npc: CastNpc
}

/** Something worth stealing, and the place it is sitting in. */
export interface CastLoot {
  readonly place: CastPlace
  readonly item: CastItem
}

/** A locked door a quest can be written through: the place, the lock, who carries its key, and what lies behind it. */
export interface CastLock {
  readonly place: CastPlace
  readonly lock: SummaryLock
  /** Whoever carries the key, standing somewhere the player can reach them. */
  readonly keeper?: CastPerson
  readonly behind: readonly CastItem[]
}

/** A screen a quest can be written at: the place and the machine. */
export interface CastMachine {
  readonly place: CastPlace
  readonly machine: SummaryMachine
}

/** Roles with a post to hold: the people a town brings its problems to. */
const GIVER_ROLES: ReadonlySet<NpcRole> = new Set(['bartender', 'clerk', 'vendor', 'receptionist', 'cook', 'mechanic', 'guard', 'worker'])

/** Roles with nowhere they have to be: the people who will walk somewhere with you. */
const WALKER_ROLES: ReadonlySet<NpcRole> = new Set(['patron', 'wanderer', 'courier', 'resident', 'worker'])

/** How many jobs one person may hand out before the town starts to look empty. */
const JOBS_PER_GIVER = 2

/** How many counters a town looks at before it settles on the far side of its own argument. */
const RIVAL_LOOKS = 8

/**
 * The city as a quest writer uses it: who can give work, who will walk with
 * you, what is lying about that no other quest has claimed, and how far apart
 * any two doors are. Everything it hands out is booked, so two quests never
 * send the player after the same thing, and every pick is drawn near the place
 * the job starts from, so a job in a big city is still a job on one street.
 */
export class CityCast {
  readonly places: readonly CastPlace[]
  #peopled: CastPlace[] = []
  #givers: CastPerson[] = []
  #walkers: CastPerson[] = []
  #everyone: CastPerson[] = []
  #hiding: CastPlace[] = []
  #locks: CastLock[] = []
  #screens: CastMachine[] = []
  #arcades: CastMachine[] = []
  #counters: CastPlace[] = []
  #homes: CastPlace[] = []
  #garages: CastPlace[] = []
  #stock: Stock
  #jobs = new Map<string, number>()
  #home = new Map<string, string>()
  #busy = new Set<string>()
  #promised = new Set<string>()
  /** Things behind a lock that a quest has claimed: they are outside the ledger, so they are booked here. */
  #claimed = new Set<string>()

  constructor(summary: WorldSummary) {
    // a person behind a locked door is a person no line can point at until the door is open, so the cast is everybody in front of one
    this.places = summary.places.map((place) => ({ ...place, npcs: place.npcs.filter((npc) => inReach(place, npc)) }))
    this.#stock = new Stock(this.places)
    for (const place of this.places) {
      if (place.stashAnchorId !== undefined) this.#hiding.push(place)
      if (place.forSale !== undefined && place.interiorId) this.#homes.push(place)
      if (place.items.some((item) => item.ownerNpcId !== undefined && (item.value ?? 0) > 0)) this.#counters.push(place)
      for (const machine of place.machines ?? []) (GAMES.includes(machine.program) ? this.#arcades : this.#screens).push({ place, machine })
      for (const lock of place.locks ?? []) {
        const npc = place.npcs.find((one) => one.npcId === lock.keeperNpcId)
        this.#locks.push({ place, lock, ...(npc ? { keeper: { place, npc } } : {}), behind: place.items.filter((item) => lock.behind.includes(item.itemId)) })
      }
      if (!place.npcs.length) continue
      this.#peopled.push(place)
      if (place.work?.includes('bench')) this.#garages.push(place)
      for (const npc of place.npcs) {
        const person = { place, npc }
        this.#home.set(npc.npcId, place.plotId)
        this.#everyone.push(person)
        if (GIVER_ROLES.has(npc.role)) this.#givers.push(person)
        if (WALKER_ROLES.has(npc.role)) this.#walkers.push(person)
      }
    }
  }

  /** Places with somebody in them. */
  get peopled(): readonly CastPlace[] {
    return this.#peopled
  }

  /** Everybody a job can name: what the amount of work in a town is measured against. */
  get people(): readonly CastPerson[] {
    return this.#everyone
  }

  /**
   * The most jobs this town can hand out before it starts promising the same
   * thing twice: a couple per person who gives work, and one unclaimed thing
   * for each job to be about. This is the ceiling on a town's work, and it
   * grows with the town.
   */
  get capacity(): number {
    const hands = (this.#givers.length || this.#everyone.length) * JOBS_PER_GIVER
    return Math.min(hands, this.#stock.things)
  }

  /** How many places hold at least this many things nobody has claimed. */
  stocked(least = 1): number {
    return this.#stock.atLeast(least)
  }

  /** How many places hold something that belongs to somebody, unclaimed. */
  get lootable(): number {
    return this.#stock.owned.length
  }

  /** The things in a place no quest has taken yet. */
  free(place: CastPlace): readonly CastItem[] {
    return this.#stock.free(place)
  }

  /** How many locked doors a quest can be written through: a way past each that a quest can hand out, and something still unclaimed behind it. */
  get locked(): number {
    return this.#locks.filter((one) => this.#passable(one)).length
  }

  /** How many locked screens with a code on them stand in places with somebody in them. */
  get screens(): number {
    return this.#screens.filter((one) => one.machine.locked && one.machine.password !== undefined && one.place.npcs.length > 0).length
  }

  /** How many game screens stand in places with somebody in them. */
  get arcades(): number {
    return this.#arcades.filter((one) => one.place.npcs.length > 0).length
  }

  /** How many counters sell something. */
  get counters(): number {
    return this.#counters.length
  }

  /** A locked door with something still unclaimed behind it, near where the job starts, and a way past it a quest can hand out. */
  lock(rng: Rng, from: CastPlace | undefined): CastLock | undefined {
    const found = pickNear(rng, this.#locks, (one) => one.place, (one) => this.#passable(one), from)
    return found ? { ...found, behind: found.behind.filter((item) => !this.#claimed.has(item.itemId)) } : undefined
  }

  /** Whether a quest can be written through this lock: a way past it to hand out, and something behind it nobody has claimed. */
  #passable(one: CastLock): boolean {
    return (one.keeper !== undefined || one.lock.password !== undefined) && one.behind.some((item) => !this.#claimed.has(item.itemId))
  }

  /** A locked screen with a code on it, a walk from where the job starts, in a place with somebody in it. */
  screen(rng: Rng, from: CastPlace | undefined): CastMachine | undefined {
    const spare = (one: CastMachine) => one.place.plotId !== from?.plotId && one.machine.locked && one.machine.password !== undefined && one.place.npcs.length > 0
    return pickNear(rng, this.#screens, (one) => one.place, spare, from)
  }

  /** A screen running a game, in a place with somebody in it. */
  arcade(rng: Rng, from: CastPlace | undefined): CastMachine | undefined {
    return pickNear(rng, this.#arcades, (one) => one.place, (one) => one.place.npcs.length > 0, from)
  }

  /** A counter with priced things on it that nobody has claimed, a walk from where the job starts. */
  counter(rng: Rng, from: CastPlace | undefined): CastPlace | undefined {
    const spare = (place: CastPlace) => place.plotId !== from?.plotId && this.priced(place).length > 0
    return pickNear(rng, this.#counters, itself, spare, from)
  }

  /** What a counter sells that no quest has claimed: the things with an owner and a price. */
  priced(place: CastPlace): readonly CastItem[] {
    return this.free(place).filter((item) => item.ownerNpcId !== undefined && (item.value ?? 0) > 0)
  }

  /** A home for sale nobody has promised yet: what the town's finale can hand over. Promising it books it. */
  home(rng: Rng): CastPlace | undefined {
    const home = pickNear(rng, this.#homes, itself, (place) => !this.#promised.has(place.plotId))
    if (home) this.#promised.add(home.plotId)
    return home
  }

  /** Whether the town has somewhere that works at a bench: a place with a car to hand over. */
  get garage(): boolean {
    return this.#garages.length > 0
  }

  /** Metres between two street doors: what a walk actually costs the player. */
  metres(from: CastPlace, to: CastPlace): number {
    return metresBetween(from, to)
  }

  /** The busiest staffed place in town, and the person behind its counter. */
  hub(rng: Rng): CastPerson | undefined {
    const staffed = this.#peopled.filter((place) => place.npcs.some((npc) => GIVER_ROLES.has(npc.role)))
    if (!staffed.length) return this.giver(rng)
    const most = staffed.reduce((many, place) => Math.max(many, place.npcs.length), 0)
    const busiest = staffed.filter((place) => place.npcs.length === most)
    const place = rng.pick(busiest)
    const npc = place.npcs.find((candidate) => GIVER_ROLES.has(candidate.role)) ?? place.npcs[0]!
    return { place, npc }
  }

  /**
   * The other side of the town's argument: somebody with a post of their own,
   * as far from the hub as the town can manage. Sampled rather than sorted, and
   * the furthest of a handful of looks, so a big town puts the two sides in two
   * parts of it and a small one still finds a second counter.
   */
  rival(rng: Rng, hub: CastPerson): CastPerson | undefined {
    const spare = (person: CastPerson) => person.place.plotId !== hub.place.plotId && GIVER_ROLES.has(person.npc.role)
    let best: CastPerson | undefined
    let furthest = -1
    for (let look = 0; look < RIVAL_LOOKS; look++) {
      const candidate = pickNear(rng, this.#givers, placeOf, spare)
      if (!candidate) break
      const away = metresBetween(hub.place, candidate.place)
      if (away > furthest) {
        furthest = away
        best = candidate
      }
    }
    return best
  }

  /**
   * Somebody who can hand out work, and has not handed out too much already.
   *
   * A door nothing has been asked of yet is tried before one that has already
   * handed something out, because a player meets a town one door at a time: work
   * stacked on two counters is a town where the first six people you walk in on
   * have nothing for you, however much of it there is.
   */
  giver(rng: Rng, avoid: readonly string[] = []): CastPerson | undefined {
    const spare = (person: CastPerson) => !avoid.includes(person.npc.npcId) && (this.#jobs.get(person.npc.npcId) ?? 0) < JOBS_PER_GIVER
    const quiet = (person: CastPerson) => spare(person) && !this.#busy.has(person.place.plotId)
    return (
      pickNear(rng, this.#givers, placeOf, quiet) ??
      pickNear(rng, this.#givers, placeOf, spare) ??
      pickNear(rng, this.#everyone, placeOf, spare)
    )
  }

  /** Somebody with no counter to stand behind, who can be walked somewhere. */
  walker(rng: Rng, avoid: readonly string[] = [], near?: CastPlace): CastPerson | undefined {
    return pickNear(rng, this.#walkers, placeOf, (person) => !avoid.includes(person.npc.npcId), near)
  }

  /** Anybody at all, other than the people already in this quest. */
  anyone(rng: Rng, avoid: readonly string[] = [], near?: CastPlace): CastPerson | undefined {
    return pickNear(rng, this.#everyone, placeOf, (person) => !avoid.includes(person.npc.npcId), near)
  }

  /** Somebody standing in this very place, other than the people already in this quest. */
  inside(rng: Rng, place: CastPlace, avoid: readonly string[] = []): CastPerson | undefined {
    const spare = place.npcs.filter((npc) => !avoid.includes(npc.npcId))
    return spare.length ? { place, npc: rng.pick(spare) } : undefined
  }

  /** Another place with people in it, a walk from this one: somewhere to walk somebody to. */
  elsewhere(rng: Rng, from: CastPlace): CastPlace | undefined {
    return pickNear(rng, this.#peopled, itself, (place) => place.plotId !== from.plotId, from)
  }

  /** Somewhere with something to fetch, a walk away from where the job starts. */
  source(rng: Rng, from: CastPlace | undefined, least = 1): CastPlace | undefined {
    const spare = (place: CastPlace) => place.plotId !== from?.plotId && this.free(place).length >= least
    return pickNear(rng, this.#stock.places, itself, spare, from)
  }

  /** Something with an owner, and where it is sitting: the only things worth lifting. */
  loot(rng: Rng, from: CastPlace | undefined): CastLoot | undefined {
    const spare = (place: CastPlace) => place.plotId !== from?.plotId && this.free(place).some((item) => item.ownerNpcId !== undefined)
    const place = pickNear(rng, this.#stock.owned, itself, spare, from)
    if (!place) return undefined
    return { place, item: rng.pick(this.free(place).filter((item) => item.ownerNpcId !== undefined)) }
  }

  /** A place with a surface to leave something on. */
  hidingPlace(rng: Rng, avoid: readonly string[] = [], near?: CastPlace): CastPlace | undefined {
    return pickNear(rng, this.#hiding, itself, (place) => !avoid.includes(place.plotId), near)
  }

  /** Books things and people so nothing is promised to two quests at once. */
  book(items: readonly CastItem[], givers: readonly string[] = []): void {
    this.#stock.take(items)
    for (const item of items) this.#claimed.add(item.itemId)
    for (const npcId of givers) {
      this.#jobs.set(npcId, (this.#jobs.get(npcId) ?? 0) + 1)
      const home = this.#home.get(npcId)
      if (home) this.#busy.add(home)
    }
  }
}

const placeOf = (person: CastPerson): CastPlace => person.place
const itself = (place: CastPlace): CastPlace => place

/** Whether somebody stands where a player can walk up to them: not behind a locked room door, and not inside a locked street door. */
function inReach(place: CastPlace, npc: CastNpc): boolean {
  return !(place.locks ?? []).some((lock) => lock.street || lock.roomId === npc.roomId)
}
