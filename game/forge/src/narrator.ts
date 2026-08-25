import type { Asks, Charter, ItemArchetype, Npc, NpcRole, Premise, RoomKind, Word } from '@gb/world'
import type { History } from './premise/shape.ts'

/**
 * A person as a narrator writes them. `life` and `background` are `@gb/world`'s
 * own shapes: the life is what a prompt is handed so two people in one room
 * answer differently, the background is the codex the player earns. A narrator
 * that leaves them out gets a person who answers off `personality` and
 * `knowledge` alone.
 */
export interface NpcProfile {
  readonly name: string
  readonly personality: string
  readonly knowledge: readonly string[]
  readonly life?: Npc['life']
  readonly background?: Npc['background']
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
  /** The word of the kind of place it is. */
  readonly kind: Word
  /** What that word means: the charter behind it, with its label, its names and its rumours. */
  readonly charter: Charter
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

/** One building that does not open, waiting for the sign over its door. */
export interface PlaceRequest {
  readonly kind: Word
  readonly charter: Charter
  readonly theme: string
  /** Where this building falls in the town's own count of plots. */
  readonly index: number
  /** What the city is about, in the few lines `premiseLines` renders it as. Absent when nobody wrote one. */
  readonly premise?: string
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
  /** What the owner asked of the writing: the main errand, the side work, the tone. */
  readonly asks?: Asks
  readonly places: ReadonlyArray<{
    readonly plotId: string
    readonly interiorId?: string
    readonly kind: Word
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
 * as, and what the main line is about. It may declare kinds of place of its own
 * beside the presets, as `charters`.
 *
 * `namePlaces` is the signs over the doors that do not open, asked for
 * together; a narrator without it gets them written here.
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
   * what happened to it, who is arguing about it, what it therefore holds, and
   * any kind of place it invents to hold it. `brief` and `asks` are the owner's
   * own words and choices, when they gave any. A narrator without one gets a
   * town with no story, built from the presets.
   */
  writePremise?(input: { theme: string; seed: string; brief?: string; asks?: Asks }): Promise<History>
  nameCity(input: { theme: string; seed: string; premise?: Premise }): Promise<string>
  /** A sign for one place. `premise` is the town's story as `premiseLines` renders it, when it has one. */
  namePlace(input: { kind: Word; charter: Charter; theme: string; index: number; premise?: string }): Promise<string>
  /** The signs over every door that does not open, one per request in request order. */
  namePlaces?(requests: readonly PlaceRequest[]): Promise<readonly string[]>
  /** One person for one post. `premise` is the town's story as `premiseLines` renders it, when it has one. */
  describeNpc(input: {
    role: NpcRole
    placeKind: Word
    place: Charter
    placeName: string
    theme: string
    index: number
    premise?: string
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
