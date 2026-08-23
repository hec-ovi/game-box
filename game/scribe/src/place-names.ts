import type { Narrator } from '@gb/forge'
import type { BuildingKind } from '@gb/world'
import type { Asker } from './asker.ts'
import type { Progress } from './progress.ts'
import { bullets, prompt } from './prompts.ts'
import type { NameRegistry } from './registry.ts'
import { NAME_PLACE } from './tools.ts'
import { UniqueNames, type Pass } from './unique.ts'
import type { Waves } from './waves.ts'

/** A building that does not open: a facade, a door and a sign, and nothing behind it. */
export interface PlaceRequest {
  readonly kind: BuildingKind
  readonly theme: string
}

export interface PlaceNamerOptions {
  readonly asker: Asker
  readonly waves: Waves
  readonly fallback: Narrator
  readonly registry: NameRegistry
  readonly progress: Progress
}

/** How far apart two facades' fallback streams sit, so no two of them draw the same spare sign. */
const ATTEMPTS = 40

/**
 * Names the buildings nobody walks into, several at a time.
 *
 * Most of a city is frontage, so most of the calls a model build makes are
 * signs over closed doors. They have nothing to do with each other, which makes
 * them the cheapest thing in the whole pipeline to write at once, and the names
 * still come back in the order they were asked for.
 */
export class PlaceNamer implements Pass<PlaceRequest, string> {
  #asker: Asker
  #fallback: Narrator
  #registry: NameRegistry
  #progress: Progress
  #unique: UniqueNames<PlaceRequest, string>
  #counted = new Set<number>()

  constructor(options: PlaceNamerOptions) {
    this.#asker = options.asker
    this.#fallback = options.fallback
    this.#registry = options.registry
    this.#progress = options.progress
    this.#unique = new UniqueNames(options.waves, options.registry, this)
  }

  async write(requests: readonly PlaceRequest[]): Promise<string[]> {
    this.#counted.clear()
    this.#progress.start('city', requests.length, `${requests.length} buildings`)
    return this.#unique.write(requests)
  }

  async ask(request: PlaceRequest, index: number, taken: readonly string[]): Promise<string | undefined> {
    const answer = await this.#asker.ask(
      NAME_PLACE,
      prompt('name-place', {
        kind: request.kind,
        theme: request.theme,
        cityName: this.#registry.cityName,
        usedNames: bullets(taken, 'None yet.'),
      }),
    )
    if (answer) this.#count(index, answer.name, request.kind)
    return answer?.name
  }

  namesIn(name: string): readonly string[] {
    return [name]
  }

  async repair(request: PlaceRequest, index: number, answer: string | undefined): Promise<string> {
    if (answer !== undefined && !this.#registry.taken(answer)) return answer
    const at = (attempt: number) => ({ kind: request.kind, theme: request.theme, index: index * ATTEMPTS + attempt })
    let name = await this.#fallback.namePlace(at(0))
    for (let attempt = 1; attempt <= ATTEMPTS && this.#registry.taken(name); attempt++) {
      name = await this.#fallback.namePlace(at(attempt))
    }
    this.#count(index, name, request.kind)
    return name
  }

  /** One building counts once, whether it was named first time, asked again, or mended. */
  #count(index: number, name: string, kind: BuildingKind): void {
    if (this.#counted.has(index)) return
    this.#counted.add(index)
    this.#progress.finished(`${name}, a ${kind}`)
  }
}
