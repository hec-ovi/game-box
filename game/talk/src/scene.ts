import type { Npc } from '@gb/world'
import type { Situation } from './moves.ts'
import { PROMPTS } from './prompts.generated.ts'
import { bands, fill, inBand, keyed } from './text.ts'

const WORDS = keyed(PROMPTS.surroundings)
const STANDING = bands(keyed(PROMPTS.standing))

/**
 * Where this person is standing, who is in the room with them, what the hour
 * and the sky are doing, and what the player's name in town is worth to them.
 * All of it is what they could see or would have heard, so a character can be
 * specific about the place and the moment they are actually in.
 */
export class Scene {
  #situation: Situation

  constructor(situation: Situation) {
    this.#situation = situation
  }

  /** The building they are in, named the way the town names it. */
  get place(): string {
    return this.#plot()?.name ?? WORDS.outside!
  }

  /** The spot they keep, as an anchor kind. Nothing when they are not stationed. */
  get doing(): string | undefined {
    return this.#anchor()?.kind
  }

  /** The room, the company, the hour and the weather, in one paragraph. */
  where(): string {
    const clock = this.#situation.player.clock
    const hour = { reading: clock.reading, weather: WORDS[clock.weather] ?? '' }
    if (!this.#station()) return fill(WORDS.street!, hour)

    const here = fill(WORDS.inside!, { ...hour, station: WORDS[this.doing ?? ''] ?? WORDS.stand! })
    return `${here} ${this.#company()}`
  }

  /** How this person takes the player before a word is said. */
  standing(): string {
    return inBand(STANDING, this.#situation.player.reputation()) ?? ''
  }

  /** Who else is in the building, which is who they can see from where they stand. */
  others(): readonly Npc[] {
    const { world, npcId } = this.#situation
    const plotId = this.#plot()?.id
    return plotId ? world.npcsIn(plotId).filter((other) => other.id !== npcId) : []
  }

  #company(): string {
    const others = this.others()
    if (!others.length) return WORDS.alone!
    const people = others.map((other) => fill(WORDS.person!, { name: other.name, role: other.role })).join(', ')
    return fill(WORDS.others!, { people })
  }

  #station() {
    return this.#situation.world.npc(this.#situation.npcId)?.station
  }

  #interior() {
    const station = this.#station()
    return station && this.#situation.world.interior(station.interiorId)
  }

  #anchor() {
    const station = this.#station()
    return station && this.#interior()?.anchors.find((candidate) => candidate.id === station.anchorId)
  }

  #plot() {
    const interior = this.#interior()
    return interior && this.#situation.world.plot(interior.plotId)
  }
}
