import { BALCONY } from '../src/balcony.ts'
import { heightOf, type Bucket } from '../src/bucket.ts'
import { BASE_TILE, baseFinish } from '../src/wall.ts'
import { FACADE } from '../src/windows.ts'
import type { Layers } from './layers.ts'
import type { Look } from './look.ts'
import { box, type Piece } from './pieces.ts'
import { stackFor } from './stack.ts'

/**
 * The balconies a look carries, generated from its own numbers and stood on
 * the model after the producer has drawn it.
 *
 * They are not composed through the producer, because a band anything is
 * composed on loses its window grid for the whole storey, and a balcony with a
 * blank wall behind it is a shelf. So the wall stays the windowed wall and the
 * balcony is four boxes in front of it: a slab in the look's own wall picture,
 * a balustrade across the front and a rail down either side in the balustrade
 * picture. One per upper storey, on the street face, centred on a bay so the
 * window behind it is the one you would step out of.
 *
 * How far it reaches is `BALCONY.reach`, which is the one place the pack is
 * allowed past its plot by more than a tube's relief.
 */

/** Metres the producer's own bay is, which is how the shader's bays fall along a face. */
const BAY = 12 / FACADE.grid.across

/** The slab, the balustrade and how far both bite into the wall so no two faces share a plane. */
const SLAB = 0.15
const RAIL = 0.08
const BITE = 0.03

/** Metres of balustrade picture one repeat covers along a rail: what the producer draws it at. */
const GUARD_TILE = 2

export function balconyPieces(look: Look, bucket: Bucket, layers: Layers): Piece[] {
  if (!look.balcony) return []
  const stack = stackFor(bucket.storeys)
  const guard = layers.at(BALCONY.finish)
  const slab = layers.at(baseFinish(look.facade))
  const pieces: Piece[] = []

  const floors: Array<{ y: number; face: number; setback: number }> = []
  for (let floor = 0; floor < stack.bodyFloors; floor++) floors.push({ y: stack.ground + floor * stack.bodyFloor, face: bucket.front, setback: 0 })
  if (stack.crown >= stack.bodyFloor) floors.push({ y: heightOf(bucket.storeys) - stack.crown, face: bucket.front - (look.setback ?? 0) * 2, setback: look.setback ?? 0 })

  for (const { y, face, setback } of floors) {
    // centred on the middle bay, or the one left of centre, of the face's own bays
    const bays = Math.max(1, Math.round(face / BAY))
    const centre = -face / 2 + (Math.floor((bays - 1) / 2) + 0.5) * (face / bays)
    const left = centre - look.balcony.wide / 2
    const right = centre + look.balcony.wide / 2
    const wall = bucket.depth / 2 - setback
    const out = wall + look.balcony.deep
    const floor = y + SLAB
    const top = floor + look.balcony.guard

    pieces.push(box([left, y, wall - BITE], [right, floor, out], slab, BASE_TILE))
    pieces.push(box([left, floor, out - RAIL], [right, top, out], guard, GUARD_TILE))
    pieces.push(box([left, floor, wall - BITE], [left + RAIL, top, out], guard, GUARD_TILE))
    pieces.push(box([right - RAIL, floor, wall - BITE], [right, top, out], guard, GUARD_TILE))
  }
  return pieces
}
