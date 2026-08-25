import type { Solid } from '../build/solid.ts'
import type { Variant } from '../style/variant.ts'

/**
 * What a prop builder is handed: the piece under construction, the floor it has
 * to stay inside, the height a body meets it at, and the variant that decides
 * everything else.
 *
 * A builder never scales anything. It draws to the numbers it is given, which
 * is the whole reason a seat cannot come out 7 cm low.
 */
export interface Build {
  readonly solid: Solid
  readonly variant: Variant
  /** Metres across the front, from the cells the planner claims. */
  readonly width: number
  /** Metres front to back. */
  readonly depth: number
  /** The surface a body meets, for a prop that declares one. Zero otherwise. */
  readonly contact: number
  /** The second working surface, for a piece worked from both sides. Zero otherwise. */
  readonly staff: number
  /** How tall it stands, for a prop that declares one. Zero otherwise. */
  readonly height: number
  /** Drawn in its open state: a gate with its leaf slid back. False for everything that does not open. */
  readonly open: boolean
}

export type PropBuilder = (build: Build) => void
