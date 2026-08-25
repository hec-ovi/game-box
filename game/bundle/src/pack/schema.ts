import { contract } from '@gb/kit'
import { questContract } from '@gb/quest'
import { CELL_KINDS, ResolvedCharterSchema, worldContract } from '@gb/world'
import { z } from 'zod'
import { AssetPackRefSchema, CreatedWithSchema, HashSchema } from '../schema.ts'
import type { WorldDoc } from '../self-describing.ts'

type WorldShape = { readonly [K in keyof WorldDoc]-?: z.ZodType<WorldDoc[K]> }

/** The world document's own record schemas, so a pack's records are checked the way a file's are. */
function worldShape(): WorldShape {
  const schema = worldContract.schema
  if (!(schema instanceof z.ZodObject)) throw new Error('the world schema is not an object schema')
  return schema.shape as WorldShape
}

const world = worldShape()

/** One cell the pack builds on, and what it becomes. Only ground that was `empty` in the base is ever named. */
export const CellChangeSchema = z.object({ x: z.int().min(0), y: z.int().min(0), kind: z.enum(CELL_KINDS) })

/** What an extension added to a world document, in the base's own record shapes and nothing of the base. */
export const ExtensionSchema = z.object({
  /** The extended city's counters: every id in here was minted past the base's. */
  idCounters: world.idCounters,
  cells: z.array(CellChangeSchema),
  charters: z.array(ResolvedCharterSchema),
  catalogues: z.array(AssetPackRefSchema).max(32),
  plots: world.plots,
  interiors: world.interiors,
  npcs: world.npcs,
  items: world.items,
  placements: world.placements,
})

export const PackSchema = z.object({
  format: z.literal('game-box.pack'),
  schemaVersion: z.literal(1),
  /** Sha-256 of everything else in here. A pack that hashes differently is refused. */
  contentHash: HashSchema,
  /** The city this pack was cut from, by id and by content. It applies to that city and no other. */
  base: z.object({ worldId: z.string().min(1), contentHash: HashSchema }),
  world: ExtensionSchema,
  /** The quests the extension wrote. They may name the base's places and people. */
  quests: z.array(questContract.schema),
  createdWith: CreatedWithSchema,
})

export const packContract = contract('pack', PackSchema)

export type PackDoc = z.infer<typeof PackSchema>
export type ExtensionDoc = z.infer<typeof ExtensionSchema>
export type CellChange = z.infer<typeof CellChangeSchema>
