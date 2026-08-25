import { SCREEN_WORDS } from '../phrase.ts'
import type { ScreenApp } from './app.ts'
import { centre } from './size.ts'

const LOCK = SCREEN_WORDS.lock

/** How much of a password fits on the line. */
const MAX = 60

/**
 * A locked machine asking for its password. Every printable key goes into
 * the line, drawn as stars; Enter hands it to the game, which answers by
 * opening the screen or turning it down, and the prompt says which.
 */
export class LockApp implements ScreenApp {
  #typed = ''
  #refused: boolean
  #try: (password: string) => void
  #changed: () => void

  constructor(refused: boolean, hooks: { changed(): void; try(password: string): void }) {
    this.#refused = refused
    this.#try = hooks.try
    this.#changed = hooks.changed
  }

  /** The game turned the last try down, or took it back. */
  refused(refused: boolean): void {
    this.#refused = refused
  }

  rows(): readonly string[] {
    return [
      '',
      '',
      '',
      '',
      '',
      centre(LOCK.title),
      '',
      '',
      centre(`${LOCK.ask}: ${'*'.repeat(this.#typed.length)}_`),
      '',
      centre(this.#refused ? LOCK.wrong : ''),
    ]
  }

  status(): string {
    return LOCK.status
  }

  key(key: string): void {
    if (key === 'Enter') {
      if (this.#typed) this.#try(this.#typed)
      this.#typed = ''
    } else if (key === 'Backspace') this.#typed = this.#typed.slice(0, -1)
    else if (key.length === 1 && this.#typed.length < MAX) this.#typed += key
    else return
    this.#changed()
  }

  dispose(): void {}
}
