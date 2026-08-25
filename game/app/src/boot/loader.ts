import { Hud, type LoaderView, type Notice } from '@gb/hud'
import type { ScribeProgress, ScribeStage } from '@gb/scribe'

/** The four stages `@gb/scribe` reports, in the order a build runs them, in the player's words. */
const STAGES: readonly { id: ScribeStage; label: string }[] = [
  { id: 'history', label: 'Writing the history' },
  { id: 'city', label: 'Laying out the city' },
  { id: 'places', label: 'Writing the places' },
  { id: 'quests', label: 'Writing the quests' },
]

/**
 * The loading view while the model writes a city: `@gb/hud`'s loader, driven
 * from `@gb/scribe`'s progress port. The interface exists only for the wait,
 * because the game builds its own once there is a city to play, and it is
 * taken down before that one goes up.
 */
export class Loader {
  #mount: HTMLElement
  #hud: Hud | undefined
  #title = ''
  #heard = new Map<ScribeStage, ScribeProgress>()

  constructor(mount: HTMLElement) {
    this.#mount = mount
  }

  get up(): boolean {
    return this.#hud !== undefined
  }

  begin(title: string): void {
    this.end()
    this.#title = title
    this.#heard.clear()
    this.#hud = new Hud(this.#mount, { onIntent: () => {} })
    this.#draw()
  }

  /** One answer landed, or one stage opened. */
  progress(event: ScribeProgress): void {
    if (!this.#hud) return
    this.#heard.set(event.stage, event)
    // the city stage opens by naming the town, and from then on the wait is
    // for that town rather than for a theme
    if (event.stage === 'city' && event.total === 1 && event.done === 1) this.#title = `Writing ${event.what}`
    this.#draw()
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
    const view: LoaderView = {
      title: this.#title,
      stages: STAGES.map(({ id, label }) => {
        const heard = this.#heard.get(id)
        if (!heard) return { id, label, state: 'waiting' }
        return { id, label, state: heard.done >= heard.total ? 'done' : 'running', done: heard.done, total: heard.total }
      }),
    }
    this.#hud?.show({ loading: view })
  }
}
