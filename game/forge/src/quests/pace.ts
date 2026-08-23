import { METRICS } from '@gb/world'

/**
 * How long a walk takes in the seconds a quest timer counts. Timers are read
 * off the game clock, and `@gb/play` runs that clock at 240 game seconds a real
 * second by default, so a two minute walk is most of a game day.
 */
const CLOCK_RATE = 240

/** How much longer than a straight walk a timed job gives the player. */
const SLACK = 2

/** The longest timer the quest schema takes: one game day. */
const LONGEST = 86400
const SHORTEST = 1800

/** A fair time limit, in game seconds, for a job that walks this far. */
export function secondsToWalk(metres: number): number {
  const seconds = Math.round((metres / METRICS.player.walkSpeed) * CLOCK_RATE * SLACK)
  return Math.max(SHORTEST, Math.min(LONGEST, seconds))
}
