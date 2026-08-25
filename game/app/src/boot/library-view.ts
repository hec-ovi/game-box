import type { Shelved } from './library.ts'

/**
 * The library on the panel: every city the player has made or opened, newest
 * first, the one they were last in marked, each with a way back in and a way
 * to take it off the shelf. Nothing here decides anything: the rows are what
 * the library lists, and a click is reported by key.
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

  /** The shelf as it stands. The first entry is the city the player was last in. */
  render(entries: readonly Shelved[]): void {
    this.#empty.hidden = entries.length > 0
    this.#list.replaceChildren(...entries.map((entry, index) => this.#row(entry, index === 0)))
  }

  #row(entry: Shelved, last: boolean): HTMLLIElement {
    const row = document.createElement('li')
    row.className = 'gb-boot-shelved'
    row.dataset.key = entry.key
    row.dataset.last = String(last)

    const name = document.createElement('span')
    name.className = 'gb-boot-shelved-name'
    name.textContent = entry.name

    const about = document.createElement('span')
    about.className = 'gb-boot-shelved-about'
    about.textContent = describe(entry, last)

    const open = button(last ? 'Continue' : 'Open', `Open ${entry.name}`, () => this.#open(entry.key))
    const remove = button('Remove', `Remove ${entry.name}`, () => this.#remove(entry.key))
    row.append(name, about, open, remove)
    return row
  }
}

function button(text: string, label: string, onClick: () => void): HTMLButtonElement {
  const made = document.createElement('button')
  made.type = 'button'
  made.textContent = text
  made.setAttribute('aria-label', label)
  made.addEventListener('click', onClick)
  return made
}

/** One line under the name: how it was asked for, and whether it was the last one played. */
function describe(entry: Shelved, last: boolean): string {
  const how = entry.source === 'made' ? `${entry.theme}, seed ${entry.seed}, ${entry.blocks} blocks${entry.model ? ', model' : ''}` : 'opened from a file'
  return last ? `${how}. Last played` : how
}
