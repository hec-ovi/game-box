import { Forge, OfflineNarrator } from '@gb/forge'
import type { Interior, World } from '@gb/world'
import * as THREE from 'three'
import {
  FurnishDressing,
  FurnishLibrary,
  SURFACE_TEXTURE_IDS,
  SurfaceLibrary,
  furnishKit,
  type FurnishStyle,
} from '../src/index.ts'

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
 * The same catalog with a pack's worth of surfaces behind it. What is in the
 * images makes no difference to which one a room is given, which is what the
 * tests that use this measure.
 */
const surfaced = new FurnishLibrary(
  'surfaces',
  new SurfaceLibrary(new Map(SURFACE_TEXTURE_IDS.map((id) => [id, { map: new THREE.Texture(), normal: undefined }]))),
)

export function surfacedDressing(style: FurnishStyle): FurnishDressing {
  return new FurnishDressing(surfaced, undefined, style)
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

/**
 * How many places a town is asked to open. `@gb/forge` opens an absolute
 * number, the brief's, whatever the size of the city, and it ranks which ones
 * on what a place holds and how near the middle it stands. Three, the default,
 * is a playthrough's worth and not a catalog's: measured over the seeds below,
 * three opens no bar in any of them, so nobody serves at a bar counter or sits
 * on a bar stool and a sample of a real town misses what the box draws for one.
 * At twelve each of those towns puts a body on all eight props on its own, so
 * the sample stands however the ranking picks next.
 */
const PLACES = 12

/** A town built the way the game builds one, opening the places these tests have to see inside. */
async function built(theme: string, seed: string): Promise<World> {
  const made = await new Forge(new OfflineNarrator(seed)).build({
    theme,
    seed,
    blocksX: 3,
    blocksY: 3,
    blockCells: 14,
    openPlaces: PLACES,
  })
  if (!made.ok) throw new Error(JSON.stringify(made.error).slice(0, 400))
  return made.value.world
}

/** A town of the ordinary trades: shops, flats, offices, a bar, the places the catalog was drawn for. */
export async function town(seed = 'furnish'): Promise<World> {
  return built('old harbour town', seed)
}

/**
 * The town whose story calls for dancing: the offline neon trade "the clubs"
 * declares a disco, with a dance floor, a gate of bars on its cellar and a
 * camera over its door. The one town with each of those in it.
 */
export async function clubTown(): Promise<World> {
  return built('dense neon port city', 'club-1')
}

/** Seeds a test that has to see the catalog exercised samples over, rather than one town. */
const TOWN_SEEDS = ['furnish', 'furnish-2', 'furnish-3'] as const

/** Every interior of several towns: what a coverage test reads, so one seed's mix cannot pass for the game's. */
export async function interiorsAcrossTowns(): Promise<Interior[]> {
  const worlds = await Promise.all(TOWN_SEEDS.map((seed) => town(seed)))
  return worlds.flatMap((world) => [...world.interiors()])
}

/** One level upward-looking surface of a built prop: how high it is and how much of it there is. */
export interface Plate {
  readonly y: number
  readonly area: number
}

/**
 * Every upward-looking level face of a built object, measured off the triangles
 * the renderer would draw and grouped to ten microns, which is what a float32
 * position buffer can hold rather than a tolerance.
 *
 * Written here rather than taken from `src/` on purpose: a test that asks the
 * box how tall its own surface is proves only that it can read its own
 * bookkeeping.
 */
function* levelFaces(object: THREE.Object3D): Generator<{ y: number; area: number; corners: THREE.Vector3[] }> {
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
      yield { y: Math.round(((corners[0].y + corners[1].y + corners[2].y) / 3) * 1e5) / 1e5, area, corners }
    }
  }
}

/** Every height a built prop has level surface at, widest first. */
export function plates(object: THREE.Object3D): Plate[] {
  const areas = new Map<number, number>()
  for (const face of levelFaces(object)) areas.set(face.y, (areas.get(face.y) ?? 0) + face.area)
  return [...areas].map(([y, area]) => ({ y, area })).sort((one, two) => two.area - one.area)
}

/**
 * How far the level surface at one height runs front to back, in the prop's own
 * metres, front edge first. What a body lying or sitting on it has under it,
 * and the pair `@gb/forge` mirrors as a seat's pad.
 */
export function padAt(object: THREE.Object3D, height: number): [number, number] {
  let front = Infinity
  let back = -Infinity
  for (const face of levelFaces(object)) {
    if (Math.abs(face.y - height) > 1e-5) continue
    for (const corner of face.corners) {
      front = Math.min(front, corner.z)
      back = Math.max(back, corner.z)
    }
  }
  if (front > back) throw new Error(`nothing level at ${height}`)
  return [front, back]
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

/** The metres a surface spans, for a call that asks for a material and not a size. */
export const ROOM_SIZE = { u: 6, v: 4 }
