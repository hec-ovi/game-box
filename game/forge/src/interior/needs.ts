import type { Premise, ResolvedCharter } from '@gb/world'
import { stationsWanted } from '../layout/stations.ts'
import type { PlaceNeed } from '../narrator.ts'

/**
 * What a town needs its open doors to be.
 *
 * The architecture cuts the doors and says how many; what each one is belongs
 * to the writing. So everything this box used to settle by ranking charters is
 * said here instead, in the words the writer is asked in, and handed over with
 * the doors: a counter to buy across, a room to sit down in, a home, somewhere
 * the trains board, and whatever the town's own history says it holds.
 *
 * Nothing here checks the answer. A town whose writer left it a need is a town
 * missing that thing, the way a town whose writer left a sign blank has the
 * sign this box composed: there is no author here to put one in.
 */

/** The fewest doors a town opens before one of them is a home: a hamlet with two spends both on what a town needs. */
const HOME_AT = 3

/** And one more home for every this many places a brief asks to open, so a wider city has one that stays somebody's as well as one on the market. */
const PER_HOME = 8

/** How many homes a city opens, whatever its size: the one the player buys, and one more per handful of places. */
export const homesFor = (open: number): number => (open >= HOME_AT ? 1 + Math.floor(open / PER_HOME) : 0)

/** The town the needs are read off: how many doors it opens, how far across it is, and what its history says it holds. */
export interface Needing {
  /** Doors this town opens. */
  readonly places: number
  /** The longest side of the town, in metres: what tells it whether it is big enough to need the trains. */
  readonly span: number
  readonly charters: readonly ResolvedCharter[]
  readonly premise?: Premise
}

/**
 * What this town needs, in the order it needs it.
 *
 * The first two are the rooms a town is met in: one counter a thing, a job and
 * a deed change hands over, and one room with seats in it and somebody serving.
 * One place answers both often enough. Then the home the player buys, then
 * somewhere the trains board where the town is big enough to want them, then
 * every kind of place the town's own history says it holds.
 */
export function townNeeds(town: Needing): PlaceNeed[] {
  const demanded = town.premise?.build.mustHave ?? []
  const boards = town.charters.filter((charter) => charter.transit === 'subway').map((charter) => charter.word)
  const stations = stationsWanted(town.span, demanded.some((word) => boards.includes(word)))
  return [
    { wants: 'somewhere to buy something over a counter, with stock to sell across it', count: 1 },
    { wants: 'somewhere to sit down and be served, with seats in the room', count: 1 },
    { wants: 'a home somebody lives in', count: homesFor(town.places) },
    ...(stations ? [{ wants: 'somewhere the trains board', count: stations }] : []),
    ...demanded.map((word) => ({ wants: "a kind of place the town's own history says it has", count: 1, kind: word })),
  ].filter((need) => need.count > 0)
}
