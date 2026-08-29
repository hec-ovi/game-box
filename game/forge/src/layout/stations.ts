/**
 * Metres of town between one station and the next: about ten blocks, which is
 * a walk of six minutes at the far end of it. Where fast travel boards is a
 * distance, so a city wants a handful of entrances however many plots it holds
 * and a town smaller than half that spacing wants none.
 */
const SPACING = 500

/**
 * The fewest entrances a town that boards at all has. A ride goes from one
 * entrance to another, so a town with a single station is a travel panel with
 * nowhere to go: it boards nowhere, or it boards somewhere worth riding to.
 */
const FEWEST = 2

/**
 * How many stations a town this many metres across wants.
 *
 * Nothing here puts one up. A station is a kind of place, and what a building
 * is belongs to the writing, so this is a number the writing is handed with the
 * doors it has to fill (`interior/needs.ts`) rather than a plot this box picks.
 *
 * `demanded` is whether the town's own history says it has one. A history that
 * says so is honoured wherever the spacing would ask for none, and the town
 * then wants a second, because the first only means anything once there is
 * somewhere to ride to.
 */
export function stationsWanted(span: number, demanded: boolean): number {
  const spaced = Math.round(span / SPACING)
  if (!spaced && !demanded) return 0
  return Math.max(spaced, FEWEST)
}
