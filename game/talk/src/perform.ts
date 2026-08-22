import type { Change } from '@gb/quest'
import type { TalkEvent } from './events.ts'
import type { Move, Situation } from './moves.ts'

/**
 * Carries a move out through the box that owns the state it changes: quests
 * through `@gb/quest`, inventory, money and companions through `@gb/play`.
 * Legality is checked once more here, so a move that was legal when the turn
 * began but is not any more does nothing at all.
 */
export class Performer {
  #situation: Situation

  constructor(situation: Situation) {
    this.#situation = situation
  }

  run(move: Move): readonly TalkEvent[] {
    const { world, log, player, npcId } = this.#situation
    const events: TalkEvent[] = []
    const record = (changes: readonly Change[]) => {
      for (const change of changes) events.push({ kind: 'changed', change })
    }

    switch (move.action) {
      case 'give_quest': {
        const questId = move.id ?? ''
        if (!log.offeredBy(npcId).some((quest) => quest.id === questId)) return []
        const started = log.start(questId)
        events.push({ kind: 'did', action: move.action, detail: questId })
        if (started.ok) record(started.value)
        break
      }
      case 'take_delivery': {
        const itemId = move.id ?? ''
        if (!player.has(itemId)) return []
        player.drop(itemId)
        events.push({ kind: 'did', action: move.action, detail: itemId })
        const handled = log.handle({ kind: 'gave', itemId, npcId })
        if (handled.ok) record(handled.value)
        break
      }
      case 'hand_over': {
        const itemId = move.id ?? ''
        if (!world.hasItem(itemId)) return []
        player.take(itemId)
        events.push({ kind: 'did', action: move.action, detail: itemId })
        const handled = log.handle({ kind: 'acquired', itemId, stolen: false })
        if (handled.ok) record(handled.value)
        break
      }
      case 'follow_player':
        player.addCompanion(npcId)
        events.push({ kind: 'did', action: move.action })
        break
      case 'stop_following':
        player.removeCompanion(npcId)
        events.push({ kind: 'did', action: move.action })
        break
      case 'end_talk':
        events.push({ kind: 'did', action: move.action })
        break
    }
    return events
  }
}
