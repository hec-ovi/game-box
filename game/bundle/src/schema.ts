import { contract } from '@gb/kit'
import { playerContract } from '@gb/play'
import { questContract, questProgressContract } from '@gb/quest'
import { worldContract } from '@gb/world'
import { z } from 'zod'

/** An art pack the renderer must have to show this city as its maker saw it. */
export const AssetPackRefSchema = z.object({
  pack: z.string().min(1).max(60),
  version: z.string().min(1).max(20),
  /** Hash of the pack's own manifest, so a different pack of the same name is caught. */
  sha256: z.string().regex(/^[a-f0-9]{64}$/).optional(),
})

export const BundleSchema = z.object({
  format: z.literal('game-box.bundle'),
  schemaVersion: z.literal(1),
  /** Sha-256 of everything static in here. An import that hashes differently is refused. */
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  world: worldContract.schema,
  quests: z.array(questContract.schema),
  requires: z.array(AssetPackRefSchema).max(32),
  createdWith: z.object({ generator: z.string().min(1).max(60), version: z.string().min(1).max(20) }),
})

export const SaveSchema = z.object({
  format: z.literal('game-box.save'),
  schemaVersion: z.literal(1),
  /** Which bundle this playthrough belongs to, by id and by content. */
  worldId: z.string().min(1),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  player: playerContract.schema,
  questProgress: questProgressContract.schema,
})

export const bundleContract = contract('bundle', BundleSchema)
export const saveContract = contract('save', SaveSchema)

export type BundleDoc = z.infer<typeof BundleSchema>
export type SaveDoc = z.infer<typeof SaveSchema>
export type AssetPackRef = z.infer<typeof AssetPackRefSchema>
