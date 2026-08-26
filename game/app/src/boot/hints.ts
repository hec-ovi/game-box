/** As wide as the tag can get, declared on `.gb-cyber-tooltip` in the stylesheet. */
const TAG_WIDTH = 280

/** How far under the pointer the tag sits, how much room it needs there, and where it goes without it. */
const BELOW = 18
const TALL = 90
const ABOVE = 48
const MARGIN = 16

/**
 * The sentence that goes with a control. Anything carrying `data-hint` streams
 * its words into the reserved line beside the rail and into the tag that
 * follows the pointer, on hover and on focus alike, so what the keyboard reads
 * is what the pointer reads. The line holds its height whether or not it has
 * words in it, so nothing below it moves.
 */
export class Hints {
  #line: HTMLElement | null
  #tag: HTMLElement | null

  constructor(root: HTMLElement) {
    this.#line = root.querySelector<HTMLElement>('[data-boot="intel-text"]')
    this.#tag = root.querySelector<HTMLElement>('[data-boot="intel-tooltip"]')

    root.addEventListener('mouseover', (event) => this.#show(hinted(event), event as MouseEvent))
    root.addEventListener('focusin', (event) => this.#show(hinted(event)))
    root.addEventListener('mouseout', (event) => this.#hide(hinted(event)))
    root.addEventListener('focusout', (event) => this.#hide(hinted(event)))
    root.addEventListener('mousemove', (event) => {
      if (this.#tag?.dataset.visible === 'true') this.#place(event as MouseEvent)
    })
  }

  #show(target: HTMLElement | null, pointer?: MouseEvent): void {
    const words = target?.dataset.hint
    if (!target || !words) return
    if (this.#line) {
      this.#line.textContent = words
      this.#line.dataset.visible = 'true'
    }
    if (!this.#tag) return
    this.#tag.textContent = words
    this.#tag.dataset.visible = 'true'
    if (pointer?.clientX || pointer?.clientY) return this.#place(pointer)
    const box = target.getBoundingClientRect()
    this.#at(box.left, box.bottom + 4)
  }

  #hide(target: HTMLElement | null): void {
    if (!target) return
    if (this.#line) {
      this.#line.textContent = ''
      this.#line.dataset.visible = 'false'
    }
    if (this.#tag) this.#tag.dataset.visible = 'false'
  }

  #place(pointer: MouseEvent): void {
    this.#at(pointer.clientX + 12, pointer.clientY + BELOW)
  }

  /** Under the pointer, and never off the edge of the window. */
  #at(x: number, y: number): void {
    if (!this.#tag) return
    const left = x + TAG_WIDTH > window.innerWidth - MARGIN ? Math.max(MARGIN, window.innerWidth - TAG_WIDTH - MARGIN) : x
    const top = y + TALL > window.innerHeight - MARGIN ? y - ABOVE : y
    this.#tag.style.left = `${left}px`
    this.#tag.style.top = `${top}px`
  }
}

function hinted(event: Event): HTMLElement | null {
  return (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-hint]') ?? null
}
