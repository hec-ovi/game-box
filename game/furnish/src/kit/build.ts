import type { FurnitureProp } from '@gb/world'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { PIECES, yawOf, type PieceId } from '../catalog/pieces.ts'
import { PROP_ART, type PropArt } from '../catalog/props.ts'
import { fitScale } from './fit.ts'

/** One material's worth of one prop, ready to draw. */
export interface Part {
  readonly material: string
  readonly geometry: THREE.BufferGeometry
}

/**
 * Turns the source models into the furniture the game places: each prop turned
 * to face north, scaled into the box the room planner keeps clear for it, its
 * origin moved to the centre of its base, and everything on one material welded
 * into one mesh.
 *
 * All of that happens once, when the pack loads. Placing a chair afterwards is
 * a new `Mesh` over geometry that is already the right size and the right way
 * round.
 */
export function buildProps(pieces: ReadonlyMap<PieceId, readonly Part[]>): Map<FurnitureProp, Part[]> {
  const props = new Map<FurnitureProp, Part[]>()
  for (const [prop, art] of Object.entries(PROP_ART) as [FurnitureProp, PropArt][]) {
    const built = buildProp(art, pieces)
    if (built) props.set(prop, built)
  }
  return props
}

function buildProp(art: PropArt, pieces: ReadonlyMap<PieceId, readonly Part[]>): Part[] | undefined {
  const placed: Part[] = []
  for (const part of art.parts) {
    const source = pieces.get(part.piece)
    if (!source) return undefined
    const [x, y, z] = part.at ?? [0, 0, 0]
    for (const piece of source) {
      placed.push({ material: piece.material, geometry: piece.geometry.clone().translate(x, y, z) })
    }
  }
  if (!placed.length) return undefined

  // face north first: the box the prop has to fit is measured across its front
  const turn = new THREE.Matrix4().makeRotationY(yawOf(PIECES[art.parts[0]!.piece].front))
  for (const part of placed) part.geometry.applyMatrix4(turn)

  const size = bounds(placed).getSize(new THREE.Vector3())
  const scale = fitScale(size, art)
  const fit = new THREE.Matrix4().makeScale(scale.x, scale.y, scale.z)
  for (const part of placed) part.geometry.applyMatrix4(fit)

  // origin at the centre of the base, so placing it on the floor cannot sink it
  const box = bounds(placed)
  const centre = box.getCenter(new THREE.Vector3())
  const rebase = new THREE.Matrix4().makeTranslation(-centre.x, -box.min.y, -centre.z)
  for (const part of placed) part.geometry.applyMatrix4(rebase)

  return weld(placed)
}

/** Everything on one material as one buffer: a prop is as many draws as it has materials. */
function weld(parts: readonly Part[]): Part[] {
  const buckets = new Map<string, THREE.BufferGeometry[]>()
  for (const part of parts) {
    const bucket = buckets.get(part.material)
    if (bucket) bucket.push(part.geometry)
    else buckets.set(part.material, [part.geometry])
  }

  const welded: Part[] = []
  for (const [material, geometries] of buckets) {
    if (geometries.length === 1) {
      welded.push({ material, geometry: geometries[0]! })
      continue
    }
    const merged = mergeGeometries(geometries)
    if (!merged) throw new Error(`furnish: geometry on ${material} would not weld`)
    for (const geometry of geometries) geometry.dispose()
    welded.push({ material, geometry: merged })
  }
  return welded
}

function bounds(parts: readonly Part[]): THREE.Box3 {
  const box = new THREE.Box3()
  for (const part of parts) {
    part.geometry.computeBoundingBox()
    box.union(part.geometry.boundingBox!)
  }
  return box
}
