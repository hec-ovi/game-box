import type { PlaceRequest } from '@gb/forge'

/**
 * One of the town's doors, in the words a prompt reads.
 *
 * A building reaches a writer twice: once before anything in the town is
 * anything, when all there is to say about it is the architecture, and once
 * with its sign to write, by which time it may be a bar with two jobs running
 * through it. Both lines are written here so the two calls describe one door
 * the same way.
 */

/** How big it stands and where: the architecture, and the whole of what a building nobody has said anything about is. */
export function standingLine(place: PlaceRequest): string {
  const size = `${place.storeys} ${place.storeys === 1 ? 'storey' : 'storeys'}, ${Math.round(place.floor.frontage)} by ${Math.round(place.floor.depth)} metres`
  const where = place.street ? `${place.onAvenue ? ' on the avenue ' : ' on '}${place.street}` : place.onAvenue ? ' on an avenue' : ''
  return `${size}${where}`
}

/** The same door once one of the town's needs has taken it: where it stands, what it is, and what it answers. */
export function settledLine(place: PlaceRequest, is: string, answers: readonly string[]): string {
  return `${standingLine(place)}. Settled: a ${is}, because the town needs ${answers.join(', and ')}`
}

/** The same door once its sign is being written: what it is where that is settled, and what the town's work does behind it. */
export function doorLine(place: PlaceRequest): string {
  const what = place.charter ? `a ${place.charter.label}${place.street ? `${place.onAvenue ? ' on the avenue ' : ' on '}${place.street}` : ''}` : standingLine(place)
  const work = place.work?.length ? `. What the town's work does here: ${place.work.join('; ')}` : ''
  return `${what}${work}`
}
