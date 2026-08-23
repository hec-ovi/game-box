import { Forge, OfflineNarrator } from '@gb/forge'
import type { Interior, World } from '@gb/world'
import * as THREE from 'three'
import { FurnishDressing, furnishKit, type FurnishStyle } from '../src/index.ts'

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

/** The catalog, built once for the whole suite: every test reads the same buffers the game would. */
const kit = furnishKit()

export function dressingIn(style: FurnishStyle): FurnishDressing {
  return new FurnishDressing(kit, undefined, style)
}

/**
 * Where the surface of the upper half of a piece sits, front to back, weighted
 * by area. A chair, a sofa and a bed all carry their weight up there behind the
 * middle: the backrest, the headboard. Positive is behind a prop facing north.
 */
export function backwardsMass(object: THREE.Object3D): number {
  const bounds = boundsOf(object)
  const above = bounds.min.y + 0.55 * (bounds.max.y - bounds.min.y)
  let total = 0
  let z = 0
  for (const mesh of meshesOf(object)) {
    const position = mesh.geometry.getAttribute('position')
    const index = mesh.geometry.getIndex()!
    for (let at = 0; at + 2 < index.count; at += 3) {
      const corners = [0, 1, 2].map((offset) =>
        new THREE.Vector3().fromBufferAttribute(position, index.getX(at + offset)),
      ) as [THREE.Vector3, THREE.Vector3, THREE.Vector3]
      const middle = corners[0].clone().add(corners[1]).add(corners[2]).divideScalar(3)
      if (middle.y <= above) continue
      const area =
        new THREE.Vector3()
          .subVectors(corners[1], corners[0])
          .cross(new THREE.Vector3().subVectors(corners[2], corners[0]))
          .length() / 2
      total += area
      z += area * middle.z
    }
  }
  return total ? z / total : 0
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

/** One level upward-looking surface of a built prop: how high it is and how much of it there is. */
export interface Plate {
  readonly y: number
  readonly area: number
}

/**
 * Every height a built prop has level surface at, measured off the triangles
 * the renderer would draw. Written here rather than taken from `src/` on
 * purpose: a test that asks the box how tall its own surface is proves only
 * that it can read its own bookkeeping.
 *
 * Heights are grouped to ten microns, which is what a float32 position buffer
 * can hold, not a tolerance: the geometry was drawn to the number.
 */
export function plates(object: THREE.Object3D): Plate[] {
  const areas = new Map<number, number>()
  object.updateMatrixWorld(true)
  for (const mesh of meshesOf(object)) {
    const position = mesh.geometry.getAttribute('position')
    const index = mesh.geometry.getIndex()
    const count = index ? index.count : position.count
    for (let at = 0; at + 2 < count; at += 3) {
      const corners = [0, 1, 2].map((offset) =>
        new THREE.Vector3()
          .fromBufferAttribute(position, index ? index.getX(at + offset) : at + offset)
          .applyMatrix4(mesh.matrixWorld),
      ) as [THREE.Vector3, THREE.Vector3, THREE.Vector3]
      const normal = new THREE.Vector3()
        .subVectors(corners[1], corners[0])
        .cross(new THREE.Vector3().subVectors(corners[2], corners[0]))
      const area = normal.length() / 2
      // a face is level enough to rest on within about ten degrees of flat
      if (area < 1e-7 || normal.y / (2 * area) < 0.985) continue
      const y = Math.round(((corners[0].y + corners[1].y + corners[2].y) / 3) * 1e5) / 1e5
      areas.set(y, (areas.get(y) ?? 0) + area)
    }
  }
  return [...areas].map(([y, area]) => ({ y, area })).sort((one, two) => two.area - one.area)
}

/**
 * Where a body would meet this prop, read off the drawn triangles: the widest
 * level plate for something you rest on, the highest wide one for something you
 * work at. The same two rules the contract states, written independently here.
 */
export function contactOf(object: THREE.Object3D, kind: 'rest' | 'work'): number {
  const found = plates(object)
  if (!found.length) throw new Error('nothing level to meet')
  if (kind === 'rest') return found[0]!.y

  const size = sizeOf(object)
  const wide = found.filter((plate) => plate.area >= 0.25 * size.x * size.z)
  return Math.max(...(wide.length ? wide : found).map((plate) => plate.y))
}
