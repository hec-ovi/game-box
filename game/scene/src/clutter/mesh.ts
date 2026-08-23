import * as THREE from 'three'
import { MaterialBatch } from '../batch/batch.ts'
import type { Dressing } from '../dressing.ts'
import { ClutterModels } from './models.ts'
import type { ClutterPiece } from './plan.ts'

/**
 * Every piece of rubbish in the city in one `BatchedMesh`.
 *
 * One draw, whatever the size of the city, because the models go into the
 * buffer once and every piece is an instance of one of them. Colour rides on
 * the vertices rather than on a material each, so a street of bins, sacks,
 * crates and litter is still one material. Each piece keeps its own transform
 * and its own bounds, so three culls them one at a time and submits only what
 * the frustum reaches, exactly the way the buildings work.
 */
export function clutterMesh(pieces: readonly ClutterPiece[], seed: string, dressing: Dressing): THREE.BatchedMesh | undefined {
  if (!pieces.length) return undefined

  const models = new ClutterModels(seed)
  const held = [...models.all().values()]
  const batch = new MaterialBatch('clutter', dressing.clutter?.() ?? clutterMaterial(), {
    instances: pieces.length,
    vertices: held.reduce((total, one) => total + one.getAttribute('position').count, 0),
    indices: held.reduce((total, one) => total + (one.getIndex()?.count ?? 0), 0),
  })
  batch.mesh.castShadow = false
  batch.mesh.receiveShadow = true

  const ids = new Map<string, number>()
  const at = new THREE.Matrix4()
  const turn = new THREE.Quaternion()
  const up = new THREE.Vector3(0, 1, 0)
  const one = new THREE.Vector3(1, 1, 1)

  for (const piece of pieces) {
    const key = `${piece.kind}:${piece.variant}`
    let geometry = ids.get(key)
    if (geometry === undefined) {
      geometry = batch.hold(models.geometry(piece.kind, piece.variant))
      ids.set(key, geometry)
    }
    turn.setFromAxisAngle(up, piece.rot)
    at.compose(new THREE.Vector3(piece.x, piece.y, piece.z), turn, one)
    batch.place(geometry, at)
  }

  batch.remeasure()
  return batch.mesh
}

/** What rubbish looks like when a dressing has not said otherwise: dull, dark and unlit by itself. */
export function clutterMaterial(): THREE.Material {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86, metalness: 0.06 })
  material.name = 'clutter'
  return material
}
