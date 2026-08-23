import { ok, type Result } from '@gb/kit'
import type { Sidecar, SidecarError } from '@gb/sidecar'
import { menu, picked, type Move } from './moves.ts'
import { PROMPTS } from './prompts.generated.ts'
import { fill, keyed } from './text.ts'

/** Rules that only make sense while a particular move is on the menu. */
const RULES = keyed(PROMPTS.rules)

/** What came back from the action track. An unanswered turn is not a decision to do nothing. */
export interface Decision {
  readonly answered: boolean
  readonly move?: Move
}

/**
 * The action track: one choice from the moves that were legal when the turn
 * began, plus doing nothing, which is the first line of the menu and the answer
 * to almost every exchange. The model picks a number; the ids stay here, so
 * nothing it writes can name a quest or an item that was not on the list.
 */
export class Decider {
  #sidecar: Sidecar

  constructor(sidecar: Sidecar) {
    this.#sidecar = sidecar
  }

  async choose(input: {
    npcName: string
    city: string
    moves: readonly Move[]
    transcript: string
    signal?: AbortSignal | undefined
  }): Promise<Result<Decision, SidecarError>> {
    const stream = await this.#sidecar.converse({
      signal: input.signal,
      system: fill(PROMPTS.decide, {
        name: input.npcName,
        city: input.city,
        menu: menu(input.moves),
        rules: rulesFor(input.moves),
      }),
      messages: [{ role: 'user', content: fill(PROMPTS['decide-turn'], { transcript: input.transcript }) }],
      temperature: 0,
    })
    if (!stream.ok) return stream

    let answer = ''
    for await (const event of stream.value) {
      if (event.kind === 'text') answer += event.text
    }
    if (!answer.trim()) return ok({ answered: false })

    const move = picked(input.moves, number(answer))
    return ok(move ? { answered: true, move } : { answered: true })
  }
}

function rulesFor(moves: readonly Move[]): string {
  const rules = [...new Set(moves.map((move) => RULES[move.action]).filter(Boolean))]
  return rules.length ? `${rules.join('\n')}\n` : ''
}

/** The first number in the answer. Anything else reads as doing nothing. */
function number(answer: string): number {
  const found = /\d+/.exec(answer)
  return found ? Number(found[0]) : 1
}
