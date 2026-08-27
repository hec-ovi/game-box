import type { Rng } from '@gb/kit'
import type { Charter, Word } from '@gb/world'
import { flavourOf } from '../theme/flavour.ts'
import type { PremiseBuild } from './check.ts'
import { PLACES } from './places.ts'
import type { History } from './shape.ts'
import { tradesFor, turnsFor, type Kinds } from './wording.ts'

/** How many of the turn's facts everybody in town has heard. */
const FACTS = 2

/** A history, and the noun a town that lives on this can be named after. */
export interface Composed {
  readonly history: History
  readonly word: string
}

/**
 * A town's history composed from the seed, with no model behind it.
 *
 * Two halves: what the place lives on, which comes from the kind of town the
 * theme reads as, and what happened to it, which is drawn from what can happen
 * to a town like this. Both halves push the same building mix, and either may
 * declare a kind of place of its own, so the history and the architecture are
 * one decision rather than two. The wording is in `premise/*.md`; this only
 * picks and joins.
 */
export function composePremise(theme: string, rng: Rng): Composed {
  const flavour = flavourOf(theme)
  const trade = rng.pick(tradesFor(flavour))
  const turn = rng.pick(turnsFor(flavour))
  const charters = unique([...trade.declares, ...turn.declares]).map((word) => PLACES[word]).filter((charter): charter is Charter => charter !== undefined)
  return {
    word: trade.word,
    history: {
      livesOn: trade.lives,
      happened: turn.happened,
      stake: turn.stake,
      sides: turn.sides.map((side) => ({ ...side })),
      common: rng.shuffle([...turn.known]).slice(0, FACTS),
      build: merge(trade, turn),
      ...(charters.length ? { charters } : {}),
    },
  }
}

/**
 * Two pushes on one mix. A kind the story demands is never a kind the town has
 * fewer of, whichever half asked for which.
 */
function merge(trade: Kinds, turn: Kinds): PremiseBuild {
  const moreOf = unique([...trade.more, ...turn.more])
  const mustHave = unique([...trade.must, ...turn.must])
  const fewerOf = unique([...trade.fewer, ...turn.fewer]).filter((kind) => !moreOf.includes(kind) && !mustHave.includes(kind))
  return { moreOf, fewerOf, mustHave }
}

const unique = (words: readonly Word[]): Word[] => [...new Set(words)]
