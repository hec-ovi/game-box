import { el, setText } from '../dom.ts'
import { NO_SETTINGS, SETTINGS, clockFace } from '../phrase.ts'
import type { HudIntent, HudState, HudWindowName, SettingsView } from '../types.ts'
import type { Tab } from './tab.ts'

/**
 * What the player may set: the clock (held at the hour shown, or skipped
 * ahead), the sky, what the interface keeps on screen, whether the game fills
 * the screen, and the way out. Every button is an intent the game acts on; the
 * tab draws what the game pushes back and decides nothing. The clock and the
 * sky wait for a running city; the view does not, so those two buttons answer
 * from the first push.
 */
export class SettingsTab implements Tab {
  readonly name: HudWindowName = 'settings'
  readonly node = el('div', 'gb-settings')
  #emit: (intent: HudIntent) => void
  #clock = el('span', 'gb-num gb-clock')
  #lock = button('gb-setting-lock')
  #skip = button('gb-setting-skip', SETTINGS.skip)
  #weathers = el('div', 'gb-weathers')
  #minimap = button('gb-setting-minimap', SETTINGS.minimap)
  #full = button('gb-setting-fullscreen')
  #time = el('section', 'gb-setting')
  #sky = el('section', 'gb-setting')
  #view = el('section', 'gb-setting')
  #none = el('p', 'gb-empty', NO_SETTINGS)
  #key: string | null = null
  #viewKey: string | null = null

  constructor(emit: (intent: HudIntent) => void) {
    this.#emit = emit
    this.#clock.setAttribute('aria-label', 'Hour')
    this.#lock.addEventListener('click', () => {
      this.#emit({ kind: 'lock-time', locked: pressed(this.#lock) !== true })
    })
    this.#skip.addEventListener('click', () => this.#emit({ kind: 'skip-time' }))
    this.#minimap.addEventListener('click', () => this.#emit({ kind: 'minimap', shown: pressed(this.#minimap) !== true }))
    this.#full.addEventListener('click', () => this.#emit({ kind: 'fullscreen', on: pressed(this.#full) !== true }))

    const clockLine = el('div', 'gb-setting-line')
    clockLine.append(this.#clock, this.#lock, this.#skip)
    this.#time.append(el('h3', undefined, SETTINGS.time), clockLine)
    this.#sky.append(el('h3', undefined, SETTINGS.weather), this.#weathers)
    const viewLine = el('div', 'gb-setting-line')
    viewLine.append(this.#minimap, this.#full)
    this.#view.append(el('h3', undefined, SETTINGS.view), viewLine)

    const exit = button('gb-setting-exit', SETTINGS.exit)
    exit.addEventListener('click', () => this.#emit({ kind: 'exit' }))
    const out = el('section', 'gb-setting')
    out.append(exit)
    this.node.append(this.#time, this.#sky, this.#none, this.#view, out)
  }

  render(state: HudState): void {
    this.#city(state.settings)
    this.#look(state.settings)
  }

  clear(): void {
    this.#key = null
    this.#viewKey = null
    this.#weathers.replaceChildren()
  }

  /** The clock and the sky, which only mean something once a city is running. */
  #city(settings: SettingsView | undefined): void {
    const key = settings
      ? `${settings.hour}:${settings.minute}:${settings.locked}:${settings.weather}:${settings.weathers.join(',')}`
      : ''
    if (key === this.#key) return
    this.#key = key
    this.#time.hidden = this.#sky.hidden = settings === undefined
    this.#none.hidden = settings !== undefined
    if (!settings) return
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

  /** The minimap and full screen: on until the game says otherwise, off until it says so. */
  #look(settings: SettingsView | undefined): void {
    const minimap = settings?.minimap !== false
    const full = settings?.fullscreen === true
    const key = `${minimap}:${full}`
    if (key === this.#viewKey) return
    this.#viewKey = key
    this.#minimap.setAttribute('aria-pressed', String(minimap))
    this.#full.setAttribute('aria-pressed', String(full))
    setText(this.#full, full ? SETTINGS.windowed : SETTINGS.fullscreen)
  }
}

function button(className: string, label = ''): HTMLButtonElement {
  const node = el('button', className, label)
  node.type = 'button'
  return node
}

/** What the button says it is now, which is what the game last pushed. */
function pressed(node: HTMLButtonElement): boolean {
  return node.getAttribute('aria-pressed') === 'true'
}
