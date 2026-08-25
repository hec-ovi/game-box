import { freshSeed, STYLE, tidy, type CityBrief, type StyleAxis } from './brief.ts'

/** Every field on the form, by the name the markup gives it. */
const TEXT = ['theme', 'brief', 'main', 'side', 'tone', 'seed'] as const

type Texts = Record<(typeof TEXT)[number], HTMLInputElement | HTMLTextAreaElement>
type Styles = Record<StyleAxis, HTMLSelectElement>

/**
 * The creation form: what the player typed, read as a brief, and a brief
 * written back into the fields. Every field is optional, and blank means the
 * generator chooses, so the form can be long without anybody having to fill it
 * in. The style fields offer only what the catalogue draws.
 */
export class CityForm {
  #text: Texts
  #style: Styles
  #blocks: HTMLInputElement
  #model: HTMLInputElement

  constructor(find: <T extends HTMLElement>(name: string) => T) {
    this.#text = Object.fromEntries(TEXT.map((name) => [name, find<HTMLInputElement>(name)])) as Texts
    this.#style = Object.fromEntries((Object.keys(STYLE) as StyleAxis[]).map((axis) => [axis, find<HTMLSelectElement>(axis)])) as Styles
    this.#blocks = find('blocks')
    this.#model = find('model')

    for (const axis of Object.keys(STYLE) as StyleAxis[]) this.#offer(axis)
    find<HTMLButtonElement>('roll').addEventListener('click', () => {
      this.#text.seed.value = freshSeed()
      this.#text.seed.focus()
    })
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
      blocks: Number(this.#blocks.value),
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
    this.#blocks.value = String(brief.blocks)
    this.#model.checked = brief.model
  }

  focus(): void {
    this.#text.theme.focus()
  }

  /** The catalogue's own levels, and a first choice that leaves it to the generator. */
  #offer(axis: StyleAxis): void {
    const select = this.#style[axis]
    select.replaceChildren(new Option('Any', ''), ...STYLE[axis].map((level) => new Option(level.replace('-', ' '), level)))
  }
}
