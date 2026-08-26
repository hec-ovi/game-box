import type { DistrictRequest, Narrator } from '@gb/forge'
import type { Asker, Violation } from './asker.ts'
import type { Progress } from './progress.ts'
import { bullets, prompt } from './prompts.ts'
import type { NameRegistry } from './registry.ts'
import { districtsTool, type WrittenDistricts } from './tools.ts'

export interface DistrictNamerOptions {
  readonly asker: Asker
  /** Used for whatever the model will not name, so a city always comes out with every part of it named. */
  readonly fallback: Narrator
  readonly registry: NameRegistry
  readonly progress: Progress
}

/**
 * Names the parts of the city, all in one call.
 *
 * A city has a handful of districts, so there is never a second batch: the
 * whole cut goes out together with the town's history in front of it, which is
 * what lets one name answer another (a wharf end and a hill above it) instead
 * of each being written in the dark. A name that comes back missing, or the
 * same as another, is composed by the offline narrator instead, so the answer
 * is always one name per part with no two of them alike.
 */
export class DistrictNamer {
  #asker: Asker
  #fallback: Narrator
  #registry: NameRegistry
  #progress: Progress

  constructor(options: DistrictNamerOptions) {
    this.#asker = options.asker
    this.#fallback = options.fallback
    this.#registry = options.registry
    this.#progress = options.progress
  }

  async write(requests: readonly DistrictRequest[]): Promise<string[]> {
    if (!requests.length) return []
    this.#progress.open('city', requests.length, `${requests.length} districts`)
    const written = await this.#ask(requests)
    const spare = await this.#spare(requests)

    // what the model wrote, each name kept once, then the holes filled from the
    // composed set. There is one spare per part and no two of them are alike,
    // so a hole always has one left however many the model got right
    const taken = new Set<string>()
    const names = requests.map((request) => {
      const answer = written.get(label(request))
      if (!answer || taken.has(answer.toLowerCase())) return ''
      taken.add(answer.toLowerCase())
      return answer
    })
    for (const [index, name] of names.entries()) {
      if (name) continue
      const filled = spare.find((one) => !taken.has(one.toLowerCase())) ?? spare[index] ?? ''
      taken.add(filled.toLowerCase())
      names[index] = filled
    }
    for (const name of names) this.#progress.finished(name)
    return names
  }

  /** One call: the names by label, or none of them when the model would not write them at all. */
  async #ask(requests: readonly DistrictRequest[]): Promise<ReadonlyMap<string, string>> {
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
      'districts',
      (value) => [...labelProblems(value, labels), ...repeatProblems(value)],
    )
    return new Map((answer?.districts ?? []).map((one) => [one.district, one.name]))
  }

  /** A composed name for every part, ready for whichever ones the model left unnamed or named twice. */
  async #spare(requests: readonly DistrictRequest[]): Promise<readonly string[]> {
    return (await this.#fallback.nameDistricts?.(requests)) ?? requests.map((request) => `Part ${request.index + 1}`)
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
