import { contract } from '@gb/kit'
import { z } from 'zod'
import { id } from './ids.ts'
import { PlaceSchema } from './schema.ts'

/** What the game tells the quest layer the player just did, or what the world just did to them. */
export const GameEventSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('talked'), npcId: id('npc'), topic: z.string().min(1).max(80).optional() }),
  /** The player's own body entered that plot or interior. */
  z.object({ kind: z.literal('arrived'), place: PlaceSchema }),
  /** Somebody walking with the player entered that plot or interior. A companion flag alone never produces this. */
  z.object({ kind: z.literal('companion-arrived'), npcId: id('npc'), place: PlaceSchema }),
  z.object({ kind: z.literal('acquired'), itemId: id('item'), stolen: z.boolean().default(false) }),
  z.object({ kind: z.literal('gave'), itemId: id('item'), npcId: id('npc') }),
  z.object({ kind: z.literal('stashed'), itemId: id('item'), interiorId: id('interior'), anchorId: id('anchor') }),
  /** A locked door's lock came off, with its key item or its password typed. */
  z.object({ kind: z.literal('unlocked'), doorId: id('door') }),
  /** A locked machine's lock came off at its own screen, with its password typed or a hack. */
  z.object({ kind: z.literal('machine-unlocked'), machineId: id('machine') }),
  /** A game on that machine ended on this score. */
  z.object({ kind: z.literal('scored'), machineId: id('machine'), score: z.number().int().min(0) }),
  /** The thing was paid for at a counter and is in the player's hand. */
  z.object({ kind: z.literal('bought'), itemId: id('item') }),
  z.object({ kind: z.literal('chose'), questId: id('quest'), stepId: id('step'), optionId: z.string().min(1).max(40) }),
  /** Game seconds since the playthrough began, as `@gb/play`'s `clock.totalSeconds` reads. Quests on a timer count off it. */
  z.object({ kind: z.literal('clock'), seconds: z.number().int().min(0) }),
  z.object({ kind: z.literal('npc-gone'), npcId: id('npc'), reason: z.enum(['died', 'left']) }),
  z.object({ kind: z.literal('item-destroyed'), itemId: id('item') }),
])

export const gameEventContract = contract('game-event', GameEventSchema)
export type GameEvent = z.infer<typeof GameEventSchema>
