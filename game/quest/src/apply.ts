import type { PlayerState } from '@gb/play'
import type { Condition, Effect, Reward } from './schema.ts'

/** Whether the player already satisfies everything a step or a quest asks for. */
export function meets(player: PlayerState, conditions: readonly Condition[]): boolean {
  return unmet(player, conditions).length === 0
}

/** The conditions the player does not satisfy, so a refusal can say which. */
export function unmet(player: PlayerState, conditions: readonly Condition[]): readonly Condition[] {
  return conditions.filter((condition) => {
    switch (condition.kind) {
      case 'has-item':
        return !player.has(condition.itemId)
      case 'flag':
        return player.flag(condition.flag) !== condition.value
      case 'money-at-least':
        return player.money < condition.amount
      case 'reputation-at-least':
        return player.reputation(condition.faction) < condition.amount
      case 'reputation-below':
        return player.reputation(condition.faction) >= condition.amount
      case 'has-companion':
        return !player.isCompanion(condition.npcId)
    }
  })
}

/** Effects are the only way a quest changes the player. Nothing here is implicit. */
export function applyEffects(player: PlayerState, effects: readonly Effect[]): void {
  for (const effect of effects) {
    switch (effect.kind) {
      case 'give-item':
        player.take(effect.itemId)
        break
      case 'take-item':
        player.drop(effect.itemId)
        break
      case 'pay':
        player.earn(effect.amount)
        break
      case 'charge':
        player.pay(effect.amount)
        break
      case 'reputation':
        player.adjustReputation(effect.delta, effect.faction)
        break
      case 'set-flag':
        player.setFlag(effect.flag, effect.value)
        break
      case 'companion-join':
        player.addCompanion(effect.npcId)
        break
      case 'companion-leave':
        player.removeCompanion(effect.npcId)
        break
      case 'reveal':
        // the quest log owns what the player can see; the player state has no say in it
        break
    }
  }
}

export function payReward(player: PlayerState, reward: Reward): void {
  player.earn(reward.money)
  if (reward.reputation) player.adjustReputation(reward.reputation, reward.faction)
  for (const itemId of reward.items) player.take(itemId)
}
