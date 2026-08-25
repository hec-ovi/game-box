import type { NpcProfile } from '@gb/forge'
import { BACKGROUND_UNLOCKS, BackgroundFactSchema, LifeSchema, MAX_BACKGROUND_FACTS } from '@gb/world'
import { z } from 'zod'
import type { Violation } from './asker.ts'
import { familyPattern } from './claim.ts'

/**
 * A person as the model writes one, with the family name held to the letters
 * the place was dealt. `life` and `background` are `@gb/world`'s own schemas:
 * every part of a life is asked for, and there is a fact for each way of earning
 * one, so the codex has something behind every stage the player can reach.
 */
export function personSchema(letters: string) {
  return z.object({
    given: z.string().min(2).max(30),
    family: z.string().regex(familyPattern(letters)),
    personality: z.string().min(10).max(400),
    knowledge: z.array(z.string().min(4).max(300)).min(2).max(4),
    life: LifeSchema.required(),
    background: z.array(BackgroundFactSchema).min(BACKGROUND_UNLOCKS.length).max(MAX_BACKGROUND_FACTS),
  })
}

export type WrittenPerson = z.infer<ReturnType<typeof personSchema>>

/** A stage no fact is behind is a stage the player earns nothing at. */
export function personProblems(person: WrittenPerson, path: string): Violation[] {
  const used = new Set(person.background.map((fact) => fact.unlockedBy))
  return BACKGROUND_UNLOCKS.filter((stage) => !used.has(stage)).map((stage) => ({
    path: `${path}.background`,
    message: `no fact is unlocked by ${stage}: write the one the player earns that way`,
  }))
}

/** The person in the shape the generator takes. */
export function profileOf(person: WrittenPerson): NpcProfile {
  return {
    name: `${person.given} ${person.family}`,
    personality: person.personality,
    knowledge: [...person.knowledge],
    life: person.life,
    background: [...person.background],
  }
}
