import type { CompassGoal } from '@gb/hud'
import type { Point } from '@gb/nav'
import type { QuestKind } from '@gb/quest'
import type { Vec2 } from './walk.ts'

/**
 * A walk through the streets, kept while the player walks it: the corners
 * `@gb/nav` found, and where along them they have got to.
 *
 * Finding the corners is the expensive half and it holds for as long as the
 * player is walking them; reading the walk off them is arithmetic, so it is
 * done every frame. That is why the whole route is kept rather than its next
 * corner alone: a corner is dropped as the player walks past it, the bearing is
 * always a corner still ahead of them, and the distance is the metres of route
 * left. Held to one fixed corner, walking past it turned the arrow round to
 * point back at it and sent the distance climbing while the player was closing
 * on the goal.
 *
 * A route has at least one corner, and the first is where it was measured from.
 */
export class Route {
  readonly label: string
  readonly line: QuestKind | undefined
  readonly #corners: readonly Point[]
  /** Metres of route left from each corner to the goal. */
  readonly #left: readonly number[]
  /** The corner the player is walking towards. */
  #next: number

  constructor(input: { label: string; corners: readonly Point[]; line?: QuestKind }) {
    this.label = input.label
    this.line = input.line
    this.#corners = input.corners
    this.#left = legsLeft(input.corners)
    // the walk starts where the player was standing, so the corner to head for
    // is the one after it
    this.#next = Math.min(1, input.corners.length - 1)
  }

  /** Walk it: drop every corner the player has already gone past. */
  follow(from: Vec2): void {
    while (this.#next < this.#corners.length - 1 && this.#walkedPast(from, this.#next)) this.#next++
  }

  /** Which way to set off and how far is left, from where the player is standing now. */
  goalFrom(from: Vec2): CompassGoal {
    const corner = this.#corners[this.#next]!
    return {
      label: this.label,
      bearing: bearingOf(from, corner),
      distance: gap(from, corner) + this.#left[this.#next]!,
      ...(this.line ? { line: this.line } : {}),
    }
  }

  /** How far the player is from the stretch of street they are walking, in metres. */
  offBy(from: Vec2): number {
    const corner = this.#corners[this.#next]!
    const behind = this.#corners[this.#next - 1]
    return behind ? awayFrom(from, behind, corner) : gap(from, corner)
  }

  /**
   * Whether the whole of the leg into that corner is behind them. Measured
   * along the leg they walked rather than along the one that follows it, so
   * somebody who wandered sideways is off the route (which is what `offBy`
   * answers) rather than counted as having turned the corner.
   */
  #walkedPast(from: Vec2, next: number): boolean {
    const corner = this.#corners[next]!
    const behind = this.#corners[next - 1]!
    const leg = { x: corner.x - behind.x, z: corner.z - behind.z }
    const walked = (from.x - behind.x) * leg.x + (from.z - behind.z) * leg.z
    return walked >= leg.x * leg.x + leg.z * leg.z
  }
}

/** How far a walk is, corner to corner, in metres. */
export function walkLength(walk: readonly Point[]): number {
  return legsLeft(walk)[0] ?? 0
}

/** Metres left to the end of the walk from each of its corners. */
function legsLeft(walk: readonly Point[]): number[] {
  const left = new Array<number>(walk.length).fill(0)
  for (let i = walk.length - 2; i >= 0; i--) left[i] = left[i + 1]! + gap(walk[i]!, walk[i + 1]!)
  return left
}

function gap(from: Vec2, to: Vec2): number {
  return Math.hypot(to.x - from.x, to.z - from.z)
}

/** How far a spot is from a stretch of street, in metres. */
function awayFrom(from: Vec2, start: Vec2, end: Vec2): number {
  const leg = { x: end.x - start.x, z: end.z - start.z }
  const square = leg.x * leg.x + leg.z * leg.z
  if (square === 0) return gap(from, start)
  const along = Math.min(1, Math.max(0, ((from.x - start.x) * leg.x + (from.z - start.z) * leg.z) / square))
  return gap(from, { x: start.x + leg.x * along, z: start.z + leg.z * along })
}

/** Which way one spot is from another, in radians clockwise from north, in one turn. */
function bearingOf(from: Vec2, to: Vec2): number {
  const turn = Math.PI * 2
  const bearing = Math.atan2(to.x - from.x, -(to.z - from.z))
  return ((bearing % turn) + turn) % turn
}
