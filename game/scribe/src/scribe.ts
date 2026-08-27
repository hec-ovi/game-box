import type { DistrictRequest, History, Instance, InstanceRequest, ItemProfile, Narrator, NpcProfile } from '@gb/forge'
import { OfflineNarrator, premiseLines } from '@gb/forge'
import { Sidecar, type Job } from '@gb/sidecar'
import type { Charter, ItemArchetype, NpcRole, Premise, Word } from '@gb/world'
import { Asker, type ScribeProblem } from './asker.ts'
import { BRIEF_FIELDS, BRIEF_LABELS, type BriefDraft, type BriefField, type BriefSoFar } from './brief.ts'
import { charterLines } from './charter-lines.ts'
import { CharterWriter } from './charters.ts'
import { FamilyClaims } from './claim.ts'
import { DistrictNamer } from './districts.ts'
import { InstanceWriter } from './instance.ts'
import { profileOf } from './person.ts'
import { Pins } from './pins.ts'
import { PremiseWriter, type PremiseInput } from './premise.ts'
import { Progress, type ProgressPort } from './progress.ts'
import { bullets, prompt } from './prompts.ts'
import { QuestWriter, type QuestInput } from './quests.ts'
import { NameRegistry } from './registry.ts'
import { SignNamer, type PlaceRequest } from './signs.ts'
import { DESCRIBE_ITEM, describeNpcTool, NAME_CITY, NAME_PLACE, WRITE_BRIEF } from './tools.ts'
import { Waves } from './waves.ts'

/**
 * A quest is the longest call there is: one was measured at 100 s on its own, and
 * several run at once, which makes each of them slower. Every other call runs on
 * the sidecar's own clock.
 */
const QUEST_MS = 900_000

/**
 * How far the engine strays from its likeliest token, sent on every call. A
 * town written at zero is the same three names over and over; the engine's own
 * default is one.
 */
const TEMPERATURE = 0.9

/** How many spare answers the offline narrator is asked for before a single-place call takes what it has. */
const ATTEMPTS = 40

/** The jobs this box writes for. Every call it makes goes through the asker for one of them. */
type WritingJob = Extract<Job, 'history' | 'city' | 'places' | 'quests'>

export interface ScribeOptions {
  readonly sidecar?: Sidecar
  /** Used whenever the model cannot answer, so a world always generates. */
  readonly fallback?: Narrator
  readonly seed?: string
  /** Tries per call before falling back. */
  readonly attempts?: number
  /** Calls in flight at once. Defaults to `GAME_BOX_SLOTS`, or four. */
  readonly concurrency?: number
  /** Sent with every call. Defaults to 0.9. */
  readonly temperature?: number
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
  #askers: Record<WritingJob, Asker>
  #fallback: Narrator
  #registry = new NameRegistry()
  #waves: Waves
  #progress: Progress
  #pins: Pins
  #seed: string
  #claims: FamilyClaims
  #problems: ScribeProblem[] = []
  #characters = new Map<string, string>()

