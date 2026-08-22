import { contract } from '@gb/kit'
import { z } from 'zod'
import { id } from './ids.ts'
import { PlaceSchema } from './schema.ts'

/** What the game tells the quest layer the player just did, or what the world just did to them. */
export const GameEventSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('talked'), npcId: id('npc'), topic: z.string().min(1).max(80).optional() }),
  z.object({ kind: z.literal('arrived'), place: PlaceSchema }),
  z.object({ kind: z.literal('acquired'), itemId: id('item'), stolen: z.boolean().default(false) }),
  z.object({ kind: z.literal('gave'), itemId: id('item'), npcId: id('npc') }),
  z.object({ kind: z.literal('stashed'), itemId: id('item'), interiorId: id('interior'), anchorId: id('anchor') }),
  z.object({ kind: z.literal('chose'), questId: id('quest'), stepId: id('step'), optionId: z.string().min(1).max(40) }),
  /** Seconds of play so far. Whatever drives the clock reports it; quests on a timer read it. */
  z.object({ kind: z.literal('clock'), seconds: z.number().int().min(0) }),
  z.object({ kind: z.literal('npc-gone'), npcId: id('npc'), reason: z.enum(['died', 'left']) }),
  z.object({ kind: z.literal('item-destroyed'), itemId: id('item') }),
])

export const gameEventContract = contract('game-event', GameEventSchema)
export type GameEvent = z.infer<typeof GameEventSchema>
