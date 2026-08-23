import type { ItemProfile, Narrator, NpcProfile, WorldSummary } from '@gb/forge'
import { OfflineNarrator } from '@gb/forge'
import { Sidecar } from '@gb/sidecar'
import type { BuildingKind, ItemArchetype, NpcRole } from '@gb/world'
import { Asker, type ScribeProblem } from './asker.ts'
import { bullets, prompt } from './prompts.ts'
import { QuestWriter } from './quests.ts'
import { NameRegistry } from './registry.ts'
import { DESCRIBE_ITEM, DESCRIBE_NPC, NAME_CITY, NAME_PLACE } from './tools.ts'
import { Waves } from './waves.ts'

/**
 * A quest is the longest call there is: one was measured at 100 s on its own, and
 * several run at once, which makes each of them slower. Every other call runs on
 * the sidecar's own clock.
 */
const QUEST_MS = 900_000

export interface ScribeOptions {
  readonly sidecar?: Sidecar
  /** Used whenever the model cannot answer, so a world always generates. */
  readonly fallback?: Narrator
  readonly seed?: string
  /** Tries per call before falling back. */
  readonly attempts?: number
  /** Calls in flight at once. Defaults to `GAME_BOX_SLOTS`, or four. */
  readonly concurrency?: number
  /** Stops every call this narrator has not finished. */
  readonly signal?: AbortSignal | undefined
}

/**
 * The narrator backed by the local model. Every answer is a forced tool call
 * validated against the schema the tool was built from, so nothing reaches the
 * world as prose. When a call cannot be made good, the offline narrator answers
 * instead and the failure is recorded rather than hidden.
 */
export class Scribe implements Narrator {
  #descriptive: Asker
  #questions: Asker
  #fallback: Narrator
  #registry = new NameRegistry()
  #waves: Waves
  #seed: string
  #problems: ScribeProblem[] = []

  constructor(options: ScribeOptions = {}) {
    const sidecar = options.sidecar ?? new Sidecar()
    const attempts = Math.max(1, options.attempts ?? 2)
    const record = (problem: ScribeProblem): void => {
      this.#problems.push(problem)
    }
    this.#descriptive = new Asker({ sidecar, attempts, signal: options.signal, record })
    this.#questions = new Asker({ sidecar, attempts, timeoutMs: QUEST_MS, signal: options.signal, record })
    this.#fallback = options.fallback ?? new OfflineNarrator(options.seed ?? 'scribe')
    this.#waves = new Waves(options.concurrency)
    this.#seed = options.seed ?? 'scribe'
  }

  problems(): readonly ScribeProblem[] {
    return this.#problems
  }

  async nameCity(input: { theme: string; seed: string }): Promise<string> {
    this.#seed = input.seed
    const answer = await this.#descriptive.ask(NAME_CITY, prompt('name-city', input))
    const name = answer?.name ?? (await this.#fallback.nameCity(input))
    this.#registry.nameCity(name)
    return name
  }

  async namePlace(input: { kind: BuildingKind; theme: string; index: number }): Promise<string> {
    const answer = await this.#descriptive.ask(
      NAME_PLACE,
      prompt('name-place', { ...input, ...this.#city() }),
    )
    const name = answer?.name ?? (await this.#fallback.namePlace(input))
    this.#registry.add(name)
    return name
  }

  async describeNpc(input: {
    role: NpcRole
    placeKind: BuildingKind
    placeName: string
    theme: string
    index: number
  }): Promise<NpcProfile> {
    const answer = await this.#descriptive.ask(
      DESCRIBE_NPC,
      prompt('describe-npc', { ...input, ...this.#city() }),
    )
    const person = answer ? { ...answer, knowledge: [...answer.knowledge] } : await this.#fallback.describeNpc(input)
    this.#registry.add(person.name)
    return person
  }

  async describeItem(input: { archetype: ItemArchetype; theme: string; index: number }): Promise<ItemProfile> {
    const answer = await this.#descriptive.ask(
      DESCRIBE_ITEM,
      prompt('describe-item', { ...input, ...this.#city() }),
    )
    const thing = answer ?? (await this.#fallback.describeItem(input))
    this.#registry.add(thing.name)
    return thing
  }

  /**
   * One call per quest, run in waves. Every draft is checked against the city
   * before it is handed back, and a slot the model cannot fill is filled by the
   * offline narrator, so a build never reports a city with no quests in it.
   */
  async writeQuests(input: { summary: WorldSummary; sideQuests: number }): Promise<unknown[]> {
    return new QuestWriter({
      asker: this.#questions,
      waves: this.#waves,
      fallback: this.#fallback,
      seed: this.#seed,
    }).write(input)
  }

  /** What every descriptive call is told about the city it is writing into. */
  #city(): { cityName: string; usedNames: string } {
    return {
      cityName: this.#registry.cityName,
      usedNames: bullets(this.#registry.names(), 'None yet.'),
    }
  }
}
