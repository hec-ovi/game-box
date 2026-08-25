import type { CompassGoal, Hud } from '@gb/hud'
import type { Guide } from './guide.ts'
import type { Vec2 } from './walk.ts'

/** How often the walk to the goal is measured again while the player is moving, in seconds. */
const EVERY = 1

/** Far enough from where the walk was last measured to be worth measuring again, in metres. */
const MOVED = 2

/** A turn of the head too small to redraw the strip for, in radians. */
const STILL = 0.002

/**
 * The strip along the top: which way the player is facing and which way the
 * tracked goal is. The facing is the body's own yaw and costs nothing, so it is
 * pushed whenever it moves; the goal is a walk asked of `@gb/nav`, so it is
 * measured again only when the player has moved, when a second has passed, or
 * when the quests changed. Indoors the strip goes: a room has its own metres,
 * and the route is measured from the door.
 */
export class Compass {
  #hud: Hud
  #guide: Guide
  #heading: () => number
  #standing: () => Vec2
  #outdoors: () => boolean
  #goal: CompassGoal | undefined
  #facing = Number.NaN
  #since = EVERY
  #measuredAt: Vec2 | undefined
  #again = true
  #shown = false

  constructor(input: { hud: Hud; guide: Guide; heading: () => number; standing: () => Vec2; outdoors: () => boolean }) {
    this.#hud = input.hud
    this.#guide = input.guide
    this.#heading = input.heading
    this.#standing = input.standing
    this.#outdoors = input.outdoors
  }

  /** The quests moved: whatever the goal was, it wants measuring again. */
  dirty(): void {
    this.#again = true
  }

  update(seconds: number): void {
    if (!this.#outdoors()) {
      if (this.#shown) this.#hud.show({ compass: null })
      this.#shown = false
      this.#facing = Number.NaN
      // coming back out measures the walk again from the door
      this.#again = true
      return
    }

    this.#since += seconds
    const at = this.#standing()
    const moved = !this.#measuredAt || Math.hypot(at.x - this.#measuredAt.x, at.z - this.#measuredAt.z) >= MOVED
    let changed = false
    if (this.#again || (this.#since >= EVERY && moved)) {
      const goal = this.#guide.resolve()
      changed = !same(goal, this.#goal)
      this.#goal = goal
      this.#measuredAt = at
      this.#since = 0
      this.#again = false
    }

    const facing = bearing(-this.#heading())
    if (Number.isNaN(this.#facing) || Math.abs(facing - this.#facing) > STILL) {
      this.#facing = facing
      changed = true
    }
    if (!changed) return
    this.#hud.show({ compass: { facing, ...(this.#goal ? { goal: this.#goal } : {}) } })
    this.#shown = true
  }
}

function same(a: CompassGoal | undefined, b: CompassGoal | undefined): boolean {
  if (!a || !b) return a === b
  return a.label === b.label && a.line === b.line && Math.abs(a.bearing - b.bearing) < STILL && Math.round(a.distance) === Math.round(b.distance)
}

/** Radians clockwise from north, in one turn. */
function bearing(radians: number): number {
  const turn = Math.PI * 2
  return ((radians % turn) + turn) % turn
}
