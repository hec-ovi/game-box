import type { Hud } from '@gb/hud'
import type { World } from '@gb/world'
import type { Turntable } from './turntable.ts'

/** Drawing a thing the player has opened in the inventory, and putting it on the panel. */
export interface Inspect {
  show(itemId: string): Promise<void>
}

/**
 * The thing open in the inventory, drawn from every side and pushed to the
 * panel so the player can turn it.
 *
 * The views are only asked for while the window is open, and the panel keeps
 * the thing's icon until they land, so opening the inventory costs nothing and
 * the wait is never a blank box. A thing opened after the player has walked on
 * to another one is dropped: the views take a moment and the panel has moved.
 */
export class Inspecting implements Inspect {
  #world: World
  #hud: Hud
  #turntable: Turntable
  #open: string | undefined

  constructor(input: { world: World; hud: Hud; turntable: Turntable }) {
    this.#world = input.world
    this.#hud = input.hud
    this.#turntable = input.turntable
  }

  async show(itemId: string): Promise<void> {
    const item = this.#world.item(itemId)
    if (!item) return
    this.#open = itemId
    // the panel is told which thing it is straight away, so it stops showing
    // the last one while this one is drawn
    this.#hud.show({ inspecting: { itemId, frames: [] } })
    const frames = await this.#turntable.of(item)
    if (this.#open !== itemId || frames.length === 0) return
    this.#hud.show({ inspecting: { itemId, frames } })
  }
}
