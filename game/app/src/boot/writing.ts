import { BRIEF_FIELDS, Scribe, type BriefField } from '@gb/scribe'
import type { Sidecar } from '@gb/sidecar'
import { freshSeed } from './brief.ts'
import type { Fields } from './fields.ts'

/** What each button asks for, and how that reads on the status line. */
const ASKS: Record<string, { want: readonly BriefField[]; called: string } | undefined> = {
  theme: { want: ['theme'], called: 'the theme' },
  brief: { want: ['brief'], called: 'what the city is about' },
  mainQuest: { want: ['mainQuest'], called: 'the story' },
  sideQuests: { want: ['sideQuests'], called: 'the side jobs' },
  tone: { want: ['tone'], called: 'the tone' },
  all: { want: BRIEF_FIELDS, called: 'the whole brief' },
}

/** What a button says while its call is out. */
const WORKING = 'Writing...'

/**
 * The buttons that have the local model write a field of the brief. Each one
 * asks for the field it sits beside and puts the answer straight into it; the
 * fast track asks for all five.
 *
 * There is nothing canned behind them. With the model off, or with the sidecar
 * unreachable, a button says what it needs and changes nothing, because a
 * composed sentence handed over as the model's answer is the thing these are
 * here to replace.
 */
export class BriefWriting {
  #fields: Fields
  #say: (message: string, trouble?: boolean) => void
  #buttons: HTMLButtonElement[]
  #sidecar: Sidecar | undefined
  #busy = false

  constructor(root: HTMLElement, fields: Fields, say: (message: string, trouble?: boolean) => void) {
    this.#fields = fields
    this.#say = say
    this.#buttons = [...root.querySelectorAll<HTMLButtonElement>('[data-write]')]
    for (const button of this.#buttons) button.addEventListener('click', () => void this.#write(button))
  }

  /** The page's one sidecar, handed over by whoever built it. */
  set sidecar(sidecar: Sidecar) {
    this.#sidecar = sidecar
  }

  async #write(button: HTMLButtonElement): Promise<void> {
    const asked = ASKS[button.dataset.write ?? '']
    if (!asked || this.#busy) return
    if (!this.#fields.model) return this.#say('That is written by the local model. Turn the model on at the last step and try again.', true)
    if (!this.#sidecar) return this.#say('There is no local model on this page to write it.', true)

    this.#busy = true
    const words = button.querySelector<HTMLElement>('[data-label]')
    const said = words?.textContent ?? ''
    if (words) words.textContent = WORKING
    for (const other of this.#buttons) other.disabled = true
    this.#say(`Asking the local model to write ${asked.called}`)
    try {
      // a fresh seed each press: the same seed writes the same words, and a
      // button that hands back what it handed back last time reads as broken
      const seed = freshSeed()
      const draft = await new Scribe({ sidecar: this.#sidecar, seed }).writeBrief({ want: asked.want, have: this.#fields.soFar, seed })
      if (!draft) return this.#say('The local model did not answer, so nothing was written. Check it is running and try again.', true)
      this.#fields.write(draft, asked.want)
      this.#say(`The local model wrote ${asked.called}.`)
    } finally {
      this.#busy = false
      if (words) words.textContent = said
      for (const other of this.#buttons) other.disabled = false
    }
  }
}
