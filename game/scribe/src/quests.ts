import type { Narrator } from '@gb/forge'
import { err, ok, type Result } from '@gb/kit'
import { compileQuest } from '@gb/quest'
import { askedLines } from './asked.ts'
import type { Asker, Violation } from './asker.ts'
import type { ScribeFailure } from './failure.ts'
import { openTheWay, toldPath } from './keys.ts'
import { describeSlice, idsOf, Neighbourhood, type Slice } from './neighbourhood.ts'
import type { Progress } from './progress.ts'
import { bullets, lastFew, prompt } from './prompts.ts'
import { reachProblems } from './reach.ts'
import { rewardBands } from './reward-bands.ts'
import { billFor } from './spend.ts'
import { answered } from './stand-in.ts'
import { CitySummary, type QuestSummary } from './summary.ts'
import { questTool, type QuestSheet } from './tools.ts'
import type { Waves } from './waves.ts'
import { CornerWords, wordingProblems } from './wording.ts'

/** How much of the city one quest is shown. Enough to write about, short enough to send on every call. */
const PLACES_PER_QUEST = 8

/** What the quest writer is asked: the city, and how many jobs beside the main one. */
export interface QuestInput {
  readonly summary: QuestSummary
  readonly sideQuests: number
}

interface Written {
  readonly quest: unknown
  readonly title: string
}

export interface QuestWriterOptions {
  readonly asker: Asker
  readonly waves: Waves
  readonly progress: Progress
  readonly seed: string
  /** What the instance pass said each place is, by name, for the places this quest is set among. */
  readonly characters: ReadonlyMap<string, string>
  /** Told when a side errand is lost, so the caller can report a city one job short. */
  readonly dropped: (failure: ScribeFailure) => void
  /** Only where a caller handed one in. Nothing in the game does. */
  readonly standIn?: Narrator | undefined
}

/**
 * Writes the city's quests, one model call each.
 *
 * A small model writes a better single quest than a batch, and a call that fails
 * costs one quest rather than all of them. Each draft is checked here against
 * the same ids the model was shown, and one that will not hold up comes back to
 * the model with the reason.
 *
 * What a slot the model cannot fill costs depends on which slot it is. The main
 * line is the city's spine, so losing it stops the stage. A side errand is one
 * job out of a dozen: it is dropped, the reason goes to the caller to report,
 * and the rest of the town stands. Measured: one side job priced under its band
 * refused a whole 3x3 city, which left the owner with nothing at all over an
 * errand nobody would have missed.
 *
 * The calls run in waves, so a city's quests are written several at a time
 * without their order ever depending on which answer landed first.
 */
export class QuestWriter {
  #asker: Asker
  #waves: Waves
  #progress: Progress
  #seed: string
  #characters: ReadonlyMap<string, string>
  #dropped: (failure: ScribeFailure) => void
  #standIn: Narrator | undefined
  #spare?: Promise<readonly unknown[]>

  constructor(options: QuestWriterOptions) {
    this.#asker = options.asker
    this.#waves = options.waves
    this.#progress = options.progress
    this.#seed = options.seed
    this.#characters = options.characters
    this.#dropped = options.dropped
    this.#standIn = options.standIn
  }

