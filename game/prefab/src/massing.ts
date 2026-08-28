import { METRICS } from '@gb/world'
import * as THREE from 'three'
import { ENTRANCE_ATTRIBUTE } from './doorway.ts'
import { LAYER_ATTRIBUTE } from './pack.ts'
import { BASE_TILE } from './wall.ts'
import { FACADE } from './windows.ts'

/** Metres of wall one bay of curtain wall covers: what the producer lays the pack's pictures at. */
const BAY_WIDTH = 3

/** Metres of parapet over the top storey, so a window never runs off the roof edge. */
const PARAPET = 1

/** A face too short to be worth a quad of its own. */
const THINNEST = 0.01

/** Which two layers of the pack's strip a massing is painted with: the wall above the street, and the band under and over it. */
export interface FinishPair {
  readonly wall: number
  readonly base: number
}

/** One band of one face: how far up it runs and what it is painted. */
interface Band {
  readonly from: number
  readonly to: number
  readonly layer: number
}

export interface MassingSize {
  readonly width: number
  readonly depth: number
  readonly height: number
}

/**
 * The box a plot occupies, painted with the pack's own wall.
 *
 * A plot whose shape the pack has no model for is drawn by the dressing behind,
 * and that is a whole stack of kit pieces: measured on the metro 20 by 20 city,
 * 7,439 triangles and 2.98 ms for a shell nobody is nearer than 64 m to. From
 * that far off a building is its silhouette and its lit windows, and both come
 * out of the shell material for nothing: the bays, the rooms behind them and
 * which of them are lit are arithmetic over the wall's own uv, so a box laid at
 * the metres the producer laid its pictures at wears the same facade as the
 * street it stands on.
 *
 * So this is 26 triangles: four walls cut into a street-level band, the storeys
 * over it and a parapet, and a flat roof. The kit's building still stands
 * within the detail radius; this is what carries the plot from there to the
 * skyline.
 */
export class Massing {
  /** One geometry per shape and finish, because a town cuts the same plot over and over. */
  readonly #held = new Map<string, THREE.BufferGeometry>()

  /** The box for that size on those finishes, its origin at the centre of its base. */
  of(size: MassingSize, finish: FinishPair): THREE.BufferGeometry {
    const key = `${finish.wall}:${finish.base}|${size.width}x${size.depth}x${size.height}`
    const held = this.#held.get(key)
    if (held) return held
    const made = build(size, finish)
    this.#held.set(key, made)
    return made
  }
}

function build(size: MassingSize, finish: FinishPair): THREE.BufferGeometry {
  const quads = new Quads()
  const hw = size.width / 2
  const hd = size.depth / 2
  // each face walks along `across` so that `across` cross up is its outward
  // normal, which is what makes the winding below face the street
  const faces = [
    { at: new THREE.Vector3(hw, 0, hd), across: new THREE.Vector3(0, 0, -1), run: size.depth },
    { at: new THREE.Vector3(-hw, 0, -hd), across: new THREE.Vector3(0, 0, 1), run: size.depth },
    { at: new THREE.Vector3(-hw, 0, hd), across: new THREE.Vector3(1, 0, 0), run: size.width },
    { at: new THREE.Vector3(hw, 0, -hd), across: new THREE.Vector3(-1, 0, 0), run: size.width },
  ]

  for (const face of faces) {
    for (const band of bandsOf(size.height, finish)) {
      const tile = band.layer === finish.wall ? { u: FACADE.grid.across * BAY_WIDTH, v: FACADE.grid.down * METRICS.building.storeyHeight } : { u: BASE_TILE, v: BASE_TILE }
      quads.wall(face.at, face.across, face.run, band, tile)
    }
  }
  quads.roof(hw, hd, size.height, finish.base)
  return quads.geometry()
}

/** The street level, the storeys over it and the parapet, skipping any the building is too short for. */
function bandsOf(height: number, finish: FinishPair): Band[] {
  const ground = Math.min(METRICS.building.groundFloorHeight, height)
  const eaves = Math.max(ground, height - PARAPET)
  return [
    { from: 0, to: ground, layer: finish.base },
    { from: ground, to: eaves, layer: finish.wall },
    { from: eaves, to: height, layer: finish.base },
  ].filter((band) => band.to - band.from > THINNEST)
}

/**
 * The quads of one massing, in the shape every pack geometry carries: position,
 * normal, uv, the layer and an empty entrance patch, indexed. `@gb/scene` welds
 * two geometries into one buffer only when they agree attribute for attribute,
 * so a massing has to answer for the same five or it would open a batch of its
 * own beside the shells.
 */
class Quads {
  readonly #position: number[] = []
  readonly #normal: number[] = []
  readonly #uv: number[] = []
  readonly #layer: number[] = []
  readonly #index: number[] = []

  /** One band of one wall: along `across` for `run` metres, from `band.from` up to `band.to`. */
  wall(at: THREE.Vector3, across: THREE.Vector3, run: number, band: Band, tile: { u: number; v: number }): void {
    const normal = new THREE.Vector3().crossVectors(across, UP)
    const tall = band.to - band.from
    this.#quad(
      [
        at.clone().addScaledVector(UP, band.from),
        at.clone().addScaledVector(across, run).addScaledVector(UP, band.from),
        at.clone().addScaledVector(across, run).addScaledVector(UP, band.to),
        at.clone().addScaledVector(UP, band.to),
      ],
      normal,
      [
        [0, 0],
        [run / tile.u, 0],
        [run / tile.u, tall / tile.v],
        [0, tall / tile.v],
      ],
      band.layer,
    )
  }

  /** The flat lid. */
  roof(hw: number, hd: number, height: number, layer: number): void {
    this.#quad(
      [
        new THREE.Vector3(-hw, height, hd),
        new THREE.Vector3(hw, height, hd),
        new THREE.Vector3(hw, height, -hd),
        new THREE.Vector3(-hw, height, -hd),
      ],
      UP.clone(),
      [
        [0, 0],
        [(hw * 2) / BASE_TILE, 0],
        [(hw * 2) / BASE_TILE, (hd * 2) / BASE_TILE],
        [0, (hd * 2) / BASE_TILE],
      ],
      layer,
    )
  }

  geometry(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.#position, 3))
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(this.#normal, 3))
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(this.#uv, 2))
    geometry.setAttribute(LAYER_ATTRIBUTE, new THREE.Float32BufferAttribute(this.#layer, 1))
    // no door stands on a massing, and an empty patch shuts no bay
    geometry.setAttribute(ENTRANCE_ATTRIBUTE, new THREE.Float32BufferAttribute(new Float32Array(this.#layer.length * 4), 4))
    geometry.setIndex(this.#index)
    geometry.computeBoundingBox()
    geometry.computeBoundingSphere()
    return geometry
  }

  #quad(corners: readonly THREE.Vector3[], normal: THREE.Vector3, uv: ReadonlyArray<readonly [number, number]>, layer: number): void {
    const first = this.#layer.length
    for (const [at, corner] of corners.entries()) {
      this.#position.push(corner.x, corner.y, corner.z)
      this.#normal.push(normal.x, normal.y, normal.z)
      this.#uv.push(uv[at]![0], uv[at]![1])
      this.#layer.push(layer)
    }
    this.#index.push(first, first + 1, first + 2, first, first + 2, first + 3)
  }
}

const UP = new THREE.Vector3(0, 1, 0)
