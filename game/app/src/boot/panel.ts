import { freshSeed, tidy, type CityBrief } from './brief.ts'

export interface PanelHandlers {
  generate(brief: CityBrief): void
  /** A city file the player picked off their own machine. */
  open(file: File): void
  save(): void
  cancel(): void
  close(): void
}

/**
 * The front door. Its markup is in `index.html`, so it is on screen with the
 * first byte of the page rather than after the renderer, the art and the city
 * have loaded; this drives it.
 */
export class Panel {
  #root: HTMLElement
  #form: HTMLFormElement
  #theme: HTMLInputElement
  #seed: HTMLInputElement
  #blocks: HTMLInputElement
  #model: HTMLInputElement
  #open: HTMLInputElement
  #generate: HTMLButtonElement
  #export: HTMLButtonElement
  #cancel: HTMLButtonElement
  #close: HTMLButtonElement
  #roll: HTMLButtonElement
  #status: HTMLElement
  #handlers: PanelHandlers = { generate: () => {}, open: () => {}, save: () => {}, cancel: () => {}, close: () => {} }

  constructor(root: HTMLElement) {
    this.#root = root
    const find = <T extends HTMLElement>(name: string): T => {
      const found = root.querySelector<T>(`[data-boot="${name}"]`)
      if (!found) throw new Error(`the boot panel has no ${name}`)
      return found
    }
    this.#form = find('form')
    this.#theme = find('theme')
    this.#seed = find('seed')
    this.#blocks = find('blocks')
    this.#model = find('model')
    this.#open = find('open')
    this.#generate = find('generate')
    this.#export = find('export')
    this.#cancel = find('cancel')
    this.#close = find('close')
    this.#roll = find('roll')
    this.#status = find('status')

    this.#form.addEventListener('submit', (event) => {
      event.preventDefault()
      this.#handlers.generate(this.brief)
    })
    this.#roll.addEventListener('click', () => {
      this.#seed.value = freshSeed()
      this.#seed.focus()
    })
    this.#open.addEventListener('change', () => {
      const file = this.#open.files?.[0]
      // cleared straight away, so picking the same file twice is two openings
      this.#open.value = ''
      if (file) this.#handlers.open(file)
    })
    this.#export.addEventListener('click', () => this.#handlers.save())
    this.#cancel.addEventListener('click', () => this.#handlers.cancel())
    this.#close.addEventListener('click', () => this.#handlers.close())
  }

  on(handlers: PanelHandlers): void {
    this.#handlers = handlers
  }

  get brief(): CityBrief {
    return tidy({
      theme: this.#theme.value,
      seed: this.#seed.value,
      blocks: Number(this.#blocks.value),
      model: this.#model.checked,
    })
  }

  set brief(brief: CityBrief) {
    this.#theme.value = brief.theme
    this.#seed.value = brief.seed
    this.#blocks.value = String(brief.blocks)
    this.#model.checked = brief.model
  }

  get open(): boolean {
    return !this.#root.hidden
  }

  show(): void {
    this.#root.hidden = false
    this.#theme.focus()
  }

  hide(): void {
    this.#root.hidden = true
  }

  /** Something is happening and this is what it is. */
  working(step: string): void {
    this.#say(step, { working: true })
    this.#generate.disabled = true
    this.#roll.disabled = true
    this.#open.disabled = true
    this.#cancel.hidden = false
  }

  /** Nothing is happening: the player's turn. */
  waiting(message = '', trouble = false): void {
    this.#say(message, { trouble })
    this.#generate.disabled = false
    this.#roll.disabled = false
    this.#open.disabled = false
    this.#cancel.hidden = true
  }

  /**
   * What the panel has to offer: a city can be exported whether or not it ever
   * reached the screen, and there is only somewhere to go back to once one is
   * being played.
   */
  holding(what: { city: boolean; playing: boolean }): void {
    this.#export.disabled = !what.city
    this.#close.hidden = !what.playing
  }

  #say(text: string, flags: { working?: boolean; trouble?: boolean }): void {
    this.#status.textContent = text
    this.#status.dataset.working = flags.working ? 'true' : 'false'
    this.#status.dataset.trouble = flags.trouble ? 'true' : 'false'
  }
}
