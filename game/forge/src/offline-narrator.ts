import { Rng } from '@gb/kit'
import type { BuildingKind, ItemArchetype, NpcRole } from '@gb/world'
import { knowledgeOf, personalityOf } from './narrator/knowledge.ts'
import { cityName, placeName } from './narrator/places.ts'
import type { ItemProfile, Narrator, NpcProfile, WorldSummary } from './narrator.ts'
import { QuestWriter } from './quests/write.ts'
import { flavourOf } from './theme/flavour.ts'
import { wordsFor } from './theme/words.ts'

/** What an unremarkable thing looks like when somebody describes it. */
const ITEM_ADJECTIVES: readonly string[] = [
  'worn', 'dented', 'unmarked', 'heavy', 'cheap', 'sealed', 'scuffed', 'borrowed', 'chipped',
  'wrapped', 'stained', 'second-hand', 'plain', 'oversized', 'tarnished', 'battered',
]

const ITEM_ASIDES: readonly string[] = [
  'Nothing about it invites questions.',
  'It has been somewhere else and come back.',
  'Somebody has written on it and rubbed it out again.',
  'It is worth more to the right person than it looks.',
  'It has been repaired at least once.',
  'There is a name on the underside, half gone.',
]

/**
 * A narrator that invents everything from the seed, with no model behind it.
 * It keeps the generator runnable and testable offline, and it is the shape a
 * language-model narrator has to match.
 */
export class OfflineNarrator implements Narrator {
  #rng: Rng
  #usedNames = new Set<string>()

  constructor(seed: string) {
    this.#rng = new Rng(`narrator/${seed}`)
  }

  /** Nobody in a town shares a name with anybody else in it. */
  #uniqueName(rng: Rng, theme: string): string {
    const words = wordsFor(flavourOf(theme))
    for (let attempt = 0; attempt < 40; attempt++) {
      const name = `${rng.pick(words.first)} ${rng.pick(words.last)}`
      if (!this.#usedNames.has(name)) {
        this.#usedNames.add(name)
        return name
      }
    }
    const fallback = `${rng.pick(words.first)} ${rng.pick(words.last)} the ${rng.pick(['Younger', 'Elder', 'Quiet', 'Tall', 'Lame'])}`
    this.#usedNames.add(fallback)
    return fallback
  }

  async nameCity(input: { theme: string; seed: string }): Promise<string> {
    return cityName(wordsFor(flavourOf(input.theme)), this.#rng.fork(`city/${input.seed}`))
  }

  async namePlace(input: { kind: BuildingKind; theme: string; index: number }): Promise<string> {
    const rng = this.#rng.fork(`place/${input.kind}/${input.index}`)
    return placeName(input.kind, wordsFor(flavourOf(input.theme)), rng)
  }

  async describeNpc(input: {
    role: NpcRole
    placeKind: BuildingKind
    placeName: string
    theme: string
    index: number
  }): Promise<NpcProfile> {
    const rng = this.#rng.fork(`npc/${input.index}`)
    return {
      name: this.#uniqueName(rng, input.theme),
      personality: personalityOf(input.role, input.placeName, rng),
      knowledge: knowledgeOf(input.role, input.placeKind, input.placeName, rng),
    }
  }

  async describeItem(input: { archetype: ItemArchetype; theme: string; index: number }): Promise<ItemProfile> {
    const rng = this.#rng.fork(`item/${input.index}`)
    const adjective = rng.pick(ITEM_ADJECTIVES)
    return {
      name: `${adjective[0]!.toUpperCase()}${adjective.slice(1)} ${input.archetype}`,
      description: `A ${adjective} ${input.archetype}. ${rng.pick(ITEM_ASIDES)}`,
    }
  }

  /** A main line out of the town's busiest place, and side work behind it. */
  async writeQuests(input: { summary: WorldSummary; sideQuests: number }): Promise<unknown[]> {
    return new QuestWriter(this.#rng.fork('quests')).write(input.summary, input.sideQuests)
  }
}
