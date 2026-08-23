import type { Rng } from '@gb/kit'
import type { Anchor, BodyKind, BuildingKind, ItemArchetype, NpcRole } from '@gb/world'
import type { InteriorPlan } from '../interior/plan.ts'
import type { PlotSite } from '../layout/plots.ts'

/**
 * A site the town has decided to build on, before anybody has looked inside it.
 * How the kind was picked is the caller's business: a whole town rolls it off
 * the mix, and `extend` draws one at a time into the gaps.
 */
export interface Chosen {
  readonly site: PlotSite
  readonly kind: BuildingKind
  readonly storeys: number
  /** Whether its door is on one of the town's avenues. */
  readonly onAvenue: boolean
  /** Its own stream, so the inside is planned off the same seed the outside was. */
  readonly rng: Rng
}

/** A post inside a building that somebody is going to be written into. */
export interface PlannedPost {
  readonly anchor: Anchor
  readonly role: NpcRole
  /** Where this person falls in the town's own count of people. */
  readonly index: number
  readonly appearance: { readonly base: BodyKind; readonly variant: number }
}

/** Something lying about inside a building, waiting to be named. */
export interface PlannedThing {
  /** The handle a narrator's answer comes back under. */
  readonly thingId: string
  readonly archetype: ItemArchetype
  readonly anchorId: string
  /** Where this thing falls in the town's own count of things. */
  readonly index: number
  readonly value: number
}

/** The inside of a building that opens: the shell, and what is waiting to be written into it. */
export interface PlannedInside {
  readonly interiorId: string
  readonly size: { readonly w: number; readonly h: number }
  readonly plan: InteriorPlan
  readonly posts: readonly PlannedPost[]
  readonly things: readonly PlannedThing[]
}

/** One building, planned end to end: everything about it that is arithmetic rather than invention. */
export interface PlannedSite extends Chosen {
  /** Where it falls in the town's own count of plots. */
  readonly index: number
  readonly style: string
  /** The sign over its door, written in the box. A place that opens is renamed by whoever writes it. */
  readonly sign: string
  /** Present only for the doors that open. */
  readonly inside?: PlannedInside
}
