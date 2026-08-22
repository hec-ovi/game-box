import type { Turn } from './events.ts'
import type { Move, Situation } from './moves.ts'
import { PROMPTS } from './prompts.generated.ts'
import { fill, keyed } from './text.ts'

/** How many turns of the conversation the decider is shown. */
const RECENT = 6

const LINES = keyed(PROMPTS.situation)

/** Everything the model is told: who this person is, what is going on, what was just said. */
export class Brief {
  #situation: Situation

  constructor(situation: Situation) {
    this.#situation = situation
  }

  get npcName(): string {
    return this.#npc().name
  }

  get city(): string {
    return this.#situation.world.name
  }

  /** The character the voice track speaks as. Their knowledge, and nothing else about the world. */
  voice(moves: readonly Move[]): string {
    const { world } = this.#situation
    const npc = this.#npc()
    const interior = npc.station ? world.interior(npc.station.interiorId) : undefined
    const plot = interior ? world.plot(interior.plotId) : undefined

    return fill(PROMPTS.npc, {
      name: npc.name,
      role: npc.role,
      place: plot?.name ?? 'the street',
      city: this.city,
      personality: npc.personality,
      knowledge: npc.knowledge.map((fact) => `- ${fact}`).join('\n') || '- nothing worth repeating',
      situation: this.#now(moves),
    })
  }

  /** The exchange as the decider reads it: who said what, most recent last. */
  transcript(history: readonly Turn[]): string {
    return history
      .slice(-RECENT)
      .map((turn) => `${turn.role === 'user' ? 'Them' : this.npcName}: "${turn.content}"`)
      .join('\n')
  }

  /**
   * What this NPC currently wants from the player, in their own terms. It is
   * read off the moves they may make, so what they are told and what they may
   * choose can never drift apart.
   */
  #now(moves: readonly Move[]): string {
    const { world, log, player, npcId } = this.#situation
    const lines: string[] = []
    for (const move of moves) {
      if (move.action === 'give_quest') {
        const quest = log.quests().find((candidate) => candidate.id === move.id)
        if (quest) lines.push(fill(LINES.quest!, { title: quest.title, summary: quest.summary }))
      }
      if (move.action === 'take_delivery') {
        lines.push(fill(LINES.delivery!, { item: world.item(move.id ?? '')?.name.toLowerCase() ?? 'something' }))
      }
    }
    for (const objective of log.objectives()) {
      if (objective.npcId === npcId) lines.push(fill(LINES.objective!, { text: objective.text }))
    }
    if (player.isCompanion(npcId)) lines.push(LINES.companion!)

    return lines.length
      ? fill(PROMPTS['situation-quest'], { lines: lines.map((line) => `\n- ${line}`).join('') })
      : PROMPTS['situation-idle']
  }

  #npc() {
    return this.#situation.world.npc(this.#situation.npcId)!
  }
}
