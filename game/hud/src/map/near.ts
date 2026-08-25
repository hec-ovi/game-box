import { el, svg } from '../dom.ts'
import { LAYOUT } from '../style/layout.ts'
import type { MapMark, MapPlot, MinimapDoor, MinimapView } from '../types.ts'
import { doorShape, goalShape, title, youArrow } from './marks.ts'

/** The panel is a square of this many pixels, so a mark's screen size is arithmetic, not a layout read. */
const SIZE = LAYOUT.minimap

/** How far out from the centre a goal beyond the radius is pinned, as a share of the radius. */
const RIM = 0.86

/** A goal on the plan, kept between pushes so a walk moves nodes rather than rebuilding them. */
interface Pinned {
  readonly node: SVGElement
  readonly mark: MapMark
}

/**
 * The streets round the player, north up. The city arrives windowed to a
 * radius and this draws it: the buildings in cells, and the player's arrow,
 * the goals and the doorways in pixels, so they are the same size whatever
 * radius the game chose. A goal further out than the radius is pinned to the
 * rim, so where to head is never off the panel.
 */
export class NearPlan {
  readonly node = el('div', 'gb-near')
  #svg = svg('svg', { role: 'img', 'aria-label': 'Minimap' })
  #plots = svg('g', { class: 'gb-near-plots' })
  #doors = svg('g', { class: 'gb-near-doors' })
  #goals = svg('g', { class: 'gb-near-goals' })
  #you = svg('g', { class: 'gb-you' })
  #pinned: Pinned[] = []
  #plotsKey: string | null = null
  #doorsKey: string | null = null
  #goalsKey: string | null = null

  constructor() {
    this.#you.append(youArrow())
    this.#svg.append(this.#plots, this.#doors, this.#goals, this.#you)
    this.node.append(this.#svg)
  }

  draw(view: MinimapView): void {
    const radius = Math.max(1, view.radius)
    const unit = (radius * 2) / SIZE
    this.#svg.setAttribute('viewBox', `${view.x - radius} ${view.y - radius} ${radius * 2} ${radius * 2}`)

    const plotsKey = view.plots.map(plotKey).join('|')
    if (plotsKey !== this.#plotsKey) {
      this.#plotsKey = plotsKey
      this.#plots.replaceChildren(...view.plots.map(block))
    }

    // A doorway never moves, so it is placed once and redrawn only when the
    // radius changes what a pixel is worth.
    const doors = view.doors ?? []
    const doorsKey = `${unit}|${doors.map((at) => `${at.id}:${at.x},${at.y}`).join('|')}`
    if (doorsKey !== this.#doorsKey) {
      this.#doorsKey = doorsKey
      this.#doors.replaceChildren(...doors.map((at) => door(at, unit)))
    }

    const goals = (view.marks ?? []).filter((mark) => mark.kind === 'goal')
    const goalsKey = goals.map((mark) => `${mark.line ?? 'side'}:${mark.label}`).join('|')
    if (goalsKey !== this.#goalsKey) {
      this.#goalsKey = goalsKey
      this.#pinned = goals.map((mark) => ({ node: goalNode(mark), mark }))
      this.#goals.replaceChildren(...this.#pinned.map((one) => one.node))
    }

    for (const one of this.#pinned) this.#point(one, view, radius, unit)
    this.#you.setAttribute('transform', `translate(${view.x} ${view.y}) rotate(${degrees(view.facing)}) scale(${unit})`)
  }

  clear(): void {
    this.#plotsKey = null
    this.#doorsKey = null
    this.#goalsKey = null
    this.#pinned = []
    this.#plots.replaceChildren()
    this.#doors.replaceChildren()
    this.#goals.replaceChildren()
  }

  /** A goal inside the radius sits where it is; one beyond it is held at the rim and says so. */
  #point(one: Pinned, view: MinimapView, radius: number, unit: number): void {
    const dx = one.mark.x - view.x
    const dy = one.mark.y - view.y
    const far = Math.hypot(dx, dy)
    const rim = radius * RIM
    const beyond = far > rim && far > 0
    const x = beyond ? view.x + (dx / far) * rim : one.mark.x
    const y = beyond ? view.y + (dy / far) * rim : one.mark.y
    if (beyond) one.node.dataset.edge = 'true'
    else delete one.node.dataset.edge
    one.node.setAttribute('transform', `translate(${x} ${y}) scale(${unit})`)
  }
}

function block(plot: MapPlot): SVGRectElement {
  const node = svg('rect', {
    class: 'gb-block',
    x: plot.rect.x,
    y: plot.rect.y,
    width: plot.rect.w,
    height: plot.rect.h,
    'data-prominence': plot.prominence ?? 'background',
  })
  if (plot.label) node.append(title(plot.label))
  return node
}

function door(at: MinimapDoor, unit: number): SVGElement {
  const node = svg('g', { class: 'gb-door', transform: `translate(${at.x} ${at.y}) scale(${unit})` })
  node.append(doorShape(), title(at.name))
  return node
}

function goalNode(mark: MapMark): SVGElement {
  const line = mark.line ?? 'side'
  const node = svg('g', { class: 'gb-goal', 'data-line': line })
  node.append(goalShape(line), title(mark.label))
  return node
}

function degrees(facing: number): number {
  return Math.round((facing * 180) / Math.PI)
}

function plotKey(plot: MapPlot): string {
  const { x, y, w, h } = plot.rect
  return `${plot.id}:${x},${y},${w},${h}:${plot.prominence ?? ''}`
}
