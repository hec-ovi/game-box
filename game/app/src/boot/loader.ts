import { Hud, type Notice } from '@gb/hud'
import type { ScribeProgress } from '@gb/scribe'

/**
 * The loading view while the model writes a city: one word and the name of the
 * town being written. The interface exists only for the wait, because the game
 * builds its own once there is a city to play, and it is taken down before that
 * one goes up.
 *
 * It listens to `@gb/scribe`'s progress for one thing: the town's own name, the
 * moment the model gives it one. Everything else the port reports is the
 * machine's own vocabulary, and a player waiting cannot act on any of it.
 */
export class Loader {
  #mount: HTMLElement
  #hud: Hud | undefined
  #title = ''

  constructor(mount: HTMLElement) {
    this.#mount = mount
  }

  get up(): boolean {
    return this.#hud !== undefined
  }

  begin(title: string): void {
    this.end()
    this.#title = title
    this.#hud = new Hud(this.#mount, { onIntent: () => {} })
    this.#draw()
  }

  /** One answer landed. The only one that changes what is on screen is the town being named. */
  progress(event: ScribeProgress): void {
    if (!this.#hud) return
    // the city stage opens by naming the town, and from then on the wait is
    // for that town rather than for a theme
    if (event.stage === 'city' && event.total === 1 && event.done === 1) {
      this.#title = event.what
      this.#draw()
    }
  }

  announce(notice: Notice): void {
    this.#hud?.announce(notice)
  }

  /** The city is ready, or the build stopped: the loader goes either way. */
  end(): void {
    if (!this.#hud) return
    this.#hud.show({ loading: null })
    this.#hud.destroy()
    this.#hud = undefined
  }

  #draw(): void {
    this.#hud?.show({ loading: { title: this.#title } })
  }
}
