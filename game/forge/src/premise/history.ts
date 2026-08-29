import { SHIPPED_CHARTERS, type Premise, type ResolvedCharter } from '@gb/world'
import { PLACEHOLDER_CHARTER } from '../charters/placeholder.ts'
import { declareCharters, type Dropped } from '../charters/resolve.ts'
import { PLACEHOLDER_KIND } from '../naming/placeholders.ts'
import { chartersOf, premiseOf } from './check.ts'

/** What a city is founded on: its history, if one held up, and the kinds of place it declares. */
export interface Founding {
  readonly premise?: Premise
  readonly charters: readonly ResolvedCharter[]
  /** The kinds of place the history invented that the city would not take, and why. */
  readonly dropped: readonly Dropped[]
}

/**
 * Reads what a narrator wrote into what a city is founded on, in the order the
 * parts depend on each other: the invented charters first, each checked and
 * put through the gate; then the premise, its `build` held to the words the
 * city now declares, presets included. A history nobody wrote founds a city on
 * the presets alone.
 *
 * The architecture's own word is declared with them, because every plot goes up
 * under it before the writing says what the building is.
 */
export function readHistory(written: unknown): Founding {
  const parsed = chartersOf(written)
  const declared = declareCharters(parsed.charters, [PLACEHOLDER_CHARTER, ...SHIPPED_CHARTERS])
  // the architecture's own word is not a kind of place a history may ask for
  const premise = premiseOf(written, declared.charters.map((charter) => charter.word).filter((word) => word !== PLACEHOLDER_KIND))
  return {
    ...(premise ? { premise } : {}),
    charters: declared.charters,
    dropped: [...parsed.dropped, ...declared.dropped],
  }
}
