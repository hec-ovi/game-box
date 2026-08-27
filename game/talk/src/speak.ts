import { contract, ok, type Result } from '@gb/kit'
import type { Sidecar, SidecarError } from '@gb/sidecar'
import { z } from 'zod'
import { MOODS, type Mood } from './memory.ts'
import { PROMPTS } from './prompts.generated.ts'
import { scrub } from './redact.ts'
import { fill, keyed } from './text.ts'

/** The name, the wording and the fields of the call the voice track has to make. */
const TOOL = keyed(PROMPTS['turn-tool'])

/** One spoken turn as the model reported it. */
export interface TurnReply {
  readonly does?: string | undefined
  readonly says: string
  readonly reveals?: number | undefined
  readonly remembers?: readonly string[] | undefined
  readonly mood?: Mood | undefined
}

/**
 * The voice track: the person's turn, as one call the model is made to make.
 * `does` is asked for before `says`, so the body is settled before the words
 * are written and the words follow it. It is offered no menu and no ids: what
 * they do about the conversation is the action track's to decide.
 */
export class Speaker {
  #sidecar: Sidecar

  constructor(sidecar: Sidecar) {
    this.#sidecar = sidecar
  }

  async take(input: {
    npcName: string
    system: string
    exchange: string
    /** How many facts about themselves are on offer this turn, which bounds `reveals`. */
    facts: number
    signal?: AbortSignal | undefined
  }): Promise<Result<TurnReply, SidecarError>> {
    const answered = await this.#sidecar.ask(turn(input.npcName, input.facts), {
      signal: input.signal,
      system: input.system,
      user: fill(PROMPTS.turn, { transcript: input.exchange, name: input.npcName }),
      job: 'dialogs',
      toolName: TOOL.name!,
      toolDescription: fill(TOOL.description!, { name: input.npcName }),
    })
    if (!answered.ok) return answered
    const value: TurnReply = answered.value
    return ok({
      ...value,
      does: value.does?.trim() ? scrub(value.does.trim()) : undefined,
      says: scrub(value.says.trim()),
    })
  }
}

/** The turn as a schema, `does` first so it is decided first. `reveals` is offered only while there is something to reveal. */
function turn(name: string, facts: number) {
  const word = (key: string) => fill(TOOL[key]!, { name })
  const opening = {
    does: z.string().optional().describe(word('does')),
    says: z.string().min(1).describe(word('says')),
  }
  const closing = {
    remembers: z.array(z.string()).optional().describe(word('remembers')),
    mood: z.enum(MOODS).optional().describe(word('mood')),
  }
  const reveals = z.number().int().min(1).max(facts).optional().describe(word('reveals'))
  return contract('talk.turn', facts > 0 ? z.object({ ...opening, reveals, ...closing }) : z.object({ ...opening, ...closing }))
}
