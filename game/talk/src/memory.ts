import type { Situation } from './moves.ts'
import { PROMPTS } from './prompts.generated.ts'
import { fill, keyed } from './text.ts'

/** How a turn left the person feeling about the player. */
export const MOODS = ['warmer', 'cooler', 'same'] as const
export type Mood = (typeof MOODS)[number]

/** How many things one turn may leave a person holding. */
const KEPT_PER_TURN = 3

const LINES = keyed(PROMPTS.memory)

/**
 * What this person holds of the player, through `@gb/play`: the facts they were
 * told or saw, and how they feel about them. Nothing spreads to anyone else, and
 * the playthrough bounds both, so a save grows by a few lines per person.
 */
export class Memory {
  #situation: Situation

  constructor(situation: Situation) {
    this.#situation = situation
  }

  /** What they remember of the player, for the brief. */
  held(): string {
    const { player, npcId } = this.#situation
    const facts = player.memories(npcId).map((memory) => fill(LINES[memory.source]!, { fact: memory.fact }))
    return facts.length ? fill(LINES.held!, { facts: facts.join('; ') }) : LINES.none!
  }

  /** How they feel about the player, for the brief. */
  disposition(): string {
    const { player, npcId } = this.#situation
    return LINES[`disposition-${player.disposition(npcId)}`]!
  }

  /** What the turn left behind: a few facts worth keeping, and a step of feeling. */
  keep(remembers: readonly string[] | undefined, mood: Mood | undefined): void {
    const { player, npcId } = this.#situation
    for (const fact of (remembers ?? []).slice(0, KEPT_PER_TURN)) {
      // A fact the playthrough refuses (blank, or over its length) is not held.
      player.remember(npcId, fact.trim(), 'told')
    }
    if (mood === 'warmer') player.warm(npcId)
    if (mood === 'cooler') player.cool(npcId)
  }
}
