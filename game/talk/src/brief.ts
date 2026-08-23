import type { Turn } from './events.ts'
import type { Move, Situation } from './moves.ts'
import { PROMPTS } from './prompts.generated.ts'
import { Scene } from './scene.ts'
import { fill } from './text.ts'
import { Wants } from './wants.ts'

/** How many turns of the conversation the decider is shown. */
const RECENT = 6

/** Everything the model is told: who this person is, what is going on, what was just said. */
export class Brief {
  #situation: Situation
  #scene: Scene
  #wants: Wants

  constructor(situation: Situation) {
    this.#situation = situation
    this.#scene = new Scene(situation)
    this.#wants = new Wants(situation)
  }

  get npcName(): string {
    return this.#npc().name
  }

  get city(): string {
    return this.#situation.world.name
  }

  /** The character the voice track speaks as: their knowledge, their room, their hour. */
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
      theme: world.theme,
      personality: npc.personality,
      knowledge: npc.knowledge.map((fact) => `- ${fact}`).join('\n') || '- nothing worth repeating',
      surroundings: this.#scene.where(),
      standing: this.#scene.standing(),
      situation: this.#wants.block(moves),
    })
  }

  /** The exchange as the decider reads it: who said what, most recent last. */
  transcript(history: readonly Turn[]): string {
    return history
      .slice(-RECENT)
      .map((turn) => `${turn.role === 'user' ? 'Them' : this.npcName}: "${turn.content}"`)
      .join('\n')
  }

  #npc() {
    return this.#situation.world.npc(this.#situation.npcId)!
  }
}
