import { GLYPH_ASPECT } from './atlas.ts'
import { BLANK, cellFor, SOLID } from './glyphs.ts'
import type { Written } from './sign.ts'

/**
 * Letters laid out on a panel. Everything is in the panel's own metres, `u`
 * across and `v` up from its centre, so the same run works on a wall, on a
 * blade hanging over the street, or on the back of one.
 *
 * A name that will not fit is shrunk first and cut short only when shrinking
 * would make it a smear. A sign nobody can read is still a sign, but a sign
 * that says half a name is a bug.
 */

/** Below this a letter stops being a letter and becomes a scratch. */
const SMALLEST = 0.12

/** How much of the panel the letters leave as margin, across and up. */
const MARGIN = { across: 0.07, up: 0.17 } as const

/** The cells a name is written with, trimmed of the blanks at either end. */
export function lettersOf(text: string): string[] {
  const cells = [...text].map(cellFor)
  while (cells.length > 0 && cells[0] === BLANK) cells.shift()
  while (cells.length > 0 && cells.at(-1) === BLANK) cells.pop()
  return cells
}

/** How wide a panel has to be to carry `letters` at `height`, letters and margin. */
export function widthFor(letters: readonly string[], height: number): number {
  const glyph = height * (1 - 2 * MARGIN.up)
  return letters.length * glyph * GLYPH_ASPECT + 2 * Math.min(0.22, height * 0.4)
}

/** How tall a panel is when a letter of `letter` metres runs across it. */
export function panelFor(letter: number): number {
  return letter / (1 - 2 * MARGIN.up)
}

/** How wide a panel is when a letter of `letter` metres runs down it. */
export function bladeFor(letter: number): number {
  return letter * GLYPH_ASPECT / (1 - 2 * MARGIN.up)
}

/** A name written across a panel, left to right. */
export function across(letters: readonly string[], width: number, height: number): Written[] {
  const inside = width - 2 * Math.min(0.14, width * MARGIN.across)
  const tall = height * (1 - 2 * MARGIN.up)

  let cells = [...letters]
  if (cells.length === 0) return []
  let glyph = Math.min(tall, inside / (cells.length * GLYPH_ASPECT))
  if (glyph < SMALLEST) {
    glyph = SMALLEST
    cells = cells.slice(0, Math.max(1, Math.floor(inside / (glyph * GLYPH_ASPECT))))
  }

  const advance = glyph * GLYPH_ASPECT
  const from = (advance - cells.length * advance) / 2
  return cells.map((cell, at) => ({ cell, u: from + at * advance, v: 0, width: advance, height: glyph }))
}

/** A word written down a panel, one letter to a row. */
export function down(letters: readonly string[], width: number, height: number): Written[] {
  const inside = width * (1 - 2 * MARGIN.up)
  const tall = height - 2 * Math.min(0.1, height * MARGIN.across)

  let cells = letters.filter((cell) => cell !== BLANK)
  if (cells.length === 0) return []
  let glyph = Math.min(inside / GLYPH_ASPECT, tall / cells.length)
  if (glyph < SMALLEST) {
    glyph = SMALLEST
    cells = cells.slice(0, Math.max(1, Math.floor(tall / glyph)))
  }

  const advance = glyph
  const from = (cells.length * advance - advance) / 2
  return cells.map((cell, at) => ({ cell, u: 0, v: from - at * advance, width: glyph * GLYPH_ASPECT, height: glyph }))
}

/** Four thin tubes round the edge of a panel: a lit box rather than a painted one. */
export function edging(width: number, height: number): Written[] {
  const thick = Math.min(0.05, height * 0.1)
  return [
    { cell: SOLID, u: 0, v: (height - thick) / 2, width, height: thick },
    { cell: SOLID, u: 0, v: -(height - thick) / 2, width, height: thick },
    { cell: SOLID, u: (width - thick) / 2, v: 0, width: thick, height },
    { cell: SOLID, u: -(width - thick) / 2, v: 0, width: thick, height },
  ]
}
