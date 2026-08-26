import type { Sidecar } from '@gb/sidecar'
import type { CityBrief } from './brief.ts'
import { Fields } from './fields.ts'
import { Review } from './review.ts'
import { Steps, type Step } from './steps.ts'
import { BriefWriting } from './writing.ts'

/** What the form needs from the panel around it: the markup, and the two ways out of it. */
export interface FormPorts {
  find: <T extends HTMLElement>(name: string) => T
  root: HTMLElement
  /** A word for the player on the panel's own status line. */
  say(message: string, trouble?: boolean): void
  /** Build the city the form is holding. */
  generate(): void
}

/**
 * The creation form: three steps over one brief. The fields are read out and
 * written back in `fields.ts`, which step is showing is `steps.ts`, the buttons
 * that have the local model write a field are `writing.ts`, and what the form
 * says back about itself is `review.ts`. This holds the four together and adds
 * nothing of its own.
 */
export class CityForm {
  #fields: Fields
  #steps: Steps
  #writing: BriefWriting
  #review: Review
  #moved: (step: Step) => void = () => {}

  constructor(ports: FormPorts) {
    this.#fields = new Fields(ports.find, ports.root)
    this.#steps = new Steps(ports.root, ports.find('make'))
    this.#writing = new BriefWriting(ports.root, this.#fields, ports.say)
    this.#review = new Review(ports.root, this.#fields, ports.generate)
    this.#fields.onChange(() => this.#review.refresh())
    this.#steps.onMove((step) => {
      this.#review.refresh()
      this.#moved(step)
    })
    this.#review.refresh()
  }

  /** The page's one sidecar, so the write buttons reach the same model the city is written by. */
  set sidecar(sidecar: Sidecar) {
    this.#writing.sidecar = sidecar
  }

  onStep(handler: (step: Step) => void): void {
    this.#moved = handler
  }

  get step(): Step {
    return this.#steps.at
  }

  set step(step: Step) {
    this.#steps.at = step
  }

  get brief(): CityBrief {
    return this.#fields.brief
  }

  set brief(brief: CityBrief) {
    this.#fields.brief = brief
  }

  focus(): void {
    this.#fields.focus()
  }
}
