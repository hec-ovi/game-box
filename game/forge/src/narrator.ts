import type { Result } from '@gb/kit'
import type { Asks, Charter, ItemArchetype, MachineProgram, Npc, NpcRole, Premise, RoomKind, Word, WorkKind } from '@gb/world'
import type { Bearing } from './layout/districts.ts'
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

/** What one person in a place is there for, because a quest asks the player to find them there. */
export type CastPart = 'giver' | 'talk-to' | 'deliver-to' | 'walk-with'

/**
 * A person the town's work needs standing at this post.
 *
 * The quests are written before anybody is, against the posts the plan cut, so
 * this is the whole reason some of the people in a place exist. Whoever is
 * written into `postId` is the person that quest names: get them wrong and the
 * job sends the player to a room with five strangers in it.
 */
export interface InstanceCasting {
  /** The post they stand at: one of this request's own `posts`. */
  readonly postId: string
  readonly part: CastPart
  readonly questId: string
  readonly questTitle: string
  readonly questKind: 'main' | 'side'
  /** The line of the quest they are named on, as the player reads it. */
  readonly line: string
}

/** One building's own shell: everything a narrator is shown to write the place whole. */
export interface InstanceRequest extends PlaceRequest {
  /** What the place is called. It was named before this call, out of the town's story and the work in it. */
  readonly name: string
  readonly rooms: readonly RoomKind[]
  readonly posts: readonly InstancePost[]
  /** The stock to name. Keys, cards and deeds are not in it: they are named here off what they open or own. */
  readonly things: readonly InstanceStock[]
  readonly has: InstanceBrief
  /** The people the town's work already needs standing in here, and what each of them is for. */
  readonly cast: readonly InstanceCasting[]
}

export interface InstancePerson extends NpcProfile {
  readonly postId: string
  readonly role: NpcRole
}

export interface InstanceThing extends ItemProfile {
  readonly thingId: string
}

/**
 * One part of the city as a narrator is shown it: how much of the town it
 * holds and which way it lies from the middle of it. No coordinate and no
 * metre, because a district is the coarsest handle there is on purpose.
 */
export interface DistrictRequest {
  /** Where this district falls in the city's own count of them. */
  readonly index: number
  readonly theme: string
  /** How many of the town's blocks it holds: a corner of it, or most of it. */
  readonly blocks: number
  /** Which way it lies from the middle of town. */
  readonly bearing: Bearing
  /** What the city is about, in the few lines `premiseLines` renders it as. Absent when nobody wrote one. */
  readonly premise?: string
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
  /** What the town's work does here, a line per job, because a place is named for what happens in it. Empty where nothing does. */
  readonly work?: readonly string[]
}

