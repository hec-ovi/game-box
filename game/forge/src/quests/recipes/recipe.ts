import type { Rng } from '@gb/kit'
import type { Flavour } from '../../theme/flavour.ts'
import type { CastItem, CastPerson, CityCast } from '../cast.ts'
import { payFor, type Load } from '../difficulty.ts'
import { crossed, partyOf } from '../marks.ts'
import { clip, type Condition, type Draft, type FailWhen, type Step } from '../shape.ts'

/** One quest the writer has asked for, before a recipe fills it in. */
export interface Job {
  readonly id: string
  readonly kind: 'main' | 'side'
  /** What the player must already have done to be offered this at all. */
  readonly requires: readonly Condition[]
  /** The flags this quest raises when it is finished, for whatever waits on them. */
  readonly grants?: readonly string[]
  /** The person who has to hand it out, when the caller has already chosen one. */
  readonly from?: CastPerson
  /**
   * The other side of an argument the player has to settle. A recipe that can
   * put two people in front of the player uses this one instead of picking
   * somebody at random, so the town's own quarrel is what the choice is about.
   */
  readonly against?: CastPerson
}

/** A way of writing one quest out of whatever the town happens to hold. */
export interface Recipe {
  readonly name: string
  /** Whether this recipe can carry the main line. */
  readonly leads: boolean
  /** Whether it can put two named people in front of the player and make them pick. */
  readonly takesSides: boolean
  /** How likely this recipe is in a town like this one. Zero means the town cannot serve it. */
  weight(cast: CityCast, flavour: Flavour): number
  write(cast: CityCast, rng: Rng, job: Job): Draft | undefined
}

/** What a recipe hands to `finish` once it knows who and what its quest is about. */
interface Written {
  readonly giver: CastPerson
  readonly title: string
  readonly summary: string
  readonly steps: readonly Step[]
  readonly load: Load
  readonly items: readonly CastItem[]
  readonly failWhen?: readonly FailWhen[]
}

/**
 * The shared half of every recipe: find who is handing the job out, and turn a
 * flow into a draft that is paid for what it asks and books whatever it used.
 */
export abstract class RecipeBase implements Recipe {
  abstract readonly name: string
  readonly leads: boolean = false
  readonly takesSides: boolean = false

  abstract weight(cast: CityCast, flavour: Flavour): number
  abstract write(cast: CityCast, rng: Rng, job: Job): Draft | undefined

  /** The main line names its own giver; side work asks the town for one. */
  protected giverFor(cast: CityCast, rng: Rng, job: Job, avoid: readonly string[] = []): CastPerson | undefined {
    if (job.from) return job.from
    return cast.giver(rng, avoid)
  }

  /** What is left inside the band for a step that pays on top of the reward. */
  protected bonus(load: Load): number {
    return payFor(load).bonus
  }

  protected finish(cast: CityCast, job: Job, written: Written): Draft {
    // the standing goes to the place the work was for, not to the town at large
    const { difficulty, reward } = payFor(written.load, partyOf(written.giver.place))
    const steps = written.steps.map((step) => (step.kind === 'complete' ? this.#granting(step, job) : step))
    cast.book(written.items, [written.giver.npc.npcId])
    const requires = [...job.requires, ...this.#stillTalking(job, written)]

    return {
      id: job.id,
      kind: job.kind,
      title: clip(written.title, 80),
      summary: clip(written.summary, 600),
      giverNpcId: written.giver.npc.npcId,
      difficulty,
      startStepId: steps[0]!.id,
      steps,
      reward,
      ...(requires.length ? { requires } : {}),
      ...(written.failWhen?.length ? { failWhen: written.failWhen } : {}),
    }
  }

  /**
   * Somebody whose place the player has crossed has nothing to offer them. Side
   * work only: the main line is the town's own argument and is always there to
   * be finished, whichever side of it the player ends up on.
   */
  #stillTalking(job: Job, written: Written): Condition[] {
    if (job.kind !== 'side') return []
    return [{ kind: 'flag', flag: crossed(written.giver.place), value: false }]
  }

  /** Finishing a quest raises whatever flags the town is waiting on. */
  #granting(step: Step, job: Job): Step {
    if (!job.grants?.length) return step
    const raised = job.grants.map((flag) => ({ kind: 'set-flag', flag, value: true }) as const)
    return { ...step, effects: [...(step.effects ?? []), ...raised] }
  }
}
