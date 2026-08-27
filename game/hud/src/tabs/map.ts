import { el } from '../dom.ts'
import type { Callout } from '../map/callouts.ts'
import { Glass } from '../map/glass.ts'
import { ReadingPanel } from '../map/reading.ts'
import { MapTools, type MapTool } from '../map/tools.ts'
import { WorkLists } from '../map/work.ts'
import type { HudIntent, HudState, HudWindowName, MapMove, MapView } from '../types.ts'
import type { Tab } from './tab.ts'

/** Which way each arrow key pushes the middle of the view. */
const ARROWS: Record<string, MapMove> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
}

/**
 * The city, as the architecture it is: the game draws the massing on the glass
 * in the middle and this writes over it.
 *
 * Down the left is whatever the player picked, in the game's own words. Over
 * the glass are the callouts: a line off each thing worth naming, a kink, and
 * a box with its name in it. Down the right is everything there is to read,
 * folded into three headings: the main line with its steps, the side jobs, and
 * the stations.
 *
 * Nothing here draws the city and nothing here moves the camera. A callout or
 * a row picked goes out as `read`; a tool or its key goes out as `map-move`;
 * the game answers both with a frame and a push.
 */
export class MapTab implements Tab {
  readonly name: HudWindowName = 'map'
  readonly node = el('div', 'gb-map')
  readonly glass: Glass
  #emit: (intent: HudIntent) => void
  #tools: MapTools
  #reading = new ReadingPanel()
  #work: WorkLists

  constructor(emit: (intent: HudIntent) => void) {
    this.#emit = emit
    this.glass = new Glass((targetId) => emit({ kind: 'read', targetId }))
    this.#tools = new MapTools((tool) => emit({ kind: 'map-move', move: tool }))
    this.#work = new WorkLists(emit)
    this.node.tabIndex = 0
    this.node.setAttribute('aria-label', 'Map')
    this.node.addEventListener('keydown', (event) => this.#key(event))

    // the tools stand on the glass, so a face with nothing drawing it has no
    // buttons for a camera that is not there
    this.glass.node.append(this.#tools.node)
    const middle = el('main', 'gb-map-middle')
    middle.append(this.glass.node)
    this.node.append(this.#reading.node, middle, this.#work.node)
  }

  render(state: HudState): void {
    this.glass.callouts.set(calloutsOf(state.map))
    this.glass.callouts.reading(state.reading?.id)
    this.#reading.set(state.reading)
    this.#work.render(state)
  }

  clear(): void {
    this.glass.callouts.clear()
    this.#reading.clear()
    this.#work.clear()
  }

  /** The keys the city answers to while the map has focus: the tools, and the arrows to push the view about. */
  #key(event: KeyboardEvent): void {
    if (!this.glass.drawing) return
    const tool: MapTool | undefined = MapTools.toolFor(event.key)
    const arrow = ARROWS[event.key]
    const move = tool ?? arrow
    if (!move) return
    event.preventDefault()
    event.stopPropagation()
    this.#emit({ kind: 'map-move', move })
  }
}

/**
 * What is worth a name on the city: the player, every place a job is sending
 * them, work waiting to be picked up, the places that are theirs, the stations
 * and the parts of town. It is the survey the game pushed, read as labels.
 */
function calloutsOf(map: MapView | undefined): Callout[] {
  if (!map) return []
  const callouts: Callout[] = []
  for (const mark of map.marks ?? []) {
    callouts.push({ id: mark.id, kind: mark.kind, label: mark.label, ...(mark.line ? { line: mark.line } : {}) })
  }
  for (const station of map.stations ?? []) callouts.push({ id: station.id, kind: 'station', label: station.name })
  for (const district of map.districts ?? []) callouts.push({ id: district.id, kind: 'district', label: district.name })
  // the buildings the game asked to be named: the landmarks, the places a job
  // points at and the ones already walked into. They are the last to get room
  for (const plot of map.plots) if (plot.named && plot.label) callouts.push({ id: plot.id, kind: 'place', label: plot.label })
  return callouts
}
