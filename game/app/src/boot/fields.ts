import type { BriefDraft, BriefField, BriefSoFar } from '@gb/scribe'
import { clampBlocks, clampPlaces, clampStoreys, freshSeed, STYLE, tidy, type CityBrief, type StyleAxis } from './brief.ts'

/** Every text box on the form, by the name the markup gives it. */
const TEXT = ['theme', 'brief', 'main', 'side', 'tone', 'seed'] as const

type TextName = (typeof TEXT)[number]
type Texts = Record<TextName, HTMLInputElement | HTMLTextAreaElement>
type Styles = Record<StyleAxis, HTMLSelectElement>

/** Which box on the form holds each field of a brief the model can write. */
const WRITTEN: Record<BriefField, TextName> = { theme: 'theme', brief: 'brief', mainQuest: 'main', sideQuests: 'side', tone: 'tone' }

/** The three numbers, each with the field that holds it and the range it is held to. */
const NUMBERS = { blocks: clampBlocks, places: clampPlaces, storeys: clampStoreys } as const

type NumberName = keyof typeof NUMBERS

/**
 * Every control on the creation form: what the player typed, read out as a
 * `CityBrief`, and a brief written back into the controls.
 *
 * The word pills, the arrows and the sliders are second ways into fields that
 * already exist, so keeping them in step with those fields happens here and
 * nowhere else. Nothing here decides anything about a city.
 */
export class Fields {
  #root: HTMLElement
  #text: Texts
  #style: Styles
  #numbers: Record<NumberName, HTMLInputElement>
  #model: HTMLInputElement
  #modelState: HTMLElement
  #changed: () => void = () => {}

