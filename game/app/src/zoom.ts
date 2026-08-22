/**
 * Holding the right button narrows the view, the way leaning in to look at
 * something does. The mouse slows with it, so the same hand movement covers the
 * same distance on screen however far in you are.
 */
export const WIDE_FOV = 75
export const CLOSE_FOV = 55
/** Seconds to go all the way in or all the way out. */
const TRAVEL = 0.18

export class Zoom {
  #fov = WIDE_FOV
  #wanted = WIDE_FOV

  /** Hold to look closer, release to come back. */
  set close(closer: boolean) {
    this.#wanted = closer ? CLOSE_FOV : WIDE_FOV
  }

  get close(): boolean {
    return this.#wanted === CLOSE_FOV
  }

  get fov(): number {
    return this.#fov
  }

  /** How much slower the mouse should be at this much zoom. */
  get lookScale(): number {
    return Math.tan(degToRad(this.#fov) / 2) / Math.tan(degToRad(WIDE_FOV) / 2)
  }

  /** True when the field of view actually moved, so the camera only updates then. */
  update(seconds: number): boolean {
    if (this.#fov === this.#wanted) return false
    const step = ((WIDE_FOV - CLOSE_FOV) / TRAVEL) * seconds
    const gap = this.#wanted - this.#fov
    this.#fov = Math.abs(gap) <= step ? this.#wanted : this.#fov + Math.sign(gap) * step
    return true
  }
}

function degToRad(degrees: number): number {
  return (degrees * Math.PI) / 180
}
