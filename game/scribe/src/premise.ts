import { OfflineNarrator, type History, type Narrator } from '@gb/forge'
import { SHIPPED_CHARTERS, type Asks, type Premise } from '@gb/world'
import { askedLines, type Asked } from './asked.ts'
import type { Asker, Violation } from './asker.ts'
import { CharterWriter, declared, onPresets } from './charters.ts'
import { prompt } from './prompts.ts'
import { WRITE_PREMISE } from './tools.ts'

/** The first question of a build: the theme, the seed, and whatever the owner typed beyond them. */
export interface PremiseInput extends Asked {
  readonly theme: string
  readonly seed: string
  readonly brief?: string
  readonly asks?: Asks
}

export interface PremiseWriterOptions {
  readonly asker: Asker
  readonly fallback: Narrator
  readonly charters: CharterWriter
}

/**
 * Writes the city's history: the first call of a build, made before a street is
 * laid, and the one every later call is written against.
 *
 * The whole town is downstream of this answer. The mix of buildings is pushed
 * towards what the history wants, the doors that open are the ones it demands,
 * every place that opens is written knowing it, and the main line is about what
 * it says is at stake. So a history the town cannot be built out of is worse
 * than no history at all, which is why an answer that names no buildings, or
 * whose two sides are one side twice, goes back to the model with the reason
 * before the town falls back to the one the seed composes.
 *
 * A history may build the town out of a kind of place no preset is. Each such
 * word is asked for next as a charter, and the history hands back only the
 * words the town can raise: a kind the model named and then would not write
 * is taken out of `build` rather than handed on for the forge to drop.
 */
export class PremiseWriter {
  #asker: Asker
  #fallback: Narrator
  #charters: CharterWriter

  constructor(options: PremiseWriterOptions) {
    this.#asker = options.asker
    this.#fallback = options.fallback
    this.#charters = options.charters
  }

  async write(input: PremiseInput): Promise<History> {
    const written = await this.#asker.ask(
      WRITE_PREMISE,
      prompt('write-premise', {
        theme: input.theme,
        seed: input.seed,
        asked: askedLines(input, ['brief', 'tone', 'mainQuest', 'look']) || prompt('asked-nothing'),
        kinds: SHIPPED_CHARTERS.map((charter) => charter.word).join(', '),
      }),
      'premise',
      problemsWith,
    )
    if (!written) return this.#spare(input)
    const folded = onPresets(written)
    const charters = await this.#charters.write(folded, input.theme, input)
    const premise = declared(folded, charters)
    return charters.length ? { ...premise, charters } : premise
  }

  /**
   * The history a town gets when the model writes none: the fallback narrator's
   * own, or the offline narrator's when the fallback writes no history at all.
   * A build with the model on never leaves a town with less story than the same
   * build with it off, the same way it never leaves one with fewer quests.
   */
  async #spare(input: PremiseInput): Promise<History> {
    const written = await this.#fallback.writePremise?.(input)
    return written ?? (await new OfflineNarrator(input.seed).writePremise(input))
  }
}

/**
 * Everything wrong with a history that its schema alone cannot refuse. The
 * schema says a premise has these fields; whether what is in them can build a
 * town is a question about the words.
 */
function problemsWith(premise: Premise): Violation[] {
  const problems: Violation[] = []
  const build = premise.build

  if (premise.common.length === 0) {
    problems.push({
      path: 'common',
      message: 'say what everybody in town knows: these are the lines people on the street say to each other',
    })
  }

  const [first, second] = premise.sides
  if (first && second && plain(first.name) === plain(second.name)) {
    problems.push({
      path: 'sides.1.name',
      message:
        `${second.name} is already the first side: the main line forks between these two, so they have to be two different groups`,
    })
  }

  for (const kind of build.moreOf.filter((kind) => build.fewerOf.includes(kind))) {
    problems.push({
      path: 'build.fewerOf',
      message: `${kind} is in moreOf as well: a kind of building is either commoner here or rarer, never both`,
    })
  }

  if (build.moreOf.length === 0 && build.mustHave.length === 0) {
    problems.push({
      path: 'build',
      message:
        'name what this history means the town is built out of, in moreOf or mustHave: a history that changes no building changes no city',
    })
  }
  return problems
}

const plain = (text: string): string => text.trim().toLowerCase()
