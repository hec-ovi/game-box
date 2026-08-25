import type { Rng } from '@gb/kit'
import { covers, type Cell, type StreetLine } from './bands.ts'

/**
 * Avenues: the spines a town is read by.
 *
 * An avenue is not a street that happens to be wider. It runs the whole way
 * across the town without a break, the ordinary streets hang off it, the traffic
 * is on it, and the buildings that face it stand taller and open more often. So
 * they are picked as whole lines of the grid, spread out rather than scattered,
 * and never two next to each other: a pair of avenues with one street between
 * them is a dual carriageway, not two spines.
 */

/** Street bands between one avenue and the next. About 260 m of town, which is a Manhattan block-and-a-half. */
const SPACING = 5

/**
 * How many avenues an axis with this many street bands gets. Any town with an
 * inner street gets one, because a town's main street is the first thing about
 * it; past that it is one every `SPACING` bands, and never two in a row.
 */
export function avenueCount(lines: number): number {
  if (lines < 3) return 0
  return Math.max(1, Math.round((lines - 1) / SPACING))
}

/**
 * Which of an axis's bands are avenues, as ordinals into its lines. The
 * interior lines are cut into as many spans as there are avenues and one is
 * drawn from each, so they are spread across the town wherever the seed puts
 * them rather than bunched at one end. A pick that lands next to the last one
 * is moved along, and one with nowhere left to go is dropped.
 */
export function chooseAvenues(lines: number, rng: Rng): ReadonlySet<number> {
  const wanted = avenueCount(lines)
  const inner = lines - 2
  const picked: number[] = []

  for (let span = 0; span < wanted; span++) {
    const low = 1 + Math.floor((span * inner) / wanted)
    const high = 1 + Math.floor(((span + 1) * inner) / wanted)
    let pick = rng.int(low, Math.max(low + 1, high))
    const last = picked.at(-1)
    if (last !== undefined && pick <= last + 1) pick = last + 2
    if (pick > lines - 2) continue
    picked.push(pick)
  }
  return new Set(picked)
}

/**
 * Where the avenues run, as a question you can ask about a cell: is this
 * doorstep on one? What a plot is worth showing off on, and how tall it is
 * built, both read this.
 */
export class Avenues {
  #columns: readonly StreetLine[]
  #rows: readonly StreetLine[]

  private constructor(columns: readonly StreetLine[], rows: readonly StreetLine[]) {
    this.#columns = columns
    this.#rows = rows
  }

  static from(columns: readonly StreetLine[], rows: readonly StreetLine[]): Avenues {
    const only = (lines: readonly StreetLine[]) => lines.filter((line) => line.kind === 'avenue')
    return new Avenues(only(columns), only(rows))
  }

  /** How many the town has, across and down together. */
  get count(): number {
    return this.#columns.length + this.#rows.length
  }

  /** True when the cell stands in an avenue's band: its roadway or either pavement. */
  has(cell: Cell): boolean {
    return this.#columns.some((line) => covers(line, cell.x)) || this.#rows.some((line) => covers(line, cell.y))
  }
}
