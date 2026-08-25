import * as THREE from 'three'
import type { CityBuild } from '../src/index.ts'

/**
 * What a camera would really draw of a city, and what it can reach.
 *
 * A ray cannot answer this. `THREE.Raycaster` never consults a frustum, and a
 * `THREE.BatchedMesh` culls each of its instances against that instance's own
 * bounds before it puts it in the draw, so every building in a batch can be
 * culled off the screen while a ray still hits all of them. So the two culls
 * three itself runs are run here: the scene-wide one on the batch, and the
 * per-instance one the batch does in `onBeforeRender`, read back out of the
 * draw order it leaves behind.
 */

interface Batch extends THREE.BatchedMesh {
  _multiDrawCount: number
  _indirectTexture: { image: { data: ArrayLike<number> } }
}

/** A camera at eye height on that spot, turned that way. */
export function looking(x: number, z: number, yaw: number, pitch = 0): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 600)
  camera.rotation.order = 'YXZ'
  camera.position.set(x, 1.7, z)
  camera.rotation.set(pitch, yaw, 0)
  camera.updateMatrixWorld(true)
  camera.updateProjectionMatrix()
  return camera
}

export function frustumOf(camera: THREE.PerspectiveCamera): THREE.Frustum {
  return new THREE.Frustum().setFromProjectionMatrix(
    new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse),
    camera.coordinateSystem,
  )
}

/** The plots whose box that camera reaches at all, occluded or not. */
export function inView(city: CityBuild, camera: THREE.PerspectiveCamera): string[] {
  const frustum = frustumOf(camera)
  const reached: string[] = []
  for (const [plotId, building] of city.buildings) {
    if (building.bounds.isEmpty()) continue
    if (frustum.intersectsBox(building.bounds)) reached.push(plotId)
  }
  return reached
}

/** The plots that camera would put in a draw, through every cull three runs. */
export function drawn(city: CityBuild, camera: THREE.PerspectiveCamera): Set<string> {
  city.root.updateMatrixWorld(true)
  const frustum = frustumOf(camera)
  const plots = new Set<string>()
  for (const child of city.root.children) {
    const batch = child as Batch
    if (!child.visible) continue
    if (!(batch as THREE.BatchedMesh).isBatchedMesh) {
      if (city.buildings.has(child.name) && reaches(child, frustum)) plots.add(child.name)
      continue
    }
    const names = batch.userData['plots'] as Array<string | undefined> | undefined
    if (!names) continue
    // the cull the renderer runs before it ever asks the batch to draw
    if (batch.frustumCulled && !frustum.intersectsObject(batch)) continue
    batch.onBeforeRender(null as never, null as never, camera, batch.geometry, batch.material as THREE.Material, null as never)
    const order = batch._indirectTexture.image.data
    for (let at = 0; at < batch._multiDrawCount; at++) {
      const name = names[order[at]!]
      if (name) plots.add(name)
    }
  }
  return plots
}

/** Whether anything drawable in an object a batch would not take reaches that frustum. */
function reaches(object: THREE.Object3D, frustum: THREE.Frustum): boolean {
  let seen = false
  object.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (seen || !mesh.isMesh || !mesh.visible) return
    if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere()
    if (frustum.intersectsSphere(mesh.geometry.boundingSphere!.clone().applyMatrix4(mesh.matrixWorld))) seen = true
  })
  return seen
}
