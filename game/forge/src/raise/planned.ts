import type { Rng } from '@gb/kit'
import type { Access, Anchor, BodyKind, ItemArchetype, NpcRole, ResolvedCharter } from '@gb/world'
import type { InteriorPlan } from '../interior/plan.ts'
import type { PlotSite } from '../layout/plots.ts'

/**
 * A site the town has decided to build on, before anybody has looked inside it.
 * How the kind was picked is the caller's business: a whole town rolls it off
 * the mix, `extend` draws one at a time into the gaps, and a growth also offers
 * up the facades already standing so one of them can be opened.
 */
export interface Chosen {
  readonly site: PlotSite
  /** What kind of place goes up here. */
  readonly charter: ResolvedCharter
  readonly storeys: number
  /** Whether its door is on one of the town's avenues. */
  readonly onAvenue: boolean
  /** Its own stream, so the inside is planned off the same seed the outside was. */
  readonly rng: Rng
  /** The building already standing here, when this is a facade a growth may open rather than new land. */
  readonly standing?: Standing
}

/** A building the city already has: a painted-on door a growth can turn into a real place. */
export interface Standing {
  readonly plotId: string
  /** The sign it already carries. An opened facade keeps it, so the street reads as it always did. */
  readonly name: string
  /** Where it falls in the town's own count of plots, which is what its people and its things are drawn from. */
  readonly index: number
}

/** A post inside a building that somebody is going to be written into. */
export interface PlannedPost {
  readonly anchor: Anchor
  readonly role: NpcRole
  /** Where this person falls in the town's own count of people. */
  readonly index: number
  readonly appearance: { readonly base: BodyKind; readonly variant: number }
}

/**
 * Something inside a building: stock lying on a surface waiting to be named,
 * or a key, a card or a deed the plan wrote for a lock or a sale. The narrator
 * names the stock; a key or a deed is named here off what it opens or owns.
 */
export interface PlannedThing {
  /** The handle a narrator's answer comes back under. */
  readonly thingId: string
  readonly archetype: ItemArchetype
  /** Where it lies, or whose pocket it is in when `carried`. */
  readonly anchorId: string
  /** Where this thing falls in the town's own count of things. */
  readonly index: number
  readonly value: number
  /** Minted at plan time, because a door already names it. */
  readonly itemId?: string
  /** What a key or a card opens. */
  readonly opens?: Access
  /** The room a key is the key to. */
  readonly room?: string
  /** The interior a deed is ownership of. */
  readonly deedTo?: string
  /** In the pocket of whoever stands on `anchorId`, rather than lying on it. */
  readonly carried?: boolean
}

/** Whether a thing is one the narrator is asked to name, or one written here off what it opens or owns. */
export const narrated = (thing: PlannedThing): boolean => thing.opens === undefined && thing.deedTo === undefined

/** The inside of a building that opens: the shell, and what is waiting to be written into it. */
export interface PlannedInside {
  readonly interiorId: string
  readonly size: { readonly w: number; readonly h: number }
  readonly plan: InteriorPlan
  readonly posts: readonly PlannedPost[]
  readonly things: readonly PlannedThing[]
  /** Whole credits the place is for sale for: a home whose deed lies on a counter somewhere, its residents still in it. */
  readonly forSale?: number
}

/** One building, planned end to end: everything about it that is arithmetic rather than invention. */
export interface PlannedSite extends Chosen {
  /** Where it falls in the town's own count of plots. */
  readonly index: number
  readonly style: string
  /** The sign over its door, written in the box. A place that opens is renamed by whoever writes it, unless it was already standing. */
  readonly sign: string
  /** The street its door is on. */
  readonly street?: string
  /** Present only for the doors that open. */
  readonly inside?: PlannedInside
}
