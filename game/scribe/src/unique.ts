import { err, ok, type Result } from '@gb/kit'
import type { ScribeFailure } from './failure.ts'
import { lastFew } from './prompts.ts'
import type { NameRegistry } from './registry.ts'
import type { Waves } from './waves.ts'

/** One pass of authoring whose answers have to end up with names of their own. */
export interface Pass<Request, Answer> {
  /** Writes one of them, told nothing but its own request and the names already spent. */
  ask(request: Request, index: number, taken: readonly string[]): Promise<Result<Answer, ScribeFailure>>
  /** The people's and things' names this answer would spend. */
  namesIn(answer: Answer): readonly string[]
  /** The signs this answer would hang, each spent by its head word as well. */
  signsIn(answer: Answer): readonly string[]
  /**
   * The same answer with every spent name written again by the stand-in a
   * caller handed in, or nothing where there is no stand-in. Nothing in the
   * game hands one in, so this is normally nothing and the clash is a failure.
   */
  mend(request: Request, index: number, answer: Answer | undefined): Promise<Answer | undefined>
}

/**
 * Runs a pass in waves and settles the names afterwards, in index order.
 *
 * Blind agents can land on the same name, and whichever of them the engine
 * happens to answer first must not be the one who keeps it, or the city changes
 * with the weather. So nothing is spent while the wave is in the air: the
 * answers come back in index order and are read in index order, the lower index
 * keeps the name, and the higher one is asked again with the taken names quoted
 * at it. A name the model spends twice even then stops the pass, so the city
 * never quietly gets a name nobody asked the model for. Which answer is re-asked
 * is a function of the indices alone, and so is what it is told, which is what
 * keeps the same seed building the same city however many calls were in flight.
 *
 * A name the model spends twice even after that retry is kept anyway: two
 * doors with one word on them is worth a retry and not worth a city.
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

  async write(requests: readonly Request[]): Promise<Result<Answer[], ScribeFailure>> {
    type Written = Result<Answer, ScribeFailure>
    const spent = this.#registry.names()
    const first = await this.#waves.run<Request, Written>(requests, (request, index, earlier) =>
      this.#pass.ask(request, index, lastFew([...spent, ...earlier.flatMap((answer) => this.#allOf(answer))])),
    )

    const settled: Array<Answer | undefined> = first.map((answer) => this.#keep(answer))
    // only an answer that came back and clashed is worth asking for again: one
    // the model never gave will not arrive the second time either
    const again = settled.flatMap((answer, index) => (answer === undefined && first[index]!.ok ? [index] : []))

    // every retry in this wave is told the same taken list, so none of them
    // depends on which of the others came back first
    const taken = this.#registry.names()
    const second = await this.#waves.run<number, Written>(again, (index) => this.#pass.ask(requests[index]!, index, taken))
    const retried = new Map(again.map((index, k) => [index, second[k]!]))
    for (const [index, answer] of retried) settled[index] = this.#keep(answer)

    const out: Answer[] = []
    for (const [index, request] of requests.entries()) {
      const answer = settled[index]
      if (answer !== undefined) {
        out.push(answer)
        continue
      }
      const last = retried.get(index) ?? first[index]!
      const mended = await this.#pass.mend(request, index, last.ok ? last.value : undefined)
      if (mended !== undefined) {
        this.#spend(mended)
        out.push(mended)
        continue
      }
      // A name over two doors is a blemish on a street. The retry above is
      // what the rule is worth; the city is not. So an answer that still
      // repeats a name is taken as it stands, and only a call that never
      // answered stops the pass.
      if (!last.ok) return err(last.error)
      this.#spend(last.value)
      out.push(last.value)
    }
    return ok(out)
  }

  /** Takes the answer if every name in it is free, and spends them if it does. */
  #keep(answer: Result<Answer, ScribeFailure>): Answer | undefined {
    if (!answer.ok) return undefined
    const names = this.#pass.namesIn(answer.value)
    const signs = this.#pass.signsIn(answer.value)
    const repeated = (list: readonly string[]) => list.some((name, i) => list.indexOf(name) !== i)
    if (repeated([...names, ...signs])) return undefined
    if (names.some((name) => this.#registry.taken(name))) return undefined
    if (signs.some((sign) => this.#registry.signTaken(sign))) return undefined
    this.#spend(answer.value)
    return answer.value
  }

  #spend(answer: Answer): void {
    for (const name of this.#pass.namesIn(answer)) this.#registry.add(name)
    for (const sign of this.#pass.signsIn(answer)) this.#registry.hang(sign)
  }

  #allOf(answer: Result<Answer, ScribeFailure>): readonly string[] {
    return answer.ok ? [...this.#pass.signsIn(answer.value), ...this.#pass.namesIn(answer.value)] : []
  }
}
