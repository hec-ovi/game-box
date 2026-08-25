import { contract } from '@gb/kit'
import { z } from 'zod'
import { METRICS } from '../metrics.ts'
import { AccessSchema, OwnerSchema } from './access.ts'
import { AssetPackRefSchema, MAX_CATALOGUES, PlotDesignSchema } from './design.ts'
import { AsksSchema, BriefSchema } from './asks.ts'
import { id } from './ids.ts'
import { BackgroundSchema, LifeSchema } from './life.ts'
import { isMachineProp, MachineSchema, PasswordSchema } from './machine.ts'
import { PremiseSchema } from './premise.ts'
import { ChartersSchema } from './resolved.ts'
import { FINISHES, ROOM_USES } from './traits.ts'
import { WordSchema } from './word.ts'
import {
  ANCHOR_KINDS,
  BODY_KINDS,
  FACINGS,
  FURNITURE_PROPS,
  ITEM_ARCHETYPES,
  NPC_ROLES,
  ROAD_KINDS,
  ROOM_KINDS,
} from './vocabulary.ts'

const Cell = z.object({ x: z.number().int().min(0), y: z.number().int().min(0) })
const RectSchema = z.object({
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  w: z.number().int().min(1),
  h: z.number().int().min(1),
})
const Point = z.object({ x: z.number(), y: z.number() })

export const AnchorSchema = z.object({
  id: id('anchor'),
  kind: z.enum(ANCHOR_KINDS),
  roomId: id('room'),
  /** Metres from the interior origin. */
  pos: Point,
  /** Degrees, 0 faces north. */
  rot: z.number().min(-360).max(360),
  /** The furniture this anchor belongs to, when it has one. */
  propId: id('prop').optional(),
  /** What whoever stands here is doing, in a phrase for the talk. Absent means the kind says it. */
  doing: z.string().min(1).max(300).optional(),
})

export const FurnitureSchema = z.object({
  id: id('prop'),
  prop: z.enum(FURNITURE_PROPS),
  roomId: id('room'),
  pos: Point,
  rot: z.number().min(-360).max(360),
  /**
   * Metres off the floor its base stands, for a piece that stands on another
   * piece: the top of the counter a till is on. Left out, it is on the floor,
   * which is where all but a handful of pieces are. Never above the ceiling.
   */
  lift: z.number().min(0).max(METRICS.building.groundFloorHeight).optional(),
  /**
   * The piece this one stands on, in the same interior: the counter under a
   * till. A piece with a host carries `lift`, and it is the host's own top.
   */
  on: id('prop').optional(),
  /** What the app opens at it. On every piece of a machine kind, and nothing else. */
  machine: MachineSchema.optional(),
  /** The room a camera watches, in the same interior. On a camera and nothing else. */
  watches: id('room').optional(),
  /** The opening a bars-door stands across, in the same interior. On a bars-door and nothing else. */
  doorId: id('door').optional(),
}).superRefine((piece, ctx) => {
  const rules: Array<['machine' | 'watches' | 'doorId', string, boolean]> = [
    ['machine', 'a machine kind', isMachineProp(piece.prop)],
    ['watches', 'a camera', piece.prop === 'camera'],
    ['doorId', 'a bars-door', piece.prop === 'bars-door'],
  ]
  for (const [field, who, wanted] of rules) {
    if ((piece[field] !== undefined) === wanted) continue
    ctx.addIssue({ code: 'custom', path: [field], message: wanted ? `${who} carries ${field}` : `only ${who} carries ${field}` })
  }
})

export const RoomSchema = z.object({
  id: id('room'),
  kind: z.enum(ROOM_KINDS),
  /** Which dressing routine filled it. Absent is read back off `kind` through the charter. */
  use: z.enum(ROOM_USES).optional(),
  name: z.string().min(1).max(60),
  /** Metres from the interior origin. */
  rect: z.object({ x: z.number(), y: z.number(), w: z.number().positive(), h: z.number().positive() }),
})

export const DoorSchema = z.object({
  id: id('door'),
  /** `outside` on the entrance door, otherwise the room you come from. */
  from: z.union([z.literal('outside'), id('room')]),
  to: id('room'),
  pos: Point,
  rot: z.number().min(-360).max(360),
  locked: z.boolean().default(false),
  /** The item that unlocks it, when locked. */
  keyItemId: id('item').optional(),
  /** The password that unlocks it, when locked and a quest hands one out. */
  password: PasswordSchema.optional(),
})

