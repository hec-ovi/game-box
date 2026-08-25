import { MAX_CHARTERS, type Charter, type ResolvedCharter, type Word } from '@gb/world'
import { drawOf } from '../interior/draw.ts'
import { builtFor } from './built.ts'
import { signageFor, suitsFor, tintFor } from './look.ts'

/** A charter a city would not take, and why. Reported, never hidden. */
export interface Dropped {
  readonly word: Word
  readonly reason: string
}

/** The kinds of place a city declares, and the ones it refused. */
export interface Declared {
  readonly charters: readonly ResolvedCharter[]
  readonly dropped: readonly Dropped[]
}

/**
 * The kinds of place a city is built from: the presets, and whatever the
 * history invented on top, each one resolved once so the file carries every
 * piece id and number the engine derived and no reader re-derives anything.
 *
 * An invented charter goes through the gate before a plot can take its word:
 * its rooms have to plan into a walkable interior with somebody in it, or it
 * is dropped and the reason kept. One that names a preset's word replaces the
 * preset. The list is sorted by word, which is the order a mix draws it in.
 */
export function declareCharters(written: readonly Charter[], presets: readonly ResolvedCharter[]): Declared {
  const byWord = new Map(presets.map((charter) => [charter.word, charter]))
  const dropped: Dropped[] = []
  for (const charter of written) {
    const resolved = resolve(charter)
    const reason = refused(resolved)
    if (reason) {
      dropped.push({ word: charter.word, reason })
      continue
    }
    if (!byWord.has(charter.word) && byWord.size >= MAX_CHARTERS) {
      dropped.push({ word: charter.word, reason: `a city holds ${MAX_CHARTERS} kinds of place at most` })
      continue
    }
    byWord.set(charter.word, resolved)
  }
  return { charters: [...byWord.values()].sort((a, b) => a.word.localeCompare(b.word)), dropped }
}

/** The charter plus everything the engine derives from its axes. */
function resolve(charter: Charter): ResolvedCharter {
  return {
    ...charter,
    built: builtFor(charter.street.frontage, charter.street.openness),
    signage: signageFor(charter.street.voice),
    tint: tintFor(charter.street.frontage),
    suits: suitsFor(charter),
  }
}

/** Why a charter cannot become a place, or nothing when it can. */
function refused(charter: ResolvedCharter): string | undefined {
  try {
    return drawOf(charter).posts > 0 ? undefined : 'its rooms plan into an interior nobody can stand in'
  } catch (error) {
    return `its rooms will not plan: ${error instanceof Error ? error.message : String(error)}`
  }
}
