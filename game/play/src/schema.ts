import { contract } from '@gb/kit'
import { z } from 'zod'
import { MAX_RATE, SECONDS_PER_DAY } from './day.ts'
import { DISPOSITIONS } from './disposition.ts'
import { FACT_LENGTH, MEMORY_SOURCES } from './memory.ts'
import { PASSWORD_LENGTH } from './passwords.ts'
import { HISTORY_LENGTH } from './told.ts'
import { WEATHERS } from './weather.ts'

export const ClockSchema = z.object({
  /** Day 1 is the day the playthrough opened on; it only counts up. */
  day: z.number().int().min(1),
  /** How far into the day it is, from 0 up to (not including) 86400. */
  secondsOfDay: z.number().min(0).lt(SECONDS_PER_DAY),
  /** Game seconds per real second while running. A save carrying 0 opens paused at the default rate. */
  rate: z.number().min(0).max(MAX_RATE),
  weather: z.enum(WEATHERS),
  /** Whether the clock was stopped when the save was written. `rate` is still the rate it runs at. */
  paused: z.boolean().optional(),
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

export const CodexPersonSchema = z.object({
  npcId: z.string().min(1),
  /** Ids of the background facts the player has learned about them, in the order learned. */
  unlocked: z.array(z.string().min(1)),
})

export const CodexSchema = z.object({
  /** Interiors the player has walked into, first entry first. */
  places: z.array(z.string().min(1)),
  /** People the player knows of, first met first. */
  people: z.array(CodexPersonSchema),
  /** Lines the player was told of the city, oldest first. Absent until they are told something. */
  history: z.array(z.string().min(1).max(HISTORY_LENGTH)).optional(),
})

export const MemorySchema = z.object({
  /** One sentence a person now holds. */
  fact: z.string().min(1).max(FACT_LENGTH),
  /** Where they got it: the player said it, or they saw it happen. */
  source: z.enum(MEMORY_SOURCES),
})

export const PersonMemorySchema = z.object({
  /** How this one person feels about the player. */
  disposition: z.enum(DISPOSITIONS),
  /** Oldest first. */
  facts: z.array(MemorySchema),
})

/** What a lock gives way to: one door, or an interior's street door. */
export const AccessSchema = z.union([
  z.object({ doorId: z.string().min(1) }),
  z.object({ interiorId: z.string().min(1) }),
])

export const KeySchema = z.object({
  opens: AccessSchema,
  /** The key or card it rides on. Absent when a quest granted the access outright. */
  itemId: z.string().min(1).optional(),
})

/** Who gave the player a password: a quest, or a person. */
export const PasswordSourceSchema = z.union([
  z.object({ questId: z.string().min(1) }),
  z.object({ npcId: z.string().min(1) }),
])

export const PasswordSchema = z.object({
  /** The word as it is typed at a door or a screen. */
  password: z.string().min(1).max(PASSWORD_LENGTH),
  from: PasswordSourceSchema,
})

export const GarageSchema = z.object({
  /** Car models the player keeps, first kept first. */
  kept: z.array(z.string().min(1)),
  /** The one out on the street. Absent when none is. */
  out: z.string().min(1).optional(),
})

export const ScoreSchema = z.object({
  machineId: z.string().min(1),
  /** The game played on it, by the name its program has. */
  game: z.string().min(1),
  /** The most points scored at it, whole. */
  best: z.number().int().min(0),
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
  /** The quest the player chose to track. Absent when they track none. */
  tracked: z.string().min(1).optional(),
  /** Things the player carried off and left somewhere the city did not put them. */
  moved: z.array(PlacedItemSchema).optional(),
  /** What the player has found so far. Absent until they find something. */
  codex: CodexSchema.optional(),
  /** What each person holds of the player, by npc id. Absent until somebody holds something. */
  memory: z.record(z.string().min(1), PersonMemorySchema).optional(),
  /** What the player can get past: keys and cards in hand by what they open, and access granted outright. Absent until they hold one. */
  keys: z.array(KeySchema).optional(),
  /** The passwords the player has been given, and by whom. Absent until they learn one. */
  passwords: z.array(PasswordSchema).optional(),
  /** Interiors the player holds the deed to, first bought first. Absent until they own one. */
  owned: z.array(z.string().min(1)).optional(),
  /** The cars the player keeps, and which is out. Absent until they keep one. */
  garage: GarageSchema.optional(),
  /** The best score per game per machine. Absent until one is played. */
  scores: z.array(ScoreSchema).optional(),
})

export const playerContract = contract('player-state', PlayerStateSchema)
export type PlayerStateDoc = z.infer<typeof PlayerStateSchema>
export type ClockDoc = z.infer<typeof ClockSchema>
export type WhereDoc = z.infer<typeof WhereSchema>
export type SpotDoc = z.infer<typeof SpotSchema>
export type PlacedItemDoc = z.infer<typeof PlacedItemSchema>
export type CodexDoc = z.infer<typeof CodexSchema>
export type CodexPersonDoc = z.infer<typeof CodexPersonSchema>
export type MemoryDoc = z.infer<typeof MemorySchema>
export type PersonMemoryDoc = z.infer<typeof PersonMemorySchema>
export type AccessDoc = z.infer<typeof AccessSchema>
export type KeyDoc = z.infer<typeof KeySchema>
export type PasswordSourceDoc = z.infer<typeof PasswordSourceSchema>
export type PasswordDoc = z.infer<typeof PasswordSchema>
export type GarageDoc = z.infer<typeof GarageSchema>
export type ScoreDoc = z.infer<typeof ScoreSchema>
