import { el, svg } from '../dom.ts'
import { stepsOf, trackedQuest } from '../tracked.ts'
import type { HudState, HudWindowName, MapMark, MapView } from '../types.ts'
import type { Tab } from './tab.ts'

const NONE = 'Nothing to head for yet.'

/**
 * The city from above and where the player is headed on it. The plan is drawn
 * from whatever the game has surveyed; the bearings underneath are the places
 * the tracked quest points at, numbered to match the pips on the plan.
 */
export class MapTab implements Tab {
  readonly name: HudWindowName = 'map'
  readonly node = el('div', 'gb-map')
  #plan = el('div', 'gb-plan')
  #list = el('ol', 'gb-bearings')
  /** The survey already on screen. `null` is "nothing drawn", which a real
   *  absent survey is not, so reopening an unsurveyed map still redraws. */
  #drawn: MapView | null | undefined = null
  #key: string | null = null

  constructor() {
    const heading = el('section', 'gb-bearing-list')
    heading.append(el('h3', undefined, 'Bearings'), this.#list)
    this.node.append(this.#plan, heading)
  }

  render(state: HudState): void {
    if (state.map !== this.#drawn) {
      this.#drawn = state.map
      this.#plan.replaceChildren(...(state.map ? [plan(state.map)] : []))
    }
    const bearings = read(state)
    const key = bearings.map((line) => `${line.pip ?? ''}:${line.text}:${line.note ?? ''}`).join('|')
    if (key === this.#key) return
    this.#key = key
    this.#list.replaceChildren(...(bearings.length ? bearings.map(bearing) : [el('li', 'gb-empty', NONE)]))
  }

  clear(): void {
    this.#drawn = null
    this.#key = null
    this.#plan.replaceChildren()
    this.#list.replaceChildren()
  }
}

interface Bearing {
  readonly pip: number | undefined
  readonly text: string
  readonly note: string | undefined
}

/**
 * Where to go: from the survey when it names places, from the open steps when
 * it does not, so the tab answers the question either way.
 */
function read(state: HudState): readonly Bearing[] {
  const marks = state.map?.marks?.filter((mark) => mark.kind === 'goal') ?? []
  if (marks.length) return marks.map((mark, at) => ({ pip: at + 1, text: mark.label, note: undefined }))
  return stepsOf(state, trackedQuest(state)).map((step) => ({
    pip: undefined,
    text: step.markerLabel ?? step.text,
    note: step.hint,
  }))
}

function bearing(line: Bearing): HTMLLIElement {
  const node = el('li')
  if (line.pip !== undefined) node.append(el('span', 'gb-pip', String(line.pip)))
  node.append(el('span', 'gb-what', line.text))
  if (line.note) node.append(el('span', 'gb-note', line.note))
  return node
}

function plan(map: MapView): SVGSVGElement {
  const root = svg('svg', {
    viewBox: `0 0 ${map.width} ${map.height}`,
    preserveAspectRatio: 'xMidYMid meet',
    role: 'img',
    'aria-label': 'City plan',
  })
  root.append(svg('rect', { class: 'gb-ground', x: 0, y: 0, width: map.width, height: map.height }))
  for (const plot of map.plots) {
    root.append(
      svg('rect', { class: 'gb-block', x: plot.rect.x, y: plot.rect.y, width: plot.rect.w, height: plot.rect.h }),
    )
  }
  let pip = 0
  for (const mark of map.marks ?? []) {
    if (mark.kind === 'goal') pip += 1
    root.append(mark.kind === 'you' ? you(mark) : goal(mark, pip))
  }
  return root
}

function you(mark: MapMark): SVGElement {
  const arrow = svg('path', {
    class: 'gb-you',
    d: 'M 0 -2.4 L 1.7 2.1 L 0 1.1 L -1.7 2.1 Z',
    transform: `translate(${mark.x} ${mark.y}) rotate(${degrees(mark.facing)})`,
  })
  arrow.append(named(mark.label))
  return arrow
}

function goal(mark: MapMark, pip: number): SVGElement {
  const group = svg('g', { class: 'gb-goal', transform: `translate(${mark.x} ${mark.y})` })
  const number = svg('text', { y: 0.9, 'text-anchor': 'middle' })
  number.textContent = String(pip)
  group.append(svg('circle', { r: 2 }), number, named(mark.label))
  return group
}

/** What hovering a pip says, which is the only place a name fits at this scale. */
function named(label: string): SVGTitleElement {
  const node = svg('title')
  node.textContent = label
  return node
}

function degrees(facing: number | undefined): number {
  return facing === undefined ? 0 : Math.round((facing * 180) / Math.PI)
}
