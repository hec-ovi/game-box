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
export interface InstanceRequest extends WrittenPlace {
  /** What the place is called. It was named before this call, out of the town's story and the work in it. */
  readonly name: string
  readonly rooms: readonly RoomKind[]
  readonly posts: readonly InstancePost[]
  /** The stock to name. What opens a door or owns a home is not in it: those are named here off what they open or own. */
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

/**
 * One building as a narrator is shown it: where it stands, how big it is, and
 * what it was settled to be, when that has been settled.
 *
 * `kind` and `charter` are absent on a building nobody has said anything about
 * yet, which is every building the architecture puts up. A door that opens is
 * asked what it is before the work is written (`writePlaces`) and carries both
 * from then on; a door that never opens carries neither, and what it is comes
 * back beside its sign.
 */
export interface PlaceRequest {
  /** The word of the kind of place it is, once that is settled. */
  readonly kind?: Word
  /** What that word means: the charter behind it, with its label, its names and its rumours. */
  readonly charter?: Charter
  readonly theme: string
  /** Where this building falls in the town's own count of plots. */
  readonly index: number
  /** How many storeys it stands: the architecture's, and a fact about what can be in it. */
  readonly storeys: number
  /** Its footprint in metres, across the front then front to back. */
  readonly floor: { readonly frontage: number; readonly depth: number }
  /** Whether its door is on one of the town's avenues, where the traffic goes. */
  readonly onAvenue: boolean
  /** The street its door is on. Absent when the door stands on no street band. */
  readonly street?: string
  /** What the city is about, in the few lines `premiseLines` renders it as. Absent when nobody wrote one. */
  readonly premise?: string
  /** What the town's work does here, a line per job, because a place is named for what happens in it. Empty where nothing does. */
  readonly work?: readonly string[]
}

/** A building whose kind the writing has settled: what a sign is written over, and what a place is written into. */
export type WrittenPlace = PlaceRequest & { readonly kind: Word; readonly charter: Charter }

/** The sign over one door, and what the place behind it is when nobody has said yet. */
export interface PlaceSign {
  /** What the sign reads. Blank keeps the one composed in the box. */
  readonly name: string
  /** What the place is, for a door that was never asked before. A word the city does not declare leaves the building a building. */
  readonly kind?: Word
}

/**
 * One thing a town needs behind one of its doors, in the words the writer is
 * asked for it: a counter to buy across, a room to sit down in, a home, or a
 * kind of place the town's own history says it has.
 */
export interface PlaceNeed {
  readonly wants: string
  /** How many of the town's doors have to answer it. */
  readonly count: number
  /** The word that answers it, where the town's own history named one. */
  readonly kind?: Word
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
 * 1. `writePremise`, before a plot is placed. The town's history decides what
 *    kinds of place the town holds and what the main line is about, and it may
 *    declare kinds of its own beside the presets, as `charters`.
 * 2. `writePlaces`, once the architecture stands. The town is a grid of
 *    buildings with no kind at all, a handful of them with doors that open, and
 *    this says what each of those is: a house, an office, a station. Everything
 *    inside them is built to the answer, so it comes before the work.
 * 3. `writeQuests`, against that architecture. The summary it is handed carries
 *    real ids and placeholder names (`Instance 7`, `Person 3`), because nothing
 *    has been named yet. What the quests name is what the town then has to hold.
 * 4. `nameCity`, `nameDistricts` and `namePlaces`, all asked once the work is
 *    written: the city, every part of it and every door in it are named out of
 *    the story and out of what the quests do there. `namePlaces` also says what
 *    the buildings that never open are, which is the only word anybody writes
 *    about them. A narrator without the plurals gets the signs composed here
 *    and the frontage left as buildings.
 * 5. `writeInstances`, last. Every place that opens goes out together, each one
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
  /**
   * What each of the town's open buildings is, answered one word per request in
   * request order. This is the stage that decides a city's locations: the
   * architecture cut the doors and this says which of them is the bar, which is
   * the station and which is somebody's home, and everything behind them is
   * built to the answer.
   *
   * `kinds` is the closed list an answer comes from: every kind of place the
   * city declares, the presets and whatever the history invented. `needs` is
   * what the town needs its doors to be, in words. An answer naming a kind the
   * city does not declare stops the build, because there is nobody else here to
   * decide what a place is.
   */
  writePlaces(input: {
    theme: string
    premise?: string
    kinds: readonly Charter[]
    needs: readonly PlaceNeed[]
    places: readonly PlaceRequest[]
  }): Promise<Written<readonly Word[]>>
  nameCity(input: { theme: string; seed: string; premise?: Premise }): Promise<Written<string>>
  /** A sign for one place, asked only for the doors that open, so what the place is is already settled. */
  namePlace(input: WrittenPlace): Promise<Written<string>>
  /**
   * The sign over every door in the town, open or shut, one per request in
   * request order. It is asked once the quests are written, so a request for a
   * place the work touches carries `work`.
   *
   * It is also where the rest of the town becomes something. A door that opens
   * was already told what it is; a door that never opens carries no kind at
   * all, and the answer's `kind` is what makes it a bakery rather than a
   * building. A blank name keeps the sign composed here, a blank or unknown
   * kind leaves the building a building, and a narrator without this gets the
   * whole street that way.
   */
  namePlaces?(requests: readonly PlaceRequest[]): Promise<Written<readonly PlaceSign[]>>
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
