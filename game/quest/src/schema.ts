import { contract } from '@gb/kit'
import { z } from 'zod'
import { DIFFICULTIES } from './balance.ts'
import { id } from './ids.ts'

/** What must already be true before a step can be entered, or a quest offered. */
export const ConditionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('has-item'), itemId: id('item') }),
  z.object({ kind: z.literal('flag'), flag: z.string().min(1).max(60), value: z.boolean() }),
  z.object({ kind: z.literal('money-at-least'), amount: z.number().int().min(0) }),
  z.object({ kind: z.literal('reputation-at-least'), faction: z.string().min(1).max(40), amount: z.number().int().min(-100).max(100) }),
  z.object({ kind: z.literal('reputation-below'), faction: z.string().min(1).max(40), amount: z.number().int().min(-100).max(100) }),
  z.object({ kind: z.literal('has-companion'), npcId: id('npc') }),
])

/** What completing a step changes. */
export const EffectSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('give-item'), itemId: id('item') }),
  z.object({ kind: z.literal('take-item'), itemId: id('item') }),
  z.object({ kind: z.literal('pay'), amount: z.number().int().min(0).max(100000) }),
  z.object({ kind: z.literal('charge'), amount: z.number().int().min(0).max(100000) }),
  z.object({ kind: z.literal('reputation'), faction: z.string().min(1).max(40), delta: z.number().int().min(-50).max(50) }),
  z.object({ kind: z.literal('set-flag'), flag: z.string().min(1).max(60), value: z.boolean() }),
  z.object({ kind: z.literal('companion-join'), npcId: id('npc') }),
  z.object({ kind: z.literal('companion-leave'), npcId: id('npc') }),
  /** Puts a hidden step on the board. The step it names must be `hidden`. */
  z.object({ kind: z.literal('reveal'), stepId: id('step') }),
])

/** Somewhere the player can be told to go. */
export const PlaceSchema = z.union([
  z.object({ plotId: id('plot') }),
  z.object({ interiorId: id('interior') }),
])

/** Things that end a quest badly on their own, without the flow reaching a `fail` step. */
export const FailRuleSchema = z.discriminatedUnion('kind', [
  /** Seconds of play from the moment the quest starts. The game reports the clock. */
  z.object({ kind: z.literal('time-limit'), seconds: z.number().int().min(30).max(86400) }),
  /** Someone the quest cannot do without. No `reason` means either dying or leaving town. */
  z.object({ kind: z.literal('npc-lost'), npcId: id('npc'), reason: z.enum(['died', 'left']).optional() }),
  z.object({ kind: z.literal('item-lost'), itemId: id('item') }),
])

const stepBase = {
  id: id('step'),
  /** The line the journal and the HUD show while this step is the one to do. */
  objective: z.string().min(1).max(160),
  /** Short label for the marker in the world, when the objective line is too long for it. */
  markerLabel: z.string().min(1).max(40).optional(),
  /** A nudge to show if the player stops making progress. */
  hint: z.string().min(1).max(200).optional(),
  /** Steps that open when this one is done. Several means they open together. */
  next: z.array(id('step')).max(8).default([]),
  requires: z.array(ConditionSchema).max(6).default([]),
  effects: z.array(EffectSchema).max(8).default([]),
  /** Side work: the quest finishes without it, and nothing required may hang off it. */
  optional: z.boolean().optional(),
  /** Stays off the board until a `reveal` effect earlier in the flow puts it there. */
  hidden: z.boolean().optional(),
}

/** How many of a pool of interchangeable items a step wants, and what else counts. */
const counted = {
  count: z.number().int().min(1).max(20).optional(),
  /** Other items that satisfy this step just as well as `itemId`. */
  alternates: z.array(id('item')).max(19).optional(),
}

