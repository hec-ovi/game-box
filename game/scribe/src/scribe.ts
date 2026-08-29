import type { DistrictRequest, History, Instance, InstanceRequest, ItemProfile, Narrator, NpcProfile, PlaceRequest, PlaceSign, WrittenPlace } from '@gb/forge'
import { premiseLines } from '@gb/forge'
import { err, ok, type Result } from '@gb/kit'
import { Sidecar } from '@gb/sidecar'
import { SHIPPED_CHARTERS, type Charter, type ItemArchetype, type NpcRole, type Premise, type Word } from '@gb/world'
import { Asker, type ScribeProblem, type Violation } from './asker.ts'
import { BRIEF_FIELDS, BRIEF_LABELS, type BriefDraft, type BriefField, type BriefSoFar } from './brief.ts'
import { charterLines } from './charter-lines.ts'
import { CharterWriter } from './charters.ts'
import { FamilyClaims } from './claim.ts'
import { DistrictNamer } from './districts.ts'
import { addressOf, type ScribeFailure } from './failure.ts'
import { InstanceWriter } from './instance.ts'
import { PlaceWriter, type PlacesInput } from './places.ts'
import { profileOf } from './person.ts'
import { Pins } from './pins.ts'
import { PremiseWriter, type PremiseInput } from './premise.ts'
import { Progress, type ProgressPort, type ScribeStage } from './progress.ts'
import { bullets, prompt } from './prompts.ts'
import { QuestWriter, type QuestInput } from './quests.ts'
import { NameRegistry } from './registry.ts'
import { OneSign, SignNamer } from './signs.ts'
import { answered } from './stand-in.ts'
import { DESCRIBE_ITEM, describeNpcTool, NAME_CITY, WRITE_BRIEF } from './tools.ts'
import { Waves } from './waves.ts'

/**
 * A quest is the longest call there is: one was measured at 100 s on its own, and
 * several run at once, which makes each of them slower.
 */
const QUEST_MS = 900_000

/**
 * A place is the second longest: one call writes the building, everybody in it
 * and what they keep, and on a small local model it is minutes rather than
 * seconds. Measured on 2026-08-27: a 3 by 3 town on the sidecar's own clock
 * lost its build to "the workshop and the people in it could not be written:
 * the model ran out of time". A stage that is only slow must not read as a
 * stage that refused. Every other call runs on the sidecar's own clock.
 */
const PLACE_MS = 600_000

/**
 * How far the engine strays from its likeliest token, sent on every call. A
 * town written at zero is the same three names over and over; the engine's own
 * default is one.
 */
const TEMPERATURE = 0.9

/** How many spare answers a stand-in is asked for before a single call takes what it has. */
const ATTEMPTS = 40

/** One person asked for on their own: their post, the place they stand in, and what such a place is here. */
interface NpcRequest {
  readonly role: NpcRole
  readonly placeKind: Word
  readonly place: Charter
  readonly placeName: string
  readonly theme: string
  readonly index: number
  readonly premise?: string
}

