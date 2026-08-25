import type { Asks } from '@gb/world'
import { prompt, type PromptName } from './prompts.ts'

/** What the owner typed: the city in their words, and what they asked of the writers. */
export interface Asked {
  readonly brief?: string | undefined
  readonly asks?: Asks | undefined
}

/** The parts of an ask, each with the prompt that carries it to a writer. */
export type AskPart = 'brief' | 'tone' | 'mainQuest' | 'sideQuests' | 'look'

const PROMPT_FOR: Record<AskPart, PromptName> = {
  brief: 'asked-brief',
  tone: 'asked-tone',
  mainQuest: 'asked-main-quest',
  sideQuests: 'asked-side-quests',
  look: 'asked-look',
}

/**
 * The owner's asks written out for one writer, in the owner's own words.
 *
 * Only the parts a writer consumes are handed to it, and only the ones the
 * owner filled in: an absent field is absent from the prompt, never a line
 * saying it is empty, so a form left blank asks nothing of the model.
 */
export function askedLines(owner: Asked, parts: readonly AskPart[]): string {
  return parts
    .flatMap((part) => {
      const value = valueOf(owner, part)
      return value ? [prompt(PROMPT_FOR[part], { [part]: value })] : []
    })
    .join('\n\n')
}

function valueOf(owner: Asked, part: AskPart): string | undefined {
  if (part === 'brief') return owner.brief?.trim() || undefined
  if (part === 'look') return lookOf(owner.asks?.style)
  return owner.asks?.[part]?.trim() || undefined
}

/** The style choices as one line, only the ones made. */
function lookOf(style: Asks['style']): string | undefined {
  if (!style) return undefined
  const chosen = (['neon', 'density', 'wear'] as const).flatMap((key) =>
    style[key] ? [`${key} ${style[key]}`] : [],
  )
  return chosen.length ? chosen.join(', ') : undefined
}
