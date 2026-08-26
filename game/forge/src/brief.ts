import { contract } from '@gb/kit'
import { AsksSchema, MAX_GRID_SIDE } from '@gb/world'
import { z } from 'zod'
import { MOST_PLACES } from './interior/budget.ts'
import { MAX_BLOCK, MIN_BLOCK, mostBlocks, widestBlock, widestGrid } from './layout/plan.ts'

/**
 * The most blocks a side anything can ask for. It is the grid bound expressed
 * in blocks rather than a number of its own: how many of the smallest block
 * fit across the widest grid `@gb/world` accepts. Bigger blocks hit the grid
 * check below first.
 */
export const BLOCKS_MAX = mostBlocks(MAX_GRID_SIDE)

/** What you ask for when you want a city. Everything else is derived from it. */
export const BriefSchema = z
  .object({
    /** Free text: "dusty western mining town", "dense neon port city". */
    theme: z.string().min(1).max(60),
    /** Same seed, same city, every time. */
    seed: z.string().min(1).max(120),
    /** Blocks across and down. A 2x2 hamlet, a 20x20 city, as many as the grid holds. */
    blocksX: z.number().int().min(1).max(BLOCKS_MAX).default(20),
    blocksY: z.number().int().min(1).max(BLOCKS_MAX).default(20),
    /** Places that open, whatever the city's size. Everything else is frontage. */
    openPlaces: z.number().int().min(1).max(MOST_PLACES).optional(),
    /** Cells per block side, before streets. Left out, the seed picks it and varies it block by block. */
    blockCells: z.number().int().min(MIN_BLOCK).max(MAX_BLOCK).optional(),
    /** How much of each block gets built on, 0 to 1. */
    density: z.number().min(0.2).max(1).default(0.8),
    /** Tallest building allowed, in storeys. */
    maxStoreys: z.number().int().min(1).max(40).default(3),
    /** How many roads leave through the mountains. Left out, the seed picks it. */
    exits: z.number().int().min(1).max(4).optional(),
    /** What the city is about, in the owner's own words. Written into the file and read by the history writer. */
    brief: z.string().min(1).optional(),
    /** What the owner asked of the writing and the look, in `@gb/world`'s `Asks`. */
    asks: AsksSchema.optional(),
  })
  .superRefine((brief, ctx) => {
    // blocks times cells is a grid, and a grid has a size the world will not go past
    const { width, height } = widestGrid(brief)
    const side = Math.max(width, height)
    if (side > MAX_GRID_SIDE) {
      ctx.addIssue({
        code: 'custom',
        message: `${brief.blocksX}x${brief.blocksY} blocks of ${widestBlock(brief.blockCells)} cells needs a ${side}-cell grid; a city is at most ${MAX_GRID_SIDE} cells a side`,
      })
    }
  })

export const briefContract = contract('brief', BriefSchema)
export type Brief = z.infer<typeof BriefSchema>
