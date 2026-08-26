import { el, svg } from '../dom.ts'
import { LAYOUT } from '../style/layout.ts'
import type { MapMark, MapPlot, MapStation, MapView } from '../types.ts'
import { MARK_PX, goalShape, title, youArrow } from './marks.ts'
import type { Size, Viewport } from './viewport.ts'

/** The frame before the window has been laid out: the window itself, less its head. */
const NOMINAL: Size = { w: LAYOUT.window.width, h: LAYOUT.window.height - 52 }

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
  #zones = svg('g', { class: 'gb-zones' })
  #plots = svg('g', { class: 'gb-plots' })
  #names = svg('g', { class: 'gb-names' })
  #stations = svg('g', { class: 'gb-stations' })
  #marks = svg('g', { class: 'gb-marks' })
  #fixed: Fixed[] = []
  #plotsKey: string | null = null
  #stationsKey: string | null = null
  #marksKey: string | null = null

  constructor() {
    this.#svg.append(this.#ground, this.#zones, this.#plots, this.#names, this.#stations, this.#marks)
    this.node.append(this.#svg)
  }

  /** The frame in pixels, or its nominal size until it has been laid out. */
  frame(): Size {
    const w = this.node.clientWidth
    const h = this.node.clientHeight
    return w > 0 && h > 0 ? { w, h } : NOMINAL
  }

  draw(map: MapView, view: Viewport): void {
    const plotsKey = map.plots.map(plotKey).join('|')
    if (plotsKey !== this.#plotsKey) {
      this.#plotsKey = plotsKey
      this.#ground.setAttribute('width', String(map.width))
      this.#ground.setAttribute('height', String(map.height))
      this.#drawZones(map.width, map.height)
      this.#plots.replaceChildren(...map.plots.map(block))
      this.#empty(this.#names)
      for (const plot of map.plots) {
        if (plot.named && plot.label) this.#name(plot)
        if (plot.prominence === 'key') this.#door(plot)
      }
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

  #drawZones(width: number, height: number): void {
    this.#zones.replaceChildren()
    if (width <= 0 || height <= 0) return
    const midX = width / 2
    const midY = height / 2
    const zoneDefs = [
      { id: 'z1', name: 'West Commercial', x: 0, y: 0, w: midX, h: midY, line: 'main' },
      { id: 'z2', name: 'Harbor District', x: midX, y: 0, w: midX, h: midY, line: 'side' },
      { id: 'z3', name: 'Old Town Slums', x: 0, y: midY, w: midX, h: midY, line: 'side' },
      { id: 'z4', name: 'Transit Center', x: midX, y: midY, w: midX, h: midY, line: 'main' },
    ]
    for (const z of zoneDefs) {
      const rect = svg('rect', {
        class: 'gb-zone-shape',
        'data-line': z.line,
        'data-zone': z.name,
        x: z.x + 0.5,
        y: z.y + 0.5,
        width: z.w - 1,
        height: z.h - 1,
      })
      rect.append(title(z.name))
      this.#zones.append(rect)
    }
  }

  /** Point the view: set what is on show and size the pixel-drawn things to it. */
  look(view: Viewport): void {
    const frame = this.frame()
    const box = view.box(frame)
    this.#svg.setAttribute('viewBox', `${box.x} ${box.y} ${box.w} ${box.h}`)
    const unit = 1 / view.scale(frame)
    for (const fixed of this.#fixed) {
      const turn = fixed.rotate ? ` rotate(${fixed.rotate})` : ''
      fixed.node.setAttribute('transform', `translate(${fixed.x} ${fixed.y})${turn} scale(${unit})`)
    }
  }

  clear(): void {
    this.#plotsKey = null
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

  #door(plot: MapPlot): void {
    const node = svg('g', { class: 'gb-door-mark' })
    const r = MARK_PX.door
    node.append(svg('rect', { x: -r, y: -r, width: r * 2, height: r * 2 }), title(plot.label ?? 'Building Instance'))
    this.#marks.append(node)
    this.#fixed.push({ node, x: plot.rect.x + plot.rect.w / 2, y: plot.rect.y + plot.rect.h / 2, rotate: 0 })
  }

  #mark(mark: MapMark): void {
    const node = mark.kind === 'you' ? you(mark) : goal(mark)
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

function you(mark: MapMark): SVGElement {
  const node = svg('g', { class: 'gb-you' })
  node.append(youArrow(), title(mark.label))
  return node
}

function goal(mark: MapMark): SVGElement {
  const line = mark.line ?? 'side'
  const node = svg('g', { class: 'gb-goal', 'data-line': line })
  node.append(goalShape(line), text(mark.label, MARK_PX.gap, 0, 'start'), title(mark.label))
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
