import type { PlaceRequest } from '@gb/forge'
import type { Charter, Sprawl, Word } from '@gb/world'

/**
 * Which of the town's doors answers which of the things it needs.
 *
 * The town's needs are settled first, in words, and every one of them is
 * answered with a kind of place. That is enough to pick the doors before the
 * writing is asked what the rest of them are: the architecture says how tall
 * each door stands, how much floor it has and whether it is on an avenue, so a
 * station goes on the avenue and a home goes down the lane, and those doors are
 * then pinned to their word in the schema. A need cannot be missed after that,
 * because there is no answer left that misses it.
 */

/** One thing the town needs, once the writing has said which kind of place answers it. */
export interface SettledNeed {
  readonly wants: string
  /** How many of the town's doors have to answer it. */
  readonly count: number
  readonly word: Word
}

/** What the town's needs come to in doors: per kind of place, how many the town owes it and what those doors answer. */
export interface Demand {
  readonly word: Word
  readonly doors: number
  /** What the town wanted of it, in the words it was asked for. One kind often answers two. */
  readonly wants: readonly string[]
}

/**
 * The needs read as doors owed, in the order the town asked for them.
 *
 * One kind of place often answers two needs at once, because a place of that
 * kind really does both: somewhere that serves drink across a counter also
 * seats people. Two needs answered with one word are one row here, and the
 * doors owed is the most either of them asked for rather than the two added up,
 * so a town of three doors is not asked for six.
 */
export function demandOf(needs: readonly SettledNeed[]): Demand[] {
  const by = new Map<Word, { doors: number; wants: string[] }>()
  for (const need of needs) {
    const owed = by.get(need.word) ?? { doors: 0, wants: [] }
    owed.doors = Math.max(owed.doors, need.count)
    owed.wants.push(need.wants)
    by.set(need.word, owed)
  }
  return [...by].map(([word, owed]) => ({ word, ...owed }))
}

/**
 * The doors the needs take, by the door's own index in the town.
 *
 * The kind that cares most about which door it gets goes first: a station wants
 * the avenue and a home wants to be off it, while a place that would be the
 * same building on any of them can take what is left. So each round measures
 * what its second choice would cost every kind still owed a door, and gives the
 * next door to whichever of them stands to lose most by waiting.
 *
 * A town with fewer doors than it needs runs out here rather than stopping the
 * build over arithmetic: what there is room for is pinned and the rest goes
 * unmet, the same way a need for more doors than the town opens is asked for as
 * many as there are.
 */
export function allot(demand: readonly Demand[], places: readonly PlaceRequest[], kinds: readonly Charter[]): Map<number, Demand> {
  const ranks = rankedByFloor(places)
  const owed = demand.flatMap((one) => Array.from({ length: one.doors }, () => one))
  const charters = new Map(demand.map((one) => [one.word, kinds.find((charter) => charter.word === one.word)]))
  const spoken = new Map<number, Demand>()

  while (owed.length) {
    const free = places.filter((place) => !spoken.has(place.index))
    if (!free.length) return spoken
    const wants = owed.map((one) => choice(charters.get(one.word), free, ranks))
    const first = wants.reduce((one, other, at) => (other.cost > wants[one]!.cost ? at : one), 0)
    spoken.set(wants[first]!.door.index, owed.splice(first, 1)[0]!)
  }
  return spoken
}

/** The door a kind of place would take out of the ones still free, and what waiting for it would cost: its second choice against its first. */
function choice(charter: Charter | undefined, free: readonly PlaceRequest[], ranks: Map<number, number>): { door: PlaceRequest; cost: number } {
  const [best, next] = free.map((door) => ({ door, misfit: misfit(charter, door, ranks) })).sort((one, other) => one.misfit - other.misfit)
  return { door: best!.door, cost: next ? next.misfit - best!.misfit : 0 }
}

/** How big each door's floor is against the biggest and smallest in the town, from 0 to 1. A town whose doors are all of a size measures nothing by it. */
function rankedByFloor(places: readonly PlaceRequest[]): Map<number, number> {
  const areas = places.map(floorOf)
  const low = Math.min(...areas)
  const high = Math.max(...areas)
  return new Map(places.map((place) => [place.index, high === low ? 0.5 : (floorOf(place) - low) / (high - low)]))
}

const floorOf = (place: PlaceRequest): number => place.floor.frontage * place.floor.depth

/** How much floor a kind of place wants, in the same 0 to 1 the doors are ranked in. */
const SPRAWL: Record<Sprawl, number> = { narrow: 0, wide: 0.5, block: 1 }

/** What being on the wrong street costs, in storeys, so the two can be weighed against each other. */
const STREET = 2

/** And what the wrong floor costs at the far end of the town's own range. */
const FLOOR = 2

/**
 * How far a door is from the kind of place it would hold. Zero is a door that
 * fits, and the lowest is the one taken.
 *
 * A charter says how tall such a place stands, how much of a plot it wants and
 * whether it is the sort of place a town is met in, and those are exactly the
 * three things the architecture already decided about every door. A word with
 * no charter behind it scores nothing, so its need takes the doors in the order
 * the town laid them out rather than by a fit nobody can measure.
 */
function misfit(charter: Charter | undefined, place: PlaceRequest, ranks: Map<number, number>): number {
  if (!charter) return 0
  const [low, high] = charter.size.storeys
  const storeys = place.storeys < low ? low - place.storeys : Math.max(0, place.storeys - high)
  const floor = Math.abs((ranks.get(place.index) ?? 0) - SPRAWL[charter.size.sprawl]) * FLOOR
  return storeys + floor + street(charter, place)
}

/** Whether the door is on the street such a place belongs on: the trains and the landmarks want the avenue, and people would rather live off it. */
function street(charter: Charter, place: PlaceRequest): number {
  if (charter.transit === 'subway' || charter.prominence === 'landmark') return place.onAvenue ? 0 : STREET
  if (charter.residential) return place.onAvenue ? STREET : 0
  return 0
}
