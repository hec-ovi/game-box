import type { Narrator, PlaceRequest, PlaceSign, WrittenPlace } from '@gb/forge'
import { err, ok, type Result } from '@gb/kit'
import type { Charter, Word } from '@gb/world'
import type { Asker, Violation } from './asker.ts'
import { charterLines, kindLine } from './charter-lines.ts'
import { doorLine } from './door-lines.ts'
import type { ScribeFailure } from './failure.ts'
import { headOf } from './head.ts'
import { doorLabel } from './labels.ts'
import type { Progress } from './progress.ts'
import { bullets, lastFew, prompt } from './prompts.ts'
import type { NameRegistry } from './registry.ts'
import { answered } from './stand-in.ts'
import { NAME_PLACE, signsTool, type WrittenSigns } from './tools.ts'
import type { Waves } from './waves.ts'

export interface SignNamerOptions {
  readonly asker: Asker
  readonly waves: Waves
  readonly registry: NameRegistry
  readonly progress: Progress
  /** The closed list a door nobody has said anything about is written as. Never empty: every city declares the presets. */
  readonly kinds: readonly Charter[]
  /** Only where a caller handed one in. Nothing in the game does. */
  readonly standIn?: Narrator | undefined
}

/** Signs asked for in one call. A name is a few tokens, so a batch costs one round trip for many of them. */
const BATCH = 20

/** How far apart two facades' stand-in streams sit, so no two of them draw the same spare sign. */
const ATTEMPTS = 40

/**
 * One sign on its own: the single-place question, and the mend when the sign a
 * batch wrote for a building turns out to start with a word already over
 * another door.
 *
 * What the building is has always been settled by the time this runs, so this
 * asks for the sign and nothing else.
 *
 * The head word is checked as part of the answer, so a repeat is quoted back to
 * the model and drawn again rather than swapped for something nobody asked for.
 */
export class OneSign {
  #asker: Asker
  #registry: NameRegistry
  #standIn: Narrator | undefined

  constructor(options: { asker: Asker; registry: NameRegistry; standIn?: Narrator | undefined }) {
    this.#asker = options.asker
    this.#registry = options.registry
    this.#standIn = options.standIn
  }

