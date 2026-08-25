import { LIT } from '../../style/lit.ts'
import { print, type Program } from './page.ts'

/**
 * A desk nobody is at: a lock over a field waiting for its word, and a cursor
 * in it. The glass under it is the machine's own idle light, so most of the
 * screen is that.
 */
export const blank: Program = (page) => {
  const { width, height } = page
  const box = { w: width * 0.5, h: height * 0.42 }
  const line = 0.003
  const y0 = height * 0.29
  const y1 = y0 + box.h

  for (const [x, w, low, high] of [
    [0, box.w, y0, y0 + line],
    [0, box.w, y1 - line, y1],
    [-box.w / 2 + line / 2, line, y0 + line, y1 - line],
    [box.w / 2 - line / 2, line, y0 + line, y1 - line],
  ] as const) {
    print(page, { x, y0: low, y1: high, width: w, look: LIT.faint })
  }
  const lock = height * 0.07
  print(page, { x: 0, y0: y1 - lock * 1.7, y1: y1 - lock * 0.7, width: lock, look: LIT.amber })
  const field = box.w * 0.72
  const fy = y0 + box.h * 0.28
  print(page, { x: 0, y0: fy - line, y1: fy, width: field, look: LIT.faint })
  print(page, { x: -field / 2 + 0.006, y0: fy + 0.004, y1: fy + height * 0.05, width: 0.004, look: LIT.paper })
}
