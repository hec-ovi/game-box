import { contract } from '@gb/kit'
import { z } from 'zod'

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
})

export const playerContract = contract('player-state', PlayerStateSchema)
export type PlayerStateDoc = z.infer<typeof PlayerStateSchema>
