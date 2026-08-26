import { contract } from '@gb/kit'
import { AsksSchema, MAX_GRID_SIDE, PLOT_BAND, TALLEST_STOREYS } from '@gb/world'
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

/**
 * The ceiling a brief gets when it names none, in storeys. It has to clear
 * `PLOT_BAND.storeys.max` or a city has no skyline at all, and what stops it
 * higher is not the art: the catalogue is drawn to four storeys and
 * `@gb/kitbash` stacks a storey of wall at a time above that, as high as it is
 * told, with its signage held to the shopfront. What stops it is what a tower
 * costs to draw, 3,840 triangles a storey against a prefab shell's 203.
 *
 * At 24 a tower stands 4 + 23 x 3.2 = 77.6 m, which reads as a skyscraper over
 * a two storey street, and the few plots the skyline rule raises leave a 20
 * block city at 4.89M shell triangles and 999 MB against 706k and 507 MB with
 * the ceiling at four. Anyone who wants the full 40 can ask for it.
 */
export const STOREYS_DEFAULT = 24

/** What you ask for when you want a city. Everything else is derived from it. */
export const BriefSchema = z
  .object({
    /** Free text: "dusty western mining town", "dense neon port city". */
    theme: z.string().min(1).max(60),
    /** Same seed, same city, every time. */
    seed: z.string().min(1).max(120),
    /** Blocks across and down. A 1x1 hamlet, a 20x20 city, as many as the grid holds. */
    blocksX: z.number().int().min(1).max(BLOCKS_MAX).default(20),
    blocksY: z.number().int().min(1).max(BLOCKS_MAX).default(20),
    /** Places that open, whatever the city's size. Everything else is frontage. */
    openPlaces: z.number().int().min(1).max(MOST_PLACES).optional(),
    /** Cells per block side, before streets. Left out, the seed picks it and varies it block by block. */
    blockCells: z.number().int().min(MIN_BLOCK).max(MAX_BLOCK).optional(),
    /** How much of each block gets built on, 0 to 1. */
    density: z.number().min(0.2).max(1).default(0.8),
    /** Tallest building allowed, in storeys. See `STOREYS_DEFAULT`. */
    maxStoreys: z.number().int().min(PLOT_BAND.storeys.min).max(TALLEST_STOREYS).default(STOREYS_DEFAULT),
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
