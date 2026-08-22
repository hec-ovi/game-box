import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Placement } from './build/plan.ts'
import type { KitLibrary } from './kit/library.ts'

/**
 * Bakes a plan into one object. Every piece that shares a material is welded
 * into a single mesh, so a building of two hundred kit pieces costs as many
 * draws as the kit has materials on it, not as many as it has pieces.
 */
export function assemble(placements: readonly Placement[], library: KitLibrary, name: string): THREE.Group {
  const buckets = new Map<string, THREE.BufferGeometry[]>()
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
      if (bucket) bucket.push(geometry)
      else buckets.set(part.material, [geometry])
    }
  }

  const group = new THREE.Group()
  group.name = name
  for (const [material, geometries] of buckets) {
    const merged = geometries.length === 1 ? geometries[0]! : mergeGeometries(geometries)
    if (geometries.length > 1) for (const geometry of geometries) geometry.dispose()
    const mesh = new THREE.Mesh(merged, library.material(material))
    mesh.name = `${name}:${material}`
    mesh.castShadow = true
    mesh.receiveShadow = true
    group.add(mesh)
  }
  return group
}
