import { METRICS } from '@gb/world'
import { SOLID } from './glyphs.ts'
import { DOORLIGHT } from './palette.ts'
import type { Panel } from './place.ts'

/** The lamp at the door: a thin warm line either side of the frame, no taller than the door. */
export const DOORLAMP = {
  /** How wide the lit line is. */
  width: 0.05,
  /** Where it starts above the pavement. */
  foot: 0.35,
  /** How far past the door head it reaches. */
  overhead: 0.15,
  /** How far outside the door's edge it stands. */
  beside: 0.22,
} as const

/** Two lamps, one each side of the door at `doorAlong`, sized off the door itself. */
export function doorLamps(doorAlong: number): Panel[] {
  const { doorHeight, doorWidth } = METRICS.building
  const top = doorHeight + DOORLAMP.overhead
  const height = top - DOORLAMP.foot
  const glyphs = [{ cell: SOLID, u: 0, v: 0, width: DOORLAMP.width, height }]
  return [-1, 1].map((side) => ({
    kind: 'doorlamp' as const,
    mount: 'flat' as const,
    along: doorAlong + side * (doorWidth / 2 + DOORLAMP.beside),
    up: (top + DOORLAMP.foot) / 2,
    width: DOORLAMP.width,
    height,
    ink: DOORLIGHT.ink,
    panel: 0x08090c,
    glow: [DOORLIGHT.glow, 0],
    glyphs,
  }))
}
