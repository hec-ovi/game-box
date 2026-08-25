import { Rng } from '@gb/kit'
import type { Charter, ItemArchetype, NpcRole, Premise, Word } from '@gb/world'
import { backgroundOf } from './narrator/background.ts'
import { knowledgeOf, personalityOf } from './narrator/knowledge.ts'
import { lifeOf } from './narrator/lives.ts'
import { cityName } from './narrator/places.ts'
import { writeEachPlace } from './narrator/one-at-a-time.ts'
import { Roster } from './narrator/roster.ts'
import { Signs } from './narrator/signs.ts'
import type { Instance, InstanceRequest, ItemProfile, Narrator, NpcProfile, WorldSummary } from './narrator.ts'
import type { History } from './premise/shape.ts'
import { composePremise, type Written } from './premise/write.ts'
import { QuestWriter } from './quests/write.ts'
import { flavourOf, type Flavour } from './theme/flavour.ts'
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
  #rosters = new Map<Flavour, Roster>()
  /** The town's history, once it has been asked for: what the rest of it is written against. */
  #written: Written | undefined

  constructor(seed: string) {
    this.#rng = new Rng(`narrator/${seed}`)
    this.#signs = new Signs(seed)
  }

  /**
   * Nobody in a town shares a name with anybody else in it: the nth person
   * takes the nth pair off the roster, whatever order they are asked in.
   */
  #nameAt(index: number, theme: string): string {
    const flavour = flavourOf(theme)
    let roster = this.#rosters.get(flavour)
    if (!roster) {
      roster = new Roster(wordsFor(flavour), this.#rng.fork(`roster/${flavour}`))
      this.#rosters.set(flavour, roster)
    }
    return roster.nameAt(index)
  }

  /** What the town lives on, what happened to it, and any kind of place that calls for, drawn from the seed. */
  async writePremise(input: { theme: string; seed: string }): Promise<History> {
    this.#written = composePremise(input.theme, this.#rng.fork(`premise/${input.seed}`))
    return this.#written.history
  }

  /** A town with a history is often named after what it lives on. */
  async nameCity(input: { theme: string; seed: string; premise?: Premise }): Promise<string> {
    const livesOn = input.premise ? this.#written?.word : undefined
    return cityName(wordsFor(flavourOf(input.theme)), this.#rng.fork(`city/${input.seed}`), livesOn)
  }

  async namePlace(input: { charter: Charter; theme: string; index: number; street?: string; premise?: string }): Promise<string> {
    return this.#signs.over(input.charter, input.theme, input.index, input)
  }

  /** The plural, one place at a time: nothing here is slow, so nothing here fans out. */
  async writeInstances(requests: readonly InstanceRequest[]): Promise<readonly Instance[]> {
    return writeEachPlace(this, requests)
  }

  /** A person written whole: name, character, what they know, their life and the codex the player earns of them. */
  async describeNpc(input: { role: NpcRole; placeKind: Word; place: Charter; placeName: string; theme: string; index: number }): Promise<NpcProfile> {
    const rng = this.#rng.fork(`npc/${input.index}`)
    const premise = this.#written?.history
    const life = lifeOf(input.role, input.placeName, rng.fork('life'), premise)
    return {
      name: this.#nameAt(input.index, input.theme),
      personality: personalityOf(input.role, input.placeName, rng),
      knowledge: knowledgeOf(input.role, input.place, input.placeName, rng, premise?.common ?? []),
      life,
      background: backgroundOf(input.role, input.placeName, life, rng.fork('background')),
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

  /**
   * A main line out of the town's busiest place, and side work behind it. A
   * growth (`from`) gets side work alone, on its own stream, because the town's
   * argument was settled when it was founded.
   */
  async writeQuests(input: { summary: WorldSummary; sideQuests: number; from?: number }): Promise<unknown[]> {
    const label = input.from ? `quests/from/${input.from}` : 'quests'
    return new QuestWriter(this.#rng.fork(label)).write(input.summary, input.sideQuests, input.from)
  }
}
