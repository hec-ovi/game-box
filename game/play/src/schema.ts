import { contract } from '@gb/kit'
import { z } from 'zod'
import { MAX_RATE, SECONDS_PER_DAY } from './day.ts'
import { WEATHERS } from './weather.ts'

export const ClockSchema = z.object({
  /** Day 1 is the day the playthrough opened on; it only counts up. */
  day: z.number().int().min(1),
  /** How far into the day it is, from 0 up to (not including) 86400. */
  secondsOfDay: z.number().min(0).lt(SECONDS_PER_DAY),
  /** Game seconds per real second. 0 is paused. */
  rate: z.number().min(0).max(MAX_RATE),
  weather: z.enum(WEATHERS),
})

export const WhereSchema = z.object({
  /** Metres along the city's own axes, or the room's own when `interiorId` is set. */
  x: z.number(),
  z: z.number(),
  /** Which way the player faces, in radians. Read back wound into one turn. */
  heading: z.number(),
  /** The interior they are standing in. Absent outdoors, because then the metres are the city's. */
  interiorId: z.string().min(1).optional(),
})

export const SpotSchema = z.object({
  /** The interior the surface stands in. */
  interiorId: z.string().min(1),
  /** The surface inside it, an anchor of that interior. */
  anchorId: z.string().min(1),
})

export const PlacedItemSchema = z.object({
  itemId: z.string().min(1),
  ...SpotSchema.shape,
})

export const PlayerStateSchema = z.object({
  format: z.literal('game-box.player'),
  schemaVersion: z.literal(1),
  /** The world this playthrough belongs to. Loading it against another world is refused. */
  worldId: z.string().min(1),
  money: z.number().int().min(0),
  /** Item ids the player is carrying. */
  inventory: z.array(z.string().min(1)),
  /** Items taken from their owner without asking. */
  stolen: z.array(z.string().min(1)),
  /** Named booleans the quest layer sets and reads. */
  flags: z.record(z.string(), z.boolean()),
  /** Standing with a group, from -100 to 100. */
  reputation: z.record(z.string(), z.number().int().min(-100).max(100)),
  /** NPCs currently following the player. */
  companions: z.array(z.string().min(1)),
  /** Time of day, which day it is, and the weather. Absent in saves written before clocks. */
  clock: ClockSchema.optional(),
  /** Where the player stood when the save was written. Absent in saves written before places. */
  where: WhereSchema.optional(),
  /** The quest the player chose to follow. Absent when they are following none. */
  tracked: z.string().min(1).optional(),
  /** Things the player carried off and left somewhere the city did not put them. */
  moved: z.array(PlacedItemSchema).optional(),
})

export const playerContract = contract('player-state', PlayerStateSchema)
export type PlayerStateDoc = z.infer<typeof PlayerStateSchema>
export type ClockDoc = z.infer<typeof ClockSchema>
export type WhereDoc = z.infer<typeof WhereSchema>
export type SpotDoc = z.infer<typeof SpotSchema>
export type PlacedItemDoc = z.infer<typeof PlacedItemSchema>
