/**
 * The creation form's left rail: the sections the fields are grouped into, one
 * of them marked. Clicking a section brings it to the top of the rows beside
 * it, and writing in a field marks the section that field is in, so the rail
 * always says where the player is in the form. It holds no fields itself.
 */
export class Sections {
  #rail: HTMLElement
  #rows: HTMLElement
  #items: HTMLButtonElement[]

  constructor(find: <T extends HTMLElement>(name: string) => T) {
    this.#rail = find('rail')
    this.#rows = find('rows')
    this.#items = [...this.#rail.querySelectorAll<HTMLButtonElement>('[data-boot="section"]')]

    for (const item of this.#items) {
      item.addEventListener('click', () => {
        this.#mark(item.dataset.section)
        this.#rows.querySelector(`[data-section="${item.dataset.section}"]`)?.scrollIntoView?.({ block: 'start', behavior: 'smooth' })
      })
    }
    // the rail follows the keyboard: tabbing into a field marks its section
    this.#rows.addEventListener('focusin', (event) => {
      const section = (event.target as HTMLElement).closest<HTMLElement>('[data-section]')
      this.#mark(section?.dataset.section)
    })
  }

  /** The sections go quiet while a city is being written, because none of them is the answer to that. */
  quiet(on: boolean): void {
    this.#rail.dataset.quiet = String(on)
  }

  #mark(section: string | undefined): void {
    if (!section) return
    for (const item of this.#items) item.setAttribute('aria-current', String(item.dataset.section === section))
  }
}
