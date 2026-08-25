import type { Change } from '@gb/quest'
import type { TalkEvent } from './events.ts'
import { Home } from './home.ts'
import { Locks } from './locks.ts'
import { topicsFor, type Move, type Situation } from './moves.ts'
import { Stock } from './stock.ts'

/**
 * Carries a move out through the box that owns the state it changes: quests
 * through `@gb/quest`, inventory, access and companions through `@gb/play`.
 * Money never moves here: what they sell is named, and the counter is where
 * it is bought.
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
      case 'ask_about': {
        const topic = move.id ?? ''
        if (!topicsFor(log, npcId).includes(topic)) return []
        // Saying it is the whole of it: the step it credits is handled by Credit,
        // which is what turns being put to a subject into a quest event.
        events.push({ kind: 'did', action: move.action, detail: topic })
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
        // A key or card is taken with what it opens, so the access rides on the thing.
        const opens = new Locks(world).opensWith(itemId)
        if (opens) player.take(itemId, { opens })
        else player.take(itemId)
        events.push({ kind: 'did', action: move.action, detail: itemId })
        if (opens) events.push({ kind: 'granted', keyItemId: itemId })
        const handled = log.handle({ kind: 'acquired', itemId, stolen: false })
        if (handled.ok) record(handled.value)
        break
      }
      case 'show_wares':
        if (!new Stock(this.#situation).wares().length) return []
        events.push({ kind: 'did', action: move.action })
        break
      case 'invite_home': {
        const home = new Home(this.#situation)
        const interior = home.interior()
        if (!interior || !home.canInvite()) return []
        player.grant({ interiorId: interior.id })
        events.push({ kind: 'did', action: move.action, detail: interior.id })
        events.push({ kind: 'granted', access: { interiorId: interior.id } })
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
