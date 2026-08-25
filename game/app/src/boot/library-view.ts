import { button, chip, edged, icon, line } from './chrome.ts'
import type { Shelved } from './library.ts'
import { enters } from './motion.ts'

/** One city as the landing screen draws it: the shelf's own row, and whether a playthrough is waiting in it. */
export interface OnTheShelf {
  readonly entry: Shelved
  readonly played: boolean
}

/**
 * The landing screen's cities: one wide card each, newest first, the one they
 * were last in marked, each showing enough to know it again at a glance and
 * carrying the way back in and the way off the shelf. Nothing here decides
 * anything: the cards are what the library lists, and a click is reported by
 * key.
 */
export class LibraryView {
  #list: HTMLElement
  #empty: HTMLElement
  #open: (key: string) => void = () => {}
  #remove: (key: string) => void = () => {}

  constructor(find: <T extends HTMLElement>(name: string) => T) {
    this.#list = find('library')
    this.#empty = find('library-empty')
  }

  on(handlers: { open: (key: string) => void; remove: (key: string) => void }): void {
    this.#open = handlers.open
    this.#remove = handlers.remove
  }

  /** The shelf as it stands. The first city is the one the player was last in. */
  render(cities: readonly OnTheShelf[]): void {
    this.#empty.hidden = cities.length > 0
    this.#list.replaceChildren(...cities.map((city, index) => this.#card(city, index)))
  }

  #card(city: OnTheShelf, index: number): HTMLElement {
    const { entry } = city
    const { box, inner } = edged('li', 'gb-boot-shelved', 'c14')
    box.dataset.key = entry.key
    box.dataset.last = String(index === 0)
    box.dataset.played = String(city.played)

    // the band: what a picker would put artwork on, carrying what the city was
    // asked to be
    const plate = document.createElement('div')
    plate.className = 'gb-boot-shelved-plate'
    plate.append(icon('city', 28), line('gb-boot-shelved-theme gb-t0', entry.theme))

    const readout = document.createElement('span')
    readout.className = 'gb-boot-shelved-readout'
    readout.append(line('gb-boot-shelved-meta', metaOf(entry)))
    if (index === 0) readout.append(chip('Last played', 'gb-boot-shelved-last'))
    if (city.played) readout.append(chip('Playthrough in progress', 'gb-boot-shelved-playing'))

    const body = document.createElement('div')
    body.className = 'gb-boot-shelved-body'
    body.append(line('gb-boot-shelved-name gb-t6', entry.name), line('gb-boot-shelved-about gb-t3', aboutOf(entry)), readout)

    const buttons = document.createElement('div')
    buttons.className = 'gb-boot-shelved-buttons'
    buttons.append(
      button({
        text: index === 0 ? 'Continue' : 'Open',
        icon: 'door',
        label: `Open ${entry.name}`,
        lit: true,
        onClick: () => this.#open(entry.key),
      }),
      button({
        text: 'Remove',
        icon: 'close',
        label: `Remove ${entry.name}`,
        quiet: true,
        onClick: () => this.#remove(entry.key),
      }),
    )

    inner.append(plate, body, buttons)
    enters(box, index)
    return box
  }
}

/** What the city is, in the player's own words if they gave any, and in its theme if they did not. */
function aboutOf(entry: Shelved): string {
  return entry.brief ?? entry.theme
}

/** How big it is, how it was asked for, and when it was written. */
function metaOf(entry: Shelved): string {
  const size = entry.source === 'made' ? `${entry.blocks} blocks, seed ${entry.seed}${entry.model ? ', model' : ''}` : 'From a file'
  return `${size} · made ${ago(entry.madeAt ?? entry.openedAt)}`
}

const SPANS = [
  { seconds: 60, unit: 'second' as const },
  { seconds: 3600, unit: 'minute' as const },
  { seconds: 86400, unit: 'hour' as const },
  { seconds: 604800, unit: 'day' as const },
  { seconds: 2629800, unit: 'week' as const },
  { seconds: 31557600, unit: 'month' as const },
]

/** How long ago, in the largest unit that still says something: "3 days ago". */
function ago(when: number, now = Date.now()): string {
  const words = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  const seconds = (when - now) / 1000
  let each = 1
  for (const span of SPANS) {
    if (Math.abs(seconds) < span.seconds) return words.format(Math.round(seconds / each), span.unit)
    each = span.seconds
  }
  return words.format(Math.round(seconds / each), 'year')
}
