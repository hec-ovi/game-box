import { el } from '../dom.ts'
import { STATIONS } from '../phrase.ts'
import type { MapStation } from '../types.ts'

/**
 * Where fast travel boards, listed under the plan. Standing at a station, the
 * player can ride to any other from here; anywhere else the list only says
 * where the stations are and how to use them. Gone when the city has none.
 */
export class StationList {
  readonly node = el('section', 'gb-station-list')
  #list = el('ol', 'gb-stations')
  #walk = el('p', 'gb-note', STATIONS.walk)
  #travel: (stationId: string) => void
  #key: string | null = null

  constructor(travel: (stationId: string) => void) {
    this.#travel = travel
    this.node.append(el('h3', undefined, STATIONS.head), this.#list, this.#walk)
    this.node.hidden = true
  }

  set(stations: readonly MapStation[], boarding: string | undefined): void {
    const key = JSON.stringify([stations, boarding])
    if (key === this.#key) return
    this.#key = key
    this.node.hidden = stations.length === 0
    this.#walk.hidden = boarding !== undefined
    this.#list.replaceChildren(...stations.map((station) => this.#row(station, boarding)))
  }

  clear(): void {
    this.#key = null
    this.#list.replaceChildren()
  }

  #row(station: MapStation, boarding: string | undefined): HTMLLIElement {
    const node = el('li')
    node.append(el('span', 'gb-what', station.name))
    if (station.id === boarding) node.append(el('span', 'gb-tag', STATIONS.here))
    else if (boarding !== undefined) {
      const go = el('button', 'gb-travel', STATIONS.travel)
      go.type = 'button'
      go.setAttribute('aria-label', `${STATIONS.travel} to ${station.name}`)
      go.addEventListener('click', () => this.#travel(station.id))
      node.append(go)
    }
    return node
  }
}
