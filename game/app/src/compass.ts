import type { CompassGoal, Hud } from '@gb/hud'
import type { Guide } from './guide.ts'
import type { Route } from './route.ts'
import { bearing, type Vec2 } from './walk.ts'

/** How often the walk to the goal is asked of the streets again, in seconds. */
const EVERY = 1

/** Far enough off the walk that was found to be worth finding another, in metres. */
const STRAY = 6

/** A turn of the head too small to redraw the strip for, in radians. */
const STILL = 0.002

/**
 * The strip along the top: which way the player is facing and which way the
 * tracked goal is. Both move every frame. Finding a way through the streets is
 * `@gb/nav`'s work and the expensive half, so the whole walk is asked for on a
 * cadence: when the quests change, when the player has left the walk they were
 * given, and once a second otherwise, because a goal can move while they stand
 * still. Walking it is arithmetic and is done every frame: the corners behind
 * them are dropped, the bearing is the corner still ahead, and the distance is
 * the metres of route left, so the arrow never turns round on a corner they
 * have just gone past. Indoors the strip goes: a room has its own metres, and
 * the route is measured from the door.
 */
export class Compass {
  #hud: Hud
  #guide: Guide
  #heading: () => number
  #standing: () => Vec2
  #outdoors: () => boolean
  #goal: CompassGoal | undefined
  #route: Route | undefined
  #facing = Number.NaN
  #since = EVERY
  #again = true
  #shown = false

  constructor(input: { hud: Hud; guide: Guide; heading: () => number; standing: () => Vec2; outdoors: () => boolean }) {
    this.#hud = input.hud
    this.#guide = input.guide
    this.#heading = input.heading
    this.#standing = input.standing
    this.#outdoors = input.outdoors
  }

  /** The quests moved: whatever the goal was, it wants finding again. */
  dirty(): void {
    this.#again = true
  }

  update(seconds: number): void {
    if (!this.#outdoors()) {
      if (this.#shown) this.#hud.show({ compass: null })
      this.#shown = false
      this.#facing = Number.NaN
      // coming back out asks for the walk again, from the door
      this.#route = undefined
      this.#again = true
      return
    }

    this.#since += seconds
    const at = this.#standing()
    // walk the route they were given before anything is read off it, so the
    // corners already behind them are gone
    this.#route?.follow(at)
    if (this.#again || this.#since >= EVERY || (this.#route && this.#route.offBy(at) > STRAY)) {
      this.#route = this.#guide.way()
      this.#since = 0
      this.#again = false
    }
    // where that walk points from where they are standing this frame
    const goal = this.#route?.goalFrom(at)
    let changed = false
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
