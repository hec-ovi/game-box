import type { Asks, Charter, ItemArchetype, MachineProgram, Npc, NpcRole, Premise, RoomKind, Word, WorkKind } from '@gb/world'
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

/**
 * What the plan put in a place beyond its people and its stock: the brief a
 * writer builds a line on. A room behind a lock and how the lock opens, the
 * screens and what each runs, whether a camera watches the door, and whether
 * the place is for sale.
 */
export interface InstanceBrief {
  /** Rooms behind a locked door, by name, and what opens it: a key, a card, or a code somebody can be told. */
  readonly locked: ReadonlyArray<{ readonly room: string; readonly by: 'key' | 'card' | 'code' }>
  /** Every screen in the place, the room it is in and the program it runs. */
  readonly machines: ReadonlyArray<{ readonly room: string; readonly program: MachineProgram }>
  readonly camera: boolean
  /** Whole credits the place sells for. Absent is not for sale. */
  readonly forSale?: number
}

/** One building's own shell: everything a narrator is shown to write the place whole. */
export interface InstanceRequest extends PlaceRequest {
  readonly rooms: readonly RoomKind[]
  readonly posts: readonly InstancePost[]
  /** The stock to name. Keys, cards and deeds are not in it: they are named here off what they open or own. */
  readonly things: readonly InstanceStock[]
  readonly has: InstanceBrief
}

export interface InstancePerson extends NpcProfile {
  readonly postId: string
  readonly role: NpcRole
}

export interface InstanceThing extends ItemProfile {
  readonly thingId: string
}

/** One building as a narrator is shown it: what it is, where it stands, and what town it is in. */
export interface PlaceRequest {
  /** The word of the kind of place it is. */
  readonly kind: Word
  /** What that word means: the charter behind it, with its label, its names and its rumours. */
  readonly charter: Charter
  readonly theme: string
  /** Where this building falls in the town's own count of plots. */
  readonly index: number
  /** The street its door is on. Absent when the door stands on no street band. */
  readonly street?: string
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

/** A locked door as a quest writer sees it: what opens it, who carries that, and what lies behind it. */
export interface SummaryLock {
  readonly doorId: string
  /** The room behind it, and whether it is the street door. */
  readonly room: string
  readonly roomId: string
  readonly street: boolean
  readonly keyItemId?: string
  /** Who carries the key, when somebody in the place does. */
  readonly keeperNpcId?: string
  readonly password?: string
  /** Things lying in the room behind it. */
  readonly behind: readonly string[]
}

/** A screen as a quest writer sees it: what it runs and what opens it. */
export interface SummaryMachine {
  readonly machineId: string
  readonly program: MachineProgram
  readonly locked: boolean
  readonly password?: string
  readonly roomId: string
}

/** The abstract world a quest writer sees: who is where, what is lying about, what is locked and what runs on the screens. */
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
    /** The work done in it, off its charter: a place that works at a bench has a car to hand out. */
    readonly work?: readonly WorkKind[]
    /** Whole credits it is for sale for. */
    readonly forSale?: number
    readonly locks?: readonly SummaryLock[]
    readonly machines?: readonly SummaryMachine[]
    readonly npcs: ReadonlyArray<{ readonly npcId: string; readonly name: string; readonly role: NpcRole; readonly roomId?: string }>
    readonly items: ReadonlyArray<{
      readonly itemId: string
      readonly name: string
      readonly archetype?: ItemArchetype
      readonly ownerNpcId?: string
      /** The price its counter sells it for. */
      readonly value?: number
      readonly roomId?: string
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
  /** A sign for one place: `street` is the one its door is on, `premise` the town's story as `premiseLines` renders it, when it has one. */
  namePlace(input: { kind: Word; charter: Charter; theme: string; index: number; street?: string; premise?: string }): Promise<string>
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
  /**
   * Raw quest documents. The generator validates them and drops the ones that
   * do not hold up. `from` is how many quests the city already hands out, so a
   * growth's work carries on from the last id rather than colliding with it;
   * absent is a city being written for the first time.
   */
  writeQuests(input: { summary: WorldSummary; sideQuests: number; from?: number }): Promise<unknown[]>
}
