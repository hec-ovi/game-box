import type { WorldSummary } from '@gb/forge'
import { Rng } from '@gb/kit'

type Place = WorldSummary['places'][number]

/** The corner of the city one quest is set in. */
export interface Slice {
  /** Where the errand starts. Every distance is the walk from this door. */
  readonly home: Place
  /** The home first, then its neighbours, nearest first. */
  readonly places: readonly Place[]
}

/** How often a job reaches the far side of town instead of the next street. */
const CROSSTOWN = 0.2

/** Metres are rounded to this, because nobody paces out a walk to the metre. */
const STEP = 10

/**
 * The city cut into corners a quest can be written about.
 *
 * A slice has to be small, because a whole city in a prompt is tokens spent on
 * places the errand will never name. But eight places drawn at random are eight
 * places with nothing between them, and an errand that links two of them is
 * then an errand between strangers. So a slice is a neighbourhood: one place
 * the job starts at and the places nearest its door, with the walk between them
 * in metres, which is what lets a quest say "across town" and mean it. About
 * one job in five swaps its furthest neighbour for the far side of the city, so
 * a town is not made entirely of errands you could run in a minute.
 *
 * Which corner a quest gets is drawn from the build's seed and the quest's own
 * index, so it is the same on every run.
 */
export class Neighbourhood {
  #places: readonly Place[]
  #seed: string
  #measurable: boolean

  constructor(places: readonly Place[], seed: string) {
    this.#places = places
    this.#seed = seed
    this.#measurable = places.some((place) => place.door !== undefined)
  }

  /** The corner quest `index` happens in, at most `size` places wide. */
  for(index: number, size: number): Slice {
    const pool = this.#places
    const rng = new Rng(`${this.#seed}:quest_${index}`)
    const peopled = pool.filter((place) => place.npcs.length > 0)
    const home = rng.pick(peopled.length ? peopled : pool)
    if (pool.length <= size) return { home, places: [home, ...pool.filter((place) => place !== home)] }

    const ranked = this.#around(home, rng)
    const chosen = [home, ...ranked.slice(0, size - 1)]

    // the job that crosses the city, so a big town reads as more than one street
    const far = ranked[ranked.length - 1]
    if (far && rng.chance(CROSSTOWN) && !chosen.includes(far)) chosen[chosen.length - 1] = far

    // and whatever else it is, a corner always has something in it to pick up
    if (!chosen.some(carries)) {
      const nearest = ranked.find(carries)
      if (nearest && !chosen.includes(nearest)) chosen[chosen.length - 1] = nearest
    }
    return { home, places: chosen }
  }

  /** Everywhere else, nearest door first. A city with no doors in it falls back to the seed. */
  #around(home: Place, rng: Rng): readonly Place[] {
    const rest = this.#places.filter((place) => place !== home)
    if (!this.#measurable) return rng.shuffle(rest)
    return rest
      .map((place) => ({ place, away: walk(home, place) ?? Number.POSITIVE_INFINITY }))
      .sort((a, b) => a.away - b.away || (a.place.plotId < b.place.plotId ? -1 : 1))
      .map((entry) => entry.place)
  }
}

function carries(place: Place): boolean {
  return place.items.length > 0
}

/** The walk between two doors, in metres, when both of them are on the map. */
export function walk(from: Place, to: Place): number | undefined {
  if (!from.door || !to.door) return undefined
  return Math.hypot(from.door.x - to.door.x, from.door.z - to.door.z)
}

/**
 * The slice written out for the model: every place by id, who is in it, what is
 * lying about, and how far it is from the door the errand starts at.
 */
export function describeSlice(slice: Slice, characters: ReadonlyMap<string, string>): string {
  return slice.places
    .map((place) => {
      const away = place === slice.home ? undefined : walk(slice.home, place)
      const where =
        place === slice.home
          ? '. The errand starts here.'
          : away === undefined
            ? ''
            : `, ${Math.round(away / STEP) * STEP} m from ${slice.home.name}.`
      const character = characters.get(place.name)
      const people =
        place.npcs.map((npc) => `${npc.name} (${npc.role}, ${npc.npcId})`).join('; ') || 'nobody'
      const things =
        place.items
          .map((item) => `${item.name} (${item.itemId}${item.ownerNpcId ? `, owned by ${item.ownerNpcId}` : ''})`)
          .join('; ') || 'nothing'
      return [
        `- ${place.name}, a ${place.kind} (${place.plotId})${where}`,
        ...(character ? [`    what it is: ${character}`] : []),
        `    people: ${people}`,
        `    things: ${things}`,
      ].join('\n')
    })
    .join('\n')
}
