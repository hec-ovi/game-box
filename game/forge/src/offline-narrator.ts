import { Rng } from '@gb/kit'
import type { BuildingKind, ItemArchetype, NpcRole, Premise } from '@gb/world'
import { knowledgeOf, personalityOf } from './narrator/knowledge.ts'
import { cityName } from './narrator/places.ts'
import { writeEachPlace } from './narrator/one-at-a-time.ts'
import { Signs } from './narrator/signs.ts'
import type { Instance, InstanceRequest, ItemProfile, Narrator, NpcProfile, WorldSummary } from './narrator.ts'
import { composePremise, type Written } from './premise/write.ts'
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
  #signs: Signs
  #usedNames = new Set<string>()
  /** The town's history, once it has been asked for: what the rest of it is written against. */
  #written: Written | undefined

  constructor(seed: string) {
    this.#rng = new Rng(`narrator/${seed}`)
    this.#signs = new Signs(seed)
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

  /** What the town lives on and what happened to it, drawn from the seed. */
  async writePremise(input: { theme: string; seed: string }): Promise<Premise> {
    this.#written = composePremise(input.theme, this.#rng.fork(`premise/${input.seed}`))
    return this.#written.premise
  }

  /** A town with a history is often named after what it lives on. */
  async nameCity(input: { theme: string; seed: string; premise?: Premise }): Promise<string> {
    const livesOn = input.premise ? this.#written?.word : undefined
    return cityName(wordsFor(flavourOf(input.theme)), this.#rng.fork(`city/${input.seed}`), livesOn)
  }

  async namePlace(input: { kind: BuildingKind; theme: string; index: number }): Promise<string> {
    return this.#signs.over(input.kind, input.theme, input.index)
  }

  /** The plural, one place at a time: nothing here is slow, so nothing here fans out. */
  async writeInstances(requests: readonly InstanceRequest[]): Promise<readonly Instance[]> {
    return writeEachPlace(this, requests)
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
      knowledge: knowledgeOf(input.role, input.placeKind, input.placeName, rng, this.#written?.premise.common ?? []),
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
