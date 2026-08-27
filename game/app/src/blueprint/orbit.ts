import type { Patch } from './plan.ts'

/** A point in city metres. */
export interface Point {
  readonly x: number
  readonly y: number
  readonly z: number
}

/** Radians per pixel dragged. A quarter turn is about a third of a screen. */
const TURN = 0.006
/** How much one notch of the wheel multiplies the distance by. */
const NOTCH = 0.18
/** How near the ground the camera may swing, and how far over the town it may lean back. */
const PITCH = { low: 0.12, high: 1.53 }

/** The flattest the ground is treated as being when a drag is measured across it, so a grazing view does not fly. */
const GRAZING = 0.3
/** The nearest a rooftop may be looked at, in metres. */
const NEAREST = 30
/** How much further out than the framed town the wheel may pull back. */
const FURTHEST = 2.2
/** How far past the edge of town the middle of the view may be pushed, as a share of the town. */
const ROAM = 0.6

/** How near the camera comes when it is put onto one thing, as a share of the framed town. */
const ONTO = 0.28

/**
 * The camera you look at a city with: it always points at somewhere on the
 * ground, and you turn round that point, pull towards it or push it about.
 * There is no walking in it and no way to end up inside a building.
 *
 * The maths is here and nothing else is, so how the view moves can be read and
 * tested without a renderer in the room.
 */
export class Orbit {
  #yaw = 0.62
  #pitch = 0.66
  #distance = 400
  #target = { x: 0, y: 0, z: 0 }
  #framed = 400
  #ground: Patch = { x: 0, z: 0, w: 0, d: 0 }

  /**
   * The whole town in the view, looked at from the south east. `room` is how
   * much of the view the town may fill along each axis, so it lands inside the
   * clear middle rather than under the header, the foot or the zone list.
   */
  frame(ground: Patch, fov: number, aspect: number, room: { x: number; y: number }): void {
    this.#ground = ground
    this.#target = { x: ground.x + ground.w / 2, y: 0, z: ground.z + ground.d / 2 }
    const radius = Math.hypot(ground.w, ground.d) / 2
    const half = Math.tan((fov * Math.PI) / 360)
    const vertical = Math.atan(half * Math.max(room.y, 0.1))
    const horizontal = Math.atan(half * Math.max(aspect, 0.2) * Math.max(room.x, 0.1))
    this.#framed = Math.max(radius / Math.tan(vertical), radius / Math.tan(horizontal), NEAREST)
    this.#distance = this.#framed
    this.#yaw = 0.62
    this.#pitch = 0.66
  }

  /** Dragging turns the view round the point it is looking at. */
  turn(dx: number, dy: number): void {
    this.#yaw -= dx * TURN
    this.#pitch = clamp(this.#pitch + dy * TURN, PITCH.low, PITCH.high)
  }

  /** The wheel pulls the camera in towards what it is looking at and pushes it back out. */
  pull(notches: number): void {
    this.#distance = clamp(this.#distance * Math.exp(notches * NOTCH), NEAREST, this.#framed * FURTHEST)
  }

  /**
   * Dragging with the other button slides what the camera is looking at across
   * the ground, and never so far that the town is off the screen.
   *
   * The ground follows the pointer: whatever is under it stays under it, so the
   * camera goes the other way. Across the screen that is a pixel of drag to a
   * pixel of city; down the screen the ground is seen at an angle, so a pixel
   * covers more of it the flatter the camera is looking.
   */
  pan(dx: number, dy: number, viewHeight: number, fov: number): void {
    const perPixel = (2 * this.#distance * Math.tan((fov * Math.PI) / 360)) / Math.max(viewHeight, 1)
    const alongGround = perPixel / Math.max(Math.sin(this.#pitch), GRAZING)
    const sin = Math.sin(this.#yaw)
    const cos = Math.cos(this.#yaw)
    // right is across the screen, forward is into it along the ground
    const x = this.#target.x - dx * perPixel * cos - dy * alongGround * sin
    const z = this.#target.z + dx * perPixel * sin - dy * alongGround * cos
    const roamX = this.#ground.w * ROAM
    const roamZ = this.#ground.d * ROAM
    this.#target = {
      x: clamp(x, this.#ground.x - roamX, this.#ground.x + this.#ground.w + roamX),
      y: 0,
      z: clamp(z, this.#ground.z - roamZ, this.#ground.z + this.#ground.d + roamZ),
    }
  }

  /**
   * Put the camera onto one thing: it looks at that spot on the ground and
   * comes in to read it. The way round it is standing is kept, because a view
   * that spins as well as travels leaves the player working out where they are.
   */
  look(at: { readonly x: number; readonly z: number }): void {
    this.#target = { x: at.x, y: 0, z: at.z }
    this.#distance = clamp(Math.min(this.#distance, this.#framed * ONTO), NEAREST, this.#framed * FURTHEST)
  }

  /** How far in the view is: 1 is the whole town framed, and it climbs as the camera comes in. */
  get zoom(): number {
    return this.#framed / Math.max(this.#distance, 1)
  }

  /** Where the camera stands. */
  get eye(): Point {
    const flat = Math.cos(this.#pitch) * this.#distance
    return {
      x: this.#target.x + Math.sin(this.#yaw) * flat,
      y: this.#target.y + Math.sin(this.#pitch) * this.#distance,
      z: this.#target.z + Math.cos(this.#yaw) * flat,
    }
  }

  /** What it is pointed at. */
  get target(): Point {
    return this.#target
  }

  /** How far out it is, which is what the far plane has to clear. */
  get distance(): number {
    return this.#distance
  }
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high)
}
