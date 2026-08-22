import { METRICS } from '@gb/world'
import type { Vec2 } from './walk.ts'

export type TargetKind = 'enter' | 'leave' | 'talk' | 'take'

export interface Target {
  readonly kind: TargetKind
  /** The plot, npc or item this points at. */
  readonly id: string
  /** What the prompt says, without the key. */
  readonly label: string
  readonly at: Vec2
}

const CONE = Math.cos(Math.PI / 3)

/**
 * What the player would act on if they pressed the key: the nearest thing in
 * front of them, within reach. Distance and facing rather than a ray, because
 * everything you can act on is a place on the floor, not a surface.
 */
export function pick(from: Vec2, heading: number, targets: readonly Target[], range = METRICS.player.interactRange): Target | undefined {
  const forward = { x: -Math.sin(heading), z: -Math.cos(heading) }
  let best: { target: Target; score: number } | undefined

  for (const target of targets) {
    const dx = target.at.x - from.x
    const dz = target.at.z - from.z
    const distance = Math.hypot(dx, dz)
    if (distance > range) continue

    const facing = distance < 0.2 ? 1 : (dx * forward.x + dz * forward.z) / distance
    if (facing < CONE) continue

    const score = facing / Math.max(0.3, distance)
    if (!best || score > best.score) best = { target, score }
  }
  return best?.target
}
