import type { Facing } from '@gb/world'
import type * as THREE from 'three'
import { DOOR_FINISH, OPEN_DOOR_FINISH } from './entrance.ts'
import { PROUD } from './fit.ts'
import { LAYER_ATTRIBUTE } from './pack.ts'
import { BASE } from './wall.ts'

/**
 * A patch of a building's street face, in metres in the building's own frame:
 * the middle of its outward surface, and how big it is.
 */
export interface Plate {
  /** The middle of the patch's outward face, so a fixture laid on it starts here. */
  readonly position: [number, number, number]
  /** Across the wall. */
  readonly width: number
  readonly height: number
}

/** One outward-facing plate of the model: what it is painted, and where. */
interface Face {
  readonly finish: string
  readonly patch: Patch
}

/** A front-facing quad of the model, read in the wall's own axes. */
interface Patch {
  /** Across the wall. */
  readonly across: readonly [number, number]
  readonly up: readonly [number, number]
  /** Metres this face stands off the wall plane: negative where the model steps back off the street. */
  readonly relief: number
}

/**
 * The street face a pack model actually drew, for whoever puts a fixture on it.
 *
 * A plot says where a door belongs; a pack model has its door where the model
 * has it. The two are not the same number: every model in the pack centres its
 * entrance on the front, at its own width and its own head height, and lays a
 * fascia band over it at its own line, while the kit that writes the signage
 * snaps a door to its own 2 m module and sizes a lamp to its own door. Anything
 * hung against the plot's arithmetic lands beside the drawn door rather than on
 * it, so the drawn face has to be readable from outside.
 *
 * Everything here is measured off the geometry the plot is actually drawn with,
 * after `orient`, so a mirrored building turned onto an east wall answers for
 * the east face.
 */
export class StreetFace {
  /** The wall the entrance is on. */
  readonly wall: Facing
  /** Metres from the building's origin out to the wall plane, along that wall's outward normal. */
  readonly plane: number
  /** The entrance the pack drew: a plate over the pavement, centred on the front. */
  readonly door: Plate | undefined
  /** The band a name is written on, where the look carries one. */
  readonly band: Plate | undefined
  readonly #patches: readonly Patch[]

  private constructor(wall: Facing, plane: number, patches: readonly Patch[], door: Plate | undefined, band: Plate | undefined) {
    this.wall = wall
    this.plane = plane
    this.#patches = patches
    this.door = door
    this.band = band
  }

  /**
   * Reads one oriented geometry's street face.
   *
   * `plane` is how far the wall stands from the origin, which is the model's
   * own half depth: the origin is the middle of the base and a model is baked
   * at its plot's exact footprint.
   */
  static of(geometry: THREE.BufferGeometry, wall: Facing, plane: number, finishes: readonly string[]): StreetFace {
    const groups = frontFaces(geometry, wall, plane, finishes)
    const door = plateOf(
      groups.find((group) => group.finish === DOOR_FINISH || group.finish === OPEN_DOOR_FINISH),
      wall,
      plane,
    )
    return new StreetFace(
      wall,
      plane,
      groups.map((group) => group.patch),
      door,
      plateOf(bandOf(groups, door), wall, plane),
    )
  }

  /**
   * How far the model's own face stands off the wall under a patch of it, so a
   * fixture laid there lies on the surface rather than in the same plane as it.
   *
   * The outermost face under the patch answers, which is the one a fixture
   * would otherwise fight; a face standing further out than `PROUD` is not wall
   * (a balcony hangs that far) and is ignored. A patch with nothing behind it
   * answers 0, which is the wall plane.
   */
  reliefUnder(across: readonly [number, number], up: readonly [number, number]): number {
    let found = 0
    for (const patch of this.#patches) {
      if (patch.relief > PROUD) continue
      if (patch.across[1] <= across[0] || patch.across[0] >= across[1]) continue
      if (patch.up[1] <= up[0] || patch.up[0] >= up[1]) continue
      found = Math.max(found, patch.relief)
    }
    return found
  }
}

