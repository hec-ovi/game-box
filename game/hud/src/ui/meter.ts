import { el } from '../dom.ts'

/** Which line of work a bar belongs to, which is what colours it. */
export type MeterTone = 'accent' | 'main' | 'warn'

/**
 * A bar that fills. The fill is scaled from its left edge, never widened, so
 * a build reporting progress over a running scene costs one composited frame
 * and no layout at all.
 */
export class Meter {
  readonly node = el('div', 'gb-track gb-cut gb-edged')
  #fill = el('i', 'gb-fill')

  constructor(wide = false) {
    if (wide) this.node.classList.add('gb-track-wide')
    this.node.append(this.#fill)
  }

  /** How full, from 0 to 1. Anything outside that is clamped. */
  set(share: number): void {
    const at = Math.max(0, Math.min(1, share))
    this.#fill.style.transform = `scaleX(${Math.round(at * 1000) / 1000})`
  }

  tone(tone: MeterTone): void {
    this.node.classList.toggle('gb-track-main', tone === 'main')
    this.node.classList.toggle('gb-track-warn', tone === 'warn')
  }
}
