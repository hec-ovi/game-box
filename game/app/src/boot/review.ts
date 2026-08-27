import { districtCount } from '@gb/forge'
import { STYLE, type CityBrief, type StyleAxis } from './brief.ts'
import type { Fields } from './fields.ts'

/** How each style axis reads in a sentence. */
const AXIS: Record<StyleAxis, string> = { neon: 'Neon', density: 'Density', wear: 'Wear' }

/** What the architecture actually came out as, once it has been laid out. */
export interface Laid {
  readonly zones: number
}

/**
 * Saying back what was asked for, and asking once before it is built.
 *
 * Every readout on the form is a `[data-said]` slot filled from the brief the
 * fields hold, so what the player reads on the summary, on the review and in
 * the confirmation is the same brief said three times. The grid, the seed, the
 * instances and the height are the fields themselves. The zones are the only
 * readout that is not, and it says so: `@gb/forge`'s rule is an upper bound
 * before a town exists, so it reads "About 6" until a plan has been laid and
 * the town's own count off `world.districts()` replaces it. How many buildings
 * go up, who lives in them and what work they hand out are settled while the
 * city is built, so the form does not say them at all.
 */
export class Review {
  #root: HTMLElement
  #fields: Fields
  #modal: HTMLElement | null
  #lines: HTMLElement | null
  #laid: Laid | undefined

  constructor(root: HTMLElement, fields: Fields, proceed: () => void) {
    this.#root = root
    this.#fields = fields
    this.#modal = root.querySelector<HTMLElement>('[data-boot="compile-modal"]')
    this.#lines = root.querySelector<HTMLElement>('[data-boot="compile-said"]')

    root.querySelector('[data-boot="compile-trigger"]')?.addEventListener('click', () => this.#ask())
    root.querySelector<HTMLButtonElement>('[data-boot="compile-proceed"]')?.addEventListener('click', () => {
      this.#shut()
      proceed()
    })
    root.addEventListener('click', (event) => {
      if ((event.target as HTMLElement | null)?.closest('[data-modal-dismiss]')) this.#shut()
    })
  }

  /** What the architecture came out as, or nothing until it has been laid out. */
  set laid(laid: Laid | undefined) {
    this.#laid = laid
    this.refresh()
  }

  /** Every slot on the form, filled from the brief as it stands. */
  refresh(): void {
    const said = says(this.#fields.brief, this.#laid)
    for (const slot of this.#root.querySelectorAll<HTMLElement>('[data-said]')) {
      const key = slot.dataset.said ?? ''
      if (key in said) slot.textContent = said[key]!
    }
  }

  /** What is about to happen, in plain sentences, before anything is written. */
  #ask(): void {
    if (!this.#modal) return
    if (this.#lines) {
      this.#lines.replaceChildren(
        ...sentences(this.#fields.brief).map((sentence) => {
          const line = document.createElement('p')
          line.className = 'gb-modal-line'
          line.textContent = sentence
          return line
        }),
      )
    }
    this.#modal.hidden = false
    this.#modal.querySelector<HTMLButtonElement>('[data-boot="compile-proceed"]')?.focus()
  }

  #shut(): void {
    if (this.#modal) this.#modal.hidden = true
  }
}

/** Every readout on the form, by the name the markup asks for it under. */
function says(brief: CityBrief, laid: Laid | undefined): Record<string, string> {
  return {
    blocks: `${brief.blocks} x ${brief.blocks}`,
    grid: `${brief.blocks} by ${brief.blocks} blocks`,
    zones: laid ? String(laid.zones) : `About ${districtCount(brief.blocks, brief.blocks)}`,
    seed: `Seed: ${brief.seed}`,
    doorsCount: brief.places === undefined ? 'Any' : String(brief.places),
    doors: brief.places === undefined ? 'The generator chooses how many doors open' : `${brief.places} doors open`,
    storeysCount: brief.storeys === undefined ? 'Any' : String(brief.storeys),
    storeys: brief.storeys === undefined ? 'Tallest building: the generator chooses' : `Tallest building: ${brief.storeys} storeys`,
    theme: brief.theme,
    premise: brief.brief ?? 'The generator writes what the city is about',
    look: look(brief),
    story: brief.asks?.mainQuest ?? 'The generator writes the story',
    side: brief.asks?.sideQuests ?? 'The generator invents the side jobs',
    tone: brief.asks?.tone ?? 'The generator picks how people talk',
    ready: ready(brief),
  }
}

/** The one line under the review: the size, the doors and the height, then the question. */
function ready(brief: CityBrief): string {
  const doors = brief.places === undefined ? 'as many doors open as the generator picks' : `${brief.places} doors that open`
  const height = brief.storeys === undefined ? 'no ceiling of your own on how tall it builds' : `nothing over ${brief.storeys} storeys`
  return `A ${brief.blocks} by ${brief.blocks} block city, "${brief.theme}", with ${doors} and ${height}. Build it?`
}

/** The style the player picked, axis by axis, or the generator's own choice. */
function look(brief: CityBrief): string {
  const picked = (Object.keys(STYLE) as StyleAxis[]).flatMap((axis) => {
    const level = brief.asks?.style?.[axis]
    return level ? [`${AXIS[axis]}: ${level.replace('-', ' ')}`] : []
  })
  return picked.length > 0 ? picked.join(' · ') : 'The generator picks the look'
}

/** What is about to be built, said only in what the brief actually carries. */
function sentences(brief: CityBrief): string[] {
  return [
    `A ${brief.blocks} by ${brief.blocks} block city, "${brief.theme}", built from the seed "${brief.seed}".`,
    brief.places === undefined
      ? 'How many of its doors open is left to the generator.'
      : `${brief.places} of its doors open, each onto a place with people in it.`,
    brief.storeys === undefined ? 'How tall it builds is left to the generator.' : `Nothing in it is built taller than ${brief.storeys} storeys.`,
    `${look(brief)}.`,
    brief.brief ? `What it is about: ${brief.brief}` : 'What the city is about is left to the generator.',
    brief.asks?.mainQuest ? `The story: ${brief.asks.mainQuest}` : 'The story is left to the generator.',
    brief.asks?.sideQuests ? `The side jobs: ${brief.asks.sideQuests}` : 'The side jobs are left to the generator.',
    brief.asks?.tone ? `How people talk: ${brief.asks.tone}` : 'How people talk is left to the generator.',
    brief.model
      ? 'The model writes the history, the places and the quests.'
      : 'It is written offline, with no model, from the seed alone.',
    'How many buildings go up, who lives in them and what work they hand out are settled while it is built.',
  ]
}
