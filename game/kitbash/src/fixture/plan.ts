import type { Plot } from '@gb/world'
import type { PlotCharter } from '../charter.ts'
import type { Face } from '../compose/faces.ts'
import type { WallClaims } from '../sign/claims.ts'
import { planCamera, type CameraMount } from './camera/plan.ts'
import { planSubway, type SubwayEntrance } from './subway/plan.ts'

/** What a building carries that is drawn from code: a subway entrance on a station's doorstep, a camera over a private door. */
export interface Fixtures {
  readonly subway?: SubwayEntrance
  readonly cameras: readonly CameraMount[]
}

/**
 * Which fixtures a plot gets is read off its charter: `transit: subway` puts
 * the entrance on its doorstep, `access: private` a camera over its door.
 * Nothing here draws a number, so the fixtures of a city cannot move between
 * runs and adding one later cannot move a sign that is already up.
 */
export function planFixtures(plot: Plot, charter: PlotCharter, front: Face, doorAlong: number, cellSize: number, claims: WallClaims): Fixtures {
  const camera = charter.access === 'private' ? planCamera(front, doorAlong, claims) : undefined
  return {
    ...(charter.transit === 'subway' ? { subway: planSubway(plot, front, cellSize) } : {}),
    cameras: camera ? [camera] : [],
  }
}
