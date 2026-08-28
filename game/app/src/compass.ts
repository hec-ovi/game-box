import type { CompassGoal, Hud } from '@gb/hud'
import { Guide, type Way } from './guide.ts'
import { bearing, type Vec2 } from './walk.ts'

/** How often the walk to the goal is measured again while the player is moving, in seconds. */
const EVERY = 1

/** Far enough from where the walk was last measured to be worth measuring again, in metres. */
const MOVED = 2

/** A turn of the head too small to redraw the strip for, in radians. */
const STILL = 0.002

/**
 * The strip along the top: which way the player is facing and which way the
 * tracked goal is. Both move every frame. The walk through the streets is
 * asked of `@gb/nav`, which is the expensive half, so it is measured again
 * only when the player has moved, when a second has passed, or when the quests
 * changed; where it points from where the player is standing is arithmetic
 * over the walk that was measured, and that is done every frame. Measured once
 * a second, the arrow points at where the player was a stride ago, which reads
 * as the marker lagging behind them. Indoors the strip goes: a room has its own
 * metres, and the route is measured from the door.
 */
export class Compass {
  #hud: Hud
  #guide: Guide
  #heading: () => number
  #standing: () => Vec2
  #outdoors: () => boolean
  #goal: CompassGoal | undefined
  #way: Way | undefined
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
      this.#way = this.#guide.way()
      this.#measuredAt = at
      this.#since = 0
      this.#again = false
    }
    // where that walk points from where they are standing this frame
    const goal = this.#way ? Guide.pointAt(at, this.#way) : undefined
    if (!same(goal, this.#goal)) {
      this.#goal = goal
      changed = true
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