  constructor(find: <T extends HTMLElement>(name: string) => T, root: HTMLElement) {
    this.#root = root
    this.#text = Object.fromEntries(TEXT.map((name) => [name, find<HTMLInputElement>(name)])) as Texts
    this.#style = Object.fromEntries((Object.keys(STYLE) as StyleAxis[]).map((axis) => [axis, find<HTMLSelectElement>(axis)])) as Styles
    this.#numbers = Object.fromEntries((Object.keys(NUMBERS) as NumberName[]).map((name) => [name, find<HTMLInputElement>(name)])) as Record<
      NumberName,
      HTMLInputElement
    >
    this.#model = find('model')
    this.#modelState = find('model-state')

    for (const axis of Object.keys(STYLE) as StyleAxis[]) this.#offer(axis)
    this.#model.addEventListener('change', () => this.#sayModel())
    find<HTMLButtonElement>('roll').addEventListener('click', () => {
      this.#text.seed.value = freshSeed()
      this.#text.seed.focus()
      this.#changed()
    })
    this.#bindPills()
    this.#bindNumbers()
    root.addEventListener('input', () => this.#changed())
    root.addEventListener('change', () => this.#changed())
  }

  /** Called whenever any control moves, so whatever reads the form back can redraw. */
  onChange(handler: () => void): void {
    this.#changed = handler
  }

  get brief(): CityBrief {
    const style = Object.fromEntries(
      (Object.keys(STYLE) as StyleAxis[]).flatMap((axis) => {
        const picked = this.#style[axis].value
        return picked ? [[axis, picked]] : []
      }),
    )
    return tidy({
      theme: this.#text.theme.value,
      seed: this.#text.seed.value,
      blocks: Number(this.#numbers.blocks.value),
      ...this.#typed('places'),
      ...this.#typed('storeys'),
      model: this.#model.checked,
      brief: this.#text.brief.value,
      asks: {
        mainQuest: this.#text.main.value,
        sideQuests: this.#text.side.value,
        tone: this.#text.tone.value,
        style,
      },
    })
  }

  set brief(brief: CityBrief) {
    this.#text.theme.value = brief.theme
    this.#text.seed.value = brief.seed
    this.#text.brief.value = brief.brief ?? ''
    this.#text.main.value = brief.asks?.mainQuest ?? ''
    this.#text.side.value = brief.asks?.sideQuests ?? ''
    this.#text.tone.value = brief.asks?.tone ?? ''
    for (const axis of Object.keys(STYLE) as StyleAxis[]) this.#style[axis].value = brief.asks?.style?.[axis] ?? ''
    this.#numbers.blocks.value = String(brief.blocks)
    this.#numbers.places.value = brief.places !== undefined ? String(brief.places) : ''
    this.#numbers.storeys.value = brief.storeys !== undefined ? String(brief.storeys) : ''
    this.#model.checked = brief.model
    this.#sayModel()
    this.sync()
    this.#changed()
  }

  /** Whether the city is to be written by the local model. */
  get model(): boolean {
    return this.#model.checked
  }

  /** What the player has typed of the five fields the model can write, blanks left out. */
  get soFar(): BriefSoFar {
    const so: BriefSoFar = {}
    for (const field of Object.keys(WRITTEN) as BriefField[]) {
      const typed = this.#text[WRITTEN[field]].value.trim()
      if (typed) so[field] = typed
    }
    return so
  }

  /** Put an answer into the boxes it was asked for, and leave the rest alone. */
  write(draft: BriefDraft, wanted: readonly BriefField[]): void {
    for (const field of wanted) this.#text[WRITTEN[field]].value = draft[field]
    this.#changed()
  }

  focus(): void {
    this.#text.theme.focus()
  }

  /** The pills and the sliders back onto the fields they are a second way into. */
  sync(): void {
    for (const axis of Object.keys(STYLE) as StyleAxis[]) {
      const picked = this.#style[axis].value
      for (const pill of this.#root.querySelectorAll<HTMLElement>(`[data-pills="${axis}"] .gb-seg-pill`)) {
        pill.setAttribute('aria-checked', String((pill.dataset.val ?? '') === picked))
      }
    }
    for (const name of Object.keys(NUMBERS) as NumberName[]) {
      const slider = this.#slider(name)
      if (slider) slider.value = String(NUMBERS[name](Number(this.#numbers[name].value)))
    }
  }

  /** A number the player actually typed, held to what the generator will take. Blank is absent. */
  #typed(name: 'places' | 'storeys'): Record<string, number> {
    const written = this.#numbers[name].value.trim()
    const value = Number(written)
    if (!written || Number.isNaN(value) || value <= 0) return {}
    return { [name]: NUMBERS[name](value) }
  }

  #slider(name: NumberName): HTMLInputElement | null {
    return this.#root.querySelector<HTMLInputElement>(`.gb-cyber-range[data-sync="${name}"]`)
  }

  /** The catalogue's own levels, and a first choice that leaves it to the generator. */
  #offer(axis: StyleAxis): void {
    this.#style[axis].replaceChildren(new Option('Any', ''), ...STYLE[axis].map((level) => new Option(level.replace('-', ' '), level)))
  }

  /** The row of words above each style select, which sets the same select. */
  #bindPills(): void {
    this.#root.addEventListener('click', (event) => {
      const pill = (event.target as HTMLElement | null)?.closest<HTMLElement>('.gb-seg-pill')
      const group = pill?.closest<HTMLElement>('[data-pills]')
      const axis = group?.dataset.pills as StyleAxis | undefined
      if (!pill || !axis || !this.#style[axis]) return
      this.#style[axis].value = pill.dataset.val ?? ''
      this.#style[axis].dispatchEvent(new Event('change', { bubbles: true }))
      this.sync()
    })
  }

  /** The arrows and the slider beside each number, both writing the number itself. */
  #bindNumbers(): void {
    this.#root.addEventListener('click', (event) => {
      const step = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>('.gb-num-step-btn')
      const name = step?.dataset.stepField as NumberName | undefined
      if (!step || !name || !this.#numbers[name]) return
      const from = Number(this.#numbers[name].value)
      this.#numbers[name].value = String(NUMBERS[name](Number.isNaN(from) ? Number.NaN : from + Number(step.dataset.stepDir ?? 0)))
      this.sync()
      this.#changed()
    })
    this.#root.addEventListener('input', (event) => {
      const slider = (event.target as HTMLElement | null)?.closest<HTMLInputElement>('.gb-cyber-range')
      const name = slider?.dataset.sync as NumberName | undefined
      if (!slider || !name || !this.#numbers[name]) return
      this.#numbers[name].value = String(NUMBERS[name](Number(slider.value)))
    })
    for (const name of Object.keys(NUMBERS) as NumberName[]) {
      // typing in the field moves the slider, but never fills a field left
      // blank: blank is the generator choosing, and it has to stay that way
      this.#numbers[name].addEventListener('input', () => this.sync())
    }
  }

  /** The toggle says which of its two states it is in, in words, the moment it is flipped. */
  #sayModel(): void {
    this.#modelState.textContent = this.#model.checked ? 'On' : 'Off'
  }
}
