/** What the player has found: the places entered, the people known of, and what has been learned about each. */
import type { CodexDoc, CodexPersonDoc } from './schema.ts'

/** Something the player just came across: a place walked into, or a person met. */
export type Discovery = { readonly place: string } | { readonly npc: string }

const named = (id: string): boolean => id.trim().length > 0

export class Codex {
  #places: string[] = []
  #people: CodexPersonDoc[] = []

  /** Restore from a save, keeping each place, person and fact once, in the order it was found. */
  static from(doc: CodexDoc | undefined): Codex {
    const codex = new Codex()
    for (const place of doc?.places ?? []) codex.discover({ place })
    for (const { npcId, unlocked } of doc?.people ?? []) {
      codex.discover({ npc: npcId })
      for (const factId of unlocked) codex.unlock(npcId, factId)
    }
    return codex
  }

  /** Note a place entered or a person met. Finding it again changes nothing; a nameless id is ignored. */
  discover(found: Discovery): void {
    if ('place' in found) {
      if (named(found.place) && !this.#places.includes(found.place)) this.#places.push(found.place)
      return
    }
    if (named(found.npc) && !this.#person(found.npc)) this.#people.push({ npcId: found.npc, unlocked: [] })
  }

  /** Learn one of a person's background facts. Learning of somebody is knowing of them, so it also lists them. */
  unlock(npcId: string, factId: string): void {
    if (!named(npcId) || !named(factId)) return
    this.discover({ npc: npcId })
    const person = this.#person(npcId)
    if (person && !person.unlocked.includes(factId)) person.unlocked.push(factId)
  }

  /** The background facts learned about one person, in the order they were learned. */
  unlocked(npcId: string): readonly string[] {
    return [...(this.#person(npcId)?.unlocked ?? [])]
  }

  list(): CodexDoc {
    return {
      places: [...this.#places],
      people: this.#people.map(({ npcId, unlocked }) => ({ npcId, unlocked: [...unlocked] })),
    }
  }

  get any(): boolean {
    return this.#places.length > 0 || this.#people.length > 0
  }

  toJSON(): CodexDoc {
    return this.list()
  }

  #person(npcId: string): CodexPersonDoc | undefined {
    return this.#people.find((person) => person.npcId === npcId)
  }
}
