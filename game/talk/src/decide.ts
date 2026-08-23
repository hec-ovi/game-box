import { contract, ok, type Result } from '@gb/kit'
import type { Sidecar, SidecarError } from '@gb/sidecar'
import { z } from 'zod'
import { menu, picked, type Move } from './moves.ts'
import { PROMPTS } from './prompts.generated.ts'
import { fill, keyed } from './text.ts'

/** Rules that only make sense while a particular move is on the menu. */
const RULES = keyed(PROMPTS.rules)
/** The name, the wording and the one parameter of the call the model has to make. */
const TOOL = keyed(PROMPTS['decide-tool'])

/**
 * The action track: one choice from the moves that were legal when the turn
 * began, plus doing nothing, which is the first line of the menu and the answer
 * to almost every exchange. It is a forced tool call whose parameters are the
 * menu itself, so what comes back is a line number that was on the list or an
 * error, never prose to scrape and never a guess. The ids stay here, so nothing
 * the model writes can name a quest or an item that was not on the list.
 */
export class Decider {
  #sidecar: Sidecar

  constructor(sidecar: Sidecar) {
    this.#sidecar = sidecar
  }

  /**
   * What they do about this turn: the move they picked, or nothing when they
   * picked the first line. An error means the menu was never answered, and the
   * caller decides the turn some other way rather than reading it as a no.
   */
  async choose(input: {
    npcName: string
    city: string
    moves: readonly Move[]
    transcript: string
    signal?: AbortSignal | undefined
  }): Promise<Result<Move | undefined, SidecarError>> {
    const answered = await this.#sidecar.ask(choice(input.moves.length + 1), {
      signal: input.signal,
      system: fill(PROMPTS.decide, {
        name: input.npcName,
        city: input.city,
        menu: menu(input.moves),
        rules: rulesFor(input.moves),
      }),
      user: fill(PROMPTS['decide-turn'], { transcript: input.transcript }),
      toolName: TOOL.name!,
      toolDescription: fill(TOOL.description!, { name: input.npcName }),
      temperature: 0,
    })
    if (!answered.ok) return answered
    return ok(picked(input.moves, answered.value.option))
  }
}

/** The menu as a schema: one of its line numbers, and nothing else. */
function choice(lines: number) {
  return contract(
    'talk.action',
    z.object({ option: z.number().int().min(1).max(lines).describe(TOOL.option!) }),
  )
}

function rulesFor(moves: readonly Move[]): string {
  const rules = [...new Set(moves.map((move) => RULES[move.action]).filter(Boolean))]
  return rules.length ? `${rules.join('\n')}\n` : ''
}
