import { METRICS } from '@gb/world'
import type { Face, FaceId } from '../../compose/faces.ts'
import type { Patch, WallClaims } from '../../sign/claims.ts'
import { DOORLAMP } from '../../sign/doorlamp.ts'
import { within } from '../../sign/place.ts'
import type { Standing } from '../fixture.ts'
import { CAMERA } from './design.ts'

/** Where a camera hangs: the wall, and the point on it the bracket comes out of. */
export interface CameraMount extends Standing {
  readonly wall: FaceId
}

/**
 * A camera watching the door of a private place: beside the door head, past
 * the lamp on the frame, and over the door when neither side has room. It
 * claims its patch of wall like a sign does, so nothing is hung through it,
 * and a front with no room for it carries none.
 */
export function planCamera(front: Face, doorAlong: number, claims: WallClaims): CameraMount | undefined {
  const { doorHeight, doorWidth } = METRICS.building
  const up = doorHeight + CAMERA.over
  const beside = doorWidth / 2 + DOORLAMP.beside + CAMERA.beside
  const spots = [doorAlong + beside, doorAlong - beside, doorAlong].map((along) => within(front, along, CAMERA.claim))

  for (const along of spots) {
    const patch: Patch = { along, up, width: CAMERA.claim, height: CAMERA.claim }
    if (!claims.take(front.id, patch)) continue
    return {
      wall: front.id,
      position: [front.origin[0] + front.right[0] * along, up, front.origin[1] + front.right[1] * along],
      rotationY: front.rotationY,
    }
  }
  return undefined
}