/** A place written whole: what it is, who is in it and what is lying about. */
export interface Instance {
  /**
   * What the place is called. It was settled in the naming pass and handed in
   * on the request, so nothing is read back off this. Going: it comes out of
   * the answer once every narrator has stopped writing it.
   */
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

/**
 * The abstract world a quest writer sees: who is where, what is lying about,
 * what is locked and what runs on the screens.
 *
 * Every id in it is the id the finished city will carry. Every name in it is a
 * placeholder (`Instance 7`, `Person 3`), because the town is named after its
 * work is written; a line that names one is bound to the written name once
 * there is one.
 */
export interface WorldSummary {
  readonly cityName: string
  readonly theme: string
  /** What the city is about: what the main line is for and who the two sides of it are. */
  readonly premise?: Premise
  /** What the owner asked of the writing: the main errand, the side work, the tone. */
  readonly asks?: Asks
  /** The parts of the city, by name. Absent or empty when it was never cut into any. */
  readonly districts?: ReadonlyArray<{ readonly districtId: string; readonly name: string }>
  readonly places: ReadonlyArray<{
    readonly plotId: string
    readonly interiorId?: string
    readonly kind: Word
    readonly name: string
    /** The part of the city it stands in: the coarsest handle a quest writer is given on where it is. */
    readonly districtId?: string
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

/** The four stages of the writing, in the order a build runs them. */
export type WritingStage = 'history' | 'city' | 'places' | 'quests'

/**
 * A stage of the writing that could not be done.
 *
 * A city somebody asked a story of is written by whoever they asked, or the
 * build stops and says why. Nothing is composed in its place, because a town
 * half of somebody's and half of nobody's is the thing this exists to prevent.
 */
export interface Unwritten {
  /** Which stage stopped. */
  readonly stage: WritingStage
  /** One sentence to show whoever asked: what could not be written, and why. */
  readonly message: string
}

/** What every narrator call answers: what was written, or the stage that stopped. */
export type Written<T> = Result<T, Unwritten>

/**
 * Everything about a world that is invention rather than geometry: the city's
 * history, names, personalities, what people know, and the quests that string
 * them together. The generator never asks a narrator for coordinates.
 *
 * Every call answers `Written<T>`: what it wrote, or the stage that stopped and
 * one sentence saying why. A stage that stops stops the build, and nothing is
 * composed in its place.
 *
 * The calls come in a fixed order, and the order is the point:
 *
 * 1. `writePremise`, before a plot is placed. The town's history decides the
 *    mix of buildings, which doors open and what the main line is about, and it
 *    may declare kinds of place of its own beside the presets, as `charters`.
 * 2. `writeQuests`, against the bare architecture. The summary it is handed
 *    carries real ids and placeholder names (`Instance 7`, `Person 3`), because
 *    nothing has been named yet. What the quests name is what the town then has
 *    to hold.
 * 3. `nameCity`, `nameDistricts` and `namePlaces`, all asked once the work is
 *    written: the city, every part of it and every door in it are named out of
 *    the story and out of what the quests do there. A narrator without the
 *    plurals gets them composed here.
 * 4. `writeInstances`, last. Every place that opens goes out together, each one
 *    told its name and the `cast` the quests already need standing in it, and
 *    the answers come back one per request in request order. `describeNpc` and
 *    `describeItem` are the single-place shapes it is the plural of; a narrator
 *    that offers no plural is asked those two, one place at a time, for the
 *    same city.
 */
export interface Narrator {
  /**
   * The city's history, written before a street is laid: why the town is here,
   * what happened to it, who is arguing about it, what it therefore holds, and
   * any kind of place it invents to hold it. `brief` and `asks` are the owner's
   * own words and choices, when they gave any. A narrator without one gets a
   * town with no story, built from the presets.
   */
  writePremise?(input: { theme: string; seed: string; brief?: string; asks?: Asks }): Promise<Written<History>>
  nameCity(input: { theme: string; seed: string; premise?: Premise }): Promise<Written<string>>
  /** A sign for one place: `street` is the one its door is on, `premise` the town's story as `premiseLines` renders it, when it has one. */
  namePlace(input: { kind: Word; charter: Charter; theme: string; index: number; street?: string; premise?: string; work?: readonly string[] }): Promise<Written<string>>
  /**
   * The sign over every door in the town, open or shut, one per request in
   * request order. It is asked once the quests are written, so a request for a
   * place the work touches carries `work`. A blank keeps the sign composed
   * here, and a narrator without this gets every door named that way.
   */
  namePlaces?(requests: readonly PlaceRequest[]): Promise<Written<readonly string[]>>
  /**
   * What the parts of the city are called, all asked for together, one per
   * request in request order. A blank keeps the name the box composed, and a
   * narrator without this gets every district named that way.
   */
  nameDistricts?(requests: readonly DistrictRequest[]): Promise<Written<readonly string[]>>
  /**
   * One person for one post. `premise` is the town's story as `premiseLines`
   * renders it, when it has one, and `part` is what the town's work needs them
   * for, when a quest already names this post.
   */
  describeNpc(input: {
    role: NpcRole
    placeKind: Word
    place: Charter
    placeName: string
    theme: string
    index: number
    premise?: string
    cast?: readonly InstanceCasting[]
  }): Promise<Written<NpcProfile>>
  describeItem(input: { archetype: ItemArchetype; theme: string; index: number }): Promise<Written<ItemProfile>>
  /**
   * Every place that opens, asked for at once, after the town is named and its
   * work is written. One answer per request, in request order; inside an
   * answer, people carry the `postId` and things the `thingId` they were asked
   * about, so the caller matches by id and never by position. A post named in
   * the request's `cast` has to come back written as the person that quest
   * needs, because the quest already sends the player to this door for them.
   */
  writeInstances?(requests: readonly InstanceRequest[]): Promise<Written<readonly Instance[]>>
  /**
   * Raw quest documents, written against the bare architecture: real ids,
   * placeholder names. The generator validates them and drops the ones that do
   * not hold up, then names the town and writes the people the quests asked
   * for. `from` is how many quests the city already hands out, so a growth's
   * work carries on from the last id rather than colliding with it; absent is a
   * city being written for the first time.
   */
  writeQuests(input: { summary: WorldSummary; sideQuests: number; from?: number }): Promise<Written<readonly unknown[]>>
}