export const InteriorSchema = z.object({
  id: id('interior'),
  plotId: id('plot'),
  /** The plot's word. */
  kind: WordSchema,
  /** The language its rooms are dressed in. Absent is read back as its charter's. */
  finish: z.enum(FINISHES).optional(),
  /** Whose home it is: one of the city's people, or the player. Absent is nobody's. */
  owner: OwnerSchema.optional(),
  /** Whole credits its deed sells for. Absent is not for sale. */
  forSale: z.number().int().min(0).max(10000000).optional(),
  /** Interior footprint in metres. */
  size: z.object({ w: z.number().positive(), h: z.number().positive() }),
  rooms: z.array(RoomSchema).min(1),
  doors: z.array(DoorSchema).min(1),
  furniture: z.array(FurnitureSchema),
  anchors: z.array(AnchorSchema),
})

export const PlotSchema = z.object({
  id: id('plot'),
  /** The word of one of the city's charters. */
  kind: WordSchema,
  name: z.string().min(1).max(80),
  /** Footprint in grid cells. */
  rect: RectSchema,
  storeys: z.number().int().min(1).max(40),
  /** Where the front door is, and which way it faces. */
  entrance: z.object({ cell: Cell, facing: z.enum(FACINGS) }),
  /** Asset style key: which building kit dresses this plot. */
  style: z.string().min(1).max(40),
  interiorId: id('interior').optional(),
  /** The building this plot was dressed with, pinned when it was chosen. */
  design: PlotDesignSchema.optional(),
})

export const RoadNodeSchema = z.object({ id: id('node'), cell: Cell })

export const RoadSegmentSchema = z.object({
  id: id('road'),
  from: id('node'),
  to: id('node'),
  kind: z.enum(ROAD_KINDS),
  lanes: z.number().int().min(1).max(4),
})

/** The drivable graph: a node at every crossing, a segment between neighbours. */
export const RoadsSchema = z.object({ nodes: z.array(RoadNodeSchema), segments: z.array(RoadSegmentSchema) })

export const NpcSchema = z.object({
  id: id('npc'),
  name: z.string().min(1).max(60),
  role: z.enum(NPC_ROLES),
  /** Which body, and which variation of its colours. */
  appearance: z.object({ base: z.enum(BODY_KINDS), variant: z.number().int().min(0).max(63) }),
  /** Where they are found by default, and what they are doing there. */
  station: z.object({ interiorId: id('interior'), anchorId: id('anchor') }).optional(),
  homePlotId: id('plot').optional(),
  workPlotId: id('plot').optional(),
  /** One or two sentences that steer the model when this NPC speaks. */
  personality: z.string().min(1).max(400),
  /** What this NPC can talk about. Anything not here, they do not know. */
  knowledge: z.array(z.string().min(1).max(300)).max(20),
  voice: z.string().min(1).max(40).optional(),
  /** Their own life, for the model to speak from. Absent means nobody wrote one. */
  life: LifeSchema.optional(),
  /** Staged facts the player earns about them, for the codex. */
  background: BackgroundSchema.optional(),
})

export const ItemSchema = z.object({
  id: id('item'),
  name: z.string().min(1).max(60),
  description: z.string().min(1).max(300),
  archetype: z.enum(ITEM_ARCHETYPES),
  /** Credits a counter sells it for. Absent reads as 0: not for sale, or worth nothing. */
  value: z.number().int().min(0).max(100000).default(0),
  /** How much of the player it takes to carry: a pocket, a bag, or both hands. */
  bulk: z.enum(['pocket', 'bag', 'two-handed']).default('pocket'),
  /** Taking an owned item without permission is stealing. */
  ownerNpcId: id('npc').optional(),
  /** What a key or a keycard opens: one door, or an interior's street door. */
  opens: AccessSchema.optional(),
  /** The interior a deed is ownership of. On every deed, and nothing else. */
  deedTo: id('interior').optional(),
}).superRefine((item, ctx) => {
  if (item.opens && item.archetype !== 'key' && item.archetype !== 'keycard') {
    ctx.addIssue({ code: 'custom', path: ['opens'], message: 'only a key or a keycard opens something' })
  }
  if ((item.deedTo !== undefined) !== (item.archetype === 'deed')) {
    ctx.addIssue({ code: 'custom', path: ['deedTo'], message: item.deedTo ? 'only a deed is ownership of an interior' : 'a deed names the interior it is ownership of' })
  }
})

export const PlacementSchema = z.discriminatedUnion('at', [
  z.object({ at: z.literal('anchor'), itemId: id('item'), interiorId: id('interior'), anchorId: id('anchor') }),
  z.object({ at: z.literal('npc'), itemId: id('item'), npcId: id('npc') }),
  z.object({ at: z.literal('ground'), itemId: id('item'), cell: Cell }),
])

