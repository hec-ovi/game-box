import type { Change } from '@gb/quest'
import type { Access } from '@gb/world'
import type { ActionName, Move } from './moves.ts'
import type { TalkMove } from './picks.ts'

export type TalkError = { readonly code: 'unknown-npc'; readonly npcId: string }

/** How a reply came down on the spot: they went along with it, or they would not. */
export type Answer = 'yes' | 'no'

/** Access handed to the player in conversation: a key or card, a word, or a door open to them from now on. */
export type Grant =
  | { readonly kind: 'granted'; readonly keyItemId: string }
  | { readonly kind: 'granted'; readonly password: string }
  | { readonly kind: 'granted'; readonly access: Access }

export type TalkEvent =
  /** One spoken turn: what their body does, if anything, and the words out loud. */
  | { readonly kind: 'turn'; readonly does?: string; readonly says: string }
  | { readonly kind: 'answered'; readonly answer: Answer }
  | { readonly kind: 'did'; readonly action: ActionName; readonly detail?: string }
  /** The player earned one of this person's background facts; the codex holds it now. */
  | { readonly kind: 'learned'; readonly npcId: string; readonly factId: string }
  | { readonly kind: 'changed'; readonly change: Change }
  | Grant
  | { readonly kind: 'over' }

/**
 * How a turn came out: the move they made of it, and how their reply read. Both
 * are absent on most turns, which is a conversation carrying on and nothing more.
 */
export interface Decision {
  readonly move?: Move | undefined
  readonly answer?: Answer | undefined
}

/** One line of a transcript: who spoke, the words, and what their body did when it did anything. */
export interface Turn {
  readonly role: 'user' | 'assistant'
  readonly content: string
  readonly does?: string | undefined
}

/** The turn the NPC takes on their own, before the player has said anything. */
export interface Opening {
  /** What they say as the panel opens. Always something, and never a model call. */
  readonly line: string
  /** The same moves `moves()` gives, drawn at the moment the line was said. */
  readonly moves: readonly TalkMove[]
}
