const TWO_PI = Math.PI * 2

/**
 * The yaw a body needs for its own -Z axis, which is its front, to point along
 * a direction on the ground. It is three.js `rotation.y` straight: zero looks
 * north (-Z), the way `@gb/cast` stands somebody up and the way the player's
 * own heading works, and it grows anticlockwise seen from above, so -PI/2
 * looks east (+X) and +PI/2 looks west.
 *
 * This is the yaw that points the body along the travel vector, not the angle
 * of the travel vector: get the two mixed up and the walk cycle runs while the
 * body slides backwards.
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

/**
 * Swing an angle towards another the way a body turns rather than a turret:
 * quickly while there is a way to go, softly as it arrives, and never faster
 * than `quickest` radians a second.
 */
export function easeToward(current: number, target: number, seconds: number, ease: number, quickest: number): number {
  const delta = angleDelta(current, target)
  const room = Math.abs(delta)
  const step = Math.min(room, Math.min(room * ease, quickest) * seconds)
  return current + Math.sign(delta) * step
}

export function distance(ax: number, az: number, bx: number, bz: number): number {
  return Math.hypot(bx - ax, bz - az)
}
