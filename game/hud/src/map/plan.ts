import { el, svg } from '../dom.ts'
import { LAYOUT } from '../style/layout.ts'
import type { MapDistrict, MapMark, MapPlot, MapStation, MapView } from '../types.ts'
import { districtShape, heartOf } from './districts.ts'
import { MARK_PX, shapeOf, title } from './marks.ts'
import type { Size, Viewport } from './viewport.ts'

/** The frame before the window has been laid out: the window itself, less its head. */
const NOMINAL: Size = { w: LAYOUT.window.width, h: LAYOUT.window.height - 52 }

/** Past this zoom the districts are off: the plan is showing streets, and a border over them is in the way. */
const DISTRICTS_UNTIL = 3

/** Something drawn at screen size: it is rescaled every time the zoom moves. */
interface Fixed {
  readonly node: SVGElement
  readonly x: number
  readonly y: number
  readonly rotate: number
}

/**
 * The city from above. Plots are drawn in cells and scale with the zoom; the
 * player's arrow, the goal marks, the stations and every name are drawn in
 * pixels and stay the same size at every zoom, which is what lets a name be
 * read on a city of twenty blocks: zoom in and the names come apart.
 */
export class Plan {
  readonly node = el('div', 'gb-plan')
  #svg = svg('svg', { role: 'img', 'aria-label': 'City plan' })
  #ground = svg('rect', { class: 'gb-ground' })
  #districts = svg('g', { class: 'gb-districts' })
  #plots = svg('g', { class: 'gb-plots' })
  #districtNames = svg('g', { class: 'gb-district-names' })
  #names = svg('g', { class: 'gb-names' })
  #stations = svg('g', { class: 'gb-stations' })
  #marks = svg('g', { class: 'gb-marks' })
  #fixed: Fixed[] = []
  #plotsKey: string | null = null
  #districtsKey: string | null = null
  #onDistrict: ((id: string) => void) | undefined
  #stationsKey: string | null = null
  #marksKey: string | null = null

  constructor() {
    this.#svg.append(this.#ground, this.#districts, this.#plots, this.#districtNames, this.#names, this.#stations, this.#marks)
    this.node.append(this.#svg)
  }

  /** The frame in pixels, or its nominal size until it has been laid out. */
  frame(): Size {
    const w = this.node.clientWidth
    const h = this.node.clientHeight
    return w > 0 && h > 0 ? { w, h } : NOMINAL
  }

  /** What happens when a district is clicked: the game's to answer, so the plan only reports it. */
  set onDistrict(chosen: (id: string) => void) {
    this.#onDistrict = chosen
  }

  draw(map: MapView, view: Viewport): void {
    const districts = map.districts ?? []
    const districtsKey = districts.map((district) => `${district.id}:${district.name}:${district.rects.length}`).join('|')
    if (districtsKey !== this.#districtsKey) {
      this.#districtsKey = districtsKey
      this.#districts.replaceChildren(...districts.map((district) => this.#district(district)))
      this.#empty(this.#districtNames)
      for (const district of districts) this.#districtName(district)
    }
    const plotsKey = map.plots.map(plotKey).join('|')
    if (plotsKey !== this.#plotsKey) {
      this.#plotsKey = plotsKey
      this.#ground.setAttribute('width', String(map.width))
      this.#ground.setAttribute('height', String(map.height))
      this.#plots.replaceChildren(...map.plots.map(block))
      this.#empty(this.#names)
      for (const plot of map.plots) if (plot.named && plot.label) this.#name(plot)
    }
    const stations = map.stations ?? []
    const stationsKey = stations.map(stationKey).join('|')
    if (stationsKey !== this.#stationsKey) {
      this.#stationsKey = stationsKey
      this.#empty(this.#stations)
      for (const at of stations) this.#station(at)
    }
    const marks = map.marks ?? []
    const marksKey = marks.map(markKey).join('|')
    if (marksKey !== this.#marksKey) {
      this.#marksKey = marksKey
      this.#empty(this.#marks)
      for (const mark of marks) this.#mark(mark)
    }
    this.look(view)
  }

  /** Point the view: set what is on show and size the pixel-drawn things to it. */
  look(view: Viewport): void {
    const frame = this.frame()
    const box = view.box(frame)
    this.#svg.setAttribute('viewBox', `${box.x} ${box.y} ${box.w} ${box.h}`)
    const unit = 1 / view.scale(frame)
    // The parts of the city are the reading you take standing back from it. Zoomed
    // in the player is looking at one street, and a border across it is in the
    // way, so they go as the plan is zoomed past `DISTRICTS_UNTIL`.
    this.#svg.setAttribute('data-districts', String(view.zoom <= DISTRICTS_UNTIL))
    for (const fixed of this.#fixed) {
      const turn = fixed.rotate ? ` rotate(${fixed.rotate})` : ''
      fixed.node.setAttribute('transform', `translate(${fixed.x} ${fixed.y})${turn} scale(${unit})`)
    }
  }

  clear(): void {
    this.#plotsKey = null
    this.#districtsKey = null
    this.#districts.replaceChildren()
    this.#districtNames.replaceChildren()
    this.#stationsKey = null
    this.#marksKey = null
    this.#fixed = []
    this.#plots.replaceChildren()
    this.#names.replaceChildren()
    this.#stations.replaceChildren()
    this.#marks.replaceChildren()
  }

  /** One group rebuilt: its nodes go, and so does their place in the pixel-sized list. */
  #empty(group: SVGGElement): void {
    group.replaceChildren()
    this.#fixed = this.#fixed.filter((fixed) => fixed.node.parentNode !== group)
  }

