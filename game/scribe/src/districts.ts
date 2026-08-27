import type { DistrictRequest, Narrator } from '@gb/forge'
import { err, ok, type Result } from '@gb/kit'
import type { Asker, Violation } from './asker.ts'
import type { ScribeFailure } from './failure.ts'
import type { Progress } from './progress.ts'
import { bullets, prompt } from './prompts.ts'
import type { NameRegistry } from './registry.ts'
import { answered } from './stand-in.ts'
import { districtsTool, type WrittenDistricts } from './tools.ts'

export interface DistrictNamerOptions {
  readonly asker: Asker
  readonly registry: NameRegistry
  readonly progress: Progress
  /** Only where a caller handed one in. Nothing in the game does. */
  readonly standIn?: Narrator | undefined
}

/**
 * Names the parts of the city, all in one call.
 *
 * A city has a handful of districts, so there is never a second batch: the
 * whole cut goes out together with the town's history in front of it, which is
 * what lets one name answer another (a wharf end and a hill above it) instead
 * of each being written in the dark. An answer that misses a part, names one
 * twice, or calls two of them the same thing is quoted the fault and asked
 * again; a cut the model will not name in the end stops the build.
 */
export class DistrictNamer {
  #asker: Asker
  #registry: NameRegistry
  #progress: Progress
  #standIn: Narrator | undefined

  constructor(options: DistrictNamerOptions) {
    this.#asker = options.asker
    this.#registry = options.registry
    this.#progress = options.progress
    this.#standIn = options.standIn
  }

  async write(requests: readonly DistrictRequest[]): Promise<Result<string[], ScribeFailure>> {
    if (!requests.length) return ok([])
    this.#progress.open('city', requests.length, `${requests.length} districts`)
    const written = await this.#ask(requests)
    if (written.ok) return ok(this.#counted(requests.map((request) => written.value.get(label(request))!)))

    const spare = answered(await this.#standIn?.nameDistricts?.(requests))
    return spare ? ok(this.#counted([...spare])) : err(written.error)
  }

  /** Every part named once, published as it goes. */
  #counted(names: string[]): string[] {
    for (const name of names) this.#progress.finished(name)
    return names
  }

  /** One call: the names by label. Every part is in it exactly once, and no two of them alike. */
  async #ask(requests: readonly DistrictRequest[]): Promise<Result<ReadonlyMap<string, string>, ScribeFailure>> {
    const labels = requests.map(label)
    const first = requests[0]!
    const town = requests.reduce((sum, one) => sum + one.blocks, 0)
    const answer = await this.#asker.ask(
      districtsTool(labels),
      prompt('name-districts', {
        cityName: this.#registry.cityName,
        theme: first.theme,
        premise: first.premise ?? prompt('no-history'),
        districts: bullets(
          requests.map((request) => `${label(request)}: ${sizeOf(request.blocks, town)} of the town, ${whereOf(request)}`),
          'None.',
        ),
      }),
      { at: 'districts', what: 'the names of the parts of the city' },
      (value) => [...labelProblems(value, labels), ...repeatProblems(value)],
    )
    return answer.ok ? ok(new Map(answer.value.districts.map((one) => [one.district, one.name]))) : err(answer.error)
  }
}

const label = (request: DistrictRequest): string => `d${request.index}`

/** How much of the town a part holds, in the words somebody would use rather than a count of blocks. */
function sizeOf(blocks: number, town: number): string {
  const share = blocks / town
  if (share > 0.6) return 'most'
  if (share > 0.4) return 'about half'
  if (share > 0.28) return 'about a third'
  if (share > 0.2) return 'about a quarter'
  if (share > 0.12) return 'about a fifth'
  return 'a small corner'
}

/** Which way a part lies, said the way somebody standing in the middle of town would say it. */
const whereOf = (request: DistrictRequest): string =>
  request.bearing === 'middle' ? 'in the middle of it' : `on its ${request.bearing.replace('-', ' ')} side`

/** A batch with a part missed or named twice is a batch nothing can be zipped onto. */
function labelProblems(answer: WrittenDistricts, labels: readonly string[]): Violation[] {
  return labels.flatMap((wanted) => {
    const times = answer.districts.filter((one) => one.district === wanted).length
    return times === 1 ? [] : [{ path: 'districts', message: `name part ${wanted} exactly once, not ${times} times` }]
  })
}

/** Two parts of one city called the same thing, which is a map with one place on it twice. */
function repeatProblems(answer: WrittenDistricts): Violation[] {
  const names = answer.districts.map((one) => one.name.trim().toLowerCase())
  return names.flatMap((name, at) =>
    names.indexOf(name) === at ? [] : [{ path: `districts.${at}.name`, message: `${answer.districts[at]!.name} already names another part of this city` }],
  )
}
