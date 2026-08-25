import { LIT } from '../../style/lit.ts'
import { marginOf, print, type Program } from './page.ts'

/**
 * A ledger: a header, a column of entries with a figure against each, a rule
 * and a total. The entries are different lengths and the figures different
 * widths, so no two ledgers in a town are the same page.
 */
const ROWS = 8

export const ledger: Program = (page) => {
  const { width, height, rng } = page
  const margin = marginOf(page)
  const left = -width / 2 + margin
  const right = width / 2 - margin
  const row = height * 0.045

  print(page, { x: 0, y0: height * 0.87, y1: height * 0.95, width: width - 2 * margin, look: LIT.amber })
  for (let at = 0; at < ROWS; at++) {
    const y1 = height * 0.8 - at * height * 0.08
    const label = (right - left) * rng.fork(`label${at}`).range(0.25, 0.45)
    const figure = (right - left) * rng.fork(`figure${at}`).range(0.1, 0.18)
    print(page, { x: left + label / 2, y0: y1 - row, y1, width: label, look: at % 2 ? LIT.faint : LIT.paper })
    print(page, { x: right - figure / 2, y0: y1 - row, y1, width: figure, look: LIT.amber })
  }
  print(page, { x: 0, y0: height * 0.13, y1: height * 0.14, width: width - 2 * margin, look: LIT.faint })
  const total = (right - left) * 0.24
  print(page, { x: right - total / 2, y0: height * 0.04, y1: height * 0.1, width: total, look: LIT.amber })
}
