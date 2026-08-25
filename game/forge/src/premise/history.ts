import { SHIPPED_CHARTERS, type Premise, type ResolvedCharter } from '@gb/world'
import { declareCharters, type Dropped } from '../charters/resolve.ts'
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
 */
export function readHistory(written: unknown): Founding {
  const parsed = chartersOf(written)
  const declared = declareCharters(parsed.charters, SHIPPED_CHARTERS)
  const premise = premiseOf(written, declared.charters.map((charter) => charter.word))
  return {
    ...(premise ? { premise } : {}),
    charters: declared.charters,
    dropped: [...parsed.dropped, ...declared.dropped],
  }
}
