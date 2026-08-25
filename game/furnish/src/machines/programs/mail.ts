import { LIT } from '../../style/lit.ts'
import { marginOf, print, type Program } from './page.ts'

/**
 * Mail: folders down the left, a list of messages on the right with who sent
 * each and what it is about, and one of them unread, marked in red and
 * printed brighter than the rest.
 */
const FOLDERS = 4
const MESSAGES = 7

export const mail: Program = (page) => {
  const { width, height, rng } = page
  const margin = marginOf(page)
  const left = -width / 2 + margin
  const right = width / 2 - margin
  const pane = (right - left) * 0.24
  const split = left + pane + margin
  const row = height * 0.05
  const unread = rng.fork('unread').int(0, MESSAGES)

  print(page, { x: 0, y0: height * 0.89, y1: height * 0.95, width: width - 2 * margin, look: LIT.faint })
  for (let at = 0; at < FOLDERS; at++) {
    const y1 = height * 0.8 - at * height * 0.1
    const run = pane * rng.fork(`folder${at}`).range(0.5, 0.9)
    print(page, { x: left + run / 2, y0: y1 - row, y1, width: run, look: at ? LIT.faint : LIT.paper })
  }
  print(page, { x: split - margin / 2, y0: height * 0.06, y1: height * 0.84, width: 0.003, look: LIT.faint })

  const sender = (right - split) * 0.22
  for (let at = 0; at < MESSAGES; at++) {
    const y1 = height * 0.8 - at * height * 0.11
    const subject = (right - split - sender - margin) * rng.fork(`subject${at}`).range(0.4, 1)
    const fresh = at === unread
    if (fresh) print(page, { x: split + 0.006, y0: y1 - row * 0.7, y1: y1 - row * 0.3, width: 0.006, look: LIT.red })
    const from = split + (fresh ? 0.016 : 0)
    print(page, { x: from + sender / 2, y0: y1 - row, y1, width: sender, look: fresh ? LIT.paper : LIT.faint })
    print(page, {
      x: from + sender + margin + subject / 2,
      y0: y1 - row,
      y1,
      width: subject,
      look: fresh ? LIT.paper : LIT.faint,
    })
  }
}
