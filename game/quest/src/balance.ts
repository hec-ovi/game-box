import type { SchemaViolation } from '@gb/kit'
import { DEFAULT_FACTION } from '@gb/play'
import type { QuestDoc, Reward } from './schema.ts'

/** How much work a quest is. A generator picks one of these instead of inventing a number. */
export const DIFFICULTIES = ['errand', 'small', 'standard', 'hard', 'epic'] as const
export type Difficulty = (typeof DIFFICULTIES)[number]

/** What a quest is worth when it does not say. */
export const DEFAULT_DIFFICULTY: Difficulty = 'small'

export function difficultyOf(quest: QuestDoc): Difficulty {
  return quest.difficulty ?? DEFAULT_DIFFICULTY
}

export interface RewardBand {
  /** What the whole quest may hand over, reward plus every `pay` effect on it. */
  readonly money: { readonly min: number; readonly max: number }
  /** How far one reputation swing may go, either way. */
  readonly reputation: number
  /** How many items the reward may include. */
  readonly items: number
  /** How many doors or places the reward may open. */
  readonly access: number
  /** Whether the reward may be a car. */
  readonly car: boolean
  /** Whether the reward may be a home. */
  readonly deed: boolean
  /** What a generator gets when it asks for this difficulty and nothing more. */
  readonly typical: { readonly money: number; readonly reputation: number }
}

/**
 * The one place quest pay is tuned. Published treasure-by-level tables are the
 * shape: a band per tier, wide enough for a writer to have an opinion inside it
 * and narrow enough that an hour of walking cannot pay four coins.
 */
export const REWARD_TABLE: Readonly<Record<Difficulty, RewardBand>> = {
  errand: { money: { min: 0, max: 25 }, reputation: 4, items: 0, access: 0, car: false, deed: false, typical: { money: 15, reputation: 1 } },
  small: { money: { min: 10, max: 90 }, reputation: 12, items: 1, access: 1, car: false, deed: false, typical: { money: 45, reputation: 3 } },
  standard: { money: { min: 60, max: 250 }, reputation: 20, items: 2, access: 2, car: false, deed: false, typical: { money: 140, reputation: 6 } },
  hard: { money: { min: 200, max: 700 }, reputation: 35, items: 3, access: 2, car: true, deed: false, typical: { money: 420, reputation: 12 } },
  epic: { money: { min: 600, max: 2500 }, reputation: 50, items: 4, access: 3, car: true, deed: true, typical: { money: 1200, reputation: 20 } },
}

/** A reward that fits the band, for a generator that would rather ask for "a small job". */
export function rewardFor(difficulty: Difficulty, faction: string = DEFAULT_FACTION): Reward {
  const band = REWARD_TABLE[difficulty]
  return { money: band.typical.money, reputation: band.typical.reputation, faction, items: [] }
}

/**
 * Checks the pay against the band for the quest's difficulty. Every `pay` on a
 * step counts towards the same ceiling, so a quest cannot slip a fortune past
 * the table by handing it over mid-flow. Each complaint names the field to fix,
 * which is what a generator needs to write the quest again.
 */
export function checkReward(quest: QuestDoc): SchemaViolation[] {
  const difficulty = difficultyOf(quest)
  const band = REWARD_TABLE[difficulty]
  const tier = TIER[difficulty]
  const violations: SchemaViolation[] = []
  const fail = (path: string, message: string) => void violations.push({ path, message })

  const paid = sum(quest, 'pay') + quest.reward.money
  if (paid > band.money.max) fail('reward.money', `${tier} pays at most ${band.money.max}, this hands over ${paid}`)
  if (quest.reward.money < band.money.min) {
    fail('reward.money', `${tier} pays at least ${band.money.min}, this rewards ${quest.reward.money}`)
  }

  const charged = sum(quest, 'charge')
  if (charged > band.money.max) fail('steps.effects.charge', `${tier} may cost at most ${band.money.max}, this charges ${charged}`)

  const swing = Math.max(
    Math.abs(quest.reward.reputation),
    ...quest.steps.flatMap((step) => step.effects.filter((e) => e.kind === 'reputation').map((e) => Math.abs(e.delta))),
  )
  if (swing > band.reputation) {
    fail('reward.reputation', `${tier} moves reputation by at most ${band.reputation}, this moves it by ${swing}`)
  }
  if (quest.reward.items.length > band.items) {
    fail('reward.items', `${tier} rewards at most ${band.items} item(s), this rewards ${quest.reward.items.length}`)
  }
  const opened = quest.reward.access?.length ?? 0
  if (opened > band.access) fail('reward.access', `${tier} opens at most ${band.access} door(s) or place(s), this opens ${opened}`)
  if (quest.reward.car && !band.car) fail('reward.car', `${tier} does not hand over a car`)
  if (quest.reward.deed && !band.deed) fail('reward.deed', `${tier} does not hand over a home`)
  return violations
}

function sum(quest: QuestDoc, kind: 'pay' | 'charge'): number {
  let total = 0
  for (const step of quest.steps) {
    for (const effect of step.effects) if (effect.kind === kind) total += effect.amount
  }
  return total
}

/** How a complaint names the tier, so the message reads like a sentence. */
const TIER: Readonly<Record<Difficulty, string>> = {
  errand: 'an errand',
  small: 'a small job',
  standard: 'a standard job',
  hard: 'a hard job',
  epic: 'an epic job',
}
