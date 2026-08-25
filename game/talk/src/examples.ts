import { Rng } from '@gb/kit'
import type { Situation } from './moves.ts'
import { PROMPTS } from './prompts.generated.ts'
import { fill, keyed } from './text.ts'

/** How many worked examples one turn is shown. */
const SHOWN = 3

interface Example {
  readonly ask: string
  readonly good: string
  readonly bad: string
}

const WORDS = keyed(PROMPTS.examples)
const POOL = read(WORDS)

/**
 * The few-shot half of the how-to-speak block. A different handful is drawn
 * for every turn, seeded off the world, this person and the turn count, so the
 * model never sees the same three twice running and none of them can settle in
 * as the answer.
 */
export class Examples {
  #situation: Situation

  constructor(situation: Situation) {
    this.#situation = situation
  }

  shown(turn: number): string {
    const { world, npcId } = this.#situation
    const rng = new Rng(world.seed).fork(`examples:${npcId}:${turn}`)
    return rng
      .shuffle(POOL)
      .slice(0, SHOWN)
      .map((example) =>
        [
          fill(WORDS.said!, { text: example.ask }),
          fill(WORDS.right!, { text: example.good }),
          fill(WORDS.wrong!, { text: example.bad }),
        ].join('\n'),
      )
      .join('\n')
  }
}

/** The `ask-N`, `good-N`, `bad-N` triplets, in the order they are numbered. */
function read(words: Record<string, string>): readonly Example[] {
  const out: Example[] = []
  for (let n = 1; words[`ask-${n}`]; n++) {
    out.push({ ask: words[`ask-${n}`]!, good: words[`good-${n}`] ?? '', bad: words[`bad-${n}`] ?? '' })
  }
  return out
}
