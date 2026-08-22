import { METRICS } from '@gb/world'

export interface Vec2 {
  readonly x: number
  readonly z: number
}

/** Says whether a point in metres is inside something you cannot walk through. */
export type Solid = (x: number, z: number) => boolean

/**
 * Moving a body of some radius through solid ground, one axis at a time so a
 * wall you walk into slides you along it instead of stopping you dead. No
 * physics engine: what is solid comes from the grid the city was generated on,
 * and from the walls of whatever room you are standing in.
 */
export function slide(from: Vec2, delta: Vec2, solid: Solid, radius = METRICS.player.radius): Vec2 {
  let { x, z } = from
  const tryX = x + delta.x
  if (!blocked(tryX, z, solid, radius)) x = tryX
  const tryZ = z + delta.z
  if (!blocked(x, tryZ, solid, radius)) z = tryZ
  return { x, z }
}

/** A body is blocked if its centre or any of its four sides is in something solid. */
export function blocked(x: number, z: number, solid: Solid, radius = METRICS.player.radius): boolean {
  return (
    solid(x, z) ||
    solid(x + radius, z) ||
    solid(x - radius, z) ||
    solid(x, z + radius) ||
    solid(x, z - radius)
  )
}

/** How far the body moves this frame, from what is held down and where it is looking. */
export function step(
  input: { forward: number; strafe: number; running: boolean },
  heading: number,
  seconds: number,
  scale = 1,
): Vec2 {
  const length = Math.hypot(input.forward, input.strafe)
  if (length === 0) return { x: 0, z: 0 }

  const speed = (input.running ? METRICS.player.runSpeed : METRICS.player.walkSpeed) * seconds * scale
  const forward = (input.forward / length) * speed
  const strafe = (input.strafe / length) * speed

  // heading is the yaw in radians: 0 looks down -z, the way three.js cameras do
  return {
    x: forward * -Math.sin(heading) + strafe * Math.cos(heading),
    z: forward * -Math.cos(heading) - strafe * Math.sin(heading),
  }
}
