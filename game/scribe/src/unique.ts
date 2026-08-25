import { lastFew } from './prompts.ts'
import type { NameRegistry } from './registry.ts'
import type { Waves } from './waves.ts'

/** One pass of authoring whose answers have to end up with names of their own. */
export interface Pass<Request, Answer> {
  /** Writes one of them, told nothing but its own request and the names already spent. */
  ask(request: Request, index: number, taken: readonly string[]): Promise<Answer | undefined>
  /** The people's and things' names this answer would spend. */
  namesIn(answer: Answer): readonly string[]
  /** The signs this answer would hang, each spent by its head word as well. */
  signsIn(answer: Answer): readonly string[]
  /** The same answer, with any name the city has already spent replaced by one the fallback narrator writes. */
  repair(request: Request, index: number, answer: Answer | undefined): Promise<Answer>
}

/**
 * Runs a pass in waves and settles the names afterwards, in index order.
 *
 * Blind agents can land on the same name, and whichever of them the engine
 * happens to answer first must not be the one who keeps it, or the city changes
 * with the weather. So nothing is spent while the wave is in the air: the
 * answers come back in index order and are read in index order, the lower index
 * keeps the name, and the higher one is asked again with the taken names quoted
 * at it. A second repeat is written by the fallback narrator rather than costing
 * a third call. Which answer is re-asked is therefore a function of the indices
 * alone, and so is what it is told, which is what keeps the same seed building
 * the same city however many calls were in flight.
 */
export class UniqueNames<Request, Answer> {
  #waves: Waves
  #registry: NameRegistry
  #pass: Pass<Request, Answer>

  constructor(waves: Waves, registry: NameRegistry, pass: Pass<Request, Answer>) {
    this.#waves = waves
    this.#registry = registry
    this.#pass = pass
  }

  async write(requests: readonly Request[]): Promise<Answer[]> {
    const spent = this.#registry.names()
    const first = await this.#waves.run<Request, Answer | undefined>(requests, (request, index, earlier) =>
      this.#pass.ask(request, index, lastFew([...spent, ...earlier.flatMap((answer) => this.#allOf(answer))])),
    )

    const settled: Array<Answer | undefined> = requests.map((_, index) => this.#keep(first[index]))
    // only an answer that came back and clashed is worth asking for again: one
    // the model never gave will not arrive the second time either
    const again = settled.flatMap((answer, index) =>
      answer === undefined && first[index] !== undefined ? [index] : [],
    )

    // every retry in this wave is told the same taken list, so none of them
    // depends on which of the others came back first
    const taken = this.#registry.names()
    const second = await this.#waves.run<number, Answer | undefined>(again, (index) =>
      this.#pass.ask(requests[index]!, index, taken),
    )
    const retried = new Map(again.map((index, k) => [index, second[k]]))
    for (const [index, answer] of retried) settled[index] = this.#keep(answer)

    const out: Answer[] = []
    for (const [index, request] of requests.entries()) {
      const answer = settled[index]
      if (answer !== undefined) {
        out.push(answer)
        continue
      }
      const mended = await this.#pass.repair(request, index, retried.get(index) ?? first[index])
      this.#spend(mended)
      out.push(mended)
    }
    return out
  }

  /** Takes the answer if every name in it is free, and spends them if it does. */
  #keep(answer: Answer | undefined): Answer | undefined {
    if (answer === undefined) return undefined
    const names = this.#pass.namesIn(answer)
    const signs = this.#pass.signsIn(answer)
    const repeated = (list: readonly string[]) => list.some((name, i) => list.indexOf(name) !== i)
    if (repeated([...names, ...signs])) return undefined
    if (names.some((name) => this.#registry.taken(name))) return undefined
    if (signs.some((sign) => this.#registry.signTaken(sign))) return undefined
    this.#spend(answer)
    return answer
  }

  #spend(answer: Answer): void {
    for (const name of this.#pass.namesIn(answer)) this.#registry.add(name)
    for (const sign of this.#pass.signsIn(answer)) this.#registry.hang(sign)
  }

  #allOf(answer: Answer | undefined): readonly string[] {
    return answer === undefined ? [] : [...this.#pass.signsIn(answer), ...this.#pass.namesIn(answer)]
  }
}
