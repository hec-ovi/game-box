import { el, setText } from '../dom.ts'
import { TIME_LEFT, timeSpan } from '../phrase.ts'
import type { QuestTimer } from '../types.ts'
import { ICON_PX, icon } from '../ui/icon.ts'
import { Meter } from '../ui/meter.ts'

/** Under this share of the whole, or this many game seconds, the clock is drawn as running out. */
const LOW = { share: 0.1, seconds: 600 } as const

/**
 * The clock on a timed quest: how long is left in game time, with the share
 * of the whole drawn as a bar so the eye reads how far gone it is before it
 * reads the digits. It moves when the journal is pushed and at no other time,
 * because the timer runs on the game clock and the hud never keeps a clock of
 * its own: a held game holds the countdown with it.
 */
export class TimerView {
  readonly node = el('div', 'gb-quest-timer')
  #clock = el('span', 'gb-num gb-t4')
  #meter = new Meter(true)

  constructor() {
    const line = el('div', 'gb-timer-line')
    line.append(icon('hourglass', ICON_PX.line), el('span', 'gb-t1', TIME_LEFT), this.#clock)
    this.node.append(line, this.#meter.node)
  }

  set(timer: QuestTimer): void {
    setText(this.#clock, timeSpan(timer.remaining))
    const share = timer.total > 0 ? Math.max(0, Math.min(1, timer.remaining / timer.total)) : 0
    const low = timer.remaining <= Math.max(LOW.seconds, timer.total * LOW.share)
    this.node.dataset.low = String(low)
    this.#meter.tone(low ? 'warn' : 'accent')
    this.#meter.set(share)
  }
}
