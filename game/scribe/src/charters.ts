import { premiseLines } from '@gb/forge'
import { MAX_CHARTERS, SHIPPED_CHARTERS, type Charter, type Premise, type Word } from '@gb/world'
import { askedLines, type Asked } from './asked.ts'
import type { Asker, Violation } from './asker.ts'
import type { Progress } from './progress.ts'
import { prompt } from './prompts.ts'
import { charterTool } from './tools.ts'
import type { Waves } from './waves.ts'

export interface CharterWriterOptions {
  readonly asker: Asker
  readonly waves: Waves
  readonly progress: Progress
}

/** The words every town already has a charter for. */
const PRESETS: readonly Word[] = SHIPPED_CHARTERS.map((charter) => charter.word)

/** How many kinds a history may invent: the file holds `MAX_CHARTERS` and the presets take their share. */
const MOST_INVENTED = MAX_CHARTERS - PRESETS.length

/**
 * Writes the charter behind every kind of place the history invented.
 *
 * A history that says "there is a jail" has said a word the engine has no
 * table for. What it needs is the row of closed choices a jail is raised from
 * (its street face, the post at the front, the work, the rooms), and that row
 * is a decision about the town, so the model that wrote the history writes it,
 * one call per word, with the history in front of it. The tool's parameters
 * are `@gb/world`'s own charter contract with the word pinned, so what the
 * model decodes against is what the file accepts.
 *
 * The owner's own brief goes to this call as well as to the history, because
 * the charter is where the locks are decided: "a cellar nobody but the doorman
 * gets into" is `admitted`, `watch` and a `shut` room, and the history that
 * summarises the town does not carry the sentence that asked for it.
 */
export class CharterWriter {
  #asker: Asker
  #waves: Waves
  #progress: Progress

  constructor(options: CharterWriterOptions) {
    this.#asker = options.asker
    this.#waves = options.waves
    this.#progress = options.progress
  }

  /** One charter per invented word, in the order the history named them; a word the model will not write is left out. */
  async write(premise: Premise, theme: string, owner: Asked = {}): Promise<Charter[]> {
    const words = invented(premise)
    if (words.length === 0) return []
    this.#progress.open('history', words.length, words.join(', '))
    const history = premiseLines(premise)
    const written = await this.#waves.run<Word, Charter | undefined>(words, async (word) => {
      const charter = await this.#asker.ask(
        charterTool(word),
        prompt('write-charter', {
          word,
          theme,
          premise: history,
          asked: askedLines(owner, ['brief']),
          presets: PRESETS.join(', '),
        }),
        `charter:${word}`,
        problemsWith,
      )
      this.#progress.finished(charter ? `a ${charter.label}` : `no ${word}`)
      return charter
    })
    return written.flatMap((charter) => (charter ? [charter] : []))
  }
}

/**
 * The preset a word names, plural or not. Measured: a history asked for "more
 * of hotels, bars" and "fewer of shops, markets, cafes", and every one of those
 * would have cost a charter call and doubled a kind the town already had.
 */
function presetOf(word: Word): Word | undefined {
  return PRESETS.find((preset) => word === preset || word === `${preset}s` || word === `${preset}es`)
}

/** The history's `build` with every preset written by its own word. */
export function onPresets(premise: Premise): Premise {
  const fold = (words: readonly Word[]) => [...new Set(words.map((word) => presetOf(word) ?? word))]
  const build = premise.build
  return { ...premise, build: { moreOf: fold(build.moreOf), fewerOf: fold(build.fewerOf), mustHave: fold(build.mustHave) } }
}

/** The words the history's `build` names that no preset declares, each once, as many as the file holds. */
export function invented(premise: Premise): Word[] {
  const words: Word[] = []
  for (const word of [...premise.build.mustHave, ...premise.build.moreOf, ...premise.build.fewerOf]) {
    if (!PRESETS.includes(word) && !words.includes(word)) words.push(word)
  }
  return words.slice(0, MOST_INVENTED)
}

/** The history with `build` held to the words the town can raise: the presets and the charters written. */
export function declared(premise: Premise, charters: readonly Charter[]): Premise {
  const known = new Set([...PRESETS, ...charters.map((charter) => charter.word)])
  const keep = (words: readonly Word[]) => words.filter((word) => known.has(word))
  const build = premise.build
  return { ...premise, build: { moreOf: keep(build.moreOf), fewerOf: keep(build.fewerOf), mustHave: keep(build.mustHave) } }
}

/** What the schema cannot say: a blade with nothing on it, and a template that puts one sign over every door. */
function problemsWith(charter: Charter): Violation[] {
  const problems: Violation[] = []
  if (!/[A-Z0-9]/.test(charter.blade)) {
    problems.push({ path: 'blade', message: 'write the word the sign spells down the front: capitals and digits' })
  }
  for (const [i, template] of charter.names.entries()) {
    if (!/\{(?:family|adjective|noun)\}/.test(template)) {
      problems.push({
        path: `names.${i}`,
        message: `${template} has no slot: put {family}, {adjective} or {noun} in it, or every sign of this kind reads the same`,
      })
    }
  }
  return problems
}