export interface ScribeOptions {
  readonly sidecar?: Sidecar
  /**
   * Somewhere to get an answer the model would not give. Nothing in the game
   * passes one: it is here for the tests and the quest harness, which need a
   * city to exist without an engine behind it. Left out, a call the model will
   * not make good comes back as a `ScribeFailure`.
   */
  readonly standIn?: Narrator
  readonly seed?: string
  /** Tries per call before the call comes back as a failure. */
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
 * world as prose.
 *
 * A call the model will not make good comes back as a `ScribeFailure` saying
 * which stage stopped and what the engine said. There is nothing behind it: a
 * city somebody asked a story of is written by the model, or the build stops
 * and says so.
 */
export class Scribe implements Narrator {
  #askers: Record<ScribeStage, Asker>
  #standIn: Narrator | undefined
  #registry = new NameRegistry()
  #waves: Waves
  #progress: Progress
  #pins: Pins
  #seed: string
  #claims: FamilyClaims
  #problems: ScribeProblem[] = []
  #dropped: ScribeFailure[] = []
  #characters = new Map<string, string>()
  #oneSign: OneSign
  /**
   * The closed list of kinds this city declares, kept from the call that
   * decided what its open doors are, because the call that names the rest of
   * the street has to write them out of the same list. A growth that opens no
   * doors makes no such call, and the presets are what every city declares.
   */
  #kinds: readonly Charter[] = SHIPPED_CHARTERS

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
    const where = addressOf(sidecar.base)
    const asker = (stage: ScribeStage, timeoutMs?: number): Asker =>
      new Asker({ sidecar, pins, stage, where, attempts, timeoutMs, signal: options.signal, record })
    this.#askers = {
      history: asker('history'),
      city: asker('city'),
      places: asker('places', PLACE_MS),
      quests: asker('quests', QUEST_MS),
    }
    this.#standIn = options.standIn
    this.#waves = new Waves(options.concurrency)
    this.#progress = new Progress(options.progress)
    this.#oneSign = new OneSign({ asker: this.#askers.city, registry: this.#registry, standIn: this.#standIn })
  }

  problems(): readonly ScribeProblem[] {
    return this.#problems
  }

  /**
   * Work the city went without: a side errand the model would not write in the
   * end, dropped so the rest of the town still stands. Each one carries the
   * same sentence a stopped stage does, for whoever reports what the city is
   * short of. A stage that stopped is never in here: that came back as a
   * failure instead.
   */
  dropped(): readonly ScribeFailure[] {
    return this.#dropped
  }

  /**
   * The city's history, written before a street is laid. Everything the forge
   * does afterwards is built out of it, so an answer the town cannot be built
   * from is never handed on: the model is told what was wrong, and a history it
   * will not write stops the build. The owner's brief goes to this call
   * verbatim, with the tone, the main errand and the look they asked for. A
   * kind of place the history invents is asked for next, one charter per word,
   * and rides back on the history.
   */
  async writePremise(input: PremiseInput): Promise<Result<History, ScribeFailure>> {
    this.#reseed(input.seed)
    this.#progress.open('history', 1, 'writing the history')
    const charters = new CharterWriter({ asker: this.#askers.history, waves: this.#waves, progress: this.#progress })
    const history = await new PremiseWriter({ asker: this.#askers.history, charters, standIn: this.#standIn }).write(input)
    if (history.ok) this.#progress.finished(history.value.livesOn)
    return history
  }

  /**
   * Write the fields of a brief for somebody sitting at the form. This is the
   * one call that happens before there is a city: it answers the form's own
   * five fields and nothing else, and the ones that were not asked for come
   * back as they went in.
   *
   * A model that will not answer says nothing and the form says so. A composed
   * brief would be a canned one, and a canned brief handed over as the model's
   * answer is the thing this is here to replace.
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
      { at: 'brief', what: 'the brief' },
    )
    if (!answer.ok) return undefined
    // only what was asked for is taken: the model is told to give the rest back
    // word for word and mostly does, but "mostly" would quietly rewrite a field
    // somebody had typed themselves
    const draft = answer.value
    return { ...draft, ...Object.fromEntries(BRIEF_FIELDS.filter((field) => !want.includes(field)).map((field) => [field, have[field] ?? draft[field]])) }
  }

  /** Named after what the town lives on, which is why the history goes out with the question. */
  async nameCity(input: { theme: string; seed: string; premise?: Premise }): Promise<Result<string, ScribeFailure>> {
    this.#reseed(input.seed)
    this.#progress.open('city', 1, 'naming the city')
    const answer = await this.#askers.city.ask(
      NAME_CITY,
      prompt('name-city', {
        theme: input.theme,
        premise: input.premise ? premiseLines(input.premise) : prompt('no-history'),
      }),
      { at: 'city-name', what: "the city's name" },
    )
    if (answer.ok) return ok(this.#named(answer.value.name))
    const spare = answered(await this.#standIn?.nameCity(input))
    return spare === undefined ? err(answer.error) : ok(this.#named(spare))
  }

  /**
   * What each of the town's open doors is, before a word of work is written.
   *
   * This is the stage that decides a city's locations, so nothing here writes a
   * word of its own: what the town needs is settled first, every answer decodes
   * against the kinds the city declares, and the doors that answer a need are
   * pinned to their word. A stage this box cannot get an answer for stops the
   * build.
   */
  async writePlaces(input: PlacesInput): Promise<Result<Word[], ScribeFailure>> {
    this.#kinds = input.kinds
    return new PlaceWriter({ asker: this.#askers.places, progress: this.#progress, standIn: this.#standIn }).write(input)
  }

  /** One sign on its own, for a door whose kind is already settled. A word already over another door is quoted back and drawn again. */
  async namePlace(input: WrittenPlace): Promise<Result<string, ScribeFailure>> {
    return this.#oneSign.write(input)
  }

  /**
   * The sign over every door in the town, twenty to a call, with the town's
   * history in front of the model and each building's trade, street and the
   * work the town's quests do behind it. Back in the order they were asked for,
   * no word heading two of them. A door nobody has said anything about is told
   * what it is here as well, off the kinds the city declares.
   */
  async namePlaces(requests: readonly PlaceRequest[]): Promise<Result<PlaceSign[], ScribeFailure>> {
    return new SignNamer({
      asker: this.#askers.city,
      waves: this.#waves,
      registry: this.#registry,
      progress: this.#progress,
      kinds: this.#kinds,
      standIn: this.#standIn,
    }).write(requests)
  }

  /**
   * What the parts of the city are called, all in one call, with the town's
   * history in front of the model and how much of the town each part holds and
   * which way it lies. Back in the order they were asked for, no two of them
   * called the same thing.
   */
  async nameDistricts(requests: readonly DistrictRequest[]): Promise<Result<string[], ScribeFailure>> {
    return new DistrictNamer({
      asker: this.#askers.city,
      registry: this.#registry,
      progress: this.#progress,
      standIn: this.#standIn,
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
  async writeInstances(requests: readonly InstanceRequest[]): Promise<Result<Instance[], ScribeFailure>> {
    const written = await new InstanceWriter({
      asker: this.#askers.places,
      waves: this.#waves,
      registry: this.#registry,
      progress: this.#progress,
      claims: this.#claims,
      standIn: this.#standIn,
    }).write(requests)
    if (!written.ok) return written
    for (const instance of written.value) {
      if (instance.character) this.#characters.set(instance.name, instance.character)
    }
    return written
  }

  /** One person on their own, with their life and their codex, the family name held to their index's letters. */
  async describeNpc(input: NpcRequest): Promise<Result<NpcProfile, ScribeFailure>> {
    const letters = this.#claims.for(input.index)
    const call = { at: `person:${input.index}`, what: `the ${input.role} at ${input.placeName}` }
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
      call,
      (value) => this.#spent(`${value.given} ${value.family}`),
    )
    if (answer.ok) return ok(this.#spend(profileOf(answer.value)))
    const spare = await this.#spareNpc(input)
    return spare === undefined ? err(answer.error) : ok(this.#spend(spare))
  }

  async describeItem(input: { archetype: ItemArchetype; theme: string; index: number }): Promise<Result<ItemProfile, ScribeFailure>> {
    const answer = await this.#askers.places.ask(
      DESCRIBE_ITEM,
      prompt('describe-item', { ...input, ...this.#city() }),
      { at: `thing:${input.index}`, what: `the ${input.archetype}` },
    )
    if (answer.ok) return ok(this.#spend(answer.value))
    const spare = answered(await this.#standIn?.describeItem(input))
    return spare === undefined ? err(answer.error) : ok(this.#spend(spare))
  }

  /**
   * One call per quest, run in waves. Every draft is checked against the city
   * before it is handed back, and a slot the model cannot fill stops the stage.
   * What the owner asked of the main errand, the side work and the tone goes
   * out with each call.
   */
  async writeQuests(input: QuestInput): Promise<Result<unknown[], ScribeFailure>> {
    return new QuestWriter({
      asker: this.#askers.quests,
      waves: this.#waves,
      progress: this.#progress,
      seed: this.#seed,
      characters: this.#characters,
      dropped: (failure) => void this.#dropped.push(failure),
      standIn: this.#standIn,
    }).write(input)
  }

  /** A person from the stand-in a caller handed in, asked again until their name is free. Nothing in the game passes one. */
  async #spareNpc(input: NpcRequest): Promise<NpcProfile | undefined> {
    if (!this.#standIn) return undefined
    let person = answered(await this.#standIn.describeNpc(input))
    for (let attempt = 1; attempt <= ATTEMPTS && person !== undefined && this.#registry.taken(person.name); attempt++) {
      person = answered(await this.#standIn.describeNpc({ ...input, index: input.index * ATTEMPTS + attempt }))
    }
    return person
  }

  /** The city's name, spent and published. */
  #named(name: string): string {
    this.#registry.nameCity(name)
    this.#progress.finished(name)
    return name
  }

  /** A name this city has now given out, so no later call writes it again. */
  #spend<T extends { readonly name: string }>(written: T): T {
    this.#registry.add(written.name)
    return written
  }

  /** A name this city has already given somebody else, quoted back so the next draw is a different person. */
  #spent(name: string): Violation[] {
    return this.#registry.taken(name) ? [{ path: 'family', message: `${name} is already somebody else in this city` }] : []
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
