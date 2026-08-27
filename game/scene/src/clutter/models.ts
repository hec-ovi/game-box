import { Rng } from '@gb/kit'
import * as THREE from 'three'
import { Assembly } from '../assembly.ts'
import { CLUTTER, type ClutterKind } from './catalog.ts'

/**
 * The rubbish itself, generated rather than downloaded: a bin, a skip, a crate,
 * a pallet, a bin bag standing and another one split flat, a coil of cable and
 * the scraps blowing about between them.
 *
 * Every model has its origin at the centre of its base and faces -Z, the same
 * rule everything else in the city is placed by. Colours are dark and dirty and
 * ride on the vertices, so the whole street is one material.
 */
export class ClutterModels {
  readonly #geometries = new Map<string, THREE.BufferGeometry>()

  constructor(seed: string) {
    const rng = new Rng(seed)
    for (const kind of Object.keys(CLUTTER) as ClutterKind[]) {
      const own = rng.fork(kind)
      for (let variant = 0; variant < CLUTTER[kind].variants; variant++) {
        this.#geometries.set(`${kind}:${variant}`, fit(MAKE[kind](own.fork(`variant-${variant}`)), kind))
      }
    }
  }

  geometry(kind: ClutterKind, variant: number): THREE.BufferGeometry {
    return this.#geometries.get(`${kind}:${variant % CLUTTER[kind].variants}`)!
  }

  /** Every distinct model, for the batch to hold once and instance many times. */
  all(): ReadonlyMap<string, THREE.BufferGeometry> {
    return this.#geometries
  }
}

/**
 * Brings a model inside the footprint its kind publishes, standing on the
 * ground and centred on its own base. Nothing may hang over a rectangle the
 * game tells everyone else is clear, so the size is enforced here once rather
 * than trusted in eight separate model functions.
 */
function fit(shape: THREE.BufferGeometry, kind: ClutterKind): THREE.BufferGeometry {
  const spec = CLUTTER[kind]
  shape.computeBoundingBox()
  const box = shape.boundingBox!
  const size = box.getSize(new THREE.Vector3())
  const scale = Math.min(1, spec.width / size.x, spec.depth / size.z, spec.height / size.y)
  const centre = box.getCenter(new THREE.Vector3())
  shape.translate(-centre.x, -box.min.y, -centre.z)
  if (scale < 1) shape.scale(scale, scale, scale)
  shape.computeBoundingBox()
  shape.computeBoundingSphere()
  return shape
}

/**
 * Pushes every corner of a solid in or out a little, keeping the ones that sit
 * on top of each other together, so a sphere turns into something that has been
 * dropped. One icosahedron does the work of three stacked blobs.
 */
function crumple(shape: THREE.BufferGeometry, rng: Rng, amount: number): THREE.BufferGeometry {
  const position = shape.getAttribute('position')
  const pushed = new Map<string, number>()
  const corner = new THREE.Vector3()
  for (let i = 0; i < position.count; i++) {
    corner.fromBufferAttribute(position, i)
    const key = `${corner.x.toFixed(3)},${corner.y.toFixed(3)},${corner.z.toFixed(3)}`
    let push = pushed.get(key)
    if (push === undefined) {
      push = rng.range(1 - amount, 1 + amount)
      pushed.set(key, push)
    }
    position.setXYZ(i, corner.x * push, corner.y * push, corner.z * push)
  }
  shape.computeVertexNormals()
  return shape
}

/**
 * Dirty and desaturated: the street is lit by the moon, the lamps and what the
 * signs throw, so most rubbish is painted a little above what it really is, or
 * it reads as a hole rather than a shape. Polythene is the exception and is
 * painted near black, because that is what makes a bag read as a bag.
 */
function grubby(rng: Rng, hue: number, saturation: number, lightness: number): THREE.Color {
  return new THREE.Color().setHSL(
    (hue + rng.range(-0.03, 0.03) + 1) % 1,
    Math.max(0, saturation * rng.range(0.6, 1.1)),
    Math.max(0.02, lightness * rng.range(0.7, 1.25)),
  )
}

/** Black bin liner: near black, with the faint green or blue cast the plastic has. */
function polythene(rng: Rng): THREE.Color {
  return grubby(rng, rng.pick([0.45, 0.6, 0.0]), rng.pick([0.03, 0.1]), 0.055)
}

