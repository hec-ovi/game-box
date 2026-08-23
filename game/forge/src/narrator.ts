import type { BuildingKind, ItemArchetype, NpcRole, Premise, RoomKind } from '@gb/world'

export interface NpcProfile {
  readonly name: string
  readonly personality: string
  readonly knowledge: readonly string[]
}

export interface ItemProfile {
  readonly name: string
  readonly description: string
}

/** A post inside a building, waiting for somebody to be written into it. */
export interface InstancePost {
  /** The caller's handle. It comes back on the answer and is how the person is matched to the post. */
  readonly postId: string
  readonly role: NpcRole
  /** Where this person falls in the town's own count of people, so a narrator with no model can draw from the seed. */
  readonly index: number
}

/** Something lying about inside a building, waiting to be named. */
export interface InstanceStock {
  /** The caller's handle. It comes back on the answer and is how the name is matched to the thing. */
  readonly thingId: string
  readonly archetype: ItemArchetype
  /** Where this thing falls in the town's own count of things. */
  readonly index: number
}

/** One building's own shell: everything a narrator is shown to write the place whole. */
export interface InstanceRequest {
  readonly kind: BuildingKind
  readonly theme: string
  readonly rooms: readonly RoomKind[]
  readonly posts: readonly InstancePost[]
  readonly things: readonly InstanceStock[]
  /** What the city is about, in the few lines `premiseLines` renders it as. Absent when nobody wrote one. */
  readonly premise?: string
  /** Where this building falls in the town's own count of plots. */
  readonly index: number
}

export interface InstancePerson extends NpcProfile {
  readonly postId: string
  readonly role: NpcRole
}

export interface InstanceThing extends ItemProfile {
  readonly thingId: string
}

/** A place written whole: what it is called, what it is, who is in it and what is lying about. */
export interface Instance {
  readonly name: string
  /** What the place is and what has been going on there. Empty when nobody wrote any. */
  readonly character: string
  readonly people: readonly InstancePerson[]
  readonly things: readonly InstanceThing[]
}

/** The abstract world a quest writer sees: who is where, and what is lying about. */
export interface WorldSummary {
  readonly cityName: string
  readonly theme: string
  /** What the city is about: what the main line is for and who the two sides of it are. */
  readonly premise?: Premise
  readonly places: ReadonlyArray<{
    readonly plotId: string
    readonly interiorId?: string
    readonly kind: BuildingKind
    readonly name: string
    /** Where its street door is, in metres: how far a job makes the player walk. */
    readonly door?: { readonly x: number; readonly z: number }
    /** A surface inside it something can be left on, when it has one. */
    readonly stashAnchorId?: string
    readonly npcs: ReadonlyArray<{ readonly npcId: string; readonly name: string; readonly role: NpcRole }>
    readonly items: ReadonlyArray<{
      readonly itemId: string
      readonly name: string
      readonly archetype?: ItemArchetype
      readonly ownerNpcId?: string
    }>
  }>
}

/**
 * Everything about a world that is invention rather than geometry: the city's
 * history, names, personalities, what people know, and the quests that string
 * them together. The generator never asks a narrator for coordinates.
 *
 * `writePremise` is the first call and the one everything else is written
 * against: it comes back before a plot is placed, so the town's history is what
 * decides the mix of buildings, which doors open, what each place is written
 * as, and what the main line is about.
 *
 * `writeInstances` is the one call the generator makes about the places that
 * open: every one of them goes out together, and the answers come back one per
 * request in request order. `namePlace`, `describeNpc` and `describeItem` are
 * the single-place shapes it is the plural of; a narrator that offers no plural
 * is asked those three, one place at a time, for the same city.
 */
export interface Narrator {
  /**
   * The city's history, written before a street is laid: why the town is here,
   * what happened to it, who is arguing about it, and what it therefore holds.
   * A narrator without one gets a town with no story, exactly as before.
   */
  writePremise?(input: { theme: string; seed: string }): Promise<Premise>
  nameCity(input: { theme: string; seed: string; premise?: Premise }): Promise<string>
  namePlace(input: { kind: BuildingKind; theme: string; index: number }): Promise<string>
  describeNpc(input: {
    role: NpcRole
    placeKind: BuildingKind
    placeName: string
    theme: string
    index: number
  }): Promise<NpcProfile>
  describeItem(input: { archetype: ItemArchetype; theme: string; index: number }): Promise<ItemProfile>
  /**
   * Every place that opens, asked for at once. One answer per request, in
   * request order; inside an answer, people carry the `postId` and things the
   * `thingId` they were asked about, so the caller matches by id and never by
   * position.
   */
  writeInstances?(requests: readonly InstanceRequest[]): Promise<readonly Instance[]>
  /** Raw quest documents. The generator validates them and drops the ones that do not hold up. */
  writeQuests(input: { summary: WorldSummary; sideQuests: number }): Promise<unknown[]>
}
