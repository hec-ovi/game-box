import { Forge, OfflineNarrator } from '@gb/forge'
import type { Interior, World } from '@gb/world'
import * as THREE from 'three'

export function meshesOf(object: THREE.Object3D): THREE.Mesh[] {
  const found: THREE.Mesh[] = []
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) found.push(child)
  })
  return found
}

export function boundsOf(object: THREE.Object3D): THREE.Box3 {
  return new THREE.Box3().setFromObject(object)
}

export function sizeOf(object: THREE.Object3D): THREE.Vector3 {
  return boundsOf(object).getSize(new THREE.Vector3())
}

export function trianglesOf(object: THREE.Object3D): number {
  return meshesOf(object).reduce((total, mesh) => total + (mesh.geometry.getIndex()?.count ?? 0) / 3, 0)
}

/**
 * Where the upper half of a piece sits, front to back. A chair, a sofa and a
 * bed all carry their weight up there behind the middle: the backrest, the
 * headboard. Positive is behind a prop that faces north.
 */
export function backwardsMass(object: THREE.Object3D): number {
  const bounds = boundsOf(object)
  const above = bounds.min.y + 0.55 * (bounds.max.y - bounds.min.y)
  let count = 0
  let z = 0
  for (const mesh of meshesOf(object)) {
    const position = mesh.geometry.getAttribute('position')
    for (let vertex = 0; vertex < position.count; vertex++) {
      if (position.getY(vertex) <= above) continue
      count += 1
      z += position.getZ(vertex)
    }
  }
  return count ? z / count : 0
}

/** A town with a bar in it, built the way the game builds one. */
export async function town(seed = 'furnish'): Promise<World> {
  const built = await new Forge(new OfflineNarrator(seed)).build({
    theme: 'old harbour town',
    seed,
    blocksX: 1,
    blocksY: 1,
    blockCells: 14,
  })
  if (!built.ok) throw new Error(JSON.stringify(built.error).slice(0, 400))
  return built.value.world
}

/** The busiest interior in a town: the most furniture in one room. */
export function busiest(world: World): Interior {
  const interiors = [...world.interiors()].sort((a, b) => b.furniture.length - a.furniture.length)
  const found = interiors[0]
  if (!found) throw new Error('the town has no interiors')
  return found
}
