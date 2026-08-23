import type { Situation } from './moves.ts'
import { PROMPTS } from './prompts.generated.ts'
import { fill, keyed } from './text.ts'

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

  /** The room, the company, the hour and the weather, in one paragraph. */
  where(): string {
    const { world, player, npcId } = this.#situation
    const clock = player.clock
    const hour = { reading: clock.reading, weather: WORDS[clock.weather] ?? '' }
    const station = world.npc(npcId)?.station
    if (!station) return fill(WORDS.street!, hour)

    const interior = world.interior(station.interiorId)
    const anchor = interior?.anchors.find((candidate) => candidate.id === station.anchorId)
    const here = fill(WORDS.inside!, { ...hour, station: (anchor && WORDS[anchor.kind]) ?? WORDS.stand! })
    return `${here} ${this.#company(interior?.plotId)}`
  }

  /** How this person takes the player before a word is said. */
  standing(): string {
    const reputation = this.#situation.player.reputation()
    return (STANDING.find((band) => reputation <= band.upTo) ?? STANDING[STANDING.length - 1])?.line ?? ''
  }

  /** Who else is in the building, which is who they can see from where they stand. */
  #company(plotId: string | undefined): string {
    const { world, npcId } = this.#situation
    const others = plotId ? world.npcsIn(plotId).filter((other) => other.id !== npcId) : []
    if (!others.length) return WORDS.alone!
    const people = others.map((other) => fill(WORDS.person!, { name: other.name, role: other.role })).join(', ')
    return fill(WORDS.others!, { people })
  }
}

/** The standing lines in order, each covering everything up to its own number. */
function bands(lines: Record<string, string>): ReadonlyArray<{ upTo: number; line: string }> {
  return Object.entries(lines)
    .map(([upTo, line]) => ({ upTo: Number(upTo), line }))
    .filter((band) => Number.isFinite(band.upTo))
    .sort((a, b) => a.upTo - b.upTo)
}
