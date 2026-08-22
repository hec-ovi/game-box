/**
 * What the player is guaranteed to be carrying at a point in a quest.
 *
 * Items in a city are instances, not stacks, so "three of the five crates" is a
 * count against a pool of ids rather than a quantity of one id. A holding is
 * therefore a pool and how many of it are in hand; a single named item is just
 * a pool of one. Counting only pools that sit entirely inside what a step asks
 * for keeps the guarantee honest: it can refuse a quest that would have worked,
 * never accept one that would not.
 */
export class Held {
  #groups = new Map<string, { pool: ReadonlySet<string>; count: number }>()
  #companions = new Set<string>()

  static empty(): Held {
    return new Held()
  }

  clone(): Held {
    const copy = new Held()
    for (const [key, group] of this.#groups) copy.#groups.set(key, { pool: group.pool, count: group.count })
    copy.#companions = new Set(this.#companions)
    return copy
  }

  add(pool: ReadonlySet<string>, count: number): void {
    if (!pool.size) return
    const key = keyOf(pool)
    const held = this.#groups.get(key)
    const total = Math.min(pool.size, (held?.count ?? 0) + count)
    this.#groups.set(key, { pool, count: total })
  }

  /** How many items the player is sure to hold out of this pool. */
  available(pool: ReadonlySet<string>): number {
    let total = 0
    for (const group of this.#groups.values()) if (within(group.pool, pool)) total += group.count
    return total
  }

  /** Hands over `count` of the pool, spending the vaguest holdings first so named items stay in hand. */
  consume(pool: ReadonlySet<string>, count: number): void {
    let left = count
    const groups = [...this.#groups.entries()]
      .filter(([, group]) => within(group.pool, pool))
      .sort(([, a], [, b]) => b.pool.size - a.pool.size)
    for (const [key, group] of groups) {
      if (left <= 0) break
      const taken = Math.min(group.count, left)
      left -= taken
      if (group.count === taken) this.#groups.delete(key)
      else this.#groups.set(key, { pool: group.pool, count: group.count - taken })
    }
  }

  hasCompanion(npcId: string): boolean {
    return this.#companions.has(npcId)
  }

  addCompanion(npcId: string): void {
    this.#companions.add(npcId)
  }

  removeCompanion(npcId: string): void {
    this.#companions.delete(npcId)
  }

  /**
   * Merges what several paths leave behind. `all` is a join, where every branch
   * ran, so the largest single guarantee still holds. `any` is one path out of
   * several, so only what all of them promise counts.
   */
  static merge(states: readonly Held[], mode: 'all' | 'any'): Held {
    if (!states.length) return Held.empty()
    const out = new Held()
    const keys = new Set(states.flatMap((state) => [...state.#groups.keys()]))
    for (const key of keys) {
      const counts = states.map((state) => state.#groups.get(key)?.count ?? 0)
      const count = mode === 'all' ? Math.max(...counts) : Math.min(...counts)
      const pool = states.find((state) => state.#groups.has(key))!.#groups.get(key)!.pool
      if (count > 0) out.#groups.set(key, { pool, count })
    }
    const companions = states.flatMap((state) => [...state.#companions])
    for (const npcId of companions) {
      const everywhere = states.every((state) => state.#companions.has(npcId))
      if (mode === 'all' || everywhere) out.#companions.add(npcId)
    }
    return out
  }
}

function keyOf(pool: ReadonlySet<string>): string {
  return [...pool].sort().join('|')
}

function within(inner: ReadonlySet<string>, outer: ReadonlySet<string>): boolean {
  for (const value of inner) if (!outer.has(value)) return false
  return true
}
