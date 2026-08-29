import type { Rng } from '@gb/kit'
import type { Access, Anchor, BodyKind, ItemArchetype, NpcRole, ResolvedCharter } from '@gb/world'
import type { InteriorPlan } from '../interior/plan.ts'
import type { PlotSite } from '../layout/plots.ts'

/**
 * A site the town has decided to build on: a footprint, a door and a height,
 * and nothing about what the building is. That is the architecture's whole
 * answer, and what stands here is the writing's.
 *
 * Where the site came from is the caller's business: a whole town cuts them out
 * of its blocks, `extend` drops one at a time into the gaps, and a growth also
 * offers up the facades already standing so one of them can be opened.
 */
export interface Chosen {
  readonly site: PlotSite
  readonly storeys: number
  /** Whether its door is on one of the town's avenues. */
  readonly onAvenue: boolean
  /** The part of the city it stands in. Absent when the city was never cut into any. */
  readonly district?: string
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
  /** What the town already said it is. A growth never opens a door nobody ever said anything about, so there is always one. */
  readonly charter: ResolvedCharter
}

/** A post inside a building that somebody is going to be written into. */
export interface PlannedPost {
  /** Minted here, because the work is written against the people before anybody has written them. */
  readonly npcId: string
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
  /** Minted here, because a door names it and the work is written against it. */
  readonly itemId: string
  /** Whose it is: whoever carries it, else whoever is behind the counter of the place it lies in. */
  readonly ownerNpcId?: string
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

/**
 * A building as the architecture leaves it: a footprint, a door, a height, the
 * street it stands on and its number in the town. Nothing about what it is,
 * because that is what the writing is asked next.
 */
export interface Sited extends Chosen {
  /** Where it falls in the town's own count of plots. */
  readonly index: number
  /** The street its door is on. */
  readonly street?: string
  /** Its footprint in metres, across the front then front to back. */
  readonly floor: { readonly frontage: number; readonly depth: number }
}

/** One building, planned end to end: what the writing said it is, and everything about it that follows by arithmetic. */
export interface PlannedSite extends Sited {
  /** What kind of place it is: the writing's answer, or the architecture's own placeholder where nothing was written. */
  readonly charter: ResolvedCharter
  readonly style: string
  /** The sign over its door. A door the writing left blank keeps the one composed in the box. */
  readonly sign: string
  /** Present only for the doors that open. */
  readonly inside?: PlannedInside
}
