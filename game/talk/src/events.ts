import type { Change } from '@gb/quest'
import type { ActionName, Move } from './moves.ts'
import type { TalkMove } from './picks.ts'

export type TalkError = { readonly code: 'unknown-npc'; readonly npcId: string }

/** How a reply came down on the spot: they went along with it, or they would not. */
export type Answer = 'yes' | 'no'

export type TalkEvent =
  | { readonly kind: 'said'; readonly text: string }
  | { readonly kind: 'answered'; readonly answer: Answer }
  | { readonly kind: 'did'; readonly action: ActionName; readonly detail?: string }
  | { readonly kind: 'changed'; readonly change: Change }
  | { readonly kind: 'over' }

/**
 * How a turn came out: the move they made of it, and how their reply read. Both
 * are absent on most turns, which is a conversation carrying on and nothing more.
 */
export interface Decision {
  readonly move?: Move | undefined
  readonly answer?: Answer | undefined
}

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
