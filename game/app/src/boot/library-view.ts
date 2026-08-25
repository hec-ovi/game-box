import type { Shelved } from './library.ts'

/** One city as the landing screen draws it: the shelf's own row, and whether a playthrough is waiting in it. */
export interface OnTheShelf {
  readonly entry: Shelved
  readonly played: boolean
}

/**
 * The landing screen's grid: one box per city the player has made or opened,
 * newest first, the one they were last in marked, each showing enough to know
 * it again and carrying the way back in and the way off the shelf. Nothing
 * here decides anything: the boxes are what the library lists, and a click is
 * reported by key.
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
    this.#list.replaceChildren(...cities.map((city, index) => this.#box(city, index === 0)))
  }

  #box(city: OnTheShelf, last: boolean): HTMLLIElement {
    const { entry } = city
    const box = document.createElement('li')
    box.className = 'gb-boot-shelved'
    box.dataset.key = entry.key
    box.dataset.last = String(last)
    box.dataset.played = String(city.played)

    const name = line('gb-boot-shelved-name', entry.name)
    const about = line('gb-boot-shelved-about', aboutOf(entry))
    const meta = line('gb-boot-shelved-meta', metaOf(entry))
    const buttons = document.createElement('div')
    buttons.className = 'gb-boot-shelved-buttons'
    buttons.append(
      button(last ? 'Continue' : 'Open', `Open ${entry.name}`, () => this.#open(entry.key)),
      button('Remove', `Remove ${entry.name}`, () => this.#remove(entry.key)),
    )

    box.append(name, about, meta)
    // a city with a playthrough in it is the one to go back to, so it says so
    if (city.played) box.append(line('gb-boot-shelved-playing', 'Playthrough in progress'))
    box.append(buttons)
    return box
  }
}

function line(className: string, text: string): HTMLSpanElement {
  const made = document.createElement('span')
  made.className = className
  made.textContent = text
  return made
}

function button(text: string, label: string, onClick: () => void): HTMLButtonElement {
  const made = document.createElement('button')
  made.type = 'button'
  made.textContent = text
  made.setAttribute('aria-label', label)
  made.addEventListener('click', onClick)
  return made
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
