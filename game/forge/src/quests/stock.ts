import type { CastItem, CastPlace } from './cast.ts'

/**
 * Everything in a town that no quest has claimed yet, kept as a ledger rather
 * than recomputed: booking a thing updates the counts, so asking "is there
 * anywhere with two spare things" costs the same in a city as in a hamlet.
 */
export class Stock {
  /** Places that started with something in them. */
  #places: CastPlace[] = []
  /** Places that started with something belonging to somebody: the only things worth stealing. */
  #owned: CastPlace[] = []
  #free = new Map<string, CastItem[]>()
  #whereItIs = new Map<string, string>()
  /** How many places hold at least n unclaimed things, indexed by n. */
  #withLeast: number[] = [0]
  #things = 0

  constructor(places: readonly CastPlace[]) {
    for (const place of places) {
      // a deed is bought or won, never fetched, and a thing behind a lock is a job for whoever has the key: neither is an errand
      const locked = new Set((place.locks ?? []).flatMap((lock) => lock.behind))
      const items = place.items.filter((item) => item.archetype !== 'deed' && !locked.has(item.itemId))
      if (!items.length) continue
      this.#free.set(place.plotId, items)
      for (const item of items) this.#whereItIs.set(item.itemId, place.plotId)
      this.#places.push(place)
      this.#things += items.length
      this.#hold(items.length, 1)
      if (items.some(belongsToSomebody)) this.#owned.push(place)
    }
  }

  /** The things in a place nobody has claimed. */
  free(place: CastPlace): readonly CastItem[] {
    return this.#free.get(place.plotId) ?? []
  }

  /** How many places hold at least this many unclaimed things. */
  atLeast(least: number): number {
    return this.#withLeast[Math.max(1, least)] ?? 0
  }

  /** Everything in town nobody has claimed: what bounds how many jobs can be written. */
  get things(): number {
    return this.#things
  }

  /** Places to draw a job's errand from. Spent ones are still in it: what is free says so. */
  get places(): readonly CastPlace[] {
    return this.#places
  }

  /** Places to draw something worth lifting from. Spent ones are still in it. */
  get owned(): readonly CastPlace[] {
    return this.#owned
  }

  /** Claims things for one quest, so nothing is promised to two of them. */
  take(items: readonly CastItem[]): void {
    for (const item of items) {
      const held = this.#free.get(this.#whereItIs.get(item.itemId) ?? '')
      const at = held?.findIndex((candidate) => candidate.itemId === item.itemId) ?? -1
      if (!held || at < 0) continue
      this.#hold(held.length, -1)
      held.splice(at, 1)
      this.#hold(held.length, 1)
      this.#things--
    }
  }

  /** Counts a place in or out of every "at least n" tally up to what it holds. */
  #hold(count: number, delta: number): void {
    for (let n = 1; n <= count; n++) this.#withLeast[n] = (this.#withLeast[n] ?? 0) + delta
  }
}

const belongsToSomebody = (item: CastItem): boolean => item.ownerNpcId !== undefined
