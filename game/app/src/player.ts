import { METRICS } from '@gb/world'
import * as THREE from 'three'
import { typingSomewhere } from './focus.ts'
import { slide, step, type Solid, type Vec2 } from './walk.ts'
import { Body } from './stance.ts'
import { Zoom } from './zoom.ts'

const LOOK_SPEED = 0.0022
const PITCH_LIMIT = Math.PI / 2 - 0.05

/**
 * First person: the mouse looks, the keys walk, and walls stop you. Pointer
 * lock is released whenever something else wants the keyboard, so typing to an
 * NPC does not also walk you into the wall behind them.
 */
export class Player {
  #camera: THREE.PerspectiveCamera
  #element: HTMLElement
  #solid: Solid
  #yaw = 0
  #pitch = 0
  #held = new Set<string>()
  #typing = false
  #zoom = new Zoom()
  #stance = new Body()
  #ground: (x: number, z: number) => number = () => 0
  #riding: { x: number; y: number; z: number; roll: number } | undefined

  constructor(camera: THREE.PerspectiveCamera, element: HTMLElement, solid: Solid) {
    this.#camera = camera
    this.#element = element
    this.#solid = solid

    element.addEventListener('click', () => {
      if (!this.#typing) void element.requestPointerLock()
    })
    document.addEventListener('mousemove', this.#look)
    document.addEventListener('keydown', this.#down)
    document.addEventListener('keyup', this.#up)
    document.addEventListener('mousedown', this.#press)
    document.addEventListener('mouseup', this.#release)
    // the right button is a game control here, not a menu
    element.addEventListener('contextmenu', (event) => event.preventDefault())
  }

  dispose(): void {
    document.removeEventListener('mousemove', this.#look)
    document.removeEventListener('keydown', this.#down)
    document.removeEventListener('keyup', this.#up)
    document.removeEventListener('mousedown', this.#press)
    document.removeEventListener('mouseup', this.#release)
  }

  /** Where the walls are now: the street outside, or the room you just entered. */
  setSolid(solid: Solid): void {
    this.#solid = solid
  }

  /** How high the floor is under a point. Flat indoors, kerbed outdoors. */
  setGround(ground: (x: number, z: number) => number): void {
    this.#ground = ground
  }

  /** True while the keys belong to something else on the page. */
  get typing(): boolean {
    return this.#typing
  }

  /** While the player is typing, the keys belong to the text box. */
  setTyping(typing: boolean): void {
    this.#typing = typing
    this.#held.clear()
    this.#zoom.close = false
    if (typing && document.pointerLockElement === this.#element) document.exitPointerLock()
  }

  get position(): Vec2 {
    return { x: this.#camera.position.x, z: this.#camera.position.z }
  }

  get heading(): number {
    return this.#yaw
  }

  /** What the movement keys say this frame. Driving reads the same keys walking does. */
  get input(): { forward: number; strafe: number; running: boolean } {
    return {
      forward: (this.#down_('KeyW') ? 1 : 0) - (this.#down_('KeyS') ? 1 : 0),
      strafe: (this.#down_('KeyD') ? 1 : 0) - (this.#down_('KeyA') ? 1 : 0),
      running: this.#down_('ShiftLeft') || this.#down_('ShiftRight'),
    }
  }

  /**
   * Riding in something that moves: the eye sits where it is put and the view
   * turns with it, so the mouse still looks around inside a car that is
   * turning. Nothing hands walking back.
   */
  ride(seat: { x: number; y: number; z: number; turned: number; roll: number } | undefined): void {
    this.#riding = seat
    if (!seat) return
    this.#camera.position.set(seat.x, seat.y, seat.z)
    this.#yaw += seat.turned
    this.#apply()
  }

  placeAt(x: number, z: number, facing = this.#yaw): void {
    this.#camera.position.set(x, this.#ground(x, z) + METRICS.player.eyeHeight, z)
    this.#yaw = facing
    this.#pitch = 0
    this.#apply()
  }

  update(seconds: number): void {
    if (this.#zoom.update(seconds)) {
      this.#camera.fov = this.#zoom.fov
      this.#camera.updateProjectionMatrix()
    }

    // riding: where the eye goes is the car's business, and the stance, the
    // walk and the kerb are all off until the player gets out
    if (this.#riding) return

    this.#stance.crouching = this.#down_('KeyC')
    this.#stance.update(seconds, this.#ground(this.#camera.position.x, this.#camera.position.z))
    this.#camera.position.y = this.#stance.eye

    const input = this.input
    if (!input.forward && !input.strafe) return

    const delta = step(input, this.#yaw, seconds, this.#stance.speedScale)
    const moved = slide(this.position, delta, this.#solid)
    this.#camera.position.x = moved.x
    this.#camera.position.z = moved.z
  }

  #down_(code: string): boolean {
    return this.#held.has(code)
  }

  #look = (event: MouseEvent): void => {
    if (document.pointerLockElement !== this.#element) return
    const speed = LOOK_SPEED * this.#zoom.lookScale
    this.#yaw -= event.movementX * speed
    this.#pitch = clamp(this.#pitch - event.movementY * speed, -PITCH_LIMIT, PITCH_LIMIT)
    this.#apply()
  }

  #press = (event: MouseEvent): void => {
    if (event.button === 2 && !this.#typing) this.#zoom.close = true
  }

  #release = (event: MouseEvent): void => {
    if (event.button === 2) this.#zoom.close = false
  }

  #down = (event: KeyboardEvent): void => {
    // the walk keys are bound on the document, so a text box anywhere on the
    // page has them first: without this, a space in the panel's theme box is
    // swallowed as a jump and never reaches the word being typed
    if (this.#typing || typingSomewhere()) return
    if (event.code === 'Space') {
      event.preventDefault()
      this.#stance.jump()
    }
    this.#held.add(event.code)
  }

  #up = (event: KeyboardEvent): void => {
    this.#held.delete(event.code)
  }

  #apply(): void {
    this.#camera.rotation.set(this.#pitch, this.#yaw, this.#riding?.roll ?? 0, 'YXZ')
  }
}

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value))
}
