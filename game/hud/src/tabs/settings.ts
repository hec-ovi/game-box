import { el, setText } from '../dom.ts'
import { NO_SETTINGS, SETTINGS, clockFace } from '../phrase.ts'
import type { HudIntent, HudState, HudWindowName, SettingsView } from '../types.ts'
import { act } from '../ui/act.ts'
import { ICON_PX, icon, type IconName } from '../ui/icon.ts'
import { Row } from '../ui/row.ts'
import type { Tab } from './tab.ts'

/**
 * What the player may set: the clock (held at the hour shown, or skipped
 * ahead), the sky, what the interface keeps on screen, whether the game fills
 * the screen, and the way out. Every button is an intent the game acts on; the
 * tab draws what the game pushes back and decides nothing. The clock and the
 * sky wait for a running city; the view does not, so those two rows answer
 * from the first push.
 */
export class SettingsTab implements Tab {
  readonly name: HudWindowName = 'settings'
  readonly node = el('div', 'gb-settings')
  #emit: (intent: HudIntent) => void
  #clock = el('span', 'gb-num gb-clock gb-t6')
  // Its words wait for the game's first push of the clock, like the section it
  // sits in: nothing reads a setting the city cannot answer for yet.
  #lock = act({ label: '', icon: 'lock', })
  #skip = act({ label: SETTINGS.skip, icon: 'clock', })
  #weathers = el('div', 'gb-weathers')
  #minimap = act({ label: SETTINGS.minimap, icon: 'minimap', })
  #full = act({ label: SETTINGS.fullscreen, icon: 'fullscreen', })
  #timeRow = new Row({ icon: 'clock', title: SETTINGS.time, compact: true })
  #skyRow = new Row({ icon: 'weather-clear', title: SETTINGS.weather, compact: true })
  #time = el('section', 'gb-setting')
  #sky = el('section', 'gb-setting')
  #view = el('section', 'gb-setting')
  #none = el('p', 'gb-empty gb-t3', NO_SETTINGS)
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

    this.#timeRow.state.append(this.#clock)
    this.#timeRow.act(this.#lock)
    this.#timeRow.act(this.#skip)
    this.#time.append(el('h3', 'gb-t5 gb-section-head', SETTINGS.time), this.#timeRow.node)
    this.#skyRow.state.append(this.#weathers)
    this.#sky.append(el('h3', 'gb-t5 gb-section-head', SETTINGS.weather), this.#skyRow.node)

    const minimapRow = new Row({ icon: 'minimap', title: SETTINGS.minimap, compact: true })
    minimapRow.act(this.#minimap)
    const fullRow = new Row({ icon: 'fullscreen', title: SETTINGS.fullscreen, compact: true })
    fullRow.act(this.#full)
    this.#view.append(el('h3', 'gb-t5 gb-section-head', SETTINGS.view), minimapRow.node, fullRow.node)

    const exit = act({ label: SETTINGS.exit, icon: 'leave', className: 'gb-setting-exit gb-act-warn' })
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
    label(this.#lock, settings.locked ? SETTINGS.locked : SETTINGS.lock)
    this.#skyRow.tile.replaceChildren(skyIcon(settings.weather))
    this.#weathers.replaceChildren(
      ...settings.weathers.map((weather) => {
        const pick = act({ label: weather, })
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
    label(this.#full, full ? SETTINGS.windowed : SETTINGS.fullscreen)
  }
}

/** The words on a button, rewritten without touching its icon or its key. */
function label(node: HTMLButtonElement, text: string): void {
  const words = node.querySelector('span')
  if (words) setText(words as HTMLElement, text)
}

/** The sky the game says it is, in a picture. Anything not rain or fog is clear. */
function skyIcon(weather: string): SVGSVGElement {
  const name: IconName = /rain|storm|wet/i.test(weather)
    ? 'weather-rain'
    : /fog|mist|haze|smog/i.test(weather)
      ? 'weather-fog'
      : 'weather-clear'
  return icon(name, ICON_PX.button)
}

/** What the button says it is now, which is what the game last pushed. */
function pressed(node: HTMLButtonElement): boolean {
  return node.getAttribute('aria-pressed') === 'true'
}
