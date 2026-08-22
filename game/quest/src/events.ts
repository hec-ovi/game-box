import { contract } from '@gb/kit'
import { z } from 'zod'
import { PlaceSchema } from './schema.ts'

const id = (kind: string) => z.string().regex(new RegExp(`^${kind}_\\d{4,}$`), `expected a ${kind} id`)

/** What the game tells the quest layer the player just did. */
export const GameEventSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('talked'), npcId: id('npc'), topic: z.string().min(1).max(80).optional() }),
  z.object({ kind: z.literal('arrived'), place: PlaceSchema }),
  z.object({ kind: z.literal('acquired'), itemId: id('item'), stolen: z.boolean().default(false) }),
  z.object({ kind: z.literal('gave'), itemId: id('item'), npcId: id('npc') }),
  z.object({ kind: z.literal('stashed'), itemId: id('item'), interiorId: id('interior'), anchorId: id('anchor') }),
  z.object({ kind: z.literal('chose'), questId: id('quest'), stepId: id('step'), optionId: z.string().min(1).max(40) }),
])

export const gameEventContract = contract('game-event', GameEventSchema)
export type GameEvent = z.infer<typeof GameEventSchema>
