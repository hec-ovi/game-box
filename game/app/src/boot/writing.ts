import { BRIEF_FIELDS, Scribe, type BriefField } from '@gb/scribe'
import type { Sidecar } from '@gb/sidecar'
import { freshSeed } from './brief.ts'
import type { Fields } from './fields.ts'
import { note } from './notes.ts'

/** What each button asks for, and how that reads on the status line. */
const ASKS: Record<string, { want: readonly BriefField[]; called: string } | undefined> = {
  theme: { want: ['theme'], called: 'the theme' },
  brief: { want: ['brief'], called: 'what the city is about' },
  mainQuest: { want: ['mainQuest'], called: 'the story' },
  sideQuests: { want: ['sideQuests'], called: 'the side jobs' },
  tone: { want: ['tone'], called: 'the tone' },
  all: { want: BRIEF_FIELDS, called: 'the whole brief' },
}

/** What every one of these buttons says while its call is out. */
const WORKING = 'Generating...'

/**
 * The buttons that have the model write a field of the brief. Every one of them
 * is the same button doing the same thing, Generate with AI, and reads that way
 * wherever it sits: each asks for the field it stands beside and puts the
 * answer straight into it, and the one in the action grid asks for all five.
 *
 * Pressing one is asking for the model, so nothing else has to be switched on
 * first; the toggle on the last step is about who writes the city, not who
 * writes a line of the brief. What a press could not do is said on the line
 * beside the button that was pressed.
 *
 * There is nothing canned behind them. With no model reachable a button says so
 * and changes nothing, because a composed sentence handed over as the model's
 * answer is the thing these are here to replace.
 */
export class BriefWriting {
  #fields: Fields
  #say: (message: string) => void
  #buttons: HTMLButtonElement[]
  #sidecar: Sidecar | undefined
  #busy = false

  constructor(root: HTMLElement, fields: Fields, say: (message: string) => void) {
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
    note(button, '')
    if (!this.#sidecar) return note(button, 'No model is connected to this page, so there is nothing to write it.')

    this.#busy = true
    const words = button.querySelector<HTMLElement>('[data-label]')
    const said = words?.textContent ?? ''
    if (words) words.textContent = WORKING
    for (const other of this.#buttons) other.disabled = true
    this.#say(`Asking the model to write ${asked.called}`)
    try {
      // a fresh seed each press: the same seed writes the same words, and a
      // button that hands back what it handed back last time reads as broken
      const seed = freshSeed()
      const draft = await new Scribe({ sidecar: this.#sidecar, seed }).writeBrief({ want: asked.want, have: this.#fields.soFar, seed })
      if (!draft) {
        this.#say('')
        return note(button, 'The model did not answer, so nothing was written. Check it is running and press this again.')
      }
      this.#fields.write(draft, asked.want)
      this.#say(`The model wrote ${asked.called}.`)
    } finally {
      this.#busy = false
      if (words) words.textContent = said
      for (const other of this.#buttons) other.disabled = false
    }
  }
}
