import type { Narrator, PlaceNeed, PlaceRequest } from '@gb/forge'
import { err, ok, type Result } from '@gb/kit'
import type { Charter, Word } from '@gb/world'
import { allot, demandOf, type Demand, type SettledNeed } from './allot.ts'
import type { Asker, Violation } from './asker.ts'
import { kindLine } from './charter-lines.ts'
import { settledLine, standingLine } from './door-lines.ts'
import type { ScribeFailure } from './failure.ts'
import { doorLabel, needLabel } from './labels.ts'
import type { Progress } from './progress.ts'
import { bullets, prompt } from './prompts.ts'
import { answered } from './stand-in.ts'
import { needsTool, placesTool, type DoorSlot, type NeedSlot, type WrittenPlaces } from './tools.ts'

/** What the writer is shown and asked: the doors, the kinds the city declares, and what the town needs of them. */
export interface PlacesInput {
  readonly theme: string
  readonly premise?: string
  readonly kinds: readonly Charter[]
  readonly needs: readonly PlaceNeed[]
  readonly places: readonly PlaceRequest[]
}

export interface PlaceWriterOptions {
  readonly asker: Asker
  readonly progress: Progress
  /** Only where a caller handed one in. Nothing in the game does. */
  readonly standIn?: Narrator | undefined
}

/**
 * Says what each of the town's open doors is.
 *
 * This is the stage that decides a city's locations. The architecture cut the
 * doors and put nothing behind them, and until this answers there is no bar, no
 * station and nobody's home in the town. Everything behind those doors is then
 * built to the answer, so a word off the closed list is unwritable rather than
 * corrected: every door decodes against the charters the city carries.
 *
 * It is two calls, because what the town needs is settled before any door is
 * filled in. The first asks which kind of place answers each need, in words;
 * the doors that hold them are then picked from the architecture and pinned to
 * that word in the second call's own schema. So a town gets what it needs by
 * construction: there is no answer left that boards nowhere or sells nothing.
 */
export class PlaceWriter {
  #asker: Asker
  #progress: Progress
  #standIn: Narrator | undefined

  constructor(options: PlaceWriterOptions) {
    this.#asker = options.asker
    this.#progress = options.progress
    this.#standIn = options.standIn
  }

