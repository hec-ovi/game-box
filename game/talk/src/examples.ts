import { Rng } from '@gb/kit'
import type { Situation } from './moves.ts'
import { PROMPTS } from './prompts.generated.ts'
import { fill, keyed } from './text.ts'

/**
 * How many worked examples a conversation is shown. Two, because the local
 * model is the one that runs the game and small models are fragile here: a
 * July 2026 shot-count study measured Llama 3.1 8B at 0.525 F1 with no
 * examples, 0.8646 with one, and 0.553 with eight, while a 70B model was best
 * with none at all. Two keeps the shape in front of a small model without
 * crowding it.
 */
const SHOWN = 2

interface Example {
  readonly ask: string
  readonly good: string
  readonly bad: string
}

const WORDS = keyed(PROMPTS.examples)
const POOL = read(WORDS)

/**
 * The few-shot half of the how-to-speak block. A handful is drawn once per
 * person, seeded off the world and their id, so two people in the same town
 * are shown different ones and none can settle in as the stock answer, and so
 * the prompt in front of one person holds still from turn to turn.
 */
export class Examples {
  #situation: Situation

  constructor(situation: Situation) {
    this.#situation = situation
  }

  shown(): string {
    const { world, npcId } = this.#situation
    const rng = new Rng(world.seed).fork(`examples:${npcId}`)
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
