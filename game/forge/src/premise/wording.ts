import type { BuildingKind } from '@gb/world'
import type { Flavour } from '../theme/flavour.ts'
import { TRADES, TURNS } from './wording.generated.ts'

/**
 * The words an offline premise is composed from, and what each of them means
 * for the buildings that go up.
 *
 * The wording itself lives in `premise/*.md` and is compiled into
 * `wording.generated.ts`; nothing here is written in code.
 */

/** How one entry moves the mix: kinds it wants more of, fewer of, and one the town has to hold. */
export interface Kinds {
  readonly more: readonly BuildingKind[]
  readonly fewer: readonly BuildingKind[]
  readonly must: readonly BuildingKind[]
}

/** What a town lives on: why it is here, and the noun it is often named after. */
export interface Trade extends Kinds {
  readonly handle: string
  readonly fits: readonly Flavour[]
  readonly lives: string
  readonly word: string
}

/** One side of the town's argument: who they are and what they want out of it. */
export interface Side {
  readonly name: string
  readonly wants: string
}

/** What happened to the town, what it left at stake, and who is arguing about it. */
export interface Turn extends Kinds {
  readonly handle: string
  readonly fits: readonly Flavour[]
  readonly happened: string
  readonly stake: string
  readonly sides: readonly Side[]
  readonly known: readonly string[]
}

/** What a town of this kind lives on. */
export const tradesFor = (flavour: Flavour): readonly Trade[] => TRADES.filter((trade) => trade.fits.includes(flavour))

/** What can have happened to a town of this kind. */
export const turnsFor = (flavour: Flavour): readonly Turn[] => TURNS.filter((turn) => turn.fits.includes(flavour))
