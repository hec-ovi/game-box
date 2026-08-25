import type { Rng } from '@gb/kit'
import type { MachineProgram } from '@gb/world'
import type { Look } from '../../build/look.ts'
import type { Solid } from '../../build/solid.ts'
import type { Schematic } from '../schematic.ts'

/**
 * What a program is handed to draw on: the glass, in its own frame. Origin at
 * the middle of the glass's bottom edge, x across it as whoever reads it sees
 * it mirrored (the prop's +x is the reader's left), y up it, and everything
 * printed stands `PROUD` off the face towards the reader.
 */
export interface Page {
  readonly solid: Solid
  /** Metres across the glass. */
  readonly width: number
  /** Metres up it. */
  readonly height: number
  readonly program: MachineProgram
  readonly rng: Rng
  /** The room this screen's camera watches, for a feed. */
  readonly watched: Schematic | undefined
}

export type Program = (page: Page) => void

/** How far a print stands off the glass: its own face, never the glass's. */
export const PROUD = 0.001

/** One printed rectangle: `x` its middle across the glass, `y0` to `y1` up it. */
export function print(page: Page, mark: { x: number; y0: number; y1: number; width: number; look: Look }): void {
  page.solid.block({
    x: mark.x,
    z: -PROUD / 2,
    width: mark.width,
    depth: PROUD,
    y0: mark.y0,
    y1: mark.y1,
    look: mark.look,
  })
}

/** The page's margin: what nothing is printed inside of. */
export function marginOf(page: Page): number {
  return Math.min(page.width, page.height) * 0.06
}