  constructor(options: ScribeOptions = {}) {
    const sidecar = options.sidecar ?? new Sidecar()
    const attempts = Math.max(1, options.attempts ?? 2)
    const record = (problem: ScribeProblem): void => {
      this.#problems.push(problem)
    }
    this.#seed = options.seed ?? 'scribe'
    this.#pins = new Pins(this.#seed, options.temperature ?? TEMPERATURE)
    this.#claims = new FamilyClaims(this.#seed)
    const pins = this.#pins
    const asker = (job: WritingJob, timeoutMs?: number): Asker =>
      new Asker({ sidecar, pins, job, attempts, timeoutMs, signal: options.signal, record })
    this.#askers = {
      history: asker('history'),
      city: asker('city'),
      places: asker('places'),
      quests: asker('quests', QUEST_MS),
    }
    this.#fallback = options.fallback ?? new OfflineNarrator(this.#seed)
    this.#waves = new Waves(options.concurrency)
    this.#progress = new Progress(options.progress)
  }

  problems(): readonly ScribeProblem[] {
    return this.#problems
  }

  /**
   * The city's history, written before a street is laid. Everything the forge
   * does afterwards is built out of it, so an answer the town cannot be built
   * from is never handed on: the model is told what was wrong, and a town whose
   * history the model will not write gets the one the seed composes. The
   * owner's brief goes to this call verbatim, with the tone, the main errand
   * and the look they asked for. A kind of place the history invents is asked
   * for next, one charter per word, and rides back on the history.
   */
  async writePremise(input: PremiseInput): Promise<History> {
    this.#reseed(input.seed)
    this.#progress.open('history', 1, 'writing the history')
    const charters = new CharterWriter({ asker: this.#askers.history, waves: this.#waves, progress: this.#progress })
    const history = await new PremiseWriter({ asker: this.#askers.history, fallback: this.#fallback, charters }).write(input)
    this.#progress.finished(history.livesOn)
    return history
  }

  /**
   * Write the fields of a brief for somebody sitting at the form. This is the
   * one call that happens before there is a city: it answers the form's own
   * five fields and nothing else, and the ones that were not asked for come
   * back as they went in.
   *
   * There is no fallback. A composed brief would be a canned one, and a canned
   * brief handed over as the model's answer is the thing this is here to
   * replace, so a model that will not answer says nothing and the form says so.
   */
  async writeBrief(input: { want: readonly BriefField[]; have?: BriefSoFar; seed: string }): Promise<BriefDraft | undefined> {
    const want = BRIEF_FIELDS.filter((field) => input.want.includes(field))
    if (want.length === 0) return undefined
    this.#reseed(input.seed)
    const have = input.have ?? {}
    const written = BRIEF_FIELDS.map((field) => (have[field]?.trim() ? `- ${BRIEF_LABELS[field]}: ${have[field]!.trim()}` : undefined)).filter(
      (line): line is string => line !== undefined,
    )
    const answer = await this.#askers.history.ask(
      WRITE_BRIEF,
      prompt('write-brief', {
        wanted: want.map((field) => BRIEF_LABELS[field]).join(', '),
        sofar: written.length ? prompt('brief-so-far', { fields: written.join('\n') }) : prompt('brief-blank'),
      }),
      'brief',
    )
    if (!answer) return undefined
    // only what was asked for is taken: the model is told to give the rest back
    // word for word and mostly does, but "mostly" would quietly rewrite a field
    // somebody had typed themselves
    return { ...answer, ...Object.fromEntries(BRIEF_FIELDS.filter((field) => !want.includes(field)).map((field) => [field, have[field] ?? answer[field]])) }
  }

  /** Named after what the town lives on, which is why the history goes out with the question. */
  async nameCity(input: { theme: string; seed: string; premise?: Premise }): Promise<string> {
    this.#reseed(input.seed)
    this.#progress.open('city', 1, 'naming the city')
    const answer = await this.#askers.city.ask(
      NAME_CITY,
      prompt('name-city', {
        theme: input.theme,
        premise: input.premise ? premiseLines(input.premise) : prompt('no-history'),
      }),
      'city-name',
    )
    const name = answer?.name ?? (await this.#fallback.nameCity(input))
    this.#registry.nameCity(name)
    this.#progress.finished(name)
    return name
  }

  /** One sign on its own. A head word already over a door goes to the offline composer instead. */
  async namePlace(input: { kind: Word; charter: Charter; theme: string; index: number; premise?: string }): Promise<string> {
    const answer = await this.#askers.city.ask(
      NAME_PLACE,
      prompt('name-place', {
        theme: input.theme,
        label: input.charter.label,
        charter: charterLines(input.charter),
        premise: input.premise ?? prompt('no-history'),
        ...this.#city(),
      }),
      `sign:${input.index}`,
    )
    let name = answer?.name ?? (await this.#fallback.namePlace(input))
    for (let attempt = 1; attempt <= ATTEMPTS && this.#registry.signTaken(name); attempt++) {
      name = await this.#fallback.namePlace({ ...input, index: input.index * ATTEMPTS + attempt })
    }
    this.#registry.hang(name)
    return name
  }

  /**
   * The signs over the buildings that do not open, twenty to a call, with the
   * town's history in front of the model and each building's trade and street.
   * Back in the order they were asked for, no word heading two of them.
   */
  async namePlaces(requests: readonly PlaceRequest[]): Promise<string[]> {
    return new SignNamer({
      asker: this.#askers.city,
      waves: this.#waves,
      fallback: this.#fallback,
      registry: this.#registry,
      progress: this.#progress,
    }).write(requests)
  }

  /**
   * What the parts of the city are called, all in one call, with the town's
   * history in front of the model and how much of the town each part holds and
   * which way it lies. Back in the order they were asked for, no two of them
   * called the same thing.
   */
  async nameDistricts(requests: readonly DistrictRequest[]): Promise<string[]> {
    return new DistrictNamer({
      asker: this.#askers.city,
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
      asker: this.#askers.places,
      waves: this.#waves,
      fallback: this.#fallback,
      registry: this.#registry,
      progress: this.#progress,
      claims: this.#claims,
    }).write(requests)
    for (const instance of written) {
      if (instance.character) this.#characters.set(instance.name, instance.character)
    }
    return written
  }

  /** One person on their own, with their life and their codex, the family name held to their index's letters. */
  async describeNpc(input: {
    role: NpcRole
    placeKind: Word
    place: Charter
    placeName: string
    theme: string
    index: number
    premise?: string
  }): Promise<NpcProfile> {
    const letters = this.#claims.for(input.index)
    const answer = await this.#askers.places.ask(
      describeNpcTool(letters),
      prompt('describe-npc', {
        theme: input.theme,
        role: input.role,
        placeName: input.placeName,
        placeLabel: input.place.label,
        charter: charterLines(input.place),
        premise: input.premise ?? prompt('no-history'),
        letters: letters.split('').join(', '),
        ...this.#city(),
      }),
      `person:${input.index}`,
    )
    let person = answer ? profileOf(answer) : await this.#fallback.describeNpc(input)
    for (let attempt = 1; attempt <= ATTEMPTS && this.#registry.taken(person.name); attempt++) {
      person = await this.#fallback.describeNpc({ ...input, index: input.index * ATTEMPTS + attempt })
    }
    this.#registry.add(person.name)
    return person
  }

  async describeItem(input: { archetype: ItemArchetype; theme: string; index: number }): Promise<ItemProfile> {
    const answer = await this.#askers.places.ask(
      DESCRIBE_ITEM,
      prompt('describe-item', { ...input, ...this.#city() }),
      `thing:${input.index}`,
    )
    const thing = answer ?? (await this.#fallback.describeItem(input))
    this.#registry.add(thing.name)
    return thing
  }

  /**
   * One call per quest, run in waves. Every draft is checked against the city
   * before it is handed back, and a slot the model cannot fill is filled by the
   * offline narrator, so a build never reports a city with no quests in it.
   * What the owner asked of the main errand, the side work and the tone goes
   * out with each call.
   */
  async writeQuests(input: QuestInput): Promise<unknown[]> {
    return new QuestWriter({
      asker: this.#askers.quests,
      waves: this.#waves,
      fallback: this.#fallback,
      progress: this.#progress,
      seed: this.#seed,
      characters: this.#characters,
    }).write(input)
  }

  /** The build's own seed, from the first call that names it: every later pin and claim is drawn off it. */
  #reseed(seed: string): void {
    if (seed === this.#seed) return
    this.#seed = seed
    this.#pins.reseed(seed)
    this.#claims = new FamilyClaims(seed)
  }

  /** What every descriptive call is told about the city it is writing into. */
  #city(): { cityName: string; usedNames: string } {
    return {
      cityName: this.#registry.cityName,
      usedNames: bullets(this.#registry.names(), 'None yet.'),
    }
  }
}
