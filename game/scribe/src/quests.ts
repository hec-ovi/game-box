import type { Narrator } from '@gb/forge'
import { sealQuest, validateQuest } from '@gb/quest'
import { askedLines } from './asked.ts'
import type { Asker, Violation } from './asker.ts'
import { describeSlice, Neighbourhood } from './neighbourhood.ts'
import type { Progress } from './progress.ts'
import { bullets, lastFew, prompt } from './prompts.ts'
import { rewardBands } from './reward-bands.ts'
import { CitySummary, type QuestSummary, type SummaryView } from './summary.ts'
import { WRITE_QUEST, type QuestDraft } from './tools.ts'
import type { Waves } from './waves.ts'

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
  readonly fallback: Narrator
  readonly progress: Progress
  readonly seed: string
  /** What the instance pass said each place is, by name, for the places this quest is set among. */
  readonly characters: ReadonlyMap<string, string>
}

/**
 * Writes the city's quests, one model call each.
 *
 * A small model writes a better single quest than a batch, and a call that fails
 * costs one quest rather than all of them. Each draft is checked here against
 * the same ids the model was shown: a draft that will not hold up comes back to
 * the model with the reason, and a quest the model cannot get right in the end
 * is written by the offline narrator instead, so a slot always has a quest in
 * it. The calls run in waves, so a city's quests are written several at a time
 * without their order ever depending on which answer landed first.
 */
export class QuestWriter {
  #asker: Asker
  #waves: Waves
  #fallback: Narrator
  #progress: Progress
  #seed: string
  #characters: ReadonlyMap<string, string>
  #offline?: Promise<readonly unknown[]>

  constructor(options: QuestWriterOptions) {
    this.#asker = options.asker
    this.#waves = options.waves
    this.#fallback = options.fallback
    this.#progress = options.progress
    this.#seed = options.seed
    this.#characters = options.characters
  }

  async write(input: QuestInput): Promise<unknown[]> {
    const city = new CitySummary(input.summary)
    if (city.peopled().length === 0) return [...(await this.#offlineQuests(input))]

    const view = city.view()
    const total = Math.max(1, input.sideQuests + 1)
    const slots = Array.from({ length: total }, (_, index) => index)
    const corners = new Neighbourhood(city.peopled(), this.#seed)
    this.#progress.open('quests', total, `${total} to write`)

    const written = await this.#waves.run<number, Written | undefined>(slots, async (_, index, earlier) => {
      const id = questId(index)
      const draft = await this.#asker.ask(
        WRITE_QUEST,
        this.#brief(city, corners, index, total, earlier),
        `quest:${index}`,
        (value) => problemsWith(value, id, view),
      )
      if (draft) {
        this.#progress.finished(draft.title)
        return { quest: sealQuest(draft), title: draft.title }
      }

      const spare = (await this.#offlineQuests(input)).find((quest) => fieldOf(quest, 'id') === id)
      this.#progress.finished(spare ? fieldOf(spare, 'title') : 'nothing this time')
      return spare ? { quest: spare, title: fieldOf(spare, 'title') } : undefined
    })

    return written.filter((entry): entry is Written => entry !== undefined).map((entry) => entry.quest)
  }

  #brief(
    city: CitySummary,
    corners: Neighbourhood,
    index: number,
    total: number,
    earlier: readonly (Written | undefined)[],
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
    const slice = corners.for(index, PLACES_PER_QUEST)
    return prompt('write-quest', {
      cityName: city.cityName,
      theme: city.theme,
      premise: city.history,
      asked: askedLines(owner, ['tone']),
      questId: questId(index),
      questKind: index === 0 ? 'main' : 'side',
      questRole: role,
      home: slice.home.name,
      places: describeSlice(slice, this.#characters),
      rewardBands: rewardBands(),
      usedTitles: bullets(
        lastFew(earlier.flatMap((entry) => (entry?.title ? [entry.title] : []))),
        'None yet.',
      ),
    })
  }

  /** The offline narrator's whole set, asked for once and shared by every slot that needs one. */
  #offlineQuests(input: QuestInput): Promise<readonly unknown[]> {
    this.#offline ??= Promise.resolve(this.#fallback.writeQuests(input)).then((quests) => quests ?? [])
    return this.#offline
  }
}

function questId(index: number): string {
  return `quest_${String(index + 1).padStart(4, '0')}`
}

function fieldOf(quest: unknown, name: 'id' | 'title'): string {
  const value = (quest as Record<string, unknown>)[name]
  return typeof value === 'string' ? value : ''
}

/** Everything wrong with a draft, in the words the model gets back. */
function problemsWith(draft: QuestDraft, id: string, view: SummaryView): Violation[] {
  const problems: Violation[] = []
  if (draft.id !== id) problems.push({ path: 'id', message: `this quest's id is ${id}` })

  const checked = validateQuest(sealQuest(draft), view)
  if (!checked.ok) {
    const error = checked.error
    if ('violations' in error) problems.push(...error.violations)
    if ('problems' in error) {
      problems.push(...error.problems.map((entry) => ({ path: entry.where, message: entry.message })))
    }
  }
  return problems
}
