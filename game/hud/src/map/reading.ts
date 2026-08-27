import { el } from '../dom.ts'
import { rise } from '../motion.ts'
import { MAP_KINDS, MAP_MAIN_KIND, MAP_PANELS } from '../phrase.ts'
import type { MapReading } from '../types.ts'
import { ICON_PX, icon } from '../ui/icon.ts'
import { pictureOf } from './callouts.ts'

/**
 * What the player picked off the city, in the column beside it: what kind of
 * thing it is, its name, what it is in a line or two, and what is known about
 * it row by row.
 *
 * A quest step, a place, a station and a place of the player's own read
 * differently because the game says different things about each; nothing is
 * worked out here. With nothing picked the column says how to pick something,
 * rather than standing empty.
 */
export class ReadingPanel {
  readonly node = el('section', 'gb-map-reading gb-scrolls')
  #body = el('div', 'gb-map-reading-body')
  #key: string | null = null

  constructor() {
    this.node.append(el('h3', 'gb-t1', MAP_PANELS.reading), this.#body)
  }

  set(reading: MapReading | undefined): void {
    const key = reading ? JSON.stringify(reading) : ''
    if (key === this.#key) return
    this.#key = key
    this.#body.replaceChildren(reading ? this.#read(reading) : el('p', 'gb-empty gb-t3', MAP_PANELS.nothing))
  }

  clear(): void {
    this.#key = null
    this.#body.replaceChildren()
  }

  #read(reading: MapReading): HTMLElement {
    const main = reading.line === 'main'
    const node = el('article', 'gb-map-read gb-cut')
    node.dataset.kind = reading.kind
    if (reading.line) node.dataset.line = reading.line

    const head = el('div', 'gb-map-read-head')
    const tile = el('div', 'gb-tile gb-cut gb-edged')
    tile.append(icon(pictureOf(reading.kind, reading.line), ICON_PX.tile))
    const words = el('div', 'gb-map-read-words')
    words.append(
      el('span', 'gb-t1 gb-map-read-kind', reading.kind === 'goal' && main ? MAP_MAIN_KIND : MAP_KINDS[reading.kind]),
      el('h4', 'gb-t5 gb-map-read-name', reading.name),
    )
    head.append(tile, words)
    node.append(head)

    if (reading.text) node.append(el('p', 'gb-t3 gb-map-read-text', reading.text))

    const facts = reading.facts ?? []
    if (facts.length) {
      const list = el('dl', 'gb-map-facts')
      for (const [at, fact] of facts.entries()) {
        const row = el('div', 'gb-map-fact')
        row.append(el('dt', 'gb-t1', fact.label), el('dd', 'gb-num gb-t2', fact.value))
        rise(row, at)
        list.append(row)
      }
      node.append(list)
    }
    return node
  }
}
