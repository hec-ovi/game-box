import { el } from '../dom.ts'
import { rise } from '../motion.ts'
import { MAP_PANELS, STATIONS } from '../phrase.ts'
import type { MapStation } from '../types.ts'
import { act } from '../ui/act.ts'
import { chip } from '../ui/chip.ts'
import { Row } from '../ui/row.ts'

/** Where the player stands against the stations, which is all this list can be. */
type Standing = 'none' | 'away' | 'alone' | 'among'

/** One line per situation, and none for a player who already has somewhere to ride. */
const SAYS: Record<Standing, string> = {
  none: MAP_PANELS.noStations,
  away: STATIONS.walk,
  alone: STATIONS.alone,
  among: '',
}

/**
 * Where fast travel boards. Standing at a station, the player can ride to any
 * other from here; anywhere else the list only says where the stations are and
 * how to use them. Clicking a row takes the view to that station, the same as
 * clicking its callout on the city.
 *
 * The list always says which of the four situations the player is in, so a
 * panel is never a heading over rows that answer nothing.
 */
export class StationList {
  readonly node = el('div', 'gb-station-list')
  #list = el('ol', 'gb-stations gb-rows')
  #note = el('p', 'gb-note gb-t2')
  #travel: (stationId: string) => void
  #read: (stationId: string) => void
  #key: string | null = null

  constructor(travel: (stationId: string) => void, read: (stationId: string) => void) {
    this.#travel = travel
    this.#read = read
    this.node.append(this.#list, this.#note)
  }

  set(stations: readonly MapStation[], boarding: string | undefined, reading: string | undefined): void {
    const key = JSON.stringify([stations, boarding, reading])
    if (key === this.#key) return
    this.#key = key
    this.#say(SAYS[standing(stations, boarding)])
    this.#list.replaceChildren(...stations.map((station, at) => this.#row(station, boarding, reading, at)))
  }

  clear(): void {
    this.#key = null
    this.#say('')
    this.#list.replaceChildren()
  }

  /** The line under the rows, gone rather than blank when the situation has nothing to add. */
  #say(line: string): void {
    this.#note.textContent = line
    this.#note.hidden = line === ''
  }

  #row(station: MapStation, boarding: string | undefined, reading: string | undefined, at: number): HTMLLIElement {
    const row = new Row({ icon: 'station', title: station.name, tag: 'li', compact: true })
    row.chosen(station.id === reading)
    const pick = el('button', 'gb-map-pick', station.name)
    pick.type = 'button'
    pick.addEventListener('click', () => this.#read(station.id))
    row.titleCell.replaceChildren(pick)
    row.node.dataset.acts = 'true'
    if (station.id === boarding) {
      row.state.append(chip(STATIONS.here, 'accent'))
      row.keyLine('on')
    } else if (boarding !== undefined) {
      const go = act({
        label: STATIONS.travel,
        icon: 'station',
        lit: true,
        aria: `${STATIONS.travel} to ${station.name}`,
      })
      go.addEventListener('click', () => this.#travel(station.id))
      row.act(go)
    }
    rise(row.node, at)
    return row.node as HTMLLIElement
  }
}

/**
 * Which of the four the player is in. A town can hold none; the player can be
 * away from all of them, at one of several, or at the only one there is, which
 * is a station with a `Here` chip and nowhere to go.
 */
function standing(stations: readonly MapStation[], boarding: string | undefined): Standing {
  if (stations.length === 0) return 'none'
  if (boarding === undefined) return 'away'
  return stations.some((station) => station.id !== boarding) ? 'among' : 'alone'
}
