import type { Change } from '@gb/quest'
import type { ActionName } from './moves.ts'

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
