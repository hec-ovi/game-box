import type { Narrator } from '@gb/forge'
import { err, ok, type Result } from '@gb/kit'
import type { Charter, Word } from '@gb/world'
import type { Asker, Violation } from './asker.ts'
import { charterLines } from './charter-lines.ts'
import type { ScribeFailure } from './failure.ts'
import { headOf } from './head.ts'
import type { Progress } from './progress.ts'
import { bullets, lastFew, prompt } from './prompts.ts'
import type { NameRegistry } from './registry.ts'
import { answered } from './stand-in.ts'
import { NAME_PLACE, signsTool, type WrittenSigns } from './tools.ts'
import type { Waves } from './waves.ts'

/** A building that does not open: a facade, a door and a sign, and nothing behind it. */
export interface PlaceRequest {
  /** The word of the kind of place it is. */
  readonly kind: Word
  /** What that word means here: its label is what the sign is written for. */
  readonly charter: Charter
  readonly theme: string
  /** Where this building falls in the town's own count of plots: its label in the batch, and the stand-in's draw. */
  readonly index: number
  /** The street its door is on, when the caller knows it. */
  readonly street?: string | undefined
  /** The city's own story, as `premiseLines` renders it. */
  readonly premise?: string | undefined
}

export interface SignNamerOptions {
  readonly asker: Asker
  readonly waves: Waves
  readonly registry: NameRegistry
  readonly progress: Progress
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
  async write(request: PlaceRequest): Promise<Result<string, ScribeFailure>> {
    const answer = await this.#asker.ask(
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
      (value) => headProblem(value.name, this.#registry),
    )
    if (answer.ok) return ok(this.#hang(answer.value.name))

    const spare = await this.spare(request)
    return spare === undefined ? err(answer.error) : ok(this.#hang(spare))
  }

  /** A sign from the stand-in a caller handed in, asked again until its head is free. Nothing in the game passes one. */
  async spare(request: PlaceRequest): Promise<string | undefined> {
    if (!this.#standIn) return undefined
    const at = (attempt: number) => ({
      kind: request.kind,
      charter: request.charter,
      theme: request.theme,
      index: request.index * ATTEMPTS + attempt,
      ...(request.premise === undefined ? {} : { premise: request.premise }),
    })
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

/**
 * Names the buildings nobody walks into, a batch at a time.
 *
 * Most of a city is frontage, and a sign is five tokens, so the cost of naming
 * it all was never the tokens but the round trips. One call names twenty, with
 * the town's history in front of it and each building's trade and street, and
 * hands back the list. No word heads two signs: the call is told the heads
 * already hung and refused if it repeats one, then the answers are read in
 * index order and any head spent by then is asked for again on its own, so
 * which sign keeps a head never depends on which batch landed first.
 */
export class SignNamer {
  #asker: Asker
  #waves: Waves
  #registry: NameRegistry
  #progress: Progress
  #one: OneSign
  #counted = new Set<number>()

  constructor(options: SignNamerOptions) {
    this.#asker = options.asker
    this.#waves = options.waves
    this.#registry = options.registry
    this.#progress = options.progress
    this.#one = new OneSign({ asker: options.asker, registry: options.registry, standIn: options.standIn })
  }

  async write(requests: readonly PlaceRequest[]): Promise<Result<string[], ScribeFailure>> {
    this.#counted.clear()
    this.#progress.open('city', requests.length, `${requests.length} signs`)

    const batches: (readonly PlaceRequest[])[] = []
    for (let start = 0; start < requests.length; start += BATCH) {
      batches.push(requests.slice(start, start + BATCH))
    }
    const hung = this.#registry.heads()
    type Batch = Result<ReadonlyMap<string, string>, ScribeFailure>
    const answered = await this.#waves.run<readonly PlaceRequest[], Batch>(batches, (batch, b, earlier) =>
      this.#ask(batch, b, lastFew([...hung, ...earlier.flatMap((names) => (names.ok ? [...names.value.values()].map(headOf) : []))])),
    )

    const out: string[] = []
    for (const [index, request] of requests.entries()) {
      const settled = await this.#settle(request, answered[Math.floor(index / BATCH)]!)
      if (!settled.ok) return err(settled.error)
      this.#count(index, settled.value, request.charter.label)
      out.push(settled.value)
    }
    return ok(out)
  }

  /**
   * The sign this building ends up with: the one its batch wrote, or, where the
   * batch was lost or its head is spent by now, one more call for this building
   * alone. A batch nobody answered is not asked again twenty times: only a
   * stand-in can settle those, and without one the stage stops here.
   */
  async #settle(request: PlaceRequest, batch: Result<ReadonlyMap<string, string>, ScribeFailure>): Promise<Result<string, ScribeFailure>> {
    if (!batch.ok) {
      const spare = await this.#one.spare(request)
      if (spare === undefined) return err(batch.error)
      this.#registry.hang(spare)
      return ok(spare)
    }
    const written = batch.value.get(label(request))
    if (written === undefined || this.#registry.signTaken(written)) return this.#one.write(request)
    this.#registry.hang(written)
    return ok(written)
  }

  /**
   * One batch: the names by label.
   *
   * A repeated head is quoted back so the next draw is a better batch, but it
   * never costs the batch: the last answer that named every building once is
   * kept, and `#settle` asks again for the one sign whose head is spent.
   * Measured on one live 3x3 town: 2 of the 4 sign calls were refused for one
   * repeated head, which is a clash the mend settles one sign at a time.
   */
  async #ask(batch: readonly PlaceRequest[], b: number, takenHeads: readonly string[]): Promise<Result<ReadonlyMap<string, string>, ScribeFailure>> {
    const labels = batch.map(label)
    const first = batch[0]
    let mendable: WrittenSigns | undefined
    const answer = await this.#asker.ask(
      signsTool(labels),
      prompt('name-signs', {
        cityName: this.#registry.cityName,
        theme: first?.theme ?? '',
        premise: first?.premise ?? prompt('no-history'),
        buildings: bullets(
          batch.map((request) => `${label(request)}: a ${request.charter.label}${request.street ? ` on ${request.street}` : ''}`),
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
    if (answer.ok) return ok(this.#zip(answer.value, batch, b))
    if (mendable) return ok(this.#zip(mendable, batch, b))
    return err(answer.error)
  }

  /** The batch's answer as a sign per label, counted off as it is read. */
  #zip(written: WrittenSigns, batch: readonly PlaceRequest[], b: number): ReadonlyMap<string, string> {
    for (const [k, sign] of written.signs.entries()) {
      this.#count(b * BATCH + k, sign.name, batch[k]!.charter.label)
    }
    return new Map(written.signs.map((sign) => [sign.building, sign.name]))
  }

  /** One building counts once, whether it was named in its batch or asked for again afterwards. */
  #count(index: number, name: string, label: string): void {
    if (this.#counted.has(index)) return
    this.#counted.add(index)
    this.#progress.finished(`${name}, a ${label}`)
  }
}

function label(request: PlaceRequest): string {
  return `b${request.index}`
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
