/** What each person holds of the player: a few facts with where each came from, and how they feel about them. */
import { err, ok, type Result } from '@gb/kit'
import { DEFAULT_DISPOSITION, stepped, type Disposition } from './disposition.ts'
import type { MemoryDoc, PersonMemoryDoc } from './schema.ts'

/** Where a person got a fact: the player said it, or they saw it happen. */
export const MEMORY_SOURCES = ['told', 'seen'] as const

export type MemorySource = (typeof MEMORY_SOURCES)[number]

/** Facts one person keeps. Past this the oldest goes, so a save stays a few lines per person. */
export const MEMORY_CAP = 12

/** A fact is a sentence, not a transcript. */
export const FACT_LENGTH = 200

export type MemoryError =
  | { readonly code: 'bad-fact'; readonly npcId: string; readonly limit: number }
  | { readonly code: 'unknown-source'; readonly source: string; readonly allowed: readonly MemorySource[] }

const named = (id: string): boolean => id.trim().length > 0

export class Memories {
  #people = new Map<string, PersonMemoryDoc>()

  /** Restore from a save. More facts than the cap keeps the newest; a person with nothing held is not listed. */
  static from(doc: Record<string, PersonMemoryDoc> | undefined): Memories {
    const memories = new Memories()
    for (const [npcId, person] of Object.entries(doc ?? {})) {
      for (const { fact, source } of person.facts) memories.remember(npcId, fact, source)
      if (person.disposition !== DEFAULT_DISPOSITION) memories.#personOf(npcId).disposition = person.disposition
    }
    return memories
  }

  disposition(npcId: string): Disposition {
    return this.#people.get(npcId)?.disposition ?? DEFAULT_DISPOSITION
  }

  warm(npcId: string): void {
    this.#move(npcId, 1)
  }

  cool(npcId: string): void {
    this.#move(npcId, -1)
  }

  /** Give a person a fact to hold. The same fact from the same source is held once. */
  remember(npcId: string, fact: string, source: MemorySource): Result<void, MemoryError> {
    const line = fact.trim()
    if (!named(npcId) || line.length === 0 || line.length > FACT_LENGTH) {
      return err({ code: 'bad-fact', npcId, limit: FACT_LENGTH })
    }
    if (!MEMORY_SOURCES.includes(source)) {
      return err({ code: 'unknown-source', source: String(source), allowed: MEMORY_SOURCES })
    }
    const facts = this.#personOf(npcId).facts
    if (!facts.some((held) => held.fact === line && held.source === source)) {
      facts.push({ fact: line, source })
      if (facts.length > MEMORY_CAP) facts.splice(0, facts.length - MEMORY_CAP)
    }
    return ok(undefined)
  }

  /** What one person holds, oldest first. Somebody told nothing holds nothing. */
  memories(npcId: string): readonly MemoryDoc[] {
    return (this.#people.get(npcId)?.facts ?? []).map((held) => ({ ...held }))
  }

  /** Everyone holding something: a person back at neutral with nothing held takes no room. */
  toJSON(): Record<string, PersonMemoryDoc> {
    const holding = [...this.#people].filter(
      ([, person]) => person.facts.length > 0 || person.disposition !== DEFAULT_DISPOSITION,
    )
    return Object.fromEntries(
      holding.map(([npcId, person]) => [npcId, { ...person, facts: person.facts.map((held) => ({ ...held })) }]),
    )
  }

  #move(npcId: string, by: 1 | -1): void {
    if (!named(npcId)) return
    const person = this.#personOf(npcId)
    person.disposition = stepped(person.disposition, by)
  }

  #personOf(npcId: string): PersonMemoryDoc {
    let person = this.#people.get(npcId)
    if (!person) {
      person = { disposition: DEFAULT_DISPOSITION, facts: [] }
      this.#people.set(npcId, person)
    }
    return person
  }
}
