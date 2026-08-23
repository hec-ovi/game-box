import { BoxGeometry, BufferAttribute, type BufferGeometry } from 'three'
import { CAR_SURFACES } from '../src/pack-layout.ts'

/**
 * The dark mass a car has under it. The source models are a shell on four
 * wheels with nothing behind the arches, so at eye level you see daylight
 * through them and the car reads as a paper cut-out. This closes the gap
 * between the wheels: a plain box, tucked inside the wheels so it is never the
 * silhouette, dark enough to read as shadow under the sills.
 */

/** Black. It is meant to read as the shadow under a car, not as a panel. */
const UNDER = 0
/** It starts here rather than at the road, so it never fights the tarmac for depth. */
const CLEARANCE = 0.02

export interface UnderbodyFit {
  /** Half the width of the wheels' inner faces: the box stops just outside it. */
  readonly halfWidth: number
  /** Front and rear axle, metres along Z. */
  readonly frontZ: number
  readonly rearZ: number
  readonly wheelRadius: number
}

export function underbody(fit: UnderbodyFit): BufferGeometry {
  const overhang = fit.wheelRadius * 1.35
  const depth = fit.frontZ - fit.rearZ + overhang * 2
  const height = fit.wheelRadius * 2 + CLEARANCE
  const box = new BoxGeometry(fit.halfWidth * 2, height, depth).toNonIndexed()
  box.translate(0, CLEARANCE + height / 2, (fit.frontZ + fit.rearZ) / 2)
  box.deleteAttribute('uv')

  const count = box.getAttribute('position').count
  const colours = new Uint8Array(count * 4)
  for (let i = 0; i < count; i++) {
    colours[i * 4] = UNDER
    colours[i * 4 + 1] = UNDER
    colours[i * 4 + 2] = UNDER
    colours[i * 4 + 3] = CAR_SURFACES.trim
  }
  box.setAttribute('color', new BufferAttribute(colours, 4, true))
  return box
}
