import type { Npc } from '@gb/world'
import type { Offered } from './background.ts'
import type { Turn } from './events.ts'
import { Examples } from './examples.ts'
import { Holding } from './holding.ts'
import { Memory } from './memory.ts'
import type { Move, Situation } from './moves.ts'
import { PROMPTS } from './prompts.generated.ts'
import { Scene } from './scene.ts'
import { fill, keyed } from './text.ts'
import { Wants } from './wants.ts'

/** How many turns of the conversation the decider is shown. */
const RECENT = 6
const LINES = keyed(PROMPTS.brief)
const LIFE = keyed(PROMPTS.life)

/**
 * Everything the model is told, in one labelled template laid out in three
 * zones, most stable first: how to speak with its worked examples, fixed text
 * for everybody; then who this person is, off the world file and steady for as
 * long as the player is talking to them; then where they are this minute, what
 * the player carries, how they stand and what is between them, which the
 * engine fills again every turn. A prompt cache is reused up to the first token
 * that differs, so the volatile lines go last, and the line under them says
 * again the one rule that matters, where it is read last.
 */
export class Brief {
  #situation: Situation
  #scene: Scene
  #wants: Wants
  #memory: Memory
  #holding: Holding
  #examples: Examples

  constructor(situation: Situation) {
    this.#situation = situation
    this.#scene = new Scene(situation)
    this.#wants = new Wants(situation)
    this.#memory = new Memory(situation)
    this.#holding = new Holding(situation)
    this.#examples = new Examples(situation)
  }

  get npcName(): string {
    return this.#npc().name
  }

  get city(): string {
    return this.#situation.world.name
  }

  /** The character the voice track speaks as, this turn. */
  voice(moves: readonly Move[], offered: readonly Offered[]): string {
    const npc = this.#npc()
    return fill(PROMPTS.npc, {
      name: npc.name,
      role: npc.role,
      place: this.#scene.place,
      city: this.city,
      theme: this.#situation.world.theme,
      life: this.#life(npc),
      room: this.#scene.room(),
      doing: this.#scene.stance(),
      hour: this.#scene.hour,
      weather: this.#scene.weather,
      company: this.#scene.company(),
      carrying: this.#scene.carrying(),
      wares: this.#holding.wares(),
      pocket: this.#holding.pocket(),
      home: this.#holding.home(),
      knowledge: this.#knowledge(npc),
      hearsay: this.#scene.hearsay(),
      background: offered.length
        ? offered.map((fact, index) => fill(LINES.fact!, { number: String(index + 1), fact: fact.fact })).join('\n')
        : LINES['no-background']!,
      standing: this.#scene.standing(),
      disposition: this.#memory.disposition(),
      memories: this.#memory.held(),
      situation: this.#wants.block(moves),
      examples: this.#examples.shown(),
    })
  }

  /** The whole kept exchange, as the voice track reads it before answering. */
  exchange(history: readonly Turn[]): string {
    return this.#lines(history)
  }

  /** The exchange as the decider reads it: the last few turns, most recent last. */
  transcript(history: readonly Turn[]): string {
    return this.#lines(history.slice(-RECENT))
  }

  #lines(turns: readonly Turn[]): string {
    return turns.map((turn) => `${turn.role === 'user' ? LINES.them! : this.npcName}: "${turn.content}"`).join('\n')
  }

  /** The generator's lines about this person, one per field it wrote. Personality is always there. */
  #life(npc: Npc): string {
    const fields: Record<string, string | undefined> = { personality: npc.personality, ...npc.life }
    return Object.entries(fields)
      .filter(([key, value]) => value && LIFE[key])
      .map(([key, value]) => `- ${fill(LIFE[key]!, { value: value! })}`)
      .join('\n')
  }

  /** What they know, and what the whole town knows. */
  #knowledge(npc: Npc): string {
    const own = npc.knowledge.map((fact) => `- ${fact}`)
    const common = (this.#situation.world.premise()?.common ?? []).map((fact) => fill(LINES.common!, { fact }))
    const lines = [...own, ...common]
    return lines.length ? lines.join('\n') : LINES['no-knowledge']!
  }

  #npc(): Npc {
    return this.#situation.world.npc(this.#situation.npcId)!
  }
}
