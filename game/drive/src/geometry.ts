import { METRICS } from '@gb/world'
import type { DriveSolid, Point } from './ports.ts'

export const HALF_LENGTH = METRICS.vehicle.carLength / 2
export const HALF_WIDTH = METRICS.vehicle.carWidth / 2

/** Which way a car facing this heading is pointing. Nose down +Z at heading 0. */
export function forwardOf(heading: number): Point {
  return { x: Math.sin(heading), z: Math.cos(heading) }
}

/** The driver's left hand side of that heading. */
export function leftOf(heading: number): Point {
  return { x: Math.cos(heading), z: -Math.sin(heading) }
}

/** A point in the car's own frame, in metres of the world. `side` is to the left. */
export function aboard(car: Point, heading: number, side: number, along: number): Point {
  const forward = forwardOf(heading)
  const left = leftOf(heading)
  return {
    x: car.x + left.x * side + forward.x * along,
    z: car.z + left.z * side + forward.z * along,
  }
}

/**
 * Where a car's outline is tested: the four corners and the middle of each
 * side. Eight points rather than a swept shape, because what stops a car here
 * is a grid of cells two metres across and nothing smaller than the car itself
 * is ever solid.
 */
const OUTLINE: ReadonlyArray<readonly [number, number]> = [
  [HALF_WIDTH, HALF_LENGTH],
  [-HALF_WIDTH, HALF_LENGTH],
  [HALF_WIDTH, -HALF_LENGTH],
  [-HALF_WIDTH, -HALF_LENGTH],
  [0, HALF_LENGTH],
  [0, -HALF_LENGTH],
  [HALF_WIDTH, 0],
  [-HALF_WIDTH, 0],
]

/**
 * How much of a car standing here, pointing this way, is inside something
 * solid: 0 standing clear, 9 buried to the roof. A number rather than a yes or
 * no, because a car that somehow ends up half inside a wall has to be able to
 * tell backing out from digging in.
 */
export function buried(solid: DriveSolid, x: number, z: number, heading: number): number {
  const forward = forwardOf(heading)
  const left = leftOf(heading)
  let count = solid(x, z) ? 1 : 0
  for (const [side, along] of OUTLINE) {
    if (solid(x + left.x * side + forward.x * along, z + left.z * side + forward.z * along)) count += 1
  }
  return count
}

/** True when a car standing here, pointing this way, is touching nothing solid. */
export function fits(solid: DriveSolid, x: number, z: number, heading: number): boolean {
  return buried(solid, x, z, heading) === 0
}

/**
 * The car as round patches a driver behind can brake against. Three of them
 * down its length rather than one big one, so a car in the near lane does not
 * read as blocking the far one as well.
 */
const PATCHES: readonly number[] = [HALF_LENGTH - HALF_WIDTH, 0, HALF_WIDTH - HALF_LENGTH]

export function patchesOf(car: Point, heading: number): { x: number; z: number; radius: number }[] {
  const forward = forwardOf(heading)
  return PATCHES.map((along) => ({
    x: car.x + forward.x * along,
    z: car.z + forward.z * along,
    radius: HALF_WIDTH,
  }))
}

export function away(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.z - b.z)
}

/** An angle difference brought back into -pi..pi, so easing takes the short way round. */
export function wrap(angle: number): number {
  return angle - Math.PI * 2 * Math.round(angle / (Math.PI * 2))
}
