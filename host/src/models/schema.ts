import { z } from 'zod'
import { contract } from '../contract.ts'

/** `file` is a bare filename, so an entry cannot reach outside the cache root. */
export const ModelEntrySchema = z
  .strictObject({
    id: z.string().min(1),
    file: z.string().min(1).regex(/^[A-Za-z0-9._-]+$/),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    sizeBytes: z.int().min(1).optional(),
    url: z.url().optional(),
  })
  .meta({ $id: 'game-box.dev/models/model-entry', title: 'model catalog entry' })

export const ResolvedModelSchema = z
  .strictObject({
    id: z.string().min(1),
    path: z.string().min(1),
    sizeBytes: z.int().min(0),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .meta({ $id: 'game-box.dev/models/resolved-model', title: 'resolved model file' })

export const modelEntryContract = contract('model-entry', ModelEntrySchema)
export const resolvedModelContract = contract('resolved-model', ResolvedModelSchema)

export type ModelEntry = z.infer<typeof ModelEntrySchema>
export type ResolvedModel = z.infer<typeof ResolvedModelSchema>
