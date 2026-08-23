import type { Rng } from '@gb/kit'
import type { CastPerson, CityCast } from './cast.ts'
import { allied } from './marks.ts'
import type { Job } from './recipes/recipe.ts'
import type { Condition } from './shape.ts'

/** The longest main line a generated town gets. */
const MOST_MAIN = 4

/** How many places with people in them a town needs before its main line grows another link. */
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

/**
 * The town's own argument, and the shape of the main line that settles it.
 *
 * A generated town has no story, but it has two counters that matter and a
 * player who will end up on one side of them. The line runs out of the busiest
 * staffed place until the fork, where the player is made to choose between that
 * place and the far side of town; after that the same ladder is climbed from
 * whichever side they picked, from a different person, for different pay, and
 * it finishes somewhere different.
 *
 * Every link raises the same `standing_n` whichever branch it is on, so side
 * work never waits on a branch and the ladder can always be climbed to the top.
 * A town too small for two sides simply does not fork, and its line is the one
 * it always was.
 */
export class MainLine {
  readonly hub: CastPerson | undefined
  readonly rival: CastPerson | undefined
  readonly links: readonly Link[]

  constructor(cast: CityCast, rng: Rng) {
    this.hub = cast.hub(rng)
    if (!this.hub) {
      this.links = []
      return
    }
    const tiers = Math.min(MOST_MAIN, 1 + Math.floor(cast.peopled.length / PER_LINK) + rng.int(0, 2))
    this.rival = tiers >= TO_FORK ? cast.rival(rng, this.hub) : undefined
    // the fork needs a link in front of it to lead up to and one behind it to change
    const fork = this.rival ? rng.int(2, tiers - 1) : 0
    this.links = this.#plan(tiers, fork)
  }

  #plan(tiers: number, fork: number): Link[] {
    const links: Link[] = []
    const hub = this.hub!
    const rival = this.rival

    for (let tier = 1; tier <= tiers; tier++) {
      const climbed = tier === 1 ? [] : [flag(standing(tier - 1))]
      if (!rival || tier < fork) {
        links.push({ label: `main/${tier}`, tier, ...link(hub, climbed, tier) })
        continue
      }
      if (tier === fork) {
        // the one link that puts both sides in front of the player at once
        links.push({ label: `main/${tier}/fork`, tier, ...link(hub, climbed, tier), against: rival })
        continue
      }
      for (const side of [hub, rival]) {
        const taken = [...climbed, flag(allied(side.place))]
        links.push({ label: `main/${tier}/${side.place.plotId}`, tier, ...link(side, taken, tier) })
      }
    }
    return links
  }
}

function link(from: CastPerson, requires: Condition[], tier: number): Omit<Job, 'id'> {
  return { kind: 'main', requires, grants: [standing(tier)], from }
}

const flag = (name: string): Condition => ({ kind: 'flag', flag: name, value: true })
