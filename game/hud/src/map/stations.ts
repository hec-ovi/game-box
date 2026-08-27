import { el } from '../dom.ts'
import { rise } from '../motion.ts'
import { MAP_PANELS, STATIONS } from '../phrase.ts'
import type { MapStation } from '../types.ts'
import { act } from '../ui/act.ts'
import { chip } from '../ui/chip.ts'
import { Row } from '../ui/row.ts'

/**
 * Where fast travel boards. Standing at a station, the player can ride to any
 * other from here; anywhere else the list only says where the stations are and
 * how to use them. Clicking a row takes the view to that station, the same as
 * clicking its callout on the city.
 */
export class StationList {
  readonly node = el('div', 'gb-station-list')
  #list = el('ol', 'gb-stations gb-rows')
  #walk = el('p', 'gb-note gb-t2', STATIONS.walk)
  #none = el('p', 'gb-empty gb-t3', MAP_PANELS.noStations)
  #travel: (stationId: string) => void
  #read: (stationId: string) => void
  #key: string | null = null

  constructor(travel: (stationId: string) => void, read: (stationId: string) => void) {
    this.#travel = travel
    this.#read = read
    this.node.append(this.#list, this.#walk, this.#none)
  }

  set(stations: readonly MapStation[], boarding: string | undefined, reading: string | undefined): void {
    const key = JSON.stringify([stations, boarding, reading])
    if (key === this.#key) return
    this.#key = key
    this.#walk.hidden = boarding !== undefined || stations.length === 0
    this.#none.hidden = stations.length > 0
    this.#list.replaceChildren(...stations.map((station, at) => this.#row(station, boarding, reading, at)))
  }

  clear(): void {
    this.#key = null
    this.#list.replaceChildren()
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
