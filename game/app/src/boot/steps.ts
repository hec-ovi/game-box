/** The three steps of the form, in the order the player walks them. */
export type Step = 1 | 2 | 3

const STEPS: readonly Step[] = [1, 2, 3]

function isStep(value: string | undefined): value is `${Step}` {
  return STEPS.some((step) => String(step) === value)
}

/**
 * Which step of the form is on screen, and moving to another. Every step reads
 * and writes the same brief, so this only decides which fields are showing:
 * the pane, the tab in the rail and the chevron in the foot that says so.
 */
export class Steps {
  #root: HTMLElement
  #make: HTMLElement
  #at: Step = 1
  #moved: (step: Step) => void = () => {}

  constructor(root: HTMLElement, make: HTMLElement) {
    this.#root = root
    this.#make = make
    root.addEventListener('click', (event) => {
      const target = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-step-target], [data-step-nav], [data-step]')
      const asked = target?.dataset.stepTarget ?? target?.dataset.stepNav ?? target?.dataset.step
      if (isStep(asked)) this.at = Number(asked) as Step
    })
  }

  onMove(handler: (step: Step) => void): void {
    this.#moved = handler
  }

  get at(): Step {
    return this.#at
  }

  set at(step: Step) {
    this.#at = step
    this.#make.dataset.wizardStep = String(step)
    for (const pane of this.#root.querySelectorAll<HTMLElement>('[data-pane]')) pane.hidden = pane.dataset.pane !== String(step)
    for (const tab of this.#root.querySelectorAll<HTMLElement>('[data-boot="wizard-tab"]')) {
      tab.setAttribute('aria-current', String(tab.dataset.step === String(step)))
    }
    for (const chevron of this.#root.querySelectorAll<HTMLElement>('[data-step-target]')) {
      chevron.setAttribute('aria-current', String(chevron.dataset.stepTarget === String(step)))
    }
    this.#moved(step)
  }
}
