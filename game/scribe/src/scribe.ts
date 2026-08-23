import type { ItemProfile, Narrator, NpcProfile, WorldSummary } from '@gb/forge'
import { OfflineNarrator, premiseLines } from '@gb/forge'
import { Sidecar } from '@gb/sidecar'
import type { BuildingKind, ItemArchetype, NpcRole, Premise } from '@gb/world'
import { Asker, type ScribeProblem } from './asker.ts'
import { InstanceWriter, type Instance, type InstanceRequest } from './instance.ts'
import { PlaceNamer, type PlaceRequest } from './place-names.ts'
import { PremiseWriter } from './premise.ts'
import { Progress, type ProgressPort } from './progress.ts'
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

/** What the city stage answers: its history, then its name. */
const CITY_ANSWERS = 2

/** What a call is told when nobody has written the city's history. */
const NO_HISTORY = 'Nothing has been written about the city itself yet.'

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
  /** Where to show how far the build has got. Nothing here reads it back. */
  readonly progress?: ProgressPort
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
  #progress: Progress
  #seed: string
  #problems: ScribeProblem[] = []
  #characters = new Map<string, string>()
  /** The city stage is the history and then the name, so whichever runs first opens it. */
  #wroteHistory = false

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
    this.#progress = new Progress(options.progress)
    this.#seed = options.seed ?? 'scribe'
  }

  problems(): readonly ScribeProblem[] {
    return this.#problems
  }

  /**
   * The city's history, written before a street is laid. Everything the forge
   * does afterwards is built out of it, so an answer the town cannot be built
   * from is never handed on: the model is told what was wrong, and a town whose
   * history the model will not write gets the one the seed composes.
   */
  async writePremise(input: { theme: string; seed: string }): Promise<Premise> {
    this.#seed = input.seed
    this.#wroteHistory = true
    this.#progress.start('city', CITY_ANSWERS, 'writing the history')
    const premise = await new PremiseWriter({ asker: this.#descriptive, fallback: this.#fallback }).write(input)
    this.#progress.finished(premise.livesOn)
    return premise
  }

  /** Named after what the town lives on, which is why the history goes out with the question. */
  async nameCity(input: { theme: string; seed: string; premise?: Premise }): Promise<string> {
    this.#seed = input.seed
    if (!this.#wroteHistory) this.#progress.start('city', 1, 'naming the city')
    const answer = await this.#descriptive.ask(
      NAME_CITY,
      prompt('name-city', {
        theme: input.theme,
        premise: input.premise ? premiseLines(input.premise) : NO_HISTORY,
      }),
    )
    const name = answer?.name ?? (await this.#fallback.nameCity(input))
    this.#registry.nameCity(name)
    this.#progress.finished(name)
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

  /**
   * The same names, asked for all at once.
   *
   * Most of a city is frontage, so most of a model build's calls are signs over
   * closed doors, and they have nothing to do with each other. The names come
   * back in the order they were asked for, and which of two calls keeps a name
   * they both wanted is settled by index rather than by which one landed first.
   */
  async namePlaces(requests: readonly PlaceRequest[]): Promise<string[]> {
    return new PlaceNamer({
      asker: this.#descriptive,
      waves: this.#waves,
      fallback: this.#fallback,
      registry: this.#registry,
      progress: this.#progress,
    }).write(requests)
  }

  /**
   * One call per place: what the place is, everybody in it and everything lying
   * about, decided together.
   *
   * Each call is shown its own building and nothing else, so a whole city's
   * places can be written at the same time, and the people in one of them read
   * like people who work together rather than three strangers who were
   * described one at a time.
   */
  async writeInstances(requests: readonly InstanceRequest[]): Promise<Instance[]> {
    const written = await new InstanceWriter({
      asker: this.#descriptive,
      waves: this.#waves,
      fallback: this.#fallback,
      registry: this.#registry,
      progress: this.#progress,
      seed: this.#seed,
    }).write(requests)
    for (const instance of written) {
      if (instance.character) this.#characters.set(instance.name, instance.character)
    }
    return written
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
      progress: this.#progress,
      seed: this.#seed,
      characters: this.#characters,
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
