import { el, setText } from '../dom.ts'
import { NO_SETTINGS, SETTINGS, clockFace } from '../phrase.ts'
import type { HudIntent, HudState, HudWindowName, SettingsView } from '../types.ts'
import type { Tab } from './tab.ts'

/**
 * What the player may set: the clock (held at the hour shown, or skipped
 * ahead), the sky, and the way out of the game. Every button is an intent the
 * game acts on; the tab draws what the game pushes back and decides nothing.
 */
export class SettingsTab implements Tab {
  readonly name: HudWindowName = 'settings'
  readonly node = el('div', 'gb-settings')
  #emit: (intent: HudIntent) => void
  #clock = el('span', 'gb-num gb-clock')
  #lock = button('gb-setting-lock')
  #skip = button('gb-setting-skip', SETTINGS.skip)
  #weathers = el('div', 'gb-weathers')
  #time = el('section', 'gb-setting')
  #sky = el('section', 'gb-setting')
  #none = el('p', 'gb-empty', NO_SETTINGS)
  #key: string | null = null

  constructor(emit: (intent: HudIntent) => void) {
    this.#emit = emit
    this.#clock.setAttribute('aria-label', 'Hour')
    this.#lock.addEventListener('click', () => {
      this.#emit({ kind: 'lock-time', locked: this.#lock.getAttribute('aria-pressed') !== 'true' })
    })
    this.#skip.addEventListener('click', () => this.#emit({ kind: 'skip-time' }))

    const clockLine = el('div', 'gb-setting-line')
    clockLine.append(this.#clock, this.#lock, this.#skip)
    this.#time.append(el('h3', undefined, SETTINGS.time), clockLine)
    this.#sky.append(el('h3', undefined, SETTINGS.weather), this.#weathers)

    const exit = button('gb-setting-exit', SETTINGS.exit)
    exit.addEventListener('click', () => this.#emit({ kind: 'exit' }))
    const out = el('section', 'gb-setting')
    out.append(exit)
    this.node.append(this.#time, this.#sky, this.#none, out)
  }

  render(state: HudState): void {
    const settings = state.settings
    const key = settings
      ? `${settings.hour}:${settings.minute}:${settings.locked}:${settings.weather}:${settings.weathers.join(',')}`
      : ''
    if (key === this.#key) return
    this.#key = key
    this.#time.hidden = this.#sky.hidden = settings === undefined
    this.#none.hidden = settings !== undefined
    if (settings) this.#draw(settings)
  }

  clear(): void {
    this.#key = null
    this.#weathers.replaceChildren()
  }

  #draw(settings: SettingsView): void {
    setText(this.#clock, clockFace(settings.hour, settings.minute))
    this.#lock.setAttribute('aria-pressed', String(settings.locked))
    setText(this.#lock, settings.locked ? SETTINGS.locked : SETTINGS.lock)
    this.#weathers.replaceChildren(
      ...settings.weathers.map((weather) => {
        const pick = button('gb-setting-weather', weather)
        pick.setAttribute('aria-pressed', String(weather === settings.weather))
        pick.addEventListener('click', () => this.#emit({ kind: 'weather', weather }))
        return pick
      }),
    )
  }
}

function button(className: string, label = ''): HTMLButtonElement {
  const node = el('button', className, label)
  node.type = 'button'
  return node
}
