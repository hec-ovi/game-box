import { el } from '../dom.ts'
import { Gestures } from '../map/gestures.ts'
import { Legend, type Bearing } from '../map/legend.ts'
import { Plan } from '../map/plan.ts'
import { StationList } from '../map/stations.ts'
import { MapTools, type MapTool } from '../map/tools.ts'
import { Viewport, ZOOM_STEP, type Cell } from '../map/viewport.ts'
import { kindOf, stepsOf, trackedQuest } from '../tracked.ts'
import type { HudIntent, HudState, HudWindowName, MapMark } from '../types.ts'
import { ICON_PX, icon } from '../ui/icon.ts'
import type { Tab } from './tab.ts'

/** How far one arrow key pans: a tenth of what is on show. */
const KEY_PAN = 0.1

/**
 * The city from above, filling the frame, and where the player is headed on
 * it. The plan zooms and pans inside the frame by wheel, drag, key or button;
 * the bearings under it name the places the quests point at and swing the
 * plan onto one when it is clicked, and beside them the stations offer a
 * ride while the player stands at one.
 */
export class MapTab implements Tab {
  readonly name: HudWindowName = 'map'
  readonly node = el('div', 'gb-map')
  #plan = new Plan()
  #tools = new MapTools((tool) => this.#run(tool))
  #legend = new Legend((at) => this.#centre(at))
  #guide = el('section', 'gb-map-legend-guide')
  #stations: StationList
  #gestures: Gestures
  #view: Viewport | undefined
  #you: Cell | undefined

  constructor(emit: (intent: HudIntent) => void) {
    this.#stations = new StationList((stationId) => emit({ kind: 'travel', stationId }))
    this.node.tabIndex = 0
    this.node.setAttribute('aria-label', 'Map')
    this.node.addEventListener('keydown', (event) => this.#key(event))
    this.#plan.node.append(this.#tools.node)
    this.#guide.append(el('h3', 'gb-t1', 'What the marks mean'), this.#guideList())

    const sidebarLeft = el('aside', 'gb-map-sidebar gb-map-sidebar-left gb-scrolls')
    sidebarLeft.append(this.#legend.node, this.#stations.node)

    const mainArea = el('main', 'gb-map-main-area')
    mainArea.append(this.#plan.node)

    const sidebarRight = el('aside', 'gb-map-sidebar gb-map-sidebar-right gb-scrolls')
    sidebarRight.append(this.#guide)

    this.node.append(sidebarLeft, mainArea, sidebarRight)
    this.#gestures = new Gestures(this.#plan.node, {
      zoom: (factor, at) => {
        const view = this.#view
        if (!view) return
        view.zoomBy(factor, view.cellAt(this.#plan.frame(), at.x, at.y))
        this.#plan.look(view)
      },
      pan: (dx, dy) => this.#pan(dx, dy),
    })
  }

  /**
   * What each mark on the plan means. Every row here is a mark the plan can
   * actually draw: a key that shows a symbol the player will never see is
   * worse than no key at all.
   */
  #guideList(): HTMLElement {
    const list = el('ul', 'gb-legend-guide-list')
    const items = [
      { label: 'The story, where it is sending you', icon: 'quest-main' as const, colour: 'var(--gb-quest-main)' },
      { label: 'An errand you have taken', icon: 'quest-side' as const, colour: 'var(--gb-quest-side)' },
      { label: 'Work waiting to be picked up', icon: 'ring' as const, colour: 'var(--gb-quest-side)' },
      { label: 'A place of your own', icon: 'home' as const, colour: 'var(--gb-accent-lit)' },
      { label: 'Where the train boards', icon: 'station' as const, colour: 'var(--gb-ink)' },
    ]
    for (const item of items) {
      const row = el('li', 'gb-legend-guide-item')
      const mark = el('span', 'gb-legend-guide-icon')
      mark.style.color = item.colour
      mark.append(icon(item.icon, ICON_PX.line))
      row.append(mark, el('span', 'gb-t2', item.label))
      list.append(row)
    }
    return list
  }

  render(state: HudState): void {
    const map = state.map
    this.#plan.node.hidden = map === undefined
    if (map) {
      if (this.#view?.width !== map.width || this.#view.height !== map.height) this.#view = new Viewport(map.width, map.height)
      this.#you = map.marks?.find((mark) => mark.kind === 'you')
      this.#plan.draw(map, this.#view)
    } else {
      this.#plan.clear()
    }
    this.#legend.set(read(state))
    this.#stations.set(map?.stations ?? [], map?.boarding)
  }

  clear(): void {
    this.#plan.clear()
    this.#legend.clear()
    this.#stations.clear()
  }

  dispose(): void {
    this.#gestures.dispose()
  }

  #run(tool: MapTool): void {
    const view = this.#view
    if (!view) return
    if (tool === 'in') view.zoomBy(ZOOM_STEP)
    else if (tool === 'out') view.zoomBy(1 / ZOOM_STEP)
    else if (tool === 'fit') view.fit()
    else if (this.#you) view.centreOn(this.#you)
    this.#plan.look(view)
  }

  #pan(dxPx: number, dyPx: number): void {
    const view = this.#view
    if (!view) return
    const unit = 1 / view.scale(this.#plan.frame())
    view.panBy(dxPx * unit, dyPx * unit)
    this.#plan.look(view)
  }

  #centre(at: Cell): void {
    const view = this.#view
    if (!view) return
    view.centreOn(at)
    this.#plan.look(view)
  }

  /** The keys the plan answers to while the map has focus: tools, and arrows to pan. */
  #key(event: KeyboardEvent): void {
    if (!this.#view) return
    const tool = MapTools.toolFor(event.key)
    const arrow = ARROWS[event.key]
    if (!tool && !arrow) return
    event.preventDefault()
    event.stopPropagation()
    if (tool) this.#run(tool)
    else if (arrow) {
      const frame = this.#plan.frame()
      this.#pan(arrow.x * frame.w * KEY_PAN, arrow.y * frame.h * KEY_PAN)
    }
  }
}

const ARROWS: Record<string, Cell> = {
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
}

/**
 * Where to go: from the plan's goal marks when the game has surveyed, from
 * the tracked quest's open steps when it has not, so the tab answers either way.
 */
function read(state: HudState): readonly Bearing[] {
  const marks = state.map?.marks?.filter((mark) => mark.kind === 'goal') ?? []
  if (marks.length) return marks.map(fromMark)
  const tracked = trackedQuest(state)
  const line = kindOf(state, tracked)
  return stepsOf(state, tracked).map((step) => ({
    text: step.markerLabel ?? step.text,
    note: step.hint,
    line,
    at: undefined,
  }))
}

function fromMark(mark: MapMark): Bearing {
  return { text: mark.label, note: undefined, line: mark.line ?? 'side', at: { x: mark.x, y: mark.y } }
}
