import { ZOOM_STEP } from './viewport.ts'

/** What a gesture on the plan asks for. Pans are in pixels of the frame. */
export interface PlanGestures {
  zoom(factor: number, atPx: { x: number; y: number }): void
  pan(dxPx: number, dyPx: number): void
}

/**
 * The hand on the plan: the wheel zooms about the pointer and a drag pans.
 * Each press listens on the document until it lets go, so a drag that leaves
 * the frame still pans and still ends.
 */
export class Gestures {
  #node: HTMLElement
  #on: PlanGestures
  #last: { x: number; y: number } | undefined

  constructor(node: HTMLElement, on: PlanGestures) {
    this.#node = node
    this.#on = on
    node.addEventListener('wheel', this.#wheel, { passive: false })
    node.addEventListener('pointerdown', this.#down)
  }

  dispose(): void {
    this.#node.removeEventListener('wheel', this.#wheel)
    this.#node.removeEventListener('pointerdown', this.#down)
    this.#release()
  }

  #wheel = (event: WheelEvent): void => {
    event.preventDefault()
    const rect = this.#node.getBoundingClientRect()
    this.#on.zoom(event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP, { x: event.clientX - rect.left, y: event.clientY - rect.top })
  }

  #down = (event: PointerEvent): void => {
    if (event.button !== 0) return
    event.preventDefault()
    this.#last = { x: event.clientX, y: event.clientY }
    this.#node.dataset.dragging = 'true'
    const doc = this.#node.ownerDocument
    doc.addEventListener('pointermove', this.#move)
    doc.addEventListener('pointerup', this.#up)
  }

  #move = (event: PointerEvent): void => {
    if (!this.#last) return
    this.#on.pan(this.#last.x - event.clientX, this.#last.y - event.clientY)
    this.#last = { x: event.clientX, y: event.clientY }
  }

  #up = (): void => this.#release()

  #release(): void {
    this.#last = undefined
    delete this.#node.dataset.dragging
    const doc = this.#node.ownerDocument
    doc.removeEventListener('pointermove', this.#move)
    doc.removeEventListener('pointerup', this.#up)
  }
}
