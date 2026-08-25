/**
 * How many doors a town opens.
 *
 * A city's size is scenery. Every plot gets a facade, a sign and a name from
 * the moment it goes up, and a fixed handful of them open, whatever the city
 * is: three by default, as many as the brief asks for. A hundred-block city
 * and a two-block one cost about the same to build, to send to somebody and to
 * learn, and three places every quest is written over are learned by name where
 * two dozen are addresses.
 *
 * The number is the town's, never the batch's, so building a city bigger opens
 * no more doors. Growing one later is the other case: a growth is an authored
 * addition and it says how many more doors the city opens.
 */

/** Open places a city has when the brief does not say: what a player meets, whatever the size. */
export const OPEN_PLACES = 3

/** The most a brief may ask for. Past this a city stops being about the places in it. */
export const MOST_PLACES = 24

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