  /** One word per door, in the order they were asked about. */
  async write(input: PlacesInput): Promise<Result<Word[], ScribeFailure>> {
    if (!input.places.length) return ok([])
    this.#progress.open('places', input.places.length, `${input.places.length} doors`)

    const settled = await this.#settle(input)
    if (!settled.ok) return this.#spare(input, settled.error)

    const demand = demandOf(settled.value)
    const written = await this.#doors(input, demand, allot(demand, input.places, input.kinds))
    if (!written.ok) return this.#spare(input, written.error)
    return ok(this.#published(written.value, input.kinds))
  }

  /**
   * The kind of place that answers each thing the town needs.
   *
   * A town that needs nothing in particular skips the call: there is nothing to
   * settle, and every door is the writing's own free choice.
   */
  async #settle(input: PlacesInput): Promise<Result<SettledNeed[], ScribeFailure>> {
    const needs = slotsOf(input.needs, input.places.length)
    if (!needs.length) return ok([])

    const answer = await this.#asker.ask(
      needsTool(needs, input.kinds.map((charter) => charter.word)),
      prompt('settle-needs', {
        theme: input.theme,
        premise: input.premise ?? prompt('no-history'),
        doors: `${input.places.length}`,
        kinds: bullets(input.kinds.map(kindLine), 'None.'),
        needs: bullets(needs.map((need) => `${need.label}: ${need.wants}, behind ${counted(need.count)}`), 'Nothing in particular.'),
      }),
      { at: 'needs', what: 'the kinds of place the town needs behind its doors' },
    )
    if (!answer.ok) return err(answer.error)
    return ok(needs.map((need) => ({ wants: need.wants, count: need.count, word: answer.value.needs[need.label]! })))
  }

  /**
   * What the doors are, with the ones the needs took already settled.
   *
   * A town whose every door is spoken for is not asked: the words are the ones
   * the writing already chose, and a call whose whole answer is constants asks
   * nothing of anybody.
   */
  async #doors(input: PlacesInput, demand: readonly Demand[], spoken: ReadonlyMap<number, Demand>): Promise<Result<Word[], ScribeFailure>> {
    const doors: DoorSlot[] = input.places.map((place) => {
      const settled = spoken.get(place.index)
      return { label: doorLabel(place.index), ...(settled ? { kind: settled.word } : {}) }
    })
    if (doors.every((door) => door.kind)) return ok(doors.map((door) => door.kind!))

    const answer = await this.#asker.ask(
      placesTool(doors, input.kinds.map((charter) => charter.word)),
      prompt('write-places', {
        theme: input.theme,
        premise: input.premise ?? prompt('no-history'),
        kinds: bullets(input.kinds.map(kindLine), 'None.'),
        buildings: bullets(input.places.map((place) => `${doorLabel(place.index)}: ${this.#doorLine(place, spoken.get(place.index), input.kinds)}`), 'None.'),
      }),
      { at: 'places', what: "the kinds of place behind the town's open doors" },
      (value) => shortOf(value, demand, spoken),
    )
    return answer.ok ? ok(doors.map((door) => answer.value.places[door.label]!)) : err(answer.error)
  }

  /** One door in the words the prompt reads: where it stands, and what it already is where a need took it. */
  #doorLine(place: PlaceRequest, settled: Demand | undefined, kinds: readonly Charter[]): string {
    if (!settled) return standingLine(place)
    return settledLine(place, labelOf(settled.word, kinds), settled.wants)
  }

  /** Every door, published as what it turned out to be. */
  #published(words: Word[], kinds: readonly Charter[]): Word[] {
    for (const word of words) this.#progress.finished(`a ${labelOf(word, kinds)}`)
    return words
  }

  /** The answer a caller handed in a stand-in for, where one was handed in at all. */
  async #spare(input: PlacesInput, failure: ScribeFailure): Promise<Result<Word[], ScribeFailure>> {
    const spare = answered(await this.#standIn?.writePlaces(input))
    return spare ? ok(this.#published([...spare], input.kinds)) : err(failure)
  }
}

/** The needs as the tool is built around them: a label each, and never more doors than the town has. */
function slotsOf(needs: readonly PlaceNeed[], doors: number): NeedSlot[] {
  return needs.map((need, at) => ({
    label: needLabel(at),
    wants: need.wants,
    // a town cannot answer a need with more doors than it opens, and a count
    // nothing could satisfy would stop the build over arithmetic rather than
    // over anything the model wrote
    count: Math.min(need.count, doors),
    ...(need.kind === undefined ? {} : { kind: need.kind }),
  }))
}

/**
 * What the town needs and did not get.
 *
 * The pin puts this out of reach: a door a need took decodes to that word and
 * to nothing else, so the count is met before the model writes a character. It
 * is still read off the answer, because a town getting what it needs is the
 * whole of what this stage promises, and a promise worth making is one that can
 * be checked where it lands rather than only where it was asked for.
 */
function shortOf(answer: WrittenPlaces, demand: readonly Demand[], spoken: ReadonlyMap<number, Demand>): Violation[] {
  const written = Object.values(answer.places)
  const problems: Violation[] = []
  for (const owed of demand) {
    const doors = [...spoken.values()].filter((settled) => settled.word === owed.word).length
    const built = written.filter((word) => word === owed.word).length
    if (built < doors) {
      problems.push({
        path: 'places',
        message: `the town needs ${owed.wants.join(', and ')}, behind ${counted(doors)}, and ${built} of these buildings ${built === 1 ? 'is' : 'are'} a ${owed.word}`,
      })
    }
  }
  return problems
}

/** What a kind of place is called out loud, for a line somebody reads. */
const labelOf = (word: Word, kinds: readonly Charter[]): string => kinds.find((charter) => charter.word === word)?.label ?? word

/** A count of doors in the words a sentence reads in. */
const counted = (count: number): string => (count === 1 ? 'one of these doors' : `${count} of these doors`)
