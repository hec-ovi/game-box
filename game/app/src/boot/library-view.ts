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
  #export: (key: string) => void = () => {}
  #remove: (key: string) => void = () => {}

  constructor(find: <T extends HTMLElement>(name: string) => T) {
    this.#list = find('library')
    this.#empty = find('library-empty')
  }

  on(handlers: { open: (key: string) => void; export?: (key: string) => void; remove: (key: string) => void }): void {
    this.#open = handlers.open
    if (handlers.export) this.#export = handlers.export
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
    plate.append(line('gb-boot-shelved-theme gb-t0', entry.theme))

    const readout = document.createElement('span')
    readout.className = 'gb-boot-shelved-readout'
    readout.append(line('gb-boot-shelved-meta', metaOf(entry)))
    if (index === 0) readout.append(chip('Last played', 'gb-boot-shelved-last'))
    if (city.played) readout.append(chip('Playthrough in progress', 'gb-boot-shelved-playing'))

    const body = document.createElement('div')
    body.className = 'gb-boot-shelved-body'
    body.append(line('gb-boot-shelved-name gb-t6', entry.name), line('gb-boot-shelved-about gb-t3', aboutOf(entry)))
    const holds = holdsOf(entry)
    if (holds) body.append(holds)
    body.append(readout)

    const buttons = document.createElement('div')
    buttons.className = 'gb-boot-shelved-buttons'

    const renderNormalButtons = () => {
      buttons.replaceChildren(
        button({
          text: index === 0 ? 'Continue' : 'Open',
          icon: 'door',
          label: `Open ${entry.name}`,
          tooltip: index === 0 ? `Continue session in ${entry.name}` : `Launch playthrough in ${entry.name}`,
          hint: `Open and enter live 3D simulation mode in ${entry.name}.`,
          lit: true,
          onClick: () => this.#open(entry.key),
        }),
        button({
          text: 'Export',
          icon: 'map',
          label: `Export ${entry.name}`,
          tooltip: `Export ${entry.name} file`,
          hint: `Download ${entry.name} as a standalone world JSON archive.`,
          onClick: () => this.#export(entry.key),
        }),
        button({
          text: 'Remove',
          icon: 'close',
          label: `Remove ${entry.name}`,
          tooltip: `Remove ${entry.name} from shelf`,
          hint: `Delete this city archive from local browser storage.`,
          quiet: true,
          onClick: () => renderConfirmButtons(),
        }),
      )
    }

    const renderConfirmButtons = () => {
      const confirmLabel = line('gb-boot-remove-warn gb-t1', 'Delete permanently?')
      const cancelBtn = button({
        text: 'Cancel',
        icon: 'close',
        label: `Cancel deleting ${entry.name}`,
        tooltip: 'Cancel deletion',
        quiet: true,
        onClick: () => renderNormalButtons(),
      })
      const deleteBtn = button({
        text: 'Confirm Delete',
        icon: 'close',
        label: `Confirm Remove ${entry.name}`,
        tooltip: `Permanently delete ${entry.name}`,
        hint: `Permanently delete this city archive.`,
        lit: true,
        onClick: () => this.#remove(entry.key),
      })
      deleteBtn.classList.add('gb-btn-danger')
      buttons.replaceChildren(confirmLabel, cancelBtn, deleteBtn)
    }

    renderNormalButtons()

    inner.append(plate, body, buttons)
    enters(box, index)
    return box
  }
}

/**
 * What is in the city, as a row of counts a player picks a game by: how long
 * the main line is, how much side work there is, how many doors open, and how
 * much town there is around them. A city shelved before the counts were kept
 * has none, and the row is left off rather than guessed.
 */
function holdsOf(entry: Shelved): HTMLElement | undefined {
  const holds = entry.holds
  if (!holds) return undefined
  const row = document.createElement('span')
  row.className = 'gb-boot-shelved-holds'
  const metrics: Array<{ count: number; label: string; tooltip: string; hint: string }> = [
    {
      count: holds.mainSteps,
      label: plural(holds.mainSteps, 'mainquest step'),
      tooltip: `${holds.mainSteps} Main Storyline Objectives`,
      hint: `This city features a ${holds.mainSteps}-step main campaign storyline written for the player.`,
    },
    {
      count: holds.sideQuests,
      label: plural(holds.sideQuests, 'side job'),
      tooltip: `${holds.sideQuests} Optional Side Jobs & Errands`,
      hint: `${holds.sideQuests} optional character errands and investigations available in the codex.`,
    },
    {
      count: holds.places,
      label: plural(holds.places, 'interactive building'),
      tooltip: `${holds.places} Accessible Interior Places & Shops`,
      hint: `${holds.places} fully populated interior locations and shops you can open and explore.`,
    },
    {
      count: holds.people,
      label: plural(holds.people, 'NPC'),
      tooltip: `${holds.people} Living Town Residents & Vendors`,
      hint: `${holds.people} living citizens, shopkeepers, and characters roaming this district.`,
    },
    {
      count: holds.buildings,
      label: plural(holds.buildings, 'building'),
      tooltip: `${holds.buildings} Architectural Buildings & Facades`,
      hint: `${holds.buildings} distinct architectural structures, storefronts, and street blocks.`,
    },
  ]
  for (const { count, label, tooltip, hint } of metrics) {
    const cell = document.createElement('span')
    cell.className = 'gb-boot-holds-cell'
    cell.dataset.tooltip = tooltip
    cell.dataset.hint = hint
    cell.append(line('gb-boot-holds-count gb-t5', String(count)), line('gb-boot-holds-what gb-t0', label))
    row.append(cell)
  }
  return row
}

/** One or many, without a count in front of it, because the count is its own line. */
function plural(count: number, one: string): string {
  if (count === 1) return one
  if (one === 'NPC') return 'NPCs'
  return `${one}s`
}

/** What the city is, in the player's own words if they gave any, and in its theme if they did not. */
function aboutOf(entry: Shelved): string {
  return entry.brief ?? entry.holds?.summary ?? entry.theme
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
