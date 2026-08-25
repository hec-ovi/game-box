/** A rectangle of the city on show, in cells. */
export interface ViewBox {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

/** A size in pixels: the frame the plan is drawn in. */
export interface Size {
  readonly w: number
  readonly h: number
}

/** A point in cells. */
export interface Cell {
  readonly x: number
  readonly y: number
}

/** How far in the plan can go: twelve times the whole city. */
export const MAX_ZOOM = 12

/** One step of the zoom buttons, the keys, or one notch of the wheel. */
export const ZOOM_STEP = 1.5

/**
 * Which part of the city is on show. Zoom 1 is the whole city framed to the
 * plan's aspect; the centre moves with a pan and is held so the view never
 * leaves the city. The box it answers is what the SVG's viewBox is set to.
 */
export class Viewport {
  readonly width: number
  readonly height: number
  #zoom = 1
  #cx: number
  #cy: number

  constructor(width: number, height: number) {
    this.width = width
    this.height = height
    this.#cx = width / 2
    this.#cy = height / 2
  }

  get zoom(): number {
    return this.#zoom
  }

  /** The whole city, framed to the aspect of the frame. */
  fitBox(frame: Size): ViewBox {
    const aspect = frame.w / frame.h
    const w = this.width / this.height < aspect ? this.height * aspect : this.width
    const h = w / aspect
    return { x: (this.width - w) / 2, y: (this.height - h) / 2, w, h }
  }

  /** What is on show: the fit box scaled down by the zoom around the centre, held inside the fit box. */
  box(frame: Size): ViewBox {
    const fit = this.fitBox(frame)
    const w = fit.w / this.#zoom
    const h = fit.h / this.#zoom
    this.#cx = clamp(this.#cx, fit.x + w / 2, fit.x + fit.w - w / 2)
    this.#cy = clamp(this.#cy, fit.y + h / 2, fit.y + fit.h - h / 2)
    return { x: this.#cx - w / 2, y: this.#cy - h / 2, w, h }
  }

  /** Pixels per cell at this zoom in this frame. */
  scale(frame: Size): number {
    return frame.w / this.box(frame).w
  }

  /** The cell under a point of the frame, measured in pixels from its corner. */
  cellAt(frame: Size, px: number, py: number): Cell {
    const box = this.box(frame)
    return { x: box.x + (px / frame.w) * box.w, y: box.y + (py / frame.h) * box.h }
  }

  /** Zoom by a factor, keeping `about` under the same point of the frame. */
  zoomBy(factor: number, about: Cell = { x: this.#cx, y: this.#cy }): void {
    const zoom = clamp(this.#zoom * factor, 1, MAX_ZOOM)
    const ratio = this.#zoom / zoom
    this.#cx = about.x - (about.x - this.#cx) * ratio
    this.#cy = about.y - (about.y - this.#cy) * ratio
    this.#zoom = zoom
  }

  panBy(dx: number, dy: number): void {
    this.#cx += dx
    this.#cy += dy
  }

  centreOn(cell: Cell): void {
    this.#cx = cell.x
    this.#cy = cell.y
  }

  fit(): void {
    this.#zoom = 1
    this.#cx = this.width / 2
    this.#cy = this.height / 2
  }
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value))
}
