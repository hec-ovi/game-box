import type { Objective, Place, QuestDoc, Step } from '@gb/quest'
import type { Grant } from './events.ts'
import { firstAsk } from './job.ts'
import type { Move, Situation } from './moves.ts'
import { Payoffs } from './payoffs.ts'
import { PROMPTS } from './prompts.generated.ts'
import { Stock } from './stock.ts'
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
  #stock: Stock
  #payoffs: Payoffs

  constructor(situation: Situation) {
    this.#situation = situation
    this.#stock = new Stock(situation)
    this.#payoffs = new Payoffs(situation)
  }

  /** The situation block of the brief: what is between these two right now. */
  block(moves: readonly Move[]): string {
    const owed = new Set(moves.filter((move) => move.action === 'take_delivery').map((move) => move.id))
    const lines = [...this.#fromMoves(moves), ...this.#fromObjectives(owed), ...this.#payoffs.given().map((grant) => this.#given(grant))]
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
        const quest = this.#quest(move.id)
        if (quest) lines.push(this.#job(quest))
      }
      if (move.action === 'take_delivery') lines.push(fill(LINES.delivery!, { item: move.subject ?? 'something' }))
    }
    return lines
  }

  /** What the player still owes them, or has come to them for, said as the debt rather than as the screen text. */
  #fromObjectives(owed: ReadonlySet<string | undefined>): string[] {
    const { npcId } = this.#situation
    const lines: string[] = []
    for (const objective of this.#situation.log.objectives()) {
      const step = this.#step(objective)
      if (step?.kind === 'buy') {
        const ware = [objective.itemId, ...(objective.alternates ?? [])].map((id) => id && this.#stock.ware(id)).find(Boolean)
        if (ware) lines.push(fill(LINES.buying!, { item: ware.name, price: String(ware.price) }))
        continue
      }
      if (objective.npcId !== npcId) continue
      if (objective.itemId) {
        if (owed.has(objective.itemId)) continue
        lines.push(fill(LINES.owed!, { item: this.#itemName(objective.itemId) }))
      } else if (objective.place) {
        lines.push(fill(LINES.escorting!, { place: this.#placeName(objective.place) }))
      } else {
        lines.push(...this.#talk(objective))
      }
    }
    return lines
  }

  /** A talk step of theirs: what it waits to hear, and what it pays out when heard. */
  #talk(objective: Objective): string[] {
    const waiting = this.#payoffs.waiting().filter((payoff) => payoff.topic === objective.topic)
    if (!waiting.length) return [objective.topic ? fill(LINES.asked!, { topic: objective.topic }) : LINES.awaited!]
    return waiting.map(({ grant }) => {
      const state = objective.topic ? 'waiting' : 'ready'
      return 'password' in grant
        ? fill(LINES[`password-${state}`]!, { password: grant.password, topic: objective.topic ?? '' })
        : fill(LINES[`key-${state}`]!, { item: this.#itemName('keyItemId' in grant ? grant.keyItemId : ''), topic: objective.topic ?? '' })
    })
  }

  #given(grant: Grant): string {
    return 'password' in grant
      ? fill(LINES['password-given']!, { password: grant.password })
      : fill(LINES['key-given']!, { item: this.#itemName('keyItemId' in grant ? grant.keyItemId : '') })
  }

  #job(quest: QuestDoc): string {
    const money = quest.reward.money
    const line = money
      ? fill(LINES.quest!, { title: quest.title, summary: quest.summary, pay: fill(LINES.pay!, { money: String(money) }) })
      : fill(LINES['quest-unpaid']!, { title: quest.title, summary: quest.summary })
    const ask = firstAsk(quest)
    return ask ? `${line} ${fill(LINES.first!, { ask })}` : line
  }

  #quest(questId: string | undefined): QuestDoc | undefined {
    return this.#situation.log.quests().find((candidate) => candidate.id === questId)
  }

  #step(objective: Objective): Step | undefined {
    return this.#quest(objective.questId)?.steps.find((step) => step.id === objective.stepId)
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