/**
 * The widest a city may be, in cells: 4 km a side at 2 m a cell, which is a
 * fifty-block town of ordinary blocks with room over. What it costs at the
 * ceiling is one line of runs a row, about a megabyte of grid in the file.
 */
export const MAX_GRID_SIDE = 2048

const GridSide = z.number().int().min(4).max(MAX_GRID_SIDE)

export const WorldSchema = z.object({
  format: z.literal('game-box.world'),
  schemaVersion: z.literal(1),
  id: id('world'),
  name: z.string().min(1).max(80),
  /** The short keyword hint the offline author reads. */
  theme: z.string().min(1).max(60),
  /** What the city is about, in the owner's own words. Absent means they gave only the theme. */
  brief: BriefSchema.optional(),
  /** What else the owner asked for: quests, tone, and a style inside the catalogue. */
  asks: AsksSchema.optional(),
  seed: z.string().min(1).max(120),
  /** Which generator produced this, so a regeneration can match it. */
  generator: z.object({ name: z.string().min(1), version: z.string().min(1) }),
  /** Metres per grid cell. Everything else in cells is read through this. */
  cellSize: z.number().positive().max(16),
  /** The art catalogues this city was designed against. Absent means it records none. */
  catalogues: z.array(AssetPackRefSchema).max(MAX_CATALOGUES).optional(),
  /** The history the city was built against. Absent means nobody wrote one. */
  premise: PremiseSchema.optional(),
  /** The kinds of place this city has. Absent means the fourteen shipped presets. */
  charters: ChartersSchema.optional(),
  grid: z
    .object({
      width: GridSide,
      height: GridSide,
      /** One char a cell: the form every file written before run-length rows carries. */
      rows: z.array(z.string()).min(4).optional(),
      /** The same picture as runs of one kind, `<count><char>`, the count left out for a run of one. */
      runs: z.array(z.string()).min(4).optional(),
    })
    .superRefine((grid, ctx) => {
      if ((grid.rows === undefined) === (grid.runs === undefined)) {
        ctx.addIssue({ code: 'custom', path: ['rows'], message: 'a grid is written as rows or as runs, one of the two' })
      }
    }),
  roads: RoadsSchema,
  plots: z.array(PlotSchema),
  interiors: z.array(InteriorSchema),
  npcs: z.array(NpcSchema),
  items: z.array(ItemSchema),
  placements: z.array(PlacementSchema),
  /** Id counters, so a later session keeps minting fresh ids. */
  idCounters: z.record(z.string(), z.number().int().min(0)),
})

/** What it takes to place a plot: the record without the id the world mints and the door it opens later. */
export const PlotSpecSchema = PlotSchema.omit({ id: true, interiorId: true })

/**
 * The one set of readers for every record, at both doors: a file is read
 * through `worldContract`, and a record added at runtime through its own, so
 * both fill the same defaults, keep the same key order and refuse the same
 * things.
 */
export const worldContract = contract('world', WorldSchema)
export const plotSpecContract = contract('plot-spec', PlotSpecSchema)
export const plotContract = contract('plot', PlotSchema)
export const interiorContract = contract('interior', InteriorSchema)
export const npcContract = contract('npc', NpcSchema)
export const itemContract = contract('item', ItemSchema)
export const placementContract = contract('placement', PlacementSchema)
export const roadsContract = contract('roads', RoadsSchema)

export type WorldDoc = z.infer<typeof WorldSchema>
export type PlotSpec = z.input<typeof PlotSpecSchema>
export type Plot = z.infer<typeof PlotSchema>
/** An interior as a file may carry it: a door's `locked` still to fill. */
export type InteriorInput = z.input<typeof InteriorSchema>
export type Interior = z.infer<typeof InteriorSchema>
export type Room = z.infer<typeof RoomSchema>
export type Door = z.infer<typeof DoorSchema>
export type Anchor = z.infer<typeof AnchorSchema>
export type Furniture = z.infer<typeof FurnitureSchema>
/** A piece as a file may carry it: a machine's `locked` still to fill. */
export type FurnitureInput = z.input<typeof FurnitureSchema>
export type Npc = z.infer<typeof NpcSchema>
/** An item as a file may carry it: `value` and `bulk` still to fill. */
export type ItemInput = z.input<typeof ItemSchema>
export type Item = z.infer<typeof ItemSchema>
export type Placement = z.infer<typeof PlacementSchema>
export type RoadNode = z.infer<typeof RoadNodeSchema>
export type RoadSegment = z.infer<typeof RoadSegmentSchema>
export type Roads = z.infer<typeof RoadsSchema>
