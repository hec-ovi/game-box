import { el } from '../dom.ts'
import type { HudIntent, Inspecting } from '../types.ts'
import { ICON_PX, icon } from '../ui/icon.ts'

/** How far a drag across the whole box turns the thing, in radians: a little over one full turn. */
const ACROSS = Math.PI * 2.4

/** What one press of an arrow key turns it: fifteen degrees, so a press reads as a step and a held key spins it. */
const NUDGE = Math.PI / 12

/** How far up and down it will tip, so a thing can be looked at from above without going over the top. */
const TIP = Math.PI / 2.4

/**
 * The thing the player has open, in three dimensions, turned by dragging it.
 *
 * The interface draws none of it: it owns the canvas and reports the turn, and
 * the game renders the object into it. That keeps this box free of three.js and
 * means the thing on screen is the same object the city puts on a shelf, drawn
 * by the same art, rather than a picture of one.
 *
 * The canvas only has anything on it while the game is drawing there. Before
 * that, and for anything that cannot be drawn, the box holds the thing's own
 * icon rather than an empty frame.
 */
export class Turntable {
  readonly node = el('div', 'gb-inv-3d-box')
  /** Where the game draws. It is handed over rather than created per item, so the renderer is made once. */
  readonly canvas = document.createElement('canvas')
  #emit: (intent: HudIntent) => void
  #blank = el('div', 'gb-inv-3d-blank')
  #turning = false
  #lastX = 0
  #lastY = 0
  #yaw = 0
  #pitch = 0
  #itemId: string | undefined

  constructor(emit: (intent: HudIntent) => void) {
    this.#emit = emit
    this.canvas.className = 'gb-inv-3d-face'
    this.#blank.append(icon('item', ICON_PX.tile))
    this.node.append(this.#blank)
    this.node.setAttribute('role', 'img')

    this.node.addEventListener('pointerdown', (event) => {
      if (!this.#itemId) return
      this.#turning = true
      this.#lastX = event.clientX
      this.#lastY = event.clientY
      this.node.setPointerCapture(event.pointerId)
    })
    this.node.addEventListener('pointermove', (event) => {
      if (!this.#turning) return
      const width = this.node.clientWidth || 1
      const height = this.node.clientHeight || 1
      this.#turn(((event.clientX - this.#lastX) / width) * ACROSS, ((event.clientY - this.#lastY) / height) * ACROSS)
      this.#lastX = event.clientX
      this.#lastY = event.clientY
    })
    for (const done of ['pointerup', 'pointercancel']) {
      this.node.addEventListener(done, () => void (this.#turning = false))
    }

    // and the keyboard turns it too, because the window holds focus
    this.node.tabIndex = 0
    this.node.addEventListener('keydown', (event) => {
      if (!this.#itemId) return
      if (event.key === 'ArrowLeft') this.#turn(-NUDGE, 0)
      else if (event.key === 'ArrowRight') this.#turn(NUDGE, 0)
      else if (event.key === 'ArrowUp') this.#turn(0, -NUDGE)
      else if (event.key === 'ArrowDown') this.#turn(0, NUDGE)
      else return
      event.preventDefault()
    })
  }

  /** Which thing is open. A different one comes up face on; the same one keeps the angle it was turned to. */
  set(inspecting: Inspecting | undefined): void {
    if (inspecting?.itemId === this.#itemId) return
    this.#itemId = inspecting?.itemId
    this.#yaw = 0
    this.#pitch = 0
    this.node.dataset.turnable = String(this.#itemId !== undefined)
    if (this.#itemId === undefined) {
      this.canvas.remove()
      if (!this.#blank.isConnected) this.node.append(this.#blank)
      this.node.removeAttribute('aria-label')
      return
    }
    this.#blank.remove()
    if (!this.canvas.isConnected) this.node.append(this.canvas)
    this.node.setAttribute('aria-label', 'Drag or use the arrow keys to turn it')
    this.#emit({ kind: 'turn', yaw: 0, pitch: 0 })
  }

  clear(): void {
    this.set(undefined)
  }

  dispose(): void {
    this.canvas.remove()
  }

  #turn(byYaw: number, byPitch: number): void {
    this.#yaw += byYaw
    this.#pitch = Math.min(TIP, Math.max(-TIP, this.#pitch + byPitch))
    this.#emit({ kind: 'turn', yaw: this.#yaw, pitch: this.#pitch })
  }
}
