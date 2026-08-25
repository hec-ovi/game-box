import { el } from '../dom.ts'
import { rise } from '../motion.ts'
import { STATIONS } from '../phrase.ts'
import type { MapStation } from '../types.ts'
import { act } from '../ui/act.ts'
import { chip } from '../ui/chip.ts'
import { Row } from '../ui/row.ts'

/**
 * Where fast travel boards, listed under the plan. Standing at a station, the
 * player can ride to any other from here; anywhere else the list only says
 * where the stations are and how to use them. Gone when the city has none.
 */
export class StationList {
  readonly node = el('section', 'gb-station-list gb-scrolls')
  #list = el('ol', 'gb-stations gb-rows')
  #walk = el('p', 'gb-note gb-t2', STATIONS.walk)
  #travel: (stationId: string) => void
  #key: string | null = null

  constructor(travel: (stationId: string) => void) {
    this.#travel = travel
    this.node.append(el('h3', 'gb-t1', STATIONS.head), this.#list, this.#walk)
    this.node.hidden = true
  }

  set(stations: readonly MapStation[], boarding: string | undefined): void {
    const key = JSON.stringify([stations, boarding])
    if (key === this.#key) return
    this.#key = key
    this.node.hidden = stations.length === 0
    this.#walk.hidden = boarding !== undefined
    this.#list.replaceChildren(...stations.map((station, at) => this.#row(station, boarding, at)))
  }

  clear(): void {
    this.#key = null
    this.#list.replaceChildren()
  }

  #row(station: MapStation, boarding: string | undefined, at: number): HTMLLIElement {
    const row = new Row({ icon: 'station', title: station.name, tag: 'li', compact: true })
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
