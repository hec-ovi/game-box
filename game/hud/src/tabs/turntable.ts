import { el } from '../dom.ts'
import type { Inspecting } from '../types.ts'
import { ICON_PX, icon } from '../ui/icon.ts'

/**
 * The thing the player has open, turnable.
 *
 * The interface has no renderer of its own and is drawn over one that is
 * already busy, so this is not a live 3D view: the game draws the object once
 * from all the way round and hands over the views, and dragging walks them.
 * That reads as turning it, costs nothing a frame, and works the same whether
 * the game is paused behind the window or not.
 *
 * Until the views arrive, and where the game cannot draw them at all, it shows
 * the thing's own icon rather than an empty box.
 */
export class Turntable {
  readonly node = el('div', 'gb-inv-3d-box')
  #face = document.createElement('img')
  #blank = el('div', 'gb-inv-3d-blank')
  #frames: readonly string[] = []
  #at = 0
  #dragging = false
  #lastX = 0
  #itemId: string | undefined

  constructor() {
    this.node.setAttribute('role', 'img')
    this.#face.className = 'gb-inv-3d-face'
    this.#face.decoding = 'async'
    this.#blank.append(icon('item', ICON_PX.tile))
    this.node.append(this.#blank)

    this.node.addEventListener('pointerdown', (event) => {
      if (this.#frames.length < 2) return
      this.#dragging = true
      this.#lastX = event.clientX
      this.node.setPointerCapture(event.pointerId)
    })
    this.node.addEventListener('pointermove', (event) => {
      if (!this.#dragging) return
      const moved = event.clientX - this.#lastX
      // a drag across the whole box is one turn all the way round
      const step = Math.max(1, this.node.clientWidth / this.#frames.length)
      if (Math.abs(moved) < step) return
      this.#lastX = event.clientX
      this.#turn(Math.sign(moved) * Math.round(Math.abs(moved) / step))
    })
    for (const done of ['pointerup', 'pointercancel']) {
      this.node.addEventListener(done, () => void (this.#dragging = false))
    }
    // and the keyboard turns it too, because the window holds focus
    this.node.tabIndex = 0
    this.node.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft') this.#turn(-1)
      else if (event.key === 'ArrowRight') this.#turn(1)
      else return
      event.preventDefault()
    })
  }

  /** What the game drew. A different thing starts face on; the same thing keeps the angle it was turned to. */
  set(inspecting: Inspecting | undefined): void {
    const frames = inspecting?.frames ?? []
    if (inspecting?.itemId !== this.#itemId) {
      this.#itemId = inspecting?.itemId
      this.#at = 0
    }
    if (frames === this.#frames) return
    this.#frames = frames
    this.node.dataset.turnable = String(frames.length > 1)
    if (frames.length === 0) {
      this.#face.remove()
      if (!this.#blank.isConnected) this.node.append(this.#blank)
      this.node.removeAttribute('aria-label')
      return
    }
    this.#blank.remove()
    if (!this.#face.isConnected) this.node.append(this.#face)
    this.node.setAttribute('aria-label', frames.length > 1 ? 'Drag or use the arrow keys to turn it' : 'The thing you are holding')
    this.#draw()
  }

  clear(): void {
    this.set(undefined)
  }

  dispose(): void {
    this.#face.remove()
  }

  #turn(by: number): void {
    if (this.#frames.length < 2) return
    const count = this.#frames.length
    this.#at = (((this.#at + by) % count) + count) % count
    this.#draw()
  }

  #draw(): void {
    const frame = this.#frames[this.#at]
    if (frame) this.#face.src = frame
  }
}
