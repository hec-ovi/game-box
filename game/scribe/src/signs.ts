import type { Narrator } from '@gb/forge'
import type { Charter, Word } from '@gb/world'
import type { Asker, Violation } from './asker.ts'
import { headOf } from './head.ts'
import type { Progress } from './progress.ts'
import { bullets, lastFew, prompt } from './prompts.ts'
import type { NameRegistry } from './registry.ts'
import { signsTool, type WrittenSigns } from './tools.ts'
import type { Waves } from './waves.ts'

/** A building that does not open: a facade, a door and a sign, and nothing behind it. */
export interface PlaceRequest {
  /** The word of the kind of place it is. */
  readonly kind: Word
  /** What that word means here: its label is what the sign is written for. */
  readonly charter: Charter
  readonly theme: string
  /** Where this building falls in the town's own count of plots: its label in the batch, and the offline draw. */
  readonly index: number
  /** The street its door is on, when the caller knows it. */
  readonly street?: string | undefined
  /** The city's own story, as `premiseLines` renders it. */
  readonly premise?: string | undefined
}

export interface SignNamerOptions {
  readonly asker: Asker
  readonly waves: Waves
  readonly fallback: Narrator
  readonly registry: NameRegistry
  readonly progress: Progress
}

/** Signs asked for in one call. A name is a few tokens, so a batch costs one round trip for many of them. */
const BATCH = 20

/** How far apart two facades' fallback streams sit, so no two of them draw the same spare sign. */
const ATTEMPTS = 40


/**
 * Names the buildings nobody walks into, a batch at a time.
 *
 * Most of a city is frontage, and a sign is five tokens, so the cost of naming
 * it all was never the tokens but the round trips. One call names twenty, with
 * the town's history in front of it and each building's trade and street, and
 * hands back the list. No word heads two signs: the call is told the heads
 * already hung and refused if it repeats one, then the answers are read in
 * index order and any head spent by then goes to the offline composer, so
 * which sign keeps a head never depends on which batch landed first.
 */
export class SignNamer {
  #asker: Asker
  #waves: Waves
  #fallback: Narrator
  #registry: NameRegistry
  #progress: Progress
  #counted = new Set<number>()

  constructor(options: SignNamerOptions) {
    this.#asker = options.asker
    this.#waves = options.waves
    this.#fallback = options.fallback
    this.#registry = options.registry
    this.#progress = options.progress
  }

  async write(requests: readonly PlaceRequest[]): Promise<string[]> {
    this.#counted.clear()
    this.#progress.open('city', requests.length, `${requests.length} signs`)

    const batches: (readonly PlaceRequest[])[] = []
    for (let start = 0; start < requests.length; start += BATCH) {
      batches.push(requests.slice(start, start + BATCH))
    }
    const hung = this.#registry.heads()
    const answered = await this.#waves.run<readonly PlaceRequest[], ReadonlyMap<string, string>>(batches, (batch, b, earlier) =>
      this.#ask(batch, b, lastFew([...hung, ...earlier.flatMap((names) => [...names.values()].map(headOf))])),
    )

    const out: string[] = []
    for (const [index, request] of requests.entries()) {
      const written = answered[Math.floor(index / BATCH)]!.get(label(request))
      const name = written !== undefined && !this.#registry.signTaken(written) ? written : await this.#spare(request)
      this.#registry.hang(name)
      this.#count(index, name, request.charter.label)
      out.push(name)
    }
    return out
  }

  /** One batch: the names by label, or none of them when the model would not write the batch. */
  async #ask(batch: readonly PlaceRequest[], b: number, takenHeads: readonly string[]): Promise<ReadonlyMap<string, string>> {
    const labels = batch.map(label)
    const first = batch[0]
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
      `signs:${b}`,
      (value) => problemsWith(value, labels, takenHeads),
    )
    if (!answer) return new Map()
    for (const [k, sign] of answer.signs.entries()) {
      this.#count(b * BATCH + k, sign.name, batch[k]!.charter.label)
    }
    return new Map(answer.signs.map((sign) => [sign.building, sign.name]))
  }

  /** Keeps asking the offline composer for one more sign until its head is not already over a door. */
  async #spare(request: PlaceRequest): Promise<string> {
    const at = (attempt: number) => ({
      kind: request.kind,
      charter: request.charter,
      theme: request.theme,
      index: request.index * ATTEMPTS + attempt,
      ...(request.premise === undefined ? {} : { premise: request.premise }),
    })
    let name = await this.#fallback.namePlace(at(0))
    for (let attempt = 1; attempt <= ATTEMPTS && this.#registry.signTaken(name); attempt++) {
      name = await this.#fallback.namePlace(at(attempt))
    }
    return name
  }

  /** One building counts once, whether it was named in its batch or mended afterwards. */
  #count(index: number, name: string, label: string): void {
    if (this.#counted.has(index)) return
    this.#counted.add(index)
    this.#progress.finished(`${name}, a ${label}`)
  }
}

function label(request: PlaceRequest): string {
  return `b${request.index}`
}

/** Everything wrong with a batch that the schema alone could not refuse: a label missed or doubled, or a head used twice. */
function problemsWith(answer: WrittenSigns, labels: readonly string[], takenHeads: readonly string[]): Violation[] {
  const problems: Violation[] = []
  for (const wanted of labels) {
    const times = answer.signs.filter((sign) => sign.building === wanted).length
    if (times !== 1) problems.push({ path: 'signs', message: `name building ${wanted} exactly once, not ${times} times` })
  }
  const heads = answer.signs.map((sign) => headOf(sign.name))
  for (const [i, head] of heads.entries()) {
    if (heads.indexOf(head) !== i) {
      problems.push({ path: `signs.${i}.name`, message: `${answer.signs[i]!.name} starts with ${head}, which already heads another sign in this batch` })
    } else if (takenHeads.includes(head)) {
      problems.push({ path: `signs.${i}.name`, message: `${answer.signs[i]!.name} starts with ${head}, which already heads a sign in this city` })
    }
  }
  return problems
}
