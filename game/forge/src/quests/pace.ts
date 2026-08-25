import { METRICS } from '@gb/world'

/**
 * How long a job is given, in the seconds a quest timer counts.
 *
 * Timers are read off the game clock, which `@gb/play` runs at 24 game seconds
 * a real second, so a game day is a real hour. What eats real time is not the
 * walk: one reply from the model costs 8 to 19 real seconds, which is 200 to
 * 450 game seconds, and a walk across town is a real minute or two. So every
 * conversation the job needs is budgeted at `A_TALK`, every walk at least
 * `A_WALK` or the metres at walking pace, whichever is longer, and no job is
 * ever given under `AN_HOUR`: below that a slow reply fails it on its own.
 * The numbers are `@gb/quest`'s own guidance, under "Timers".
 */
const CLOCK_RATE = 24

/** Game seconds one conversation is given. */
const A_TALK = 600

/** The least one leg of walking is given, however short it is. */
const A_WALK = 3000

/** The least any timed job is given. */
const AN_HOUR = 3600

/** The longest timer the quest schema takes: one game day. */
const A_DAY = 86400

/** How much longer than the bare walk and talk a timed job gives the player. */
const SLACK = 1.5

/** What a timed job asks of the player, in the units the clock is budgeted in. */
export interface Timed {
  /** Metres walked door to door, the whole way round. */
  readonly metres: number
  /** Separate walks: door to door legs. */
  readonly legs: number
  /** Conversations, hand-overs included: each one is a model reply. */
  readonly talks: number
}

/** A fair time limit, in game seconds, for a job that walks this far and talks this much. */
export function secondsFor(job: Timed): number {
  const walking = Math.max(job.legs * A_WALK, (job.metres / METRICS.player.walkSpeed) * CLOCK_RATE)
  const seconds = Math.round((walking + job.talks * A_TALK) * SLACK)
  return Math.max(AN_HOUR, Math.min(A_DAY, seconds))
}
