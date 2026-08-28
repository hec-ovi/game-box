import { contract } from '@gb/kit'
import { z } from 'zod'
import { ConditionSchema, FailRuleSchema, PlaceSchema } from './schema.ts'
import { id } from './ids.ts'
import { RewardSchema } from './reward.ts'

/**
 * A quest as a writer tells it: who it is about, what happens, in what order.
 *
 * A beat is one thing that happens, with the people, places and things it
 * involves named by id. There are no step ids in here, no edges, no
 * preconditions and no wiring of any kind: the flow those beats add up to is
 * the compiler's to build (`compile.ts`), which is why a writer who is good at
 * a story and bad at a directed graph can still hand over a quest that plays.
 */

/** The line the player reads while this beat is the one to do. */
const objective = z.string().min(1).max(160)

/** What somebody hands the player when they talk: the key to a door, or the word a lock takes. */
export const HandoverSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('give-item'), itemId: id('item') }),
  z.object({ kind: z.literal('give-password'), password: z.string().trim().min(1).max(60) }),
])

/** How many of a pool of interchangeable things a beat is about, and what else counts. */
const counted = {
  alternates: z.array(id('item')).max(19).optional(),
  count: z.number().int().min(1).max(20).optional(),
}

/** Every beat but the fork, which is the one that carries beats of its own. */
const PLAIN = [
  z.object({
    kind: z.literal('talk'),
    npcId: id('npc'),
    topic: z.string().min(1).max(80).optional(),
    /** What they hand over while you are with them. */
    hands: z.array(HandoverSchema).max(4).optional(),
    objective,
  }),
  z.object({ kind: z.literal('goto'), where: PlaceSchema, objective }),
  z.object({ kind: z.literal('collect'), itemId: id('item'), ...counted, allowSteal: z.boolean().optional(), objective }),
  z.object({ kind: z.literal('buy'), itemId: id('item'), ...counted, objective }),
  z.object({ kind: z.literal('deliver'), itemId: id('item'), toNpcId: id('npc'), ...counted, objective }),
  z.object({ kind: z.literal('stash'), itemId: id('item'), interiorId: id('interior'), anchorId: id('anchor'), ...counted, objective }),
  z.object({ kind: z.literal('escort'), npcId: id('npc'), where: PlaceSchema, objective }),
  z.object({ kind: z.literal('unlock'), doorId: id('door'), objective }),
  z.object({ kind: z.literal('hack'), machineId: id('machine'), objective }),
  z.object({ kind: z.literal('beat-game'), machineId: id('machine'), score: z.number().int().min(1).max(1000000), objective }),
] as const

export const PlainBeatSchema = z.discriminatedUnion('kind', PLAIN)

/** One road out of a fork: what the button says, and what happens if it is taken. */
const RoadSchema = z.object({
  label: z.string().min(1).max(120),
  beats: z.array(PlainBeatSchema).min(1).max(8),
})

/** The fork. Its roads run their own beats and the quest carries on where they meet again. */
const ChoiceBeatSchema = z.object({
  kind: z.literal('choice'),
  /** The question in the quest's own words. */
  prompt: z.string().min(1).max(160),
  objective,
  options: z.array(RoadSchema).min(2).max(3),
})

export const BeatSchema = z.discriminatedUnion('kind', [...PLAIN, ChoiceBeatSchema])

export const QuestSheetSchema = z.object({
  id: id('quest'),
  kind: z.enum(['main', 'side']),
  title: z.string().min(1).max(80),
  /** What the journal says about why the player is doing this. */
  summary: z.string().min(1).max(600),
  /** Who offers it. Talking to them is how it starts. */
  giverNpcId: id('npc'),
  /** How much work this is. Unsaid means read off what the reward hands over. */
  difficulty: z.enum(['errand', 'small', 'standard', 'hard', 'epic']).optional(),
  /** Standing, money or belongings the player needs before this is even offered. */
  requires: z.array(ConditionSchema).max(4).optional(),
  /** Ways the quest fails on its own. */
  failWhen: z.array(FailRuleSchema).max(4).optional(),
  /** What happens, in the order it happens. */
  beats: z.array(BeatSchema).min(1).max(40),
  reward: RewardSchema,
})

export const questSheetContract = contract('quest-sheet', QuestSheetSchema)

export type Handover = z.infer<typeof HandoverSchema>
export type PlainBeat = z.infer<typeof PlainBeatSchema>
export type Beat = z.infer<typeof BeatSchema>
export type QuestSheet = z.infer<typeof QuestSheetSchema>

/** The things this beat is about: the one it names plus anything else that counts. Empty where it is about no thing. */
export function beatPool(beat: PlainBeat): ReadonlySet<string> {
  if (!('itemId' in beat)) return new Set()
  return new Set([beat.itemId, ...(beat.alternates ?? [])])
}

/** How many things this beat is about. One, unless it says otherwise. */
export function beatCount(beat: PlainBeat): number {
  return ('count' in beat ? beat.count : undefined) ?? 1
}
