import { METRICS } from '@gb/world'

/** Eye height while crouched. Low enough to read as crouching, high enough to see. */
export const CROUCH_EYE = 1.05
/** Straight up off the ground, in metres per second. About a 0.9 m hop. */
export const JUMP_SPEED = 4.2
const GRAVITY = 9.8
/** How fast the eye slides between standing and crouching. */
const STANCE_SPEED = 6

export interface Stance {
  /** Metres above the ground the eye is right now. */
  readonly eye: number
  /** True while the feet are off the ground. */
  readonly airborne: boolean
  /** What the player moves at, given what they are doing. */
  readonly speedScale: number
}

/**
 * Standing, crouching and being in the air. Kept apart from walking because it
 * is the only part of moving that has a memory: how fast you are falling.
 */
export class Body {
  #eye: number = METRICS.player.eyeHeight
  #rise = 0
  #airborne = false
  #crouching = false

  get eye(): number {
    return this.#eye
  }

  get airborne(): boolean {
    return this.#airborne
  }

  get crouching(): boolean {
    return this.#crouching
  }

  /** Crouching is slower, and being in the air gives you less say in it. */
  get speedScale(): number {
    if (this.#crouching) return 0.45
    return this.#airborne ? 0.8 : 1
  }

  /** You cannot stand up under something, but a grid city has no low ceilings yet. */
  set crouching(down: boolean) {
    this.#crouching = down
  }

  /** Push off, if there is ground under you and you are not folded up. */
  jump(): void {
    if (this.#airborne || this.#crouching) return
    this.#rise = JUMP_SPEED
    this.#airborne = true
  }

  /**
   * Advance a frame. `groundY` is the height of whatever the player is standing
   * over, so walking onto a kerb steps up onto it rather than through it.
   */
  update(seconds: number, groundY: number): void {
    const standing: number = groundY + (this.#crouching ? CROUCH_EYE : METRICS.player.eyeHeight)

    if (this.#airborne) {
      this.#rise -= GRAVITY * seconds
      this.#eye += this.#rise * seconds
      if (this.#eye <= standing) {
        this.#eye = standing
        this.#rise = 0
        this.#airborne = false
      }
      return
    }

    // a kerb is a step up, not a wall: ease onto it rather than snapping
    const gap = standing - this.#eye
    const step = STANCE_SPEED * seconds
    this.#eye = Math.abs(gap) <= step ? standing : this.#eye + Math.sign(gap) * step
  }
}
