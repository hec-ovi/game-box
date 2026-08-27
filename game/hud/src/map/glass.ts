import { el } from '../dom.ts'
import type { MapDrawn, MapSurface } from '../types.ts'
import { Callouts } from './callouts.ts'

/**
 * The city itself: a canvas the game draws the architecture into, with the
 * callouts written over it.
 *
 * The interface owns the glass and draws nothing on it. The game takes the
 * canvas, builds the city out of it, and after every frame it draws says where
 * everything landed; this puts the labels there and reports what was clicked.
 * A game that draws nothing here leaves the glass off the page altogether, so
 * the two columns of reading take the frame rather than standing beside an
 * empty black box.
 */
export class Glass implements MapSurface {
  readonly node = el('div', 'gb-map-glass')
  readonly callouts: Callouts
  /** Where the game draws. It is handed over rather than made per city, so the renderer is made once. */
  readonly canvas = document.createElement('canvas')
  #drawing = false

  constructor(read: (targetId: string) => void) {
    this.canvas.className = 'gb-map-canvas'
    this.callouts = new Callouts(read)
    this.node.append(this.canvas, this.callouts.node)
    this.node.hidden = true
  }

  get drawing(): boolean {
    return this.#drawing
  }

  set drawing(on: boolean) {
    if (on === this.#drawing) return
    this.#drawing = on
    this.node.hidden = !on
  }

  place(drawn: MapDrawn): void {
    this.callouts.place(drawn)
  }
}
