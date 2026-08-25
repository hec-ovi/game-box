import type { Notice } from '@gb/hud'

/** Whatever is on screen to say something on: the loader while a city is written, the game after. */
export interface Told {
  announce(notice: Notice): void
}

/**
 * Where a word for the player goes. The sidecar is one client for the whole
 * page, so what it has to say about a busy model reaches whichever interface
 * is up at the time; with none up there is nobody to tell, and nothing is
 * kept to be told later.
 */
export class Notices {
  #to: Told | undefined

  aim(to: Told | undefined): void {
    this.#to = to
  }

  /**
   * The model is rate limited and the sidecar is waiting it out. A wait, never
   * a failure: the call is sent again by the box that owns it, so nothing here
   * retries anything.
   */
  busy(wait: { waitMs: number }): void {
    this.#to?.announce({ kind: 'model-busy', retryIn: Math.max(1, Math.ceil(wait.waitMs / 1000)) })
  }

  tell(notice: Notice): void {
    this.#to?.announce(notice)
  }
}
