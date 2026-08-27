import type { Hud } from '@gb/hud'
import type { Dressing } from '@gb/scene'
import type { World } from '@gb/world'
import { ItemView } from './item-view.ts'

/** A thing the player has opened in the inventory, and how they are turning it. */
export interface Inspect {
  show(itemId: string): Promise<void>
  turn(yaw: number, pitch: number): void
  /** The window closed: nothing is open and nothing is being drawn. */
  closed(): void
}

/**
 * The thing open in the inventory, drawn live into the canvas the interface
 * holds so the player can turn it in their hands.
 *
 * The view is made on the first thing opened rather than with the game, so a
 * playthrough that never opens the inventory never pays for it, and it only
 * ever draws while the window is open, which is when the game behind it is
 * paused.
 */
export class Inspecting implements Inspect {
  #world: World
  #hud: Hud
  #dressing: Dressing
  #view: ItemView | undefined

  constructor(input: { world: World; hud: Hud; dressing: Dressing }) {
    this.#world = input.world
    this.#hud = input.hud
    this.#dressing = input.dressing
  }

  async show(itemId: string): Promise<void> {
    const item = this.#world.item(itemId)
    if (!item) return
    this.#hud.show({ inspecting: { itemId } })
    this.#view ??= new ItemView({ dressing: this.#dressing, canvas: this.#hud.itemCanvas })
    await this.#view.show(item)
  }

  turn(yaw: number, pitch: number): void {
    this.#view?.turn(yaw, pitch)
  }

  closed(): void {
    this.#view?.close()
  }

  dispose(): void {
    this.#view?.dispose()
    this.#view = undefined
  }
}