const MAKE: Record<ClutterKind, (rng: Rng) => THREE.BufferGeometry> = {
  /** A wheeled bin: a tapered body, a lid overhanging the front, and the wheels under it. */
  bin(rng) {
    const { width, depth, height } = CLUTTER.bin
    const body = grubby(rng, rng.pick([0.32, 0.58, 0.08]), 0.3, 0.26)
    const lid = grubby(rng, 0.0, 0.03, 0.16)
    const lidHeight = 0.08
    return new Assembly()
      .box({ x: width, y: height - lidHeight, z: depth }, { x: 0, y: (height - lidHeight) / 2, z: 0 }, body)
      .box({ x: width + 0.04, y: lidHeight, z: depth + 0.05 }, { x: 0, y: height - lidHeight / 2, z: -0.01 }, lid, 0, -0.06)
      .box({ x: 0.07, y: 0.12, z: 0.07 }, { x: width / 2 - 0.08, y: 0.06, z: depth / 2 - 0.08 }, lid)
      .box({ x: 0.07, y: 0.12, z: 0.07 }, { x: -width / 2 + 0.08, y: 0.06, z: depth / 2 - 0.08 }, lid)
      .geometry()
  },

  /** A skip: a long open container with a sloped end and a load spilling over the top. */
  skip(rng) {
    const { width, depth, height } = CLUTTER.skip
    const steel = grubby(rng, rng.pick([0.08, 0.12]), 0.32, 0.21)
    const load = grubby(rng, 0.1, 0.1, 0.14)
    const assembly = new Assembly()
      .box({ x: width, y: height, z: 0.05 }, { x: 0, y: height / 2, z: -depth / 2 }, steel)
      .box({ x: width, y: height * 0.7, z: 0.05 }, { x: 0, y: (height * 0.7) / 2, z: depth / 2 }, steel)
      .box({ x: 0.05, y: height, z: depth }, { x: -width / 2, y: height / 2, z: 0 }, steel)
      .box({ x: 0.05, y: height, z: depth }, { x: width / 2, y: height / 2, z: 0 }, steel)
      .box({ x: width, y: 0.05, z: depth }, { x: 0, y: 0.05, z: 0 }, steel)
      .box({ x: width, y: 0.1, z: depth - 0.1 }, { x: 0, y: height * 0.62, z: 0 }, load)
    for (let i = 0; i < 3; i++) {
      const at = new THREE.Matrix4()
        .makeRotationY(rng.float() * Math.PI)
        .scale(new THREE.Vector3(rng.range(0.2, 0.36), rng.range(0.14, 0.26), rng.range(0.2, 0.32)))
        .setPosition(rng.range(-width / 2 + 0.2, width / 2 - 0.2), height * 0.7, rng.range(-0.14, 0.14))
      assembly.add(crumple(new THREE.IcosahedronGeometry(0.5, 0), rng, 0.35), at, load)
    }
    return assembly.geometry()
  },

  /** A crate. Stacking is the planner's business, so the footprint stays honest. */
  crate(rng) {
    const { width, depth, height } = CLUTTER.crate
    const board = grubby(rng, rng.pick([0.09, 0.33]), 0.24, 0.3)
    const rail = grubby(rng, 0.09, 0.12, 0.19)
    return new Assembly()
      .box({ x: width, y: height, z: depth }, { x: 0, y: height / 2, z: 0 }, board)
      .box({ x: width + 0.02, y: 0.05, z: depth + 0.02 }, { x: 0, y: height - 0.03, z: 0 }, rail)
      .geometry()
  },

  /** A pallet leaning against the wall, which is where a pallet always is. */
  pallet(rng) {
    const { width, height } = CLUTTER.pallet
    const board = grubby(rng, 0.1, 0.24, 0.28)
    const lean = 0.16
    const assembly = new Assembly()
    for (let i = 0; i < 5; i++) {
      const up = 0.1 + i * ((height - 0.2) / 4)
      assembly.box({ x: width, y: 0.09, z: 0.1 }, { x: 0, y: up, z: up * lean - 0.09 }, board, 0, -lean)
    }
    return assembly.geometry()
  },

  /** A refuse sack put out whole: one lump of black polythene, knocked about. */
  bag(rng) {
    const { width, depth, height } = CLUTTER.bag
    const lump = crumple(new THREE.IcosahedronGeometry(0.5, 0), rng, 0.3)
    const at = new THREE.Matrix4()
      .makeRotationY(rng.float() * Math.PI)
      .scale(new THREE.Vector3(width, height, depth))
      .setPosition(0, height / 2, 0)
    return new Assembly().add(lump, at, polythene(rng)).geometry()
  },

  /**
   * The same sack split and trodden flat, with the torn end spread out beside
   * it. Six triangles, because a pavement carries hundreds of them.
   */
  sack(rng) {
    const { width, depth, height } = CLUTTER.sack
    const skin = polythene(rng)
    const lump = crumple(new THREE.TetrahedronGeometry(0.5, 0), rng, 0.36)
    const at = new THREE.Matrix4()
      .makeRotationY(rng.float() * Math.PI)
      .scale(new THREE.Vector3(width * 0.8, height, depth * 0.8))
      .setPosition(0, height / 2, 0)
    return new Assembly()
      .add(lump, at, skin)
      .plate(width * rng.range(0.5, 0.9), depth * rng.range(0.4, 0.8), { x: width * 0.24, y: 0.004, z: depth * rng.range(-0.2, 0.2) }, skin, rng.float() * Math.PI)
      .geometry()
  },

  /** A coil of cable or hose, dumped where the last job left it. */
  cable(rng) {
    const { width, height } = CLUTTER.cable
    const sheath = grubby(rng, rng.pick([0.0, 0.15]), 0.16, 0.14)
    return new Assembly()
      .ring(width / 2 - height / 2, height / 2, { x: 0, y: height / 2, z: 0 }, sheath)
      .box({ x: height, y: height * 0.8, z: width * 0.55 }, { x: width * 0.3, y: height * 0.4, z: 0 }, sheath, rng.range(-0.6, 0.6))
      .geometry()
  },

  /** A scrap of paper or card, flat on the ground. */
  scrap(rng) {
    const { width, depth, height } = CLUTTER.scrap
    const paper = grubby(rng, rng.pick([0.1, 0.55, 0.0]), rng.pick([0.03, 0.16]), rng.range(0.1, 0.2))
    return new Assembly()
      .plate(width * rng.range(0.6, 1), depth * rng.range(0.6, 1), { x: 0, y: height, z: 0 }, paper, rng.float() * Math.PI)
      .geometry()
  },

  /** A crushed can, on its side. Twelve triangles, and there are hundreds of them. */
  can(rng) {
    const { width, depth } = CLUTTER.can
    const tin = grubby(rng, rng.pick([0.55, 0.05, 0.3]), 0.28, 0.45)
    return new Assembly()
      .box({ x: width, y: depth * rng.range(0.6, 0.9), z: depth }, { x: 0, y: (depth * 0.75) / 2, z: 0 }, tin, rng.range(-0.5, 0.5))
      .geometry()
  },
}
