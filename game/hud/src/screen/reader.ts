import { SCREEN_WORDS } from '../phrase.ts'
import type { ScreenApp } from './app.ts'
import { BODY_ROWS, SCREEN } from './size.ts'

const READ = SCREEN_WORDS.read

/** The title takes a row and a rule under it. */
const HEAD = 2

/**
 * A page of text the generator wrote: a ledger, the mail, what the cameras
 * see. Long lines wrap to the screen's width, and the arrows scroll what does
 * not fit.
 */
export class ReaderApp implements ScreenApp {
  #title: string
  #lines: readonly string[]
  #top = 0
  #changed: () => void

  constructor(title: string, lines: readonly string[], hooks: { changed(): void }) {
    this.#title = title
    this.#lines = lines.flatMap(wrap)
    this.#changed = hooks.changed
  }

  rows(): readonly string[] {
    const shown = this.#lines.slice(this.#top, this.#top + BODY_ROWS - HEAD)
    return [this.#title, '-'.repeat(Math.min(SCREEN.cols, this.#title.length)), ...shown]
  }

  status(): string {
    return this.#lines.length > BODY_ROWS - HEAD ? `${READ.status} (${this.#top + 1}/${this.#lines.length})` : READ.end
  }

  key(key: string): void {
    const last = Math.max(0, this.#lines.length - (BODY_ROWS - HEAD))
    const step = key === 'ArrowDown' ? 1 : key === 'ArrowUp' ? -1 : 0
    if (!step) return
    const top = Math.max(0, Math.min(last, this.#top + step))
    if (top === this.#top) return
    this.#top = top
    this.#changed()
  }

  dispose(): void {}
}

/** One line as as many screen-wide lines as it takes, broken at spaces where it can be. */
function wrap(line: string): string[] {
  const out: string[] = []
  let rest = line
  while (rest.length > SCREEN.cols) {
    const at = rest.lastIndexOf(' ', SCREEN.cols)
    const cut = at > 0 ? at : SCREEN.cols
    out.push(rest.slice(0, cut))
    rest = rest.slice(cut).trimStart()
  }
  out.push(rest)
  return out
}
