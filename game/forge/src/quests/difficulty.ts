import { DIFFICULTIES, REWARD_TABLE, rewardFor } from '@gb/quest'

export type Difficulty = (typeof DIFFICULTIES)[number]

export type Reward = ReturnType<typeof rewardFor>

/** What a job actually costs the player, which is what it is paid on. */
export interface Load {
  /** Metres walked door to door, the whole way round. */
  readonly metres: number
  /** Steps the player has to do something for. */
  readonly legs: number
  /** Taking something that belongs to somebody. */
  readonly stolen?: boolean
  /** Against the clock. */
  readonly timed?: boolean
  /** Somebody walks with you and can be lost. */
  readonly escort?: boolean
  /** How many things have to be carried. */
  readonly items?: number
}

/** What a job is worth: its band, its pay, and what is left over for side work. */
export interface Pay {
  readonly difficulty: Difficulty
  readonly reward: Reward
  /** What a step may pay on top without pushing the quest out of its band. */
  readonly bonus: number
}

/** A walk of this many metres is worth one point of difficulty. */
const A_WALK = 120

const WEIGHT = { leg: 0.6, stolen: 1.2, timed: 1.5, escort: 1.5, item: 0.8 }

/** Where each band starts, hardest first. */
const BANDS: ReadonlyArray<readonly [Difficulty, number]> = [
  ['epic', 8],
  ['hard', 5.5],
  ['standard', 3.5],
  ['small', 2],
  ['errand', 0],
]

/** How wide the top band is, since nothing sits above it. */
const EPIC_SPAN = 6

/** How much of the room above the going rate a job at the top of its band takes. */
const STRETCH = 0.5

/** What an extra step may pay, as a share of the quest's own money. */
const SIDE_SHARE = 0.4

/** The least a payment is worth writing down. */
const A_COIN = 5

/** What the work adds up to, in one number. */
function effortOf(load: Load): number {
  return (
    load.metres / A_WALK +
    load.legs * WEIGHT.leg +
    (load.stolen ? WEIGHT.stolen : 0) +
    (load.timed ? WEIGHT.timed : 0) +
    (load.escort ? WEIGHT.escort : 0) +
    Math.max(0, (load.items ?? 1) - 1) * WEIGHT.item
  )
}

/** The band a job falls in: how far, how many steps, and what it asks of you. */
function difficultyOf(load: Load): Difficulty {
  const effort = effortOf(load)
  return BANDS.find(([, floor]) => effort >= floor)?.[0] ?? 'small'
}

/**
 * What a job pays: the band's going rate, moved up towards the band's ceiling
 * by how hard this particular job is inside its band, minus standing when the
 * work is a theft. Two standard jobs are not paid the same, and no job is ever
 * paid outside what `@gb/quest` allows for its difficulty. The standing goes to
 * whoever the work was for, so working for one side of a town is not the same
 * as being well thought of in general.
 */
export function payFor(load: Load, faction?: string): Pay {
  const effort = effortOf(load)
  const difficulty = difficultyOf(load)
  const band = REWARD_TABLE[difficulty]
  const going = rewardFor(difficulty, faction)
  const money = Math.round(going.money + within(difficulty, effort) * (band.money.max - going.money) * STRETCH)
  const reward: Reward = {
    ...going,
    money,
    reputation: load.stolen ? -Math.max(1, Math.round(going.reputation / 2)) : going.reputation,
  }
  const room = band.money.max - money
  const bonus = Math.min(room, Math.round(money * SIDE_SHARE))
  return { difficulty, reward, bonus: bonus >= A_COIN ? bonus : 0 }
}

/** How far into its own band a job sits, from 0 at the floor to 1 at the ceiling. */
function within(difficulty: Difficulty, effort: number): number {
  const index = BANDS.findIndex(([band]) => band === difficulty)
  const floor = BANDS[index]![1]
  const ceiling = index > 0 ? BANDS[index - 1]![1] : floor + EPIC_SPAN
  return Math.max(0, Math.min(1, (effort - floor) / (ceiling - floor)))
}
