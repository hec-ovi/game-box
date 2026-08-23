import * as THREE from 'three'
import type { ContactKind } from '../catalog/props.ts'

/** How level a face has to be before a body could rest on it: within about ten degrees of flat. */
const UPWARD = 0.985

/** How much of the piece's own footprint a plate has to cover to count as a worktop. */
const WORKTOP_SHARE = 0.25

/** One level plate of a piece that looks up. */
interface Plate {
  readonly y: number
  readonly area: number
}

/**
 * Where a body meets a piece of furniture, measured off its triangles.
 *
 * The top of a chair is its backrest and the top of a bed is its headboard, so
 * a bounding box cannot answer this. What can is the set of level plates that
 * look up: a seat, a mattress, a counter top, a hob.
 *
 * - `rest` takes the widest plate. Nothing on a chair, a sofa, a stool or a bed
 *   is broader than the thing you put your weight on.
 * - `work` takes the highest plate that covers at least a quarter of the
 *   piece's own footprint. That is the worktop beside a sink rather than the
 *   bottom of its basin, and the hob rather than the splashback behind it.
 *
 * Returns nothing for a piece with no level surface on it at all.
 */
export function contactHeight(
  geometries: readonly THREE.BufferGeometry[],
  kind: ContactKind,
): number | undefined {
  const box = new THREE.Box3()
  for (const geometry of geometries) {
    geometry.computeBoundingBox()
    box.union(geometry.boundingBox!)
  }
  const plates = platesOf(geometries)
  if (!plates.length) return undefined

  if (kind === 'rest') return plates[0]!.y - box.min.y

  const footprint = (box.max.x - box.min.x) * (box.max.z - box.min.z)
  const wide = plates.filter((plate) => plate.area >= WORKTOP_SHARE * footprint)
  const highest = wide.length ? wide : plates
  return Math.max(...highest.map((plate) => plate.y)) - box.min.y
}

/** Every height a piece has level upward-looking surface at, widest first. */
function platesOf(geometries: readonly THREE.BufferGeometry[]): Plate[] {
  const areas = new Map<number, number>()
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  const one = new THREE.Vector3()
  const two = new THREE.Vector3()

  for (const geometry of geometries) {
    const position = geometry.getAttribute('position')
    const index = geometry.getIndex()
    const count = index ? index.count : position.count
    for (let at = 0; at + 2 < count; at += 3) {
      a.fromBufferAttribute(position, index ? index.getX(at) : at)
      b.fromBufferAttribute(position, index ? index.getX(at + 1) : at + 1)
      c.fromBufferAttribute(position, index ? index.getX(at + 2) : at + 2)
      const normal = one.subVectors(b, a).cross(two.subVectors(c, a))
      const area = normal.length() / 2
      if (area < 1e-7 || normal.y / (2 * area) < UPWARD) continue
      // a millimetre either way is the same plate, whatever the file's precision
      const y = Math.round(((a.y + b.y + c.y) / 3) * 1000) / 1000
      areas.set(y, (areas.get(y) ?? 0) + area)
    }
  }
  return [...areas].map(([y, area]) => ({ y, area })).sort((one, two) => two.area - one.area)
}
