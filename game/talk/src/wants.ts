import type { Place, QuestDoc } from '@gb/quest'
import { firstAsk } from './job.ts'
import type { Move, Situation } from './moves.ts'
import { PROMPTS } from './prompts.generated.ts'
import { fill, keyed } from './text.ts'

const LINES = keyed(PROMPTS.situation)

/**
 * What this person currently wants out of the player, in their own terms. It is
 * read off the moves they may make and the targets the quest log resolved, so
 * what they are told and what they may choose can never drift apart, and no
 * line of screen text is handed to them to read out.
 */
export class Wants {
  #situation: Situation

  constructor(situation: Situation) {
    this.#situation = situation
  }

  /** The situation block of the brief: what is between these two right now. */
  block(moves: readonly Move[]): string {
    const owed = new Set(moves.filter((move) => move.action === 'take_delivery').map((move) => move.id))
    const lines = [...this.#fromMoves(moves), ...this.#fromObjectives(owed)]
    if (this.#situation.player.isCompanion(this.#situation.npcId)) lines.push(LINES.companion!)

    return lines.length
      ? fill(PROMPTS['situation-quest'], { lines: lines.map((line) => `\n- ${line}`).join('') })
      : PROMPTS['situation-idle']
  }

  /** What they could hand over or take this turn. */
  #fromMoves(moves: readonly Move[]): string[] {
    const lines: string[] = []
    for (const move of moves) {
      if (move.action === 'give_quest') {
        const quest = this.#situation.log.quests().find((candidate) => candidate.id === move.id)
        if (quest) lines.push(this.#job(quest))
      }
      if (move.action === 'take_delivery') lines.push(fill(LINES.delivery!, { item: move.subject ?? 'something' }))
    }
    return lines
  }

  /** What the player still owes them, said as the debt rather than as the screen text. */
  #fromObjectives(owed: ReadonlySet<string | undefined>): string[] {
    const lines: string[] = []
    for (const objective of this.#situation.log.objectives()) {
      if (objective.npcId !== this.#situation.npcId) continue
      if (objective.itemId) {
        if (owed.has(objective.itemId)) continue
        lines.push(fill(LINES.owed!, { item: this.#itemName(objective.itemId) }))
      } else if (objective.topic) {
        lines.push(fill(LINES.asked!, { topic: objective.topic }))
      } else if (objective.place) {
        lines.push(fill(LINES.escorting!, { place: this.#placeName(objective.place) }))
      } else {
        lines.push(LINES.awaited!)
      }
    }
    return lines
  }

  #job(quest: QuestDoc): string {
    const money = quest.reward.money
    const line = money
      ? fill(LINES.quest!, { title: quest.title, summary: quest.summary, pay: fill(LINES.pay!, { money: String(money) }) })
      : fill(LINES['quest-unpaid']!, { title: quest.title, summary: quest.summary })
    const ask = firstAsk(quest)
    return ask ? `${line} ${fill(LINES.first!, { ask })}` : line
  }

  #itemName(itemId: string): string {
    return this.#situation.world.item(itemId)?.name.toLowerCase() ?? 'something'
  }

  #placeName(place: Place): string {
    const { world } = this.#situation
    const plotId = 'plotId' in place ? place.plotId : world.interior(place.interiorId)?.plotId
    return (plotId && world.plot(plotId)?.name) || 'where they were told'
  }
}