  #name(plot: MapPlot): void {
    const node = svg('g', { class: 'gb-name' })
    node.append(text(plot.label ?? '', 0, 0, 'middle'))
    this.#names.append(node)
    this.#fixed.push({ node, x: plot.rect.x + plot.rect.w / 2, y: plot.rect.y + plot.rect.h / 2, rotate: 0 })
  }

  #station(at: MapStation): void {
    const node = svg('g', { class: 'gb-station' })
    const r = MARK_PX.station
    node.append(svg('rect', { x: -r, y: -r, width: r * 2, height: r * 2 }), text(at.name, MARK_PX.gap, 0, 'start'), title(at.name))
    this.#stations.append(node)
    this.#fixed.push({ node, x: at.x, y: at.y, rotate: 0 })
  }

  /** One part of the city: its shape, its name on hover, and a click the game answers. */
  #district(district: MapDistrict): SVGGElement {
    const node = districtShape(district)
    node.append(title(district.name))
    node.addEventListener('click', () => this.#onDistrict?.(district.id))
    node.addEventListener('pointerenter', () => this.#svg.setAttribute('data-over', district.id))
    node.addEventListener('pointerleave', () => this.#svg.removeAttribute('data-over'))
    return node
  }

  /** Its name across it, at screen size like every other name on the plan. */
  #districtName(district: MapDistrict): void {
    const node = svg('g', { class: 'gb-district-name', 'data-district': district.id })
    node.append(text(district.name, 0, 0, 'middle'))
    this.#districtNames.append(node)
    const heart = heartOf(district)
    this.#fixed.push({ node, x: heart.x, y: heart.y, rotate: 0 })
  }

  #mark(mark: MapMark): void {
    const node = svg('g', { class: `gb-mark gb-mark-${mark.kind}`, ...(mark.line ? { 'data-line': mark.line } : {}) })
    node.append(shapeOf(mark), title(mark.label))
    // The name is written beside the mark but only shown under the pointer: a
    // plan with a name on every step of every job, every offer and every place
    // the player owns is a plan of names with a city somewhere behind them.
    // The player's own arrow never needs one.
    if (mark.kind !== 'you') node.append(text(mark.label, MARK_PX.gap, 0, 'start'))
    this.#marks.append(node)
    this.#fixed.push({ node, x: mark.x, y: mark.y, rotate: mark.kind === 'you' ? degrees(mark.facing) : 0 })
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

function text(words: string, x: number, y: number, anchor: 'start' | 'middle'): SVGTextElement {
  const node = svg('text', { x, y, 'text-anchor': anchor, 'dominant-baseline': 'central' })
  node.textContent = words
  return node
}

function degrees(facing: number | undefined): number {
  return facing === undefined ? 0 : Math.round((facing * 180) / Math.PI)
}

function plotKey(plot: MapPlot): string {
  const { x, y, w, h } = plot.rect
  return `${plot.id}:${x},${y},${w},${h}:${plot.prominence ?? ''}:${plot.named ? plot.label : ''}`
}

function stationKey(at: MapStation): string {
  return `${at.id}:${at.x},${at.y}:${at.name}`
}

function markKey(mark: MapMark): string {
  return `${mark.kind}:${mark.line ?? ''}:${mark.x},${mark.y}:${mark.facing ?? ''}:${mark.label}`
}
