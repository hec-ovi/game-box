import { el, setText } from '../dom.ts'
import { Reveal } from '../reveal.ts'
import type { HudState } from '../types.ts'
import type { Surface } from './surface.ts'

/**
 * The view covered while the game is busy: the word, and the name of what is
 * being waited for under it. Nothing else.
 *
 * It used to list every stage of a build with how far each had got. What that
 * actually showed a player was four lines of the machine's own vocabulary
 * (writing the history, laying out the city) while they waited, and none of it
 * told them anything they could act on.
 */
export class LoaderSurface implements Surface {
  readonly node = el('section', 'gb-loader')
  #title = el('h2', 'gb-t7')
  #reveal: Reveal

  constructor() {
    this.node.setAttribute('role', 'status')
    this.node.setAttribute('aria-live', 'polite')
    const card = el('div', 'gb-loader-card')
    const radar = el('div', 'gb-loader-radar')
    radar.innerHTML = `
      <svg class="gb-radar-svg" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="52" class="gb-radar-track gb-radar-track-outer" />
        <circle cx="60" cy="60" r="52" class="gb-radar-arc gb-radar-arc-outer-cyan" />
        <circle cx="60" cy="60" r="52" class="gb-radar-arc gb-radar-arc-outer-amber" />
        <circle cx="60" cy="60" r="42" class="gb-radar-track gb-radar-track-mid" />
        <circle cx="60" cy="60" r="42" class="gb-radar-arc gb-radar-arc-mid" />
        <circle cx="60" cy="60" r="30" class="gb-radar-track gb-radar-track-inner" />
        <circle cx="60" cy="60" r="30" class="gb-radar-arc gb-radar-arc-inner" />
      </svg>
    `
    card.append(radar, el('p', 'gb-loader-word gb-t2', 'Loading'), this.#title)
    this.node.append(card)
    this.#reveal = new Reveal(this.node, { kind: 'veil', onClosed: () => this.#clear() })
  }

  render(state: HudState): void {
    const loading = state.loading
    if (loading) {
      setText(this.#title, loading.title)
      this.node.dataset.veil = String(loading.veil === true)
    }
    this.#reveal.set(loading !== undefined)
  }

  dispose(): void {
    this.#reveal.dispose()
  }

  #clear(): void {
    setText(this.#title, '')
  }
}
