/**
 * Stable entity ids. An id is minted once and never reused, so a save made
 * before "add three houses" still points at the same things afterwards.
 */
export type EntityId = string

export class IdMinter {
  #counters: Record<string, number>

  constructor(counters: Readonly<Record<string, number>> = {}) {
    this.#counters = { ...counters }
  }

  /** `npc` -> `npc_0007`. */
  mint(kind: string): EntityId {
    const next = (this.#counters[kind] ?? 0) + 1
    this.#counters[kind] = next
    return `${kind}_${String(next).padStart(4, '0')}`
  }

  /** Counters to store in the world file so a later session keeps counting. */
  snapshot(): Record<string, number> {
    return { ...this.#counters }
  }

  static kindOf(id: EntityId): string {
    return id.slice(0, id.lastIndexOf('_'))
  }
}
