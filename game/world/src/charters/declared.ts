import type { ResolvedCharter } from '../model/resolved.ts'
import type { WorldDoc } from '../model/schema.ts'
import { SHIPPED_CHARTERS } from './presets/index.ts'

/**
 * The kinds of place a document declares: its own charters when it carries
 * them, otherwise the fourteen shipped presets, which is what every city
 * exported before charters was built from.
 */
export const declaredCharters = (doc: Pick<WorldDoc, 'charters'>): readonly ResolvedCharter[] => doc.charters ?? SHIPPED_CHARTERS

export const charterOf = (doc: Pick<WorldDoc, 'charters'>, word: string): ResolvedCharter | undefined =>
  declaredCharters(doc).find((charter) => charter.word === word)
