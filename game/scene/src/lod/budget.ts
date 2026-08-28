/**
 * How long a frame may spend building the city into it, in milliseconds, while
 * the player is walking.
 *
 * A frame at 60 Hz is 16.7 ms and the renderer wants most of it, so a quarter
 * of one is what the streaming may take without the walk reading as anything.
 * It is well over the demand: measured on the metro 20 by 20 city, a 256 m ring
 * takes about a thirtieth of a building a frame at walking pace, and a shell of
 * that town is a fifth of a millisecond.
 */
export const STREAM_BUDGET = 4

/**
 * The same while the player is standing still, in milliseconds.
 *
 * Nobody is walking into the buildings that are not up yet, and the backlog is
 * cheaper to clear where a dropped frame costs a still picture rather than a
 * step. Three times the walking budget clears a tall one in two frames instead
 * of six.
 */
export const STANDING_BUDGET = 12

/**
 * The most overrun the streaming carries forward, in milliseconds.
 *
 * A build cannot be stopped halfway, so a frame that starts one inside its
 * budget can still finish it outside: what it went over by is charged to the
 * frames after it, which build nothing until it is paid off. The cap is what
 * stops a street of dear buildings from stopping the streaming for a second on
 * a debt no frame ever clears; past it, the overrun is written off.
 */
export const STREAM_DEBT = 48

/** How far the player has to move for the frame to count as a walking one, in metres. */
const MOVED = 0.01

/** What a ring may spend on one frame. */
export interface Budget {
  /** Whether there is anything left to start another build with. */
  readonly spends: boolean
  /** Charges one build to the frame, and carries what it went over by. */
  spend(ms: number): void
}

/** The whole backlog on one frame: what a city opening behind a loader wants, and what a test wants. */
export const WHOLE: Budget = { spends: true, spend: () => {} }

/**
 * The frame's share of the streaming, and what the last frames overran it by.
 *
 * Counting buildings does not bound a frame, because one building is not one
 * cost: on the town the game builds, a shell out of the pack is a fifth of a
 * millisecond and a tall plot the pack has no shape for is tens. So the ring
 * spends time rather than turns, stops as soon as the frame's share is gone,
 * and hands the overrun to the frames after it.
 */
export class StreamBudget implements Budget {
  #left = 0
  #debt = 0
  #was: { x: number; z: number } | undefined

  /** Opens the frame at that place: it pays what is owed first, and builds with whatever is left over. */
  open(x: number, z: number): void {
    const allowed = this.#moving(x, z) ? STREAM_BUDGET : STANDING_BUDGET
    const paid = Math.min(this.#debt, allowed)
    this.#debt -= paid
    this.#left = allowed - paid
  }

  get spends(): boolean {
    return this.#left > 0
  }

  spend(ms: number): void {
    const over = ms - this.#left
    this.#left = Math.max(0, this.#left - ms)
    if (over > 0) this.#debt = Math.min(STREAM_DEBT, this.#debt + over)
  }

  #moving(x: number, z: number): boolean {
    const was = this.#was
    this.#was = { x, z }
    if (!was) return true
    return Math.abs(x - was.x) > MOVED || Math.abs(z - was.z) > MOVED
  }
}
