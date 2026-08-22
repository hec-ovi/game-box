import { contract } from '@gb/kit'
import { z } from 'zod'

const id = (kind: string) => z.string().regex(new RegExp(`^${kind}_\\d{4,}$`), `expected a ${kind} id`)

/** What must already be true before a step can be entered. */
export const ConditionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('has-item'), itemId: id('item') }),
  z.object({ kind: z.literal('flag'), flag: z.string().min(1).max(60), value: z.boolean() }),
  z.object({ kind: z.literal('money-at-least'), amount: z.number().int().min(0) }),
  z.object({ kind: z.literal('reputation-at-least'), faction: z.string().min(1).max(40), amount: z.number().int().min(-100).max(100) }),
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
])

/** Somewhere the player can be told to go. */
export const PlaceSchema = z.union([
  z.object({ plotId: id('plot') }),
  z.object({ interiorId: id('interior') }),
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
}

export const StepSchema = z.discriminatedUnion('kind', [
  z.object({ ...stepBase, kind: z.literal('talk'), npcId: id('npc'), topic: z.string().min(1).max(80).optional() }),
  z.object({ ...stepBase, kind: z.literal('goto'), place: PlaceSchema }),
  z.object({ ...stepBase, kind: z.literal('collect'), itemId: id('item'), allowSteal: z.boolean().default(false) }),
  z.object({ ...stepBase, kind: z.literal('deliver'), itemId: id('item'), toNpcId: id('npc') }),
  z.object({ ...stepBase, kind: z.literal('stash'), itemId: id('item'), interiorId: id('interior'), anchorId: id('anchor') }),
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
  startStepId: id('step'),
  steps: z.array(StepSchema).min(1).max(60),
  reward: RewardSchema,
})

export const questContract = contract('quest', QuestSchema)

export type Condition = z.infer<typeof ConditionSchema>
export type Effect = z.infer<typeof EffectSchema>
export type Place = z.infer<typeof PlaceSchema>
export type Step = z.infer<typeof StepSchema>
export type StepKind = Step['kind']
export type Reward = z.infer<typeof RewardSchema>
export type QuestDoc = z.infer<typeof QuestSchema>