  async write(input: QuestInput): Promise<Result<unknown[], ScribeFailure>> {
    const city = new CitySummary(input.summary)
    // nobody to hand work out: there is no question to ask the model, so there
    // is nothing here for it to have failed at
    if (city.peopled().length === 0) return ok([...(await this.#spareQuests(input))])

    const total = Math.max(1, input.sideQuests + 1)
    const slots = Array.from({ length: total }, (_, index) => index)
    const corners = new Neighbourhood(city.peopled(), this.#seed)
    this.#progress.open('quests', total, `${total} to write`)

    const written = await this.#waves.run<number, Result<Written, ScribeFailure>>(slots, async (_, index, earlier) => {
      const id = questId(index)
      const slice = corners.for(index, PLACES_PER_QUEST)
      // what this corner is called, which is what the lines the model writes
      // about it are held to
      const words = new CornerWords(slice.places, city.districts)
      // the compiled quest, which is the flow built out of the beats with its
      // pay settled into the band its tier allows: that is the quest the city
      // gets, never the sheet this box happened to send
      let accepted: unknown
      const sheet = await this.#asker.ask(
        questTool(idsOf(slice)),
        this.#brief(city, slice, index, total, earlier),
        { at: `quest:${index}`, what: index === 0 ? 'the main line' : `side job ${index}` },
        (value) => {
          const outcome = compiled(value, id, city, words)
          if (outcome.quest) accepted = outcome.quest
          return outcome.problems
        },
      )
      if (sheet.ok) {
        this.#progress.finished(sheet.value.title)
        return ok({ quest: accepted, title: sheet.value.title })
      }

      const spare = (await this.#spareQuests(input)).find((quest) => fieldOf(quest, 'id') === id)
      this.#progress.finished(spare ? fieldOf(spare, 'title') : 'nothing this time')
      return spare ? ok({ quest: spare, title: fieldOf(spare, 'title') }) : err(sheet.error)
    })

    // the main line first: a city without its spine is not the city that was
    // asked for, so that one is worth stopping the build over
    const main = written[0]
    if (main && !main.ok) return err(main.error)

    const quests: unknown[] = []
    for (const entry of written) {
      if (entry.ok) quests.push(entry.value.quest)
      else this.#dropped(entry.error)
    }
    return ok(quests)
  }

  #brief(
    city: CitySummary,
    slice: Slice,
    index: number,
    total: number,
    earlier: readonly Result<Written, ScribeFailure>[],
  ): string {
    const owner = { asks: city.asks }
    const role =
      index === 0
        ? prompt('quest-role-main', { asked: askedLines(owner, ['mainQuest']) })
        : prompt('quest-role-side', {
            sideIndex: index,
            sideTotal: total - 1,
            asked: askedLines(owner, ['sideQuests']),
          })
    return prompt('write-quest', {
      cityName: city.cityName,
      theme: city.theme,
      premise: city.history,
      asked: askedLines(owner, ['tone']),
      questId: questId(index),
      questKind: index === 0 ? 'main' : 'side',
      questRole: role,
      home: slice.home.name,
      places: describeSlice(slice, this.#characters, city.districts),
      rewardBands: rewardBands(),
      usedTitles: bullets(
        lastFew(earlier.flatMap((entry) => (entry.ok && entry.value.title ? [entry.value.title] : []))),
        'None yet.',
      ),
    })
  }

  /** The stand-in's whole set, asked for once and shared by every slot that needs one. Nothing in the game hands one in. */
  #spareQuests(input: QuestInput): Promise<readonly unknown[]> {
    this.#spare ??= Promise.resolve(this.#standIn?.writeQuests(input)).then((quests) => answered(quests) ?? [])
    return this.#spare
  }
}

function questId(index: number): string {
  return `quest_${String(index + 1).padStart(4, '0')}`
}

function fieldOf(quest: unknown, name: 'id' | 'title'): string {
  const value = (quest as Record<string, unknown>)[name]
  return typeof value === 'string' ? value : ''
}

/**
 * The beats compiled into a quest `@gb/quest` accepts, or everything wrong with
 * them in the words the model gets back: first the beat the compiler could not
 * honour, then, on a flow it built, what the harness would refuse at a lock, a
 * screen or a counter. Every complaint points at the beat the writer wrote,
 * never at one this box put in.
 *
 * Two things go on before compiling, because both are the city's arithmetic
 * rather than the writer's: the way past every lock the beats walk into, and
 * the money for what the job buys.
 */
function compiled(answer: QuestSheet, id: string, city: CitySummary, words: CornerWords): { problems: Violation[]; quest?: unknown } {
  // the words first, against the beats as the model wrote them: every one of
  // these complaints is already pointed at a beat of the writer's own, so none
  // of them goes through `told`
  const problems: Violation[] = wordingProblems(answer.beats, words)
  if (answer.id !== id) problems.push({ path: 'id', message: `this quest's id is ${id}` })

  const opened = openTheWay(answer.beats, city.locks)
  const bill = billFor(opened.beats, city.locks)
  const sheet = {
    ...answer,
    beats: opened.beats,
    ...(bill > 0 ? { requires: [{ kind: 'money-at-least' as const, amount: bill }] } : {}),
  }
  const told = (violation: Violation): Violation => ({ ...violation, path: toldPath(violation.path, opened.toldAt) })

  const built = compileQuest(sheet, city.view())
  if (!built.ok) {
    const error = built.error
    const found = error.code === 'invalid-sheet' ? error.violations : error.problems.map((one) => ({ path: one.where, message: one.message }))
    return { problems: [...problems, ...found.map(told)] }
  }

  const walk = reachProblems(built.value.quest, city.locks, built.value.beatOf).map(told)
  return walk.length || problems.length ? { problems: [...problems, ...walk] } : { problems, quest: built.value.quest }
}
