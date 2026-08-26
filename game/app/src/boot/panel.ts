import type { Sidecar } from '@gb/sidecar'
import type { CityBrief } from './brief.ts'
import { paintIcons } from './chrome.ts'
import { CityForm } from './form.ts'
import { Hints } from './hints.ts'
import { LibraryView, type OnTheShelf } from './library-view.ts'
import { enters, replays } from './motion.ts'

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
  exportCity?(key: string): void
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

/** What each face calls itself, and what it says under that. */
const TITLES: Record<PanelFace, string> = { home: 'game-box', make: 'A new city' }
const SUBS: Record<PanelFace, string> = {
  home: 'Pick a game to play, open one somebody sent you, or make a new one.',
  make: 'Three steps over one brief: the city, the writing, then build it. Every field is optional.',
}

/**
 * The front door. Its markup is in `index.html`, so it is on screen with the
 * first byte of the page rather than after the renderer, the art and the city
 * have loaded; this drives it. It has two faces: the cities the player already
 * has, laid out to be picked from, and the form that makes a new one.
 */
export class Panel {
  #root: HTMLElement
  #card: HTMLElement
  #form: CityForm
  #library: LibraryView
  #rail: HTMLElement
  #open: HTMLInputElement
  #apply: HTMLInputElement
  #screens: HTMLInputElement
  #home: HTMLElement
  #make: HTMLElement
  #title: HTMLElement
  #sub: HTMLElement
  #new: HTMLButtonElement
  #crownNew: HTMLButtonElement
  #homeAgain: HTMLButtonElement
  #generate: HTMLButtonElement
  #export: HTMLButtonElement
  #grow: HTMLButtonElement
  #cancel: HTMLButtonElement
  #close: HTMLButtonElement
  #status: HTMLElement
  #shelf: readonly OnTheShelf[] = []
  #face: PanelFace = 'home'
  #playing = false
  #shown = true
  #leaving: ReturnType<typeof setTimeout> | undefined
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
    // the markup declares an icon by name and this draws it, so the panel is
    // one stylesheet and one sprite rather than a paragraph of svg per row
    paintIcons(root)
    new Hints(root)
    this.#card = find('card')
    this.#form = new CityForm({
      find,
      root,
      say: (message, trouble) => this.waiting(message, trouble),
      generate: () => this.#handlers.generate(this.brief),
    })
    this.#library = new LibraryView(find)
    this.#rail = find('rail')
    this.#home = find('home')
    this.#make = find('make')
    this.#title = find('title')
    this.#sub = find('sub')
    this.#new = find('new')
    this.#crownNew = find('crown-new')
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
    this.#library.on({
      open: (key) => this.#handlers.pick(key),
      export: (key) => this.#handlers.exportCity?.(key),
      remove: (key) => this.#handlers.remove(key),
    })
    this.#new.addEventListener('click', () => void (this.face = 'make'))
    this.#crownNew.addEventListener('click', () => void (this.face = 'make'))
    this.#homeAgain.addEventListener('click', () => void (this.face = 'home'))
    this.#export.addEventListener('click', () => this.#handlers.save())
    this.#grow.addEventListener('click', () => this.#handlers.grow())
    this.#cancel.addEventListener('click', () => this.#handlers.cancel())
    this.#close.addEventListener('click', () => this.#handlers.close())

    const backHome = root.querySelector<HTMLButtonElement>('[data-boot="back-home"]')
    if (backHome) {
      backHome.addEventListener('click', () => void (this.face = 'home'))
    }

    const createCity = root.querySelector<HTMLButtonElement>('[data-boot="create-city"]')
    if (createCity) {
      createCity.addEventListener('click', () => void (this.face = 'make'))
    }

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

  /**
   * The page's one sidecar, handed over by whoever built it, so the buttons
   * that have the local model write a field of the brief reach the same model
   * the city itself is written by.
   */
  set sidecar(sidecar: Sidecar) {
    this.#form.sidecar = sidecar
  }

  get brief(): CityBrief {
    return this.#form.brief
  }

  set brief(brief: CityBrief) {
    this.#form.brief = brief
  }

  get face(): PanelFace {
    return this.#face
  }

  /**
   * Show one face or the other. The other one leaves the page rather than
   * being scrolled past, and the one arriving slides in with its rows landing
   * one after another, so the swap reads as a move rather than a redraw.
   */
  set face(face: PanelFace) {
    this.#face = face
    this.#root.dataset.face = face
    this.#home.hidden = face !== 'home'
    this.#make.hidden = face !== 'make'
    this.#new.hidden = face !== 'home'
    this.#crownNew.hidden = face !== 'home'
    this.#homeAgain.hidden = face !== 'make'
    this.#generate.hidden = face !== 'make'
    this.#title.textContent = TITLES[face]
    this.#sub.textContent = SUBS[face]
    if (face === 'make') {
      this.#form.step = 1
    }
    this.#arrive(face === 'home' ? this.#home : this.#make)
  }

  /** What the player set that belongs to them rather than to any city. */
  get settings(): { screens: string } {
    return { screens: this.#screens.value.trim() }
  }

  set settings(settings: { screens: string }) {
    this.#screens.value = settings.screens
  }

  /** The cities on the shelf, newest first. */
  library(cities: readonly OnTheShelf[]): void {
    this.#shelf = cities
    this.#library.render(cities)
  }

  get open(): boolean {
    return this.#shown
  }

  show(): void {
    this.#shown = true
    clearTimeout(this.#leaving)
    this.#leaving = undefined
    this.#root.removeAttribute('data-leaving')
    this.#root.removeAttribute('aria-hidden')
    this.#root.removeAttribute('inert')
    this.#root.hidden = false
    replays(this.#root)
    replays(this.#card)
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

  /**
   * Gone the moment it is asked to go: it stops taking clicks, leaves the
   * accessible tree and lets the keyboard go at once, and only its pixels stay
   * behind for as long as the veil takes to clear.
   */
  hide(): void {
    if (!this.#shown) return
    this.#shown = false
    this.#root.dataset.leaving = 'true'
    this.#root.setAttribute('aria-hidden', 'true')
    this.#root.toggleAttribute('inert', true)
    if (this.#root.contains(document.activeElement)) (document.activeElement as HTMLElement).blur()
    this.#leaving = setTimeout(() => void (this.#root.hidden = true), this.#veil())
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

  /**
   * A face arriving, with the rows on it landing one after another. The mark of
   * the last arrival comes off the whole group first, in one go, so a face the
   * player has been back and forth to still arrives rather than sitting there.
   */
  #arrive(fold: HTMLElement): void {
    const rows = [...fold.querySelectorAll<HTMLElement>('.gb-boot-row')]
    for (const node of [fold, ...rows]) node.classList.remove('gb-in')
    void fold.offsetWidth
    enters(fold)
    for (const [index, row] of rows.entries()) enters(row, index)
  }

  /** How long the pixels stay, read from the durations declared on the panel itself. */
  #veil(): number {
    const token = getComputedStyle(this.#root).getPropertyValue('--gb-t-veil').trim()
    return token.endsWith('ms') ? Number.parseFloat(token) : 0
  }

  #busy(working: boolean): void {
    // the steps go quiet while a city is being written: none of them is the answer to that
    this.#rail.dataset.quiet = String(working)
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
