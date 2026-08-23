/** The things the player has moved: what is standing somewhere the city did not put it. */
import type { PlacedItemDoc, SpotDoc } from './schema.ts'

const named = (...ids: string[]): boolean => ids.every((id) => id.trim().length > 0)

/**
 * Where a thing is now, once a player has carried it off and left it somewhere
 * else. The city file says where everything started; this says which of those
 * answers is out of date, and it is the only record of it, so a thing left on a
 * shelf is still on that shelf after a reload instead of back where it was made.
 */
export class MovedItems {
  #entries: PlacedItemDoc[] = []

  /** Restore from a save, keeping one spot per thing whatever the save says. */
  static from(docs: readonly PlacedItemDoc[] | undefined): MovedItems {
    const moved = new MovedItems()
    for (const { itemId, ...spot } of docs ?? []) moved.put(itemId, spot)
    return moved
  }

  /** Where that thing was left, if it was left anywhere. */
  at(itemId: string): SpotDoc | undefined {
    const found = this.#entries.find((entry) => entry.itemId === itemId)
    return found ? { interiorId: found.interiorId, anchorId: found.anchorId } : undefined
  }

  /**
   * Leave a thing at a surface. It has one spot, so a second one replaces the
   * first. Answers whether the spot was one worth keeping: a nameless thing,
   * room or surface is refused rather than written into a save that cannot be
   * read back.
   */
  put(itemId: string, spot: SpotDoc): boolean {
    if (!named(itemId, spot.interiorId, spot.anchorId)) return false
    this.clear(itemId)
    this.#entries.push({ itemId, interiorId: spot.interiorId, anchorId: spot.anchorId })
    return true
  }

  /** Forget where a thing is: it is back in a hand, or its spot was never in this city. */
  clear(itemId: string): void {
    const index = this.#entries.findIndex((entry) => entry.itemId === itemId)
    if (index >= 0) this.#entries.splice(index, 1)
  }

  list(): readonly PlacedItemDoc[] {
    return this.#entries.map((entry) => ({ ...entry }))
  }

  get any(): boolean {
    return this.#entries.length > 0
  }

  toJSON(): PlacedItemDoc[] {
    return this.list() as PlacedItemDoc[]
  }
}
