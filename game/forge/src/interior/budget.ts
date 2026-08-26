/**
 * How many doors a town opens.
 *
 * A door is never a share of every plot: most of a city is frontage, and a
 * twenty-block town that opened one building in eight would open three hundred
 * of them, none of which anybody would learn by name. But a city big enough to
 * need the subway needs far more than a hamlet does, or a player walks two
 * kilometres past painted windows to reach the only three places in the game.
 *
 * So the count follows how many buildings there are. It used to follow how far
 * the town was across, which is the same mistake in the other direction: a town
 * spreads as its span but fills as its span squared, so every city built bigger
 * came out thinner. A twenty by twenty town of 2,781 buildings opened eleven
 * doors, four tenths of one percent of it.
 *
 * A brief that names a number gets that number, up to `MOST_PLACES`.
 *
 * The number is the town's, never the batch's, so building a city bigger opens
 * no more doors than the town's own count. Growing one later is the other case:
 * a growth is an authored addition and it says how many more doors it opens.
 */

/** Open places the smallest town has: a town you can cross on foot wants no more. */
export const OPEN_PLACES = 3

/**
 * Buildings per door. At forty, a twenty by twenty city opens about seventy,
 * which is a door every hundred and fifty metres of walking: one or two a
 * block, the way a street actually reads.
 */
const BUILDINGS_A_DOOR = 40

/**
 * Open places a city has when the brief does not say: three in a small town,
 * one per `BUILDINGS_A_DOOR` after that, stopping at `MOST_PLACES`.
 */
export const openPlacesFor = (buildings: number): number =>
  Math.max(OPEN_PLACES, Math.min(MOST_PLACES, Math.round(buildings / BUILDINGS_A_DOOR)))

/**
 * The most a brief may ask for. Every one of them is a place the model writes
 * whole, with the people in it, so this is a ceiling on what somebody is
 * willing to wait for rather than on what the town can hold.
 */
export const MOST_PLACES = 200

/**
 * The most a town may open and still be a town of frontage: strictly fewer than
 * half of it. A town of one or two buildings opens one anyway, because a town
 * with no door at all is not a town.
 */
export const mostOpen = (buildings: number): number => Math.max(1, Math.ceil(buildings / 2) - 1)

/**
 * How many doors new land opens among itself. A growth's new blocks are a
 * district and a district is a town: it opens the town's own number of places,
 * and stays mostly frontage the way a hamlet does, so a growth of two buildings
 * opens one and a growth of thirty opens three.
 */
export const placesOnNewLand = (buildings: number): number => (buildings > 0 ? Math.min(OPEN_PLACES, mostOpen(buildings)) : 0)

/** What a town already has up, before this batch of buildings. */
export interface Standing {
  /** Buildings already standing. */
  readonly built: number
  /** How many of them already open. */
  readonly open: number
}

/**
 * What a town may have open, and how much of that this batch gets to spend.
 *
 * The city's own number wins everywhere except in a hamlet too small to hold it
 * and still be mostly frontage, where the ceiling wins: three doors in a town
 * of four buildings is not a town of frontage.
 */
export class DoorBudget {
  /** Doors the whole town may have open once this batch is up. */
  readonly town: number
  /** How many of this batch may open: the town's allowance, less what already does. */
  readonly spare: number

  constructor(standing: Standing, adding: number, wanted: number) {
    this.town = Math.min(wanted, mostOpen(standing.built + adding))
    this.spare = Math.max(0, Math.min(adding, this.town - standing.open))
  }
}
