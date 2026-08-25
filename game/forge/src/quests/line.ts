import type { Rng } from '@gb/kit'
import { CAR_MODELS, type Premise } from '@gb/world'
import type { PremiseSide } from '../premise/check.ts'
import type { CastPerson, CityCast } from './cast.ts'
import { allied } from './marks.ts'
import type { Job, Stake } from './recipes/recipe.ts'
import type { Condition } from './shape.ts'

/** The longest main line a generated town gets. */
const MOST_MAIN = 4

/** How many people a town needs standing in it before its main line grows another link. */
const PER_LINK = 6

/** The fewest links a line needs before it is worth splitting in two. */
const TO_FORK = 3

/** The flag a finished main-line link raises. Side work waits on these. */
export const standing = (tier: number): string => `standing_${tier}`

/** One link of the main line: the job to write, less the id the writer gives it. */
export interface Link extends Omit<Job, 'id'> {
  /** The label its own sub-stream is forked under. */
  readonly label: string
  /** The rung of the ladder it puts the player on. */
  readonly tier: number
}

/** The two sides the town's premise named, bound to its two counters. */
interface Argument {
  readonly what: string
  /** The side the busiest counter in town is on. */
  readonly hub: PremiseSide
  /** The side the far end of town is on. */
  readonly rival: PremiseSide
}

/**
 * The town's own argument, and the shape of the main line that settles it.
 *
 * The premise says what is at stake and who wants what; this binds those two
 * sides to two counters, so the argument is somewhere the player can walk into.
 * The line runs out of the busiest staffed place until the fork, where the
 * player is made to choose between that place and the far side of town; after
 * that the same ladder is climbed from whichever side they picked, from a
 * different person, for different pay, and it finishes somewhere different.
 *
 * A town with no premise still forks, on the same two counters. What it lacks
 * is anything for the choice to be about.
 *
 * Every link raises the same `standing_n` whichever branch it is on, so side
 * work never waits on a branch and the ladder can always be climbed to the top.
 * A town too small for two sides simply does not fork, and its line is the one
 * it always was.
 *
 * The top of the ladder is paid for what it is: the finale is hard work in a
 * town too small to fork and epic in one that does, and it hands over what the
 * town has to give, a car where somewhere works at a bench and a home where
 * one is for sale. The fork is hard work too, and pays the car when the finale
 * pays the home.
 */
export class MainLine {
  readonly hub: CastPerson | undefined
  readonly rival: CastPerson | undefined
  readonly links: readonly Link[]

  constructor(cast: CityCast, rng: Rng, premise?: Premise) {
    this.hub = cast.hub(rng)
    if (!this.hub) {
      this.links = []
      return
    }
    const tiers = Math.min(MOST_MAIN, 1 + Math.floor(cast.people.length / PER_LINK) + rng.int(0, 2))
    this.rival = tiers >= TO_FORK ? cast.rival(rng, this.hub) : undefined
    // the fork needs a link in front of it to lead up to and one behind it to change
    const fork = this.rival ? rng.int(2, tiers - 1) : 0
    this.links = this.#plan(tiers, fork, argumentOf(premise), payoffs(cast, rng, tiers, fork))
  }

  #plan(tiers: number, fork: number, argument: Argument | undefined, worth: ReadonlyMap<number, Payoff>): Link[] {
    const links: Link[] = []
    const hub = this.hub!
    const rival = this.rival

    for (let tier = 1; tier <= tiers; tier++) {
      const climbed = tier === 1 ? [] : [flag(standing(tier - 1))]
      const payoff = worth.get(tier) ?? {}
      if (!rival || tier < fork) {
        links.push({ label: `main/${tier}`, tier, ...link(hub, climbed, tier, stakeOf(argument, false), payoff) })
        continue
      }
      if (tier === fork) {
        // the one link that puts both sides in front of the player at once
        links.push({ label: `main/${tier}/fork`, tier, ...link(hub, climbed, tier, stakeOf(argument, false), payoff), against: rival })
        continue
      }
      for (const [at, side] of [hub, rival].entries()) {
        const taken = [...climbed, flag(allied(side.place))]
        links.push({ label: `main/${tier}/${side.place.plotId}`, tier, ...link(side, taken, tier, stakeOf(argument, at === 1), payoff) })
      }
    }
    return links
  }
}

/** The band a rung is paid in at the least, and what it hands over beyond credits. */
type Payoff = Pick<Job, 'atLeast' | 'pays'>

/**
 * What the ladder pays at its top: the finale, and the fork where there is one.
 * A car only where the town has a garage to hand one out of, a home only where
 * one is for sale, and the home is booked here so no other line promises it.
 */
function payoffs(cast: CityCast, rng: Rng, tiers: number, fork: number): Map<number, Payoff> {
  const worth = new Map<number, Payoff>()
  const car = cast.garage ? { car: rng.pick(CAR_MODELS) } : {}
  if (!fork) {
    worth.set(tiers, { atLeast: 'hard', pays: car })
    return worth
  }
  const home = cast.home(rng)
  worth.set(fork, { atLeast: 'hard', pays: car })
  worth.set(tiers, { atLeast: 'epic', pays: { ...car, ...(home?.interiorId ? { deed: home.interiorId } : {}) } })
  return worth
}

function link(from: CastPerson, requires: Condition[], tier: number, stake: Stake | undefined, payoff: Payoff): Omit<Job, 'id'> {
  return { kind: 'main', requires, grants: [standing(tier)], from, ...(stake ? { stake } : {}), ...payoff }
}


/** The premise's first two sides, which are the two ends of the town's argument. */
function argumentOf(premise?: Premise): Argument | undefined {
  const [hub, rival] = premise?.sides ?? []
  return hub && rival ? { what: premise!.stake, hub, rival } : undefined
}

/** The argument as the person handing this link out sees it: their side, and the other one. */
function stakeOf(argument: Argument | undefined, forRival: boolean): Stake | undefined {
  if (!argument) return undefined
  const { hub, rival, what } = argument
  return forRival ? { what, side: rival, other: hub } : { what, side: hub, other: rival }
}

const flag = (name: string): Condition => ({ kind: 'flag', flag: name, value: true })
