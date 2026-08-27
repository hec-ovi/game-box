import type { Sidecar } from '@gb/sidecar'
import type { CityBrief } from './brief.ts'
import { paintIcons } from './chrome.ts'
import { CityForm } from './form.ts'
import { Hints } from './hints.ts'
import { LibraryView, type OnTheShelf } from './library-view.ts'
import { enters, replays } from './motion.ts'
import { note } from './notes.ts'
import { painted } from './painted.ts'
import type { Laid } from './review.ts'

/** What laying the architecture out came back with, and what to say about it. */
export interface Planned {
  readonly ok: boolean
  readonly message: string
  /** What the town actually came out as, when one came out. */
  readonly laid?: Laid
}

/** Whether a view opened, and what to say when it did not. */
export interface Opened {
  readonly ok: boolean
  readonly message: string
}

export interface PanelHandlers {
  generate(brief: CityBrief): void
  /** Keep this brief on this browser. Builds nothing. */
  draft(brief: CityBrief): void
  /** Lay the architecture out from these settings so it can be previewed. */
  plan?(brief: CityBrief): Promise<Planned>
  /**
   * Open the architecture the last plan laid out, and answer once it is on the
   * screen. Left out, the tile says so rather than opening something that is
   * not there.
   */
  preview?(): Promise<Opened>
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
  #stage: HTMLElement
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
  #draft: HTMLButtonElement
  #plan: HTMLButtonElement
  #preview: HTMLButtonElement
  #export: HTMLButtonElement
  #grow: HTMLButtonElement
  #cancel: HTMLButtonElement
  #close: HTMLButtonElement
  #status: HTMLElement
  #shelf: readonly OnTheShelf[] = []
  #face: PanelFace = 'home'
  #planned = false
  #playing = false
  #staged = false
  #shown = true
  #leaving: ReturnType<typeof setTimeout> | undefined
  #handlers: PanelHandlers = {
    generate: () => {},
    draft: () => {},
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
    this.#stage = find('stage')
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
    this.#draft = find('draft')
    this.#plan = find('plan')
    this.#preview = find('preview')
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
    // a settings change describes another city, so whatever was laid out goes
    this.#form.onEdit(() => this.#unplanned())
    this.#new.addEventListener('click', () => void (this.face = 'make'))
    this.#crownNew.addEventListener('click', () => void (this.face = 'make'))
    this.#homeAgain.addEventListener('click', () => void (this.face = 'home'))
    this.#draft.addEventListener('click', () => {
      this.#handlers.draft(this.brief)
      note(this.#draft, 'Draft kept on this browser. It opens here next time.')
    })
    this.#plan.addEventListener('click', () => void this.#lay())
    this.#preview.addEventListener('click', () => void this.#show())
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

    // the way back is a key as well as a button, and the button prints it.
    // A step drawn over the card has the key while it is up, because Escape
    // there means leave that step rather than leave the panel.
    root.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || !this.#playing || this.#staged) return
      event.preventDefault()
      this.#handlers.close()
    })
  }

  on(handlers: PanelHandlers): void {
    this.#handlers = handlers
  }

  /**
   * The page's one sidecar, handed over by whoever built it, so the buttons
   * that have the model write a field of the brief reach the same model
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
   * The architecture laid out from the form as it stands, so it can be looked
   * at before the city is written. Preview opens what this leaves behind and
   * stays disabled until there is one, and a layout that did not happen says so
   * on the line under the tiles rather than lighting Preview on nothing.
   */
  async #lay(): Promise<void> {
    const ask = this.#handlers.plan
    if (!ask) return note(this.#plan, 'The city layout is not connected to this button, so nothing was laid out.')
    note(this.#plan, 'Laying the architecture out.')
    this.#plan.disabled = true
    // the layout blocks this thread once it starts, so the line above it is on
    // the glass before it does
    await painted()
    let planned: Planned
    try {
      planned = await ask(this.brief)
    } catch (cause) {
      planned = { ok: false, message: `The architecture would not lay out (${String(cause)}).` }
    } finally {
      this.#plan.disabled = false
    }
    note(this.#plan, planned.message)
    this.#planned = planned.ok
    this.#form.laid = planned.laid
    this.#preview.disabled = !this.#planned
  }

  /**
   * Open what the layout laid out. The renderer is not part of the page the
   * panel is served on, so the tile says it is opening while it arrives; a view
   * that would not open says why where it was pressed and the form stays put.
   */
  async #show(): Promise<void> {
    const open = this.#handlers.preview
    if (!open) return note(this.#preview, 'The blueprint view is not connected to this button, so there is nothing to open.')
    note(this.#preview, 'Opening the blueprint.')
    this.#preview.disabled = true
    await painted()
    let opened: Opened
    try {
      opened = await open()
    } catch (cause) {
      opened = { ok: false, message: `The blueprint would not open (${String(cause)}).` }
    } finally {
      this.#preview.disabled = !this.#planned
    }
    note(this.#preview, opened.ok ? '' : opened.message)
  }

  /**
   * The surface a whole step is drawn on, in front of the card: the blueprint
   * mounts here. While it is up the form leaves the accessible tree and the
   * keyboard with it; taken down, the form is exactly as it was and the
   * keyboard is back on the tile that opened it.
   */
  stage(on: boolean): HTMLElement {
    this.#staged = on
    this.#root.dataset.stage = String(on)
    this.#card.toggleAttribute('inert', on)
    this.#stage.hidden = !on
    if (!on) {
      this.#stage.replaceChildren()
      this.#preview.focus()
    }
    return this.#stage
  }

  /** The layout dropped: the form moved, so what was laid out is not this city. */
  #unplanned(): void {
    if (!this.#planned) return
    this.#planned = false
    this.#preview.disabled = true
    note(this.#plan, '')
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
    this.#draft.disabled = working
    this.#plan.disabled = working
    this.#preview.disabled = working || !this.#planned
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
