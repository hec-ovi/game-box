const TWO_PI = Math.PI * 2

/**
 * The yaw that looks along a direction on the ground. Zero faces north (-Z),
 * which is the way `@gb/cast` spawns a body, and yaw grows towards east (+X).
 */
export function headingOf(dx: number, dz: number): number {
  return Math.atan2(-dx, -dz)
}

/** The shortest way round from one angle to another, in (-PI, PI]. */
export function angleDelta(from: number, to: number): number {
  let d = (to - from) % TWO_PI
  if (d > Math.PI) d -= TWO_PI
  if (d <= -Math.PI) d += TWO_PI
  return d
}

/** Swing an angle towards another by at most `maxStep`. */
export function turnToward(current: number, target: number, maxStep: number): number {
  const delta = angleDelta(current, target)
  if (Math.abs(delta) <= maxStep) return target
  return current + Math.sign(delta) * maxStep
}

export function distance(ax: number, az: number, bx: number, bz: number): number {
  return Math.hypot(bx - ax, bz - az)
}
