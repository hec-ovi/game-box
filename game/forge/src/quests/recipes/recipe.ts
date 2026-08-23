import type { Rng } from '@gb/kit'
import type { Flavour } from '../../theme/flavour.ts'
import type { CastItem, CastPerson, CityCast } from '../cast.ts'
import { payFor, type Load } from '../difficulty.ts'
import { clip, type Condition, type Draft, type FailWhen, type Step } from '../shape.ts'

/** One quest the writer has asked for, before a recipe fills it in. */
export interface Job {
  readonly id: string
  readonly kind: 'main' | 'side'
  /** What the player must already have done to be offered this at all. */
  readonly requires: readonly Condition[]
  /** The flag this quest raises when it is finished, for whatever waits on it. */
  readonly grants?: string
  /** The person who has to hand it out, when the caller has already chosen one. */
  readonly from?: CastPerson
}

/** A way of writing one quest out of whatever the town happens to hold. */
export interface Recipe {
  readonly name: string
  /** Whether this recipe can carry the main line. */
  readonly leads: boolean
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
    const { difficulty, reward } = payFor(written.load)
    const steps = written.steps.map((step) => (step.kind === 'complete' ? this.#granting(step, job) : step))
    cast.book(written.items, [written.giver.npc.npcId])

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
      ...(job.requires.length ? { requires: job.requires } : {}),
      ...(written.failWhen?.length ? { failWhen: written.failWhen } : {}),
    }
  }

  /** Finishing a quest raises whatever flag the town is waiting on. */
  #granting(step: Step, job: Job): Step {
    if (!job.grants) return step
    return { ...step, effects: [...(step.effects ?? []), { kind: 'set-flag', flag: job.grants, value: true }] }
  }
}
