/** The places the player holds the deed to, in the order bought. */
import { named } from './named.ts'

export class Deeds {
  #interiors: string[] = []

  /** Restore from a save, each place once. */
  static from(ids: readonly string[] | undefined): Deeds {
    const deeds = new Deeds()
    for (const id of ids ?? []) deeds.own(id)
    return deeds
  }

  /** The deed to a place is the player's now. Owning it twice changes nothing; a nameless id is ignored. */
  own(interiorId: string): void {
    if (named(interiorId) && !this.owns(interiorId)) this.#interiors.push(interiorId)
  }

  owns(interiorId: string): boolean {
    return this.#interiors.includes(interiorId)
  }

  list(): readonly string[] {
    return [...this.#interiors]
  }

  get any(): boolean {
    return this.#interiors.length > 0
  }

  toJSON(): string[] {
    return [...this.#interiors]
  }
}
