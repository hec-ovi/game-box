import { DIFFICULTIES, REWARD_TABLE, type Difficulty } from '@gb/quest'
import type { QuestDraft } from './tools.ts'

type Reward = QuestDraft['reward']

/**
 * The tier a reward belongs to, read off what it hands over.
 *
 * A small model asked for a tier and a pay inside its band gets one of them
 * wrong: measured, five of ten live drafts paid outside the band they named.
 * So the model is asked for the pay alone and the tier follows, the way the
 * offline writer reads it off the work: the lowest tier that allows what the
 * reward carries (a car, a home, that many things and doors) and holds its
 * money and its standing. A reward no tier holds whole takes the lowest tier
 * that allows what it carries, so the validator's message names the money.
 */
export function tierFor(reward: Reward): Difficulty {
  const carries = (tier: Difficulty): boolean => {
    const band = REWARD_TABLE[tier]
    return (
      (reward.items ?? []).length <= band.items &&
      (reward.access ?? []).length <= band.access &&
      (reward.car === undefined || band.car) &&
      (reward.deed === undefined || band.deed)
    )
  }
  const holds = (tier: Difficulty): boolean => {
    const band = REWARD_TABLE[tier]
    const money = reward.money ?? 0
    return money >= band.money.min && money <= band.money.max && Math.abs(reward.reputation ?? 0) <= band.reputation
  }
  const allowed = DIFFICULTIES.filter(carries)
  return allowed.find(holds) ?? allowed[0] ?? 'small'
}
