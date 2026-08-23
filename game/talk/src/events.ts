import type { Change } from '@gb/quest'
import type { ActionName } from './moves.ts'
import type { TalkMove } from './picks.ts'

export type TalkError = { readonly code: 'unknown-npc'; readonly npcId: string }

export type TalkEvent =
  | { readonly kind: 'said'; readonly text: string }
  | { readonly kind: 'did'; readonly action: ActionName; readonly detail?: string }
  | { readonly kind: 'changed'; readonly change: Change }
  | { readonly kind: 'over' }

export interface Turn {
  readonly role: 'user' | 'assistant'
  readonly content: string
}

/** The turn the NPC takes on their own, before the player has said anything. */
export interface Opening {
  /** What they say as the panel opens. Always something, and never a model call. */
  readonly line: string
  /** The same moves `moves()` gives, drawn at the moment the line was said. */
  readonly moves: readonly TalkMove[]
}
