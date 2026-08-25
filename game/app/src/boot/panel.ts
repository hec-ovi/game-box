import type { CityBrief } from './brief.ts'
import { CityForm } from './form.ts'
import { LibraryView, type OnTheShelf } from './library-view.ts'

export interface PanelHandlers {
  generate(brief: CityBrief): void
  /** A city file the player picked off their own machine. */
  open(file: File): void
  /** A pack file, onto the city that is open. */
  apply(file: File): void
  /** Build onto the city that is open, and hand back the pack for what went up. */
  grow(): void
  /** A city off the shelf, by the library's key. */
  pick(key: string): void
  remove(key: string): void
  save(): void
  cancel(): void
  close(): void
  /** The player's own settings changed: what their televisions play. */
  settings(settings: { screens: string }): void
}

/**
 * Which face the panel is showing: the cities the player has, or the form that
 * makes another one.
 */
export type PanelFace = 'home' | 'make'

/** What each face says under the title. */
const SUBS: Record<PanelFace, string> = {
  home: 'Pick a city to play, open one somebody sent you, or make a new one.',
  make: 'Every field is optional. Left blank, the city decides for itself; the same answers make the same city every time.',
}

/**
 * The front door. Its markup is in `index.html`, so it is on screen with the
 * first byte of the page rather than after the renderer, the art and the city
 * have loaded; this drives it. It has two faces: the cities the player already
 * has, laid out to be picked from, and the form that makes a new one.
 */
export class Panel {
  #root: HTMLElement
  #form: CityForm
  #library: LibraryView
  #open: HTMLInputElement
  #apply: HTMLInputElement
  #screens: HTMLInputElement
  #home: HTMLElement
  #make: HTMLElement
  #sub: HTMLElement
  #new: HTMLButtonElement
  #homeAgain: HTMLButtonElement
  #generate: HTMLButtonElement
  #export: HTMLButtonElement
  #grow: HTMLButtonElement
  #cancel: HTMLButtonElement
  #close: HTMLButtonElement
  #status: HTMLElement
  #face: PanelFace = 'make'
  #playing = false
  #handlers: PanelHandlers = {
    generate: () => {},
    open: () => {},
    apply: () => {},
    grow: () => {},
    pick: () => {},
    remove: () => {},
    save: () => {},
    cancel: () => {},
    close: () => {},
    settings: () => {},
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
    this.#home = find('home')
    this.#make = find('make')
    this.#sub = find('sub')
    this.#new = find('new')
    this.#homeAgain = find('home-again')
    this.#open = find('open')
    this.#apply = find('apply')
    this.#screens = find('screens')
    this.#generate = find('generate')
    this.#export = find('export')
    this.#grow = find('grow')
    this.#cancel = find('cancel')
    this.#close = find('close')
    this.#status = find('status')
    this.face = 'make'

    find<HTMLFormElement>('form').addEventListener('submit', (event) => {
      event.preventDefault()
      this.#handlers.generate(this.brief)
    })
    // cleared straight away, so picking the same file twice is two openings
    this.#open.addEventListener('change', () => {
      const file = this.#open.files?.[0]
      this.#open.value = ''
      if (file) this.#handlers.open(file)
    })
    this.#apply.addEventListener('change', () => {
      const file = this.#apply.files?.[0]
      this.#apply.value = ''
      if (file) this.#handlers.apply(file)
    })
    this.#screens.addEventListener('change', () => this.#handlers.settings(this.settings))
    this.#library.on({ open: (key) => this.#handlers.pick(key), remove: (key) => this.#handlers.remove(key) })
    this.#new.addEventListener('click', () => void (this.face = 'make'))
    this.#homeAgain.addEventListener('click', () => void (this.face = 'home'))
    this.#export.addEventListener('click', () => this.#handlers.save())
    this.#grow.addEventListener('click', () => this.#handlers.grow())
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

  get face(): PanelFace {
    return this.#face
  }

  /** Show one face or the other. The other one leaves the page rather than being scrolled past. */
  set face(face: PanelFace) {
    this.#face = face
    this.#root.dataset.face = face
    this.#home.hidden = face !== 'home'
    this.#make.hidden = face !== 'make'
    this.#new.hidden = face !== 'home'
    this.#homeAgain.hidden = face !== 'make'
    this.#generate.hidden = face !== 'make'
    this.#sub.textContent = SUBS[face]
  }

  /** What the player set that belongs to them rather than to any city. */
  get settings(): { screens: string } {
    return { screens: this.#screens.value.trim() }
  }

  set settings(settings: { screens: string }) {
    this.#screens.value = settings.screens
  }

  set brief(brief: CityBrief) {
    this.#form.brief = brief
  }

  /** The cities on the shelf, newest first. */
  library(cities: readonly OnTheShelf[]): void {
    this.#library.render(cities)
  }

  get open(): boolean {
    return !this.#root.hidden
  }

  show(): void {
    this.#root.hidden = false
    this.#focus()
  }

  /**
   * Where the keyboard lands when the panel comes up: the first way in on the
   * face it is showing. On the landing that is the city the player would go
   * back to, and with an empty shelf the way to make one; on the form it is the
   * first field. Escape is bound on the panel, so it is also what keeps the way
   * back to the city on a key.
   */
  #focus(): void {
    if (this.#face === 'make') return this.#form.focus()
    const first = this.#home.querySelector<HTMLButtonElement>('.gb-boot-shelved button')
    ;(first ?? this.#new).focus()
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
    this.#grow.disabled = !what.city
    this.#apply.disabled = !what.city
    this.#close.hidden = !what.playing
  }

  #busy(working: boolean): void {
    this.#generate.disabled = working
    this.#open.disabled = working
    this.#grow.disabled = working || this.#grow.disabled
    this.#apply.disabled = working || this.#apply.disabled
    this.#cancel.hidden = !working
    for (const button of this.#root.querySelectorAll<HTMLButtonElement>('.gb-boot-shelved button')) button.disabled = working
  }

  #say(text: string, flags: { working?: boolean; trouble?: boolean }): void {
    this.#status.textContent = text
    this.#status.dataset.working = flags.working ? 'true' : 'false'
    this.#status.dataset.trouble = flags.trouble ? 'true' : 'false'
  }
}
