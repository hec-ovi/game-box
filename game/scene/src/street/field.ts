import { type CellKind, type World } from '@gb/world'
import * as THREE from 'three'

/** One texel per metre: fine enough to hold a gutter and a wheel track, coarse enough to stay small. */
const STEP = 1

/** How far from a kerb the field still measures. Past this the middle of the road is all the same. */
export const EDGE_RANGE = 8

/** A big number to start a distance pass from, in texels. */
const FAR = 1e6

/**
 * What the street knows about itself, as a texture the surface material reads
 * by world position: how far this metre of ground is from the edge of its own
 * surface, and whether it is roadway or pavement.
 *
 * Its own surface, not the paved area as a whole, because the kerb is the edge
 * that matters. A road is cambered, so water runs to the gutter at the kerb and
 * dirt collects with it, the crown stays cleanest and the wheels polish a band
 * either side; a pavement is dirtiest where it meets the kerb and the wall.
 * Measuring both from the building line would put a road's gutter four metres
 * out on the pavement, which is where the pavement now reaches.
 */
export class StreetField {
  readonly texture: THREE.DataTexture
  /** Metres the texture spans, so a world position turns into a uv. */
  readonly span: { x: number; z: number }

  constructor(world: World, paved: readonly CellKind[]) {
    const width = Math.max(1, Math.ceil((world.grid.width * world.cellSize) / STEP))
    const height = Math.max(1, Math.ceil((world.grid.height * world.cellSize) / STEP))
    this.span = { x: width * STEP, z: height * STEP }

    const kinds = new Set(paved)
    const data = new Uint8Array(width * height * 2)
    const road = new Float32Array(width * height)
    const walk = new Float32Array(width * height)
    const onRoad = new Uint8Array(width * height)

    for (let j = 0; j < height; j++) {
      for (let i = 0; i < width; i++) {
        const at = j * width + i
        const kind = world.grid.at(
          Math.floor(((i + 0.5) * STEP) / world.cellSize),
          Math.floor(((j + 0.5) * STEP) / world.cellSize),
        )
        const isRoad = kind === 'street'
        const isWalk = kind !== undefined && kinds.has(kind) && !isRoad
        onRoad[at] = isRoad ? 1 : 0
        road[at] = isRoad ? FAR : 0
        walk[at] = isWalk ? FAR : 0
        data[at * 2 + 1] = kind === 'sidewalk' ? 255 : 0
      }
    }

    chamfer(road, width, height)
    chamfer(walk, width, height)
    for (let at = 0; at < road.length; at++) {
      const edge = (onRoad[at] ? road[at]! : walk[at]!) * STEP
      data[at * 2] = Math.round((Math.min(edge, EDGE_RANGE) / EDGE_RANGE) * 255)
    }

    this.texture = new THREE.DataTexture(data, width, height, THREE.RGFormat)
    this.texture.name = 'street:field'
    this.texture.minFilter = THREE.LinearFilter
    this.texture.magFilter = THREE.LinearFilter
    this.texture.wrapS = THREE.ClampToEdgeWrapping
    this.texture.wrapT = THREE.ClampToEdgeWrapping
    this.texture.needsUpdate = true
  }
}

/**
 * Distance to the nearest zero, in texels, by two sweeps of a 3-4 chamfer.
 * Within about 2% of true Euclidean distance, which is far under the metre the
 * lattice is measured at, and it is two passes rather than a queue.
 */
function chamfer(distance: Float32Array, width: number, height: number): void {
  const near = 1
  const diagonal = Math.SQRT2

  const relax = (at: number, from: number, cost: number) => {
    const candidate = distance[from]! + cost
    if (candidate < distance[at]!) distance[at] = candidate
  }

  for (let j = 0; j < height; j++) {
    for (let i = 0; i < width; i++) {
      const at = j * width + i
      if (distance[at] === 0) continue
      if (i > 0) relax(at, at - 1, near)
      if (j > 0) relax(at, at - width, near)
      if (j > 0 && i > 0) relax(at, at - width - 1, diagonal)
      if (j > 0 && i < width - 1) relax(at, at - width + 1, diagonal)
    }
  }
  for (let j = height - 1; j >= 0; j--) {
    for (let i = width - 1; i >= 0; i--) {
      const at = j * width + i
      if (distance[at] === 0) continue
      if (i < width - 1) relax(at, at + 1, near)
      if (j < height - 1) relax(at, at + width, near)
      if (j < height - 1 && i < width - 1) relax(at, at + width + 1, diagonal)
      if (j < height - 1 && i > 0) relax(at, at + width - 1, diagonal)
    }
  }
}