export const StepSchema = z.discriminatedUnion('kind', [
  z.object({ ...stepBase, kind: z.literal('talk'), npcId: id('npc'), topic: z.string().min(1).max(80).optional() }),
  z.object({ ...stepBase, kind: z.literal('goto'), place: PlaceSchema }),
  z.object({ ...stepBase, ...counted, kind: z.literal('collect'), itemId: id('item'), allowSteal: z.boolean().default(false) }),
  z.object({ ...stepBase, ...counted, kind: z.literal('deliver'), itemId: id('item'), toNpcId: id('npc') }),
  z.object({ ...stepBase, ...counted, kind: z.literal('stash'), itemId: id('item'), interiorId: id('interior'), anchorId: id('anchor') }),
  z.object({ ...stepBase, kind: z.literal('escort'), npcId: id('npc'), place: PlaceSchema }),
  z.object({
    ...stepBase,
    kind: z.literal('choice'),
    prompt: z.string().min(1).max(160),
    options: z
      .array(z.object({ id: z.string().min(1).max(40), label: z.string().min(1).max(120), next: id('step') }))
      .min(2)
      .max(4),
  }),
  /** Waits for several branches to finish before opening its own `next`. */
  z.object({ ...stepBase, kind: z.literal('join'), waitFor: z.array(id('step')).min(2).max(8) }),
  /** Steal it or buy it or talk her into it: the first branch to finish wins, the rest are dropped. */
  z.object({ ...stepBase, kind: z.literal('any-of'), oneOf: z.array(id('step')).min(2).max(8) }),
  z.object({ ...stepBase, kind: z.literal('complete') }),
  z.object({ ...stepBase, kind: z.literal('fail') }),
])

export const RewardSchema = z.object({
  money: z.number().int().min(0).max(100000).default(0),
  reputation: z.number().int().min(-50).max(50).default(0),
  faction: z.string().min(1).max(40).default('town'),
  items: z.array(id('item')).max(6).default([]),
})

export const QuestSchema = z.object({
  format: z.literal('game-box.quest'),
  schemaVersion: z.literal(1),
  id: id('quest'),
  kind: z.enum(['main', 'side']),
  title: z.string().min(1).max(80),
  /** What the journal says about why the player is doing this. */
  summary: z.string().min(1).max(600),
  /** Who offers it. Talking to them is how it starts. */
  giverNpcId: id('npc'),
  /** How much work this is. The reward has to fit the band for it. Unsaid means `small`. */
  difficulty: z.enum(DIFFICULTIES).optional(),
  /** Standing, money or belongings the player needs before this is even offered. */
  requires: z.array(ConditionSchema).max(4).optional(),
  /** Ways the quest fails on its own. */
  failWhen: z.array(FailRuleSchema).max(4).optional(),
  startStepId: id('step'),
  steps: z.array(StepSchema).min(1).max(60),
  reward: RewardSchema,
})

export const questContract = contract('quest', QuestSchema)

/** The items a counted step accepts: the one it names plus its alternates. Empty for the rest. */
export function itemPool(step: Step): ReadonlySet<string> {
  if (!isCounted(step)) return new Set()
  return new Set([step.itemId, ...(step.alternates ?? [])])
}

function isCounted(step: Step): step is Extract<Step, { kind: 'collect' | 'deliver' | 'stash' }> {
  return step.kind === 'collect' || step.kind === 'deliver' || step.kind === 'stash'
}

/** How many items this step wants. One, unless it says otherwise. */
export function countOf(step: Step): number {
  return (isCounted(step) ? step.count : undefined) ?? 1
}

export function isOptional(step: Step): boolean {
  return step.optional === true
}

export function isHiddenStep(step: Step): boolean {
  return step.hidden === true
}

/**
 * A step that needs nobody: it resolves the moment it opens. These four are the
 * flow's own plumbing, never work the player does, so they run through without
 * ever being an objective and never take a line on a journal page.
 */
export function resolvesItself(step: Step): boolean {
  return step.kind === 'join' || step.kind === 'any-of' || step.kind === 'complete' || step.kind === 'fail'
}

export type Condition = z.infer<typeof ConditionSchema>
export type Effect = z.infer<typeof EffectSchema>
export type FailRule = z.infer<typeof FailRuleSchema>
export type Place = z.infer<typeof PlaceSchema>
export type Step = z.infer<typeof StepSchema>
export type StepKind = Step['kind']
export type QuestKind = QuestDoc['kind']
export type Reward = z.infer<typeof RewardSchema>
export type QuestDoc = z.infer<typeof QuestSchema>
