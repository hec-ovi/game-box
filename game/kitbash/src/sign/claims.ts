import type { FaceId } from '../compose/faces.ts'

/** A patch of one wall: `along` metres right of the wall's middle and `up` from the pavement, both at its centre. */
export interface Patch {
  readonly along: number
  readonly up: number
  readonly width: number
  readonly height: number
}

/** Air kept between two things on one wall. */
const CLEARANCE = 0.12

/**
 * What every wall of a building has already given away. A sign claims the
 * patch it stands on before it is drawn, and a later one that lands on a held
 * patch is not drawn, so two lit things can never be drawn through each other
 * however the draws fall.
 */
export class WallClaims {
  readonly #held = new Map<FaceId, Patch[]>()

  /** Takes the patch if nothing holds it: true when it is now claimed. */
  take(wall: FaceId, patch: Patch): boolean {
    const held = this.#held.get(wall) ?? []
    if (held.some((other) => touches(other, patch))) return false
    held.push(patch)
    this.#held.set(wall, held)
    return true
  }
}

function touches(a: Patch, b: Patch): boolean {
  return Math.abs(a.along - b.along) < (a.width + b.width) / 2 + CLEARANCE
    && Math.abs(a.up - b.up) < (a.height + b.height) / 2 + CLEARANCE
}
