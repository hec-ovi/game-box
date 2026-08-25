import type { CityBrief } from './brief.ts'
import { CityForm } from './form.ts'
import { LibraryView } from './library-view.ts'
import type { Shelved } from './library.ts'

export interface PanelHandlers {
  generate(brief: CityBrief): void
  /** A city file the player picked off their own machine. */
  open(file: File): void
  /** A city off the shelf, by the library's key. */
  pick(key: string): void
  remove(key: string): void
  save(): void
  cancel(): void
  close(): void
}

/**
 * The front door. Its markup is in `index.html`, so it is on screen with the
 * first byte of the page rather than after the renderer, the art and the city
 * have loaded; this drives it. The form and the library are its two halves.
 */
export class Panel {
  #root: HTMLElement
  #form: CityForm
  #library: LibraryView
  #open: HTMLInputElement
  #generate: HTMLButtonElement
  #export: HTMLButtonElement
  #cancel: HTMLButtonElement
  #close: HTMLButtonElement
  #status: HTMLElement
  #playing = false
  #handlers: PanelHandlers = {
    generate: () => {},
    open: () => {},
    pick: () => {},
    remove: () => {},
    save: () => {},
    cancel: () => {},
    close: () => {},
  }

  constructor(root: HTMLElement) {
    this.#root = root
    const find = <T extends HTMLElement>(name: string): T => {
      const found = root.querySelector<T>(`[data-boot="${name}"]`)
      if (!found) throw new Error(`the boot panel has no ${name}`)
      return found
    }
    this.#form = new CityForm(find)
    this.#library = new LibraryView(find)
    this.#open = find('open')
    this.#generate = find('generate')
    this.#export = find('export')
    this.#cancel = find('cancel')
    this.#close = find('close')
    this.#status = find('status')

    find<HTMLFormElement>('form').addEventListener('submit', (event) => {
      event.preventDefault()
      this.#handlers.generate(this.brief)
    })
    this.#open.addEventListener('change', () => {
      const file = this.#open.files?.[0]
      // cleared straight away, so picking the same file twice is two openings
      this.#open.value = ''
      if (file) this.#handlers.open(file)
    })
    this.#library.on({ open: (key) => this.#handlers.pick(key), remove: (key) => this.#handlers.remove(key) })
    this.#export.addEventListener('click', () => this.#handlers.save())
    this.#cancel.addEventListener('click', () => this.#handlers.cancel())
    this.#close.addEventListener('click', () => this.#handlers.close())
    // the way back is a key as well as a button, and the button prints it
    root.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || !this.#playing) return
      event.preventDefault()
      this.#handlers.close()
    })
  }

  on(handlers: PanelHandlers): void {
    this.#handlers = handlers
  }

  get brief(): CityBrief {
    return this.#form.brief
  }

  set brief(brief: CityBrief) {
    this.#form.brief = brief
  }

  /** The shelf, newest first. */
  library(entries: readonly Shelved[]): void {
    this.#library.render(entries)
  }

  get open(): boolean {
    return !this.#root.hidden
  }

  show(): void {
    this.#root.hidden = false
    this.#form.focus()
  }

  hide(): void {
    this.#root.hidden = true
  }

  /**
   * Stand aside: a city being written has a loader of its own under the panel,
   * so the form gets out of its way and what is left is the step and Cancel.
   */
  aside(on: boolean): void {
    this.#root.dataset.aside = String(on)
  }

  /** Something is happening and this is what it is. */
  working(step: string): void {
    this.#say(step, { working: true })
    this.#busy(true)
  }

  /** Nothing is happening: the player's turn. */
  waiting(message = '', trouble = false): void {
    this.#say(message, { trouble })
    this.#busy(false)
  }

  /**
   * What the panel has to offer: a city can be exported whether or not it ever
   * reached the screen, and there is only somewhere to go back to once one is
   * being played.
   */
  holding(what: { city: boolean; playing: boolean }): void {
    this.#playing = what.playing
    this.#export.disabled = !what.city
    this.#close.hidden = !what.playing
  }

  #busy(working: boolean): void {
    this.#generate.disabled = working
    this.#open.disabled = working
    this.#cancel.hidden = !working
    for (const button of this.#root.querySelectorAll<HTMLButtonElement>('.gb-boot-shelved button')) button.disabled = working
  }

  #say(text: string, flags: { working?: boolean; trouble?: boolean }): void {
    this.#status.textContent = text
    this.#status.dataset.working = flags.working ? 'true' : 'false'
    this.#status.dataset.trouble = flags.trouble ? 'true' : 'false'
  }
}
