import { Rng } from '@gb/kit'
import { STATIONS } from './schedule.ts'

/**
 * Which screen shows what: the distribution, kept apart from the technique.
 *
 * What is on a screen is two numbers, its station and how far into that
 * station's schedule it is, and both are drawn from the town's seed. A room
 * draws one of a fixed handful of screenings from its own id, so the bar and
 * the flat above it are on different channels at different moments, the same
 * bar is on the same one on the second visit, and the number of screen
 * geometries in a town of any size is `SCREEN_SLOTS`.
 *
 * Retuning who watches what is this file. It cannot reach what a screen looks
 * like, which is `picture.ts` and `glass.ts`.
 */

/** How many different screenings a town has. */
export const SCREEN_SLOTS = 6

export interface Screening {
  /** Which station, 1 to `STATIONS`. Zero is not a screen at all. */
  readonly station: number
  /** How far into that station's schedule this screen is, 0 to 1. */
  readonly phase: number
}

/**
 * What a builder stamps on a face that is a screen. It says only "this is
 * glass": which station is on it is written over the stamp by `tunedTo`, so a
 * prop builder never learns what a town watches.
 */
export const SCREEN_MARK: Screening = { station: 1, phase: 0 }

/** One of the town's screenings. */
export function screeningOf(seed: string, slot: number): Screening {
  const rng = new Rng(seed).fork('furnish').fork('screen').fork(`slot:${slot}`)
  return { station: rng.int(1, STATIONS + 1), phase: rng.float() }
}

/** Which screening the screens in one interior are showing. */
export function screenSlot(seed: string, interiorId: string): number {
  return new Rng(seed).fork('furnish').fork('screen').fork(interiorId).int(0, SCREEN_SLOTS)
}
