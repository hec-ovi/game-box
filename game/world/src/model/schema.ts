import { contract } from '@gb/kit'
import { z } from 'zod'
import {
  ANCHOR_KINDS,
  BUILDING_KINDS,
  FACINGS,
  FURNITURE_PROPS,
  ITEM_ARCHETYPES,
  NPC_ROLES,
  ROOM_KINDS,
} from './vocabulary.ts'

const id = (kind: string) =>
  z
    .string()
    .regex(new RegExp(`^${kind}_\\d{4,}$`), `expected a ${kind} id like ${kind}_0001`)

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
})

export const FurnitureSchema = z.object({
  id: id('prop'),
  prop: z.enum(FURNITURE_PROPS),
  roomId: id('room'),
  pos: Point,
  rot: z.number().min(-360).max(360),
})

export const RoomSchema = z.object({
  id: id('room'),
  kind: z.enum(ROOM_KINDS),
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
})

export const InteriorSchema = z.object({
  id: id('interior'),
  plotId: id('plot'),
  kind: z.enum(BUILDING_KINDS),
  /** Interior footprint in metres. */
  size: z.object({ w: z.number().positive(), h: z.number().positive() }),
  rooms: z.array(RoomSchema).min(1),
  doors: z.array(DoorSchema).min(1),
  furniture: z.array(FurnitureSchema),
  anchors: z.array(AnchorSchema),
})

export const PlotSchema = z.object({
  id: id('plot'),
  kind: z.enum(BUILDING_KINDS),
  name: z.string().min(1).max(80),
  /** Footprint in grid cells. */
  rect: RectSchema,
  storeys: z.number().int().min(1).max(40),
  /** Where the front door is, and which way it faces. */
  entrance: z.object({ cell: Cell, facing: z.enum(FACINGS) }),
  /** Asset style key: which building kit dresses this plot. */
  style: z.string().min(1).max(40),
  interiorId: id('interior').optional(),
})

export const RoadNodeSchema = z.object({ id: id('node'), cell: Cell })

export const RoadSegmentSchema = z.object({
  id: id('road'),
  from: id('node'),
  to: id('node'),
  kind: z.enum(['street', 'avenue', 'exit']),
  lanes: z.number().int().min(1).max(4),
})

export const NpcSchema = z.object({
  id: id('npc'),
  name: z.string().min(1).max(60),
  role: z.enum(NPC_ROLES),
  /** Which character mesh and which variation of it. */
  appearance: z.object({ base: z.string().min(1).max(40), variant: z.number().int().min(0).max(63) }),
  /** Where they are found by default, and what they are doing there. */
  station: z.object({ interiorId: id('interior'), anchorId: id('anchor') }).optional(),
  homePlotId: id('plot').optional(),
  workPlotId: id('plot').optional(),
  /** One or two sentences that steer the model when this NPC speaks. */
  personality: z.string().min(1).max(400),
  /** What this NPC can talk about. Anything not here, they do not know. */
  knowledge: z.array(z.string().min(1).max(300)).max(20),
  voice: z.string().min(1).max(40).optional(),
})

export const ItemSchema = z.object({
  id: id('item'),
  name: z.string().min(1).max(60),
  description: z.string().min(1).max(300),
  archetype: z.enum(ITEM_ARCHETYPES),
  value: z.number().int().min(0).max(100000),
  /** Quest items cannot be sold or dropped. */
  questItem: z.boolean().default(false),
  /** Taking an owned item without permission is stealing. */
  ownerNpcId: id('npc').optional(),
})

export const PlacementSchema = z.discriminatedUnion('at', [
  z.object({ at: z.literal('anchor'), itemId: id('item'), interiorId: id('interior'), anchorId: id('anchor') }),
  z.object({ at: z.literal('npc'), itemId: id('item'), npcId: id('npc') }),
  z.object({ at: z.literal('ground'), itemId: id('item'), cell: Cell }),
])

export const WorldSchema = z.object({
  format: z.literal('game-box.world'),
  schemaVersion: z.literal(1),
  id: id('world'),
  name: z.string().min(1).max(80),
  theme: z.string().min(1).max(60),
  seed: z.string().min(1).max(120),
  /** Which generator produced this, so a regeneration can match it. */
  generator: z.object({ name: z.string().min(1), version: z.string().min(1) }),
  /** Metres per grid cell. Everything else in cells is read through this. */
  cellSize: z.number().positive().max(16),
  grid: z.object({
    width: z.number().int().min(4).max(1024),
    height: z.number().int().min(4).max(1024),
    rows: z.array(z.string()).min(4),
  }),
  roads: z.object({ nodes: z.array(RoadNodeSchema), segments: z.array(RoadSegmentSchema) }),
  plots: z.array(PlotSchema),
  interiors: z.array(InteriorSchema),
  npcs: z.array(NpcSchema),
  items: z.array(ItemSchema),
  placements: z.array(PlacementSchema),
  /** Id counters, so a later session keeps minting fresh ids. */
  idCounters: z.record(z.string(), z.number().int().min(0)),
})

export const worldContract = contract('world', WorldSchema)

export type WorldDoc = z.infer<typeof WorldSchema>
export type Plot = z.infer<typeof PlotSchema>
export type Interior = z.infer<typeof InteriorSchema>
export type Room = z.infer<typeof RoomSchema>
export type Door = z.infer<typeof DoorSchema>
export type Anchor = z.infer<typeof AnchorSchema>
export type Furniture = z.infer<typeof FurnitureSchema>
export type Npc = z.infer<typeof NpcSchema>
export type Item = z.infer<typeof ItemSchema>
export type Placement = z.infer<typeof PlacementSchema>
export type RoadNode = z.infer<typeof RoadNodeSchema>
export type RoadSegment = z.infer<typeof RoadSegmentSchema>
