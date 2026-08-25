import { contract } from '@gb/kit'
import { playerContract } from '@gb/play'
import { questContract, questProgressContract } from '@gb/quest'
import { worldContract } from '@gb/world'
import { z } from 'zod'

/** A sha-256, hex. */
export const HashSchema = z.string().regex(/^[a-f0-9]{64}$/)

/** Who wrote a file: the generator and its version. */
export const CreatedWithSchema = z.object({ generator: z.string().min(1).max(60), version: z.string().min(1).max(20) })

/** An art pack the renderer must have to show this city as its maker saw it. */
export const AssetPackRefSchema = z.object({
  pack: z.string().min(1).max(60),
  version: z.string().min(1).max(20),
  /** Hash of the pack's own manifest, so a different pack of the same name is caught. */
  sha256: HashSchema.optional(),
})

export const BundleSchema = z.object({
  format: z.literal('game-box.bundle'),
  /** 2 carries a self-describing world: its charters and every room's use written in. 1 is read against the presets and brought up to 2 on open. */
  schemaVersion: z.literal([1, 2]),
  /** Sha-256 of everything static in here. An import that hashes differently is refused. */
  contentHash: HashSchema,
  world: worldContract.schema,
  quests: z.array(questContract.schema),
  requires: z.array(AssetPackRefSchema).max(32),
  createdWith: CreatedWithSchema,
})

export const SaveSchema = z.object({
  format: z.literal('game-box.save'),
  schemaVersion: z.literal(1),
  /** Which bundle this playthrough belongs to, by id and by content. */
  worldId: z.string().min(1),
  contentHash: HashSchema,
  player: playerContract.schema,
  questProgress: questProgressContract.schema,
  /** What each quest was called when the save was written, so a rebuilt city's reuse of an id is caught on resume. */
  questTitles: z.record(z.string().min(1), z.string().min(1).max(80)).optional(),
})

export const bundleContract = contract('bundle', BundleSchema)
export const saveContract = contract('save', SaveSchema)

export type BundleDoc = z.infer<typeof BundleSchema>
export type SaveDoc = z.infer<typeof SaveSchema>
export type AssetPackRef = z.infer<typeof AssetPackRefSchema>
