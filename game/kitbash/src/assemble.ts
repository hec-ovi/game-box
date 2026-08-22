import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { PieceId } from './catalog/pieces.ts'
import type { Placement } from './build/plan.ts'
import { KitUnmergeable } from './kit/error.ts'
import type { KitLibrary } from './kit/library.ts'

/** Everything on one material, and which pieces put it there. */
interface Bucket {
  readonly geometries: THREE.BufferGeometry[]
  readonly pieces: Set<PieceId>
}

/**
 * Bakes a plan into one object. Every piece that shares a material is welded
 * into a single mesh, so a building of two hundred kit pieces costs as many
 * draws as the kit has materials on it, not as many as it has pieces.
 */
export function assemble(placements: readonly Placement[], library: KitLibrary, name: string): THREE.Group {
  const buckets = new Map<string, Bucket>()
  const matrix = new THREE.Matrix4()
  const quaternion = new THREE.Quaternion()
  const axis = new THREE.Vector3(0, 1, 0)
  const position = new THREE.Vector3()
  const scale = new THREE.Vector3()

  for (const placement of placements) {
    matrix.compose(
      position.set(placement.position[0], placement.position[1], placement.position[2]),
      quaternion.setFromAxisAngle(axis, placement.rotationY),
      scale.set(placement.scale[0], placement.scale[1], placement.scale[2]),
    )
    for (const part of library.parts(placement.piece)) {
      const geometry = part.geometry.clone().applyMatrix4(matrix)
      const bucket = buckets.get(part.material)
      if (bucket) {
        bucket.geometries.push(geometry)
        bucket.pieces.add(placement.piece)
      } else {
        buckets.set(part.material, { geometries: [geometry], pieces: new Set([placement.piece]) })
      }
    }
  }

  const group = new THREE.Group()
  group.name = name
  for (const [material, bucket] of buckets) {
    const mesh = new THREE.Mesh(weld(material, bucket), library.material(material))
    mesh.name = `${name}:${material}`
    mesh.castShadow = true
    mesh.receiveShadow = true
    group.add(mesh)
  }
  return group
}

/** One material's share of the building, as one buffer. */
function weld(material: string, bucket: Bucket): THREE.BufferGeometry {
  const { geometries } = bucket
  if (geometries.length === 1) return geometries[0]!

  const merged = mergeGeometries(geometries)
  if (!merged) throw new KitUnmergeable(material, [...bucket.pieces])
  for (const geometry of geometries) geometry.dispose()
  return merged
}