/** Outward off the wall the door is on, and which axis runs across it. */
export function axesOf(wall: Facing): { readonly across: 'x' | 'z'; readonly out: 'x' | 'z'; readonly outward: 1 | -1 } {
  const across = wall === 'north' || wall === 'south' ? 'x' : 'z'
  return { across, out: across === 'x' ? 'z' : 'x', outward: wall === 'south' || wall === 'east' ? 1 : -1 }
}

/**
 * Every outward-facing quad on the street face, merged per finish and per
 * plane, which is how the producer composes a band: one plate on one layer at
 * one depth.
 */
function frontFaces(geometry: THREE.BufferGeometry, wall: Facing, plane: number, finishes: readonly string[]): Face[] {
  const { across, out, outward } = axesOf(wall)
  const position = geometry.getAttribute('position')
  const layer = geometry.getAttribute(LAYER_ATTRIBUTE)
  const normal = geometry.getAttribute('normal')
  const index = geometry.getIndex()
  const groups = new Map<string, { finish: string; patch: { across: [number, number]; up: [number, number]; relief: number } }>()
  if (!index) return []

  const at = (attribute: typeof position, vertex: number, axis: 'x' | 'z'): number => (axis === 'x' ? attribute.getX(vertex) : attribute.getZ(vertex))
  for (let triangle = 0; triangle < index.count; triangle += 3) {
    const corners = [index.getX(triangle), index.getX(triangle + 1), index.getX(triangle + 2)]
    if (at(normal, corners[0]!, out) * outward < 0.9) continue
    const finish = finishes[Math.round(layer.getX(corners[0]!))]
    if (finish === undefined) continue
    const relief = Math.round((at(position, corners[0]!, out) * outward - plane) * 1000) / 1000
    const key = `${finish}@${relief}`
    const found = groups.get(key) ?? { finish, patch: { across: [Infinity, -Infinity] as [number, number], up: [Infinity, -Infinity] as [number, number], relief } }
    for (const corner of corners) {
      const a = at(position, corner, across)
      const y = position.getY(corner)
      found.patch.across = [Math.min(found.patch.across[0], a), Math.max(found.patch.across[1], a)]
      found.patch.up = [Math.min(found.patch.up[0], y), Math.max(found.patch.up[1], y)]
    }
    groups.set(key, found)
  }
  return [...groups.values()]
}

/** How far over a door head a fascia band may sit, and the share of the front it has to run, to be one. */
const BAND_REACH = 2
const BAND_SHARE = 0.6

/**
 * The fascia band over the entrance: the base plate that stands off the wall,
 * runs most of the front and sits wholly above the door head. A balcony slab
 * wears the same base picture and stands off the same wall, which is why the
 * width matters; a look with no band has its street level flush with the wall.
 */
function bandOf(groups: readonly Face[], door: Plate | undefined): Face | undefined {
  if (!door) return undefined
  const head = door.position[1] + door.height / 2
  const front = Math.max(...groups.map((group) => group.patch.across[1] - group.patch.across[0]))
  let found: Face | undefined
  for (const group of groups) {
    if (!group.finish.startsWith(BASE) || group.patch.relief <= 0) continue
    if (group.patch.up[0] < head || group.patch.up[1] > head + BAND_REACH) continue
    if (group.patch.across[1] - group.patch.across[0] < front * BAND_SHARE) continue
    if (!found || group.patch.up[0] < found.patch.up[0]) found = group
  }
  return found
}

/** A read quad, back in the building's own frame. */
function plateOf(group: Face | undefined, wall: Facing, plane: number): Plate | undefined {
  if (!group) return undefined
  const { across, outward } = axesOf(wall)
  const middle = (group.patch.across[0] + group.patch.across[1]) / 2
  const out = (plane + group.patch.relief) * outward
  return {
    position: [across === 'x' ? middle : out, (group.patch.up[0] + group.patch.up[1]) / 2, across === 'x' ? out : middle],
    width: group.patch.across[1] - group.patch.across[0],
    height: group.patch.up[1] - group.patch.up[0],
  }
}