  /** The model's sign for this building, hung, or why it could not be written. */
  async write(request: WrittenPlace): Promise<Result<string, ScribeFailure>> {
    const answer = await this.#ask(request, (value) => headProblem(value.name, this.#registry))
    if (answer.ok) return ok(this.#hang(answer.value.name))

    const spare = await this.spare(request)
    if (spare !== undefined) return ok(this.#hang(spare))

    // A head word already over another door is a blemish on a street, not a
    // reason to lose the city: the rule is worth the retries above and it is
    // not worth a build. One more call with the rule lifted, and a sign that
    // repeats a word is hung rather than refused. An engine that will not
    // answer at all still fails here, which is the failure worth having.
    const anything = await this.#ask(request, () => [])
    return anything.ok ? ok(this.#hang(anything.value.name)) : err(answer.error)
  }

  #ask(request: WrittenPlace, check: (value: { name: string }) => readonly Violation[]) {
    return this.#asker.ask(
      NAME_PLACE,
      prompt('name-place', {
        theme: request.theme,
        label: request.charter.label,
        charter: charterLines(request.charter),
        premise: request.premise ?? prompt('no-history'),
        cityName: this.#registry.cityName,
        usedNames: bullets(this.#registry.names(), 'None yet.'),
      }),
      { at: `sign:${request.index}`, what: `the sign over a ${request.charter.label}` },
      check,
    )
  }

  /** A sign from the stand-in a caller handed in, asked again until its head is free. Nothing in the game passes one. */
  async spare(request: WrittenPlace): Promise<string | undefined> {
    if (!this.#standIn) return undefined
    const at = (attempt: number) => ({ ...request, index: request.index * ATTEMPTS + attempt })
    let name = answered(await this.#standIn.namePlace(at(0)))
    for (let attempt = 1; attempt <= ATTEMPTS && name !== undefined && this.#registry.signTaken(name); attempt++) {
      name = answered(await this.#standIn.namePlace(at(attempt)))
    }
    return name
  }

  #hang(name: string): string {
    this.#registry.hang(name)
    return name
  }
}

/** One door waiting for its sign, and where it stands in the list the caller asked about. */
interface Door {
  readonly at: number
  readonly request: PlaceRequest
}

/** One call's worth of doors. A batch of doors nobody has said anything about answers what each one is as well. */
interface Batch {
  readonly doors: readonly Door[]
  readonly bare: boolean
}

/** A batch's answer: the sign, and the kind where the batch was the one that decided it. */
type Batched = Result<ReadonlyMap<string, { name: string; kind?: Word }>, ScribeFailure>

/**
 * Names every door in the town, a batch at a time, and says what the ones
 * nobody has spoken about are.
 *
 * Most of a city is frontage, and a sign is five tokens, so the cost of naming
 * it all was never the tokens but the round trips. One call names twenty, with
 * the town's history in front of it and each building's trade, street and the
 * work the town's quests do behind it, and hands back the list.
 *
 * A door that opens was told what it is back when the architecture stood, so
 * its batch is asked for the sign alone; a door that never opens is still a
 * building, and its batch answers the kind as well, off the closed list the
 * city declares. The two are batched apart so no call writes a word its caller
 * already has.
 *
 * No word heads two signs: a batch is told the heads already hung and refused
 * if it repeats one, then the answers are read in index order and any head
 * spent by then is asked for again on its own, so which sign keeps a head never
 * depends on which batch landed first.
 */
export class SignNamer {
  #waves: Waves
  #asker: Asker
  #registry: NameRegistry
  #progress: Progress
  #kinds: readonly Charter[]
  #standIn: Narrator | undefined
  #one: OneSign
  #counted = new Set<number>()

  constructor(options: SignNamerOptions) {
    this.#asker = options.asker
    this.#waves = options.waves
    this.#registry = options.registry
    this.#progress = options.progress
    this.#kinds = options.kinds
    this.#standIn = options.standIn
    this.#one = new OneSign({ asker: options.asker, registry: options.registry, standIn: options.standIn })
  }

  async write(requests: readonly PlaceRequest[]): Promise<Result<PlaceSign[], ScribeFailure>> {
    this.#counted.clear()
    this.#progress.open('city', requests.length, `${requests.length} signs`)

    const doors = requests.map((request, at) => ({ at, request }))
    const batches = this.#batches(doors)
    const hung = this.#registry.heads()
    const answers = await this.#waves.run<Batch, Batched>(batches, (batch, b, earlier) =>
      this.#ask(batch, b, lastFew([...hung, ...earlier.flatMap(headsOf)])),
    )
    // a batch nobody answered is settled once, by the stand-in a caller handed
    // in, rather than twenty times over
    for (const [b, answer] of answers.entries()) {
      if (answer.ok) continue
      const spare = await this.#spare(batches[b]!)
      if (spare) answers[b] = ok(spare)
    }
    const which = new Map(batches.flatMap((batch, b) => batch.doors.map((door) => [door.at, b] as const)))

    const out: PlaceSign[] = []
    for (const door of doors) {
      const settled = await this.#settle(door, answers[which.get(door.at)!]!)
      if (!settled.ok) return err(settled.error)
      out.push(settled.value)
    }
    return ok(out)
  }

  /**
   * The doors cut into calls: the ones already settled first, then the ones
   * that are still nothing. The split is a function of the requests alone, so
   * the same town cuts the same batches every time.
   */
  #batches(doors: readonly Door[]): Batch[] {
    const batches: Batch[] = []
    for (const bare of [false, true]) {
      const group = doors.filter((door) => (door.request.charter === undefined) === bare)
      for (let start = 0; start < group.length; start += BATCH) {
        batches.push({ doors: group.slice(start, start + BATCH), bare })
      }
    }
    return batches
  }

  /**
   * The sign this building ends up with: the one its batch wrote, or, where its
   * head is spent by now, one more call for this building alone. A batch
   * nobody answered is not asked again twenty times: only a stand-in can
   * settle one, and without one the stage stops here.
   */
  async #settle(door: Door, batch: Batched): Promise<Result<PlaceSign, ScribeFailure>> {
    if (!batch.ok) return err(batch.error)
    // a batch that missed a building was refused, so every label it answered under is in here
    const written = batch.value.get(doorLabel(door.request.index))!
    const kind = door.request.kind ?? written.kind
    const spent = this.#registry.signTaken(written.name)
    // the word over this door is already over another one: one more call for
    // this sign alone, against what the building turned out to be
    const place = spent ? this.#settledPlace(door.request, kind) : undefined
    if (place !== undefined) {
      const again = await this.#one.write(place)
      return again.ok ? ok(this.#kept(door, again.value, kind)) : err(again.error)
    }
    this.#registry.hang(written.name)
    return ok(this.#kept(door, written.name, kind))
  }

  /** A whole batch from the stand-in a caller handed in, in one call. Nothing in the game hands one in. */
  async #spare(batch: Batch): Promise<ReadonlyMap<string, PlaceSign> | undefined> {
    const written = answered(await this.#standIn?.namePlaces?.(batch.doors.map((door) => door.request)))
    return written?.length === batch.doors.length
      ? new Map(batch.doors.map((door, at) => [doorLabel(door.request.index), written[at]!]))
      : undefined
  }

  /** The same building with its kind settled, which is what a sign is written against. */
  #settledPlace(request: PlaceRequest, kind: Word | undefined): WrittenPlace | undefined {
    const charter = request.charter ?? this.#kinds.find((one) => one.word === kind)
    return kind !== undefined && charter !== undefined ? { ...request, kind, charter } : undefined
  }

  /** One building counts once, whether it was named in its batch or asked for again afterwards. */
  #kept(door: Door, name: string, kind: Word | undefined): PlaceSign {
    if (!this.#counted.has(door.at)) {
      this.#counted.add(door.at)
      this.#progress.finished(`${name}, a ${labelOf(door.request, kind, this.#kinds)}`)
    }
    // a door that was already something keeps what it was: the caller has it
    return door.request.kind !== undefined || kind === undefined ? { name } : { name, kind }
  }

  /**
   * One batch: the signs by label.
   *
   * A repeated head is quoted back so the next draw is a better batch, but it
   * never costs the batch: the last answer that named every building once is
   * kept, and `#settle` asks again for the one sign whose head is spent.
   * Measured on one live 3x3 town: 2 of the 4 sign calls were refused for one
   * repeated head, which is a clash the mend settles one sign at a time.
   */
  async #ask(batch: Batch, b: number, takenHeads: readonly string[]): Promise<Batched> {
    const labels = batch.doors.map((door) => doorLabel(door.request.index))
    const first = batch.doors[0]?.request
    let mendable: WrittenSigns | undefined
    const answer = await this.#asker.ask(
      signsTool(labels, batch.bare ? this.#kinds.map((charter) => charter.word) : undefined),
      prompt('name-signs', {
        cityName: this.#registry.cityName,
        theme: first?.theme ?? '',
        premise: first?.premise ?? prompt('no-history'),
        kinds: batch.bare ? prompt('signs-kinds', { kinds: bullets(this.#kinds.map(kindLine), 'None.') }) : prompt('signs-settled'),
        buildings: bullets(
          batch.doors.map((door) => `${doorLabel(door.request.index)}: ${doorLine(door.request)}`),
          'None.',
        ),
        usedHeads: bullets(takenHeads, 'None yet.'),
      }),
      { at: `signs:${b}`, what: 'the signs over the doors' },
      (value) => {
        const missed = labelProblems(value, labels)
        if (missed.length === 0) mendable = value
        return [...missed, ...headProblems(value, takenHeads)]
      },
    )
    if (answer.ok) return ok(zip(answer.value))
    if (mendable) return ok(zip(mendable))
    return err(answer.error)
  }
}

/** The batch's answer as a sign per label. */
function zip(written: WrittenSigns): ReadonlyMap<string, { name: string; kind?: Word }> {
  return new Map(written.signs.map((sign) => [sign.building, sign.kind === undefined ? { name: sign.name } : { name: sign.name, kind: sign.kind }]))
}

/** The heads a batch already spent, for the batches after it in the same pass. */
const headsOf = (batch: Batched): string[] => (batch.ok ? [...batch.value.values()].map((sign) => headOf(sign.name)) : [])

/** What a person calls this building, once there is a word for it. */
function labelOf(request: PlaceRequest, kind: Word | undefined, kinds: readonly Charter[]): string {
  return request.charter?.label ?? kinds.find((one) => one.word === kind)?.label ?? kind ?? 'building'
}

/** A batch with a building missed or named twice is a batch nothing can be zipped onto. */
function labelProblems(answer: WrittenSigns, labels: readonly string[]): Violation[] {
  return labels.flatMap((wanted) => {
    const times = answer.signs.filter((sign) => sign.building === wanted).length
    return times === 1 ? [] : [{ path: 'signs', message: `name building ${wanted} exactly once, not ${times} times` }]
  })
}

/** A head over two doors, which the next draw can do better and the mend settles either way. */
function headProblems(answer: WrittenSigns, takenHeads: readonly string[]): Violation[] {
  const heads = answer.signs.map((sign) => headOf(sign.name))
  return heads.flatMap((head, i) => {
    const where = heads.indexOf(head) !== i ? 'another sign in this batch' : takenHeads.includes(head) ? 'a sign in this city' : ''
    return where ? [{ path: `signs.${i}.name`, message: `${answer.signs[i]!.name} starts with ${head}, which already heads ${where}` }] : []
  })
}

/** One sign whose word is already over another door in this city. */
function headProblem(name: string, registry: NameRegistry): Violation[] {
  return registry.signTaken(name)
    ? [{ path: 'name', message: `${name} starts with ${headOf(name)}, which already heads a sign in this city` }]
    : []
}
