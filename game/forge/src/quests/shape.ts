import type { Difficulty } from './difficulty.ts'

/**
 * The quest draft as this box writes it: the fields of `@gb/quest`'s draft
 * contract that the recipes actually use. The contract itself is the authority
 * and every draft goes through it before it is sealed; this is here so a recipe
 * cannot mistype a field on the way.
 */

export type Place = { readonly plotId: string } | { readonly interiorId: string }

export type Condition =
  | { readonly kind: 'flag'; readonly flag: string; readonly value: boolean }
  | { readonly kind: 'has-item'; readonly itemId: string }
  | { readonly kind: 'reputation-at-least'; readonly faction: string; readonly amount: number }

export type Effect =
  | { readonly kind: 'pay'; readonly amount: number }
  | { readonly kind: 'reputation'; readonly faction: string; readonly delta: number }
  | { readonly kind: 'set-flag'; readonly flag: string; readonly value: boolean }
  | { readonly kind: 'companion-join'; readonly npcId: string }
  | { readonly kind: 'companion-leave'; readonly npcId: string }
  | { readonly kind: 'reveal'; readonly stepId: string }

export type FailWhen =
  | { readonly kind: 'time-limit'; readonly seconds: number }
  | { readonly kind: 'npc-lost'; readonly npcId: string; readonly reason?: 'died' | 'left' }
  | { readonly kind: 'item-lost'; readonly itemId: string }

/** What every step carries, whatever it asks the player to do. */
interface Common {
  readonly id: string
  readonly objective: string
  readonly next?: readonly string[]
  readonly requires?: readonly Condition[]
  readonly effects?: readonly Effect[]
  readonly optional?: boolean
  readonly hidden?: boolean
  readonly markerLabel?: string
  readonly hint?: string
}

export type Step = Common &
  (
    | { readonly kind: 'talk'; readonly npcId: string }
    | { readonly kind: 'goto'; readonly place: Place }
    | { readonly kind: 'collect'; readonly itemId: string; readonly alternates?: readonly string[]; readonly count?: number; readonly allowSteal?: boolean }
    | { readonly kind: 'deliver'; readonly itemId: string; readonly toNpcId: string; readonly alternates?: readonly string[]; readonly count?: number }
    | { readonly kind: 'stash'; readonly itemId: string; readonly interiorId: string; readonly anchorId: string }
    | { readonly kind: 'escort'; readonly npcId: string; readonly place: Place }
    | { readonly kind: 'choice'; readonly prompt: string; readonly options: ReadonlyArray<{ readonly id: string; readonly label: string; readonly next: string }> }
    | { readonly kind: 'join'; readonly waitFor: readonly string[] }
    | { readonly kind: 'complete' }
  )

export interface Draft {
  readonly id: string
  readonly kind: 'main' | 'side'
  readonly title: string
  readonly summary: string
  readonly giverNpcId: string
  readonly difficulty: Difficulty
  readonly startStepId: string
  readonly steps: readonly Step[]
  readonly reward: { readonly money: number; readonly reputation: number; readonly faction: string; readonly items: readonly string[] }
  readonly requires?: readonly Condition[]
  readonly failWhen?: readonly FailWhen[]
}

/** Step ids in the order a recipe writes them. */
export const stepId = (n: number): string => `step_${String(n).padStart(4, '0')}`

/** Quest ids in the order a town hands them out. */
export const questId = (n: number): string => `quest_${String(n).padStart(4, '0')}`

/** Keeps a written line inside what the schema will take. */
export function clip(text: string, most: number): string {
  return text.length <= most ? text : `${text.slice(0, most - 1).trimEnd()}.`
}
