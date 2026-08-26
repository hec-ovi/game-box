/**
 * How many doors a town opens.
 *
 * A city's size is scenery, so a door is never a share of the plots: a
 * twenty-block city would open two hundred of them and none would be learned by
 * name. But a city big enough to need the subway needs more than a hamlet does,
 * or a player walks two kilometres past painted windows to reach the only three
 * places in the game.
 *
 * So a door count grows with the span of the town and stops: three in a town
 * you can cross on foot, and up to `MOST_PLACES` in a city you cannot. A brief
 * that names a number gets that number.
 *
 * The number is the town's, never the batch's, so building a city bigger opens
 * no more doors than the town's own count. Growing one later is the other case:
 * a growth is an authored addition and it says how many more doors it opens.
 */

/** Open places the smallest town has: a town you can cross on foot wants no more. */
export const OPEN_PLACES = 3

/** Metres of town per door past the first three, so a city you cannot walk has places worth the walk. */
const METRES_A_DOOR = 90

/**
 * Open places a city has when the brief does not say. Three in a small town,
 * rising with how far it is across and stopping at `MOST_PLACES`, so a fifty
 * block city is a city rather than three doors and a lot of scenery.
 */
export const openPlacesFor = (metresAcross: number): number =>
  Math.max(OPEN_PLACES, Math.min(MOST_PLACES, OPEN_PLACES + Math.floor(Math.max(0, metresAcross - 400) / METRES_A_DOOR)))

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
