import { type CellKind, type World } from '@gb/world'
import * as THREE from 'three'

/** One texel per metre: fine enough to hold a gutter and a wheel track, coarse enough to stay small. */
const STEP = 1

/** How far from an edge the field still measures. Past this the middle of the road is all the same. */
export const EDGE_RANGE = 8

/** A big number to start a distance pass from, in texels. */
const FAR = 1e6

/**
 * What the street knows about itself, as a texture the surface material reads
 * by world position: how far this metre of ground is from the edge of the
 * paved surface, and whether it is roadway or pavement.
 *
 * Distance is what puts the grime and the standing water where they belong. A
 * road is cambered, so water runs to the gutter and dirt collects with it; the
 * middle of the lane stays cleanest and the wheels polish two bands either side
 * of it. All three read off the same number, so they cannot disagree.
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
    const distance = new Float32Array(width * height)

    for (let j = 0; j < height; j++) {
      for (let i = 0; i < width; i++) {
        const at = j * width + i
        const kind = world.grid.at(
          Math.floor(((i + 0.5) * STEP) / world.cellSize),
          Math.floor(((j + 0.5) * STEP) / world.cellSize),
        )
        const isPaved = kind !== undefined && kinds.has(kind)
        distance[at] = isPaved ? FAR : 0
        data[at * 2 + 1] = kind === 'sidewalk' ? 255 : 0
      }
    }

    chamfer(distance, width, height)
    for (let at = 0; at < distance.length; at++) {
      data[at * 2] = Math.round((Math.min(distance[at]! * STEP, EDGE_RANGE) / EDGE_RANGE) * 255)
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
