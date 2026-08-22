import { contract } from '@gb/kit'
import { z } from 'zod'

/** What you ask for when you want a city. Everything else is derived from it. */
export const BriefSchema = z.object({
  /** Free text: "dusty western mining town", "dense neon port city". */
  theme: z.string().min(1).max(200),
  /** Same seed, same city, every time. */
  seed: z.string().min(1).max(120),
  /** Blocks across and down. A 2x2 hamlet or a 12x12 city. */
  blocksX: z.number().int().min(1).max(24).default(3),
  blocksY: z.number().int().min(1).max(24).default(3),
  /** Cells per block side, before streets. 12 cells at 2m is a 24m block. */
  blockCells: z.number().int().min(6).max(40).default(14),
  /** How much of each block gets built on, 0 to 1. */
  density: z.number().min(0.2).max(1).default(0.8),
  /** Tallest building allowed, in storeys. */
  maxStoreys: z.number().int().min(1).max(40).default(3),
  /** How many roads leave through the mountains. */
  exits: z.number().int().min(1).max(4).default(1),
})

export const briefContract = contract('brief', BriefSchema)
export type Brief = z.infer<typeof BriefSchema>
