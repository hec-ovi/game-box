import * as THREE from 'three'
import { shade, type Look } from './look.ts'
import { everyCorner, outline, type Corners, type Rim } from './outline.ts'
import { section, SHARP, type Edge, type Ring } from './profile.ts'

/**
 * What every piece of furniture is built out of: a rectangle in plan, with a
 * radius on each corner, extruded between two heights with an edge treatment at
 * each end.
 *
 * That one shape is a worktop, a leg, a plinth, a cushion, a door panel, a
 * light strip, a plant pot and a lamp column, because a full corner radius
 * makes it a cylinder and an inset at one end makes it a taper. There is no
 * second primitive.
 *
 * The colour, the emission and the finish ride on the vertices, so a whole
 * piece is one buffer on one material. Nothing is ever scaled after the fact: a
 * top asked for at 0.75 is drawn with its vertices at 0.75, which is what makes
 * the contact height exact rather than close.
 */
export interface Block {
  /** Centre of the footprint. Both default to the middle of the piece. */
  readonly x?: number
  readonly z?: number
  readonly width: number
  readonly depth: number
  readonly y0: number
  readonly y1: number
  readonly look: Look
  /** Corner radii in plan: one number for all four, or +x-z, -x-z, -x+z, +x+z. */
  readonly corner?: number | Corners
  /** Points per rounded corner. */
  readonly arc?: number
  readonly top?: Edge
  readonly bottom?: Edge
  /** Metres the section pulls in at that end: a taper, not a scale. */
  readonly topInset?: number
  readonly bottomInset?: number
  /** Leave the cap off a face nothing can see, so an open case is not lidded. */
  readonly openTop?: boolean
  readonly openBottom?: boolean
}

/** Which way a band of the wall faces, in the plane of the plan normal and up. */
interface Slope {
  readonly horizontal: number
  readonly vertical: number
}

const ARC = 4

const point = new THREE.Vector3()
const direction = new THREE.Vector3()

/** A piece of furniture under construction: blocks go in, one geometry comes out. */
export class Solid {
  readonly #position: number[] = []
  readonly #normal: number[] = []
  readonly #shade: number[] = []
  readonly #glow: number[] = []
  readonly #rough: number[] = []
  readonly #metal: number[] = []
  readonly #index: number[] = []
  readonly #stack: (THREE.Matrix4 | undefined)[] = []
  #frame: THREE.Matrix4 | undefined

  /** Everything the body adds is placed by this transform. Nests. */
  in(matrix: THREE.Matrix4, body: () => void): void {
    this.#stack.push(this.#frame)
    this.#frame = this.#frame ? new THREE.Matrix4().multiplyMatrices(this.#frame, matrix) : matrix.clone()
    body()
    this.#frame = this.#stack.pop()
  }

  block(block: Block): void {
    const rim = outline(
      block.width / 2,
      block.depth / 2,
      typeof block.corner === 'object' ? block.corner : everyCorner(block.corner ?? 0),
      block.arc ?? ARC,
    )
    const rings = section({
      y0: block.y0,
      y1: block.y1,
      bottom: block.bottom ?? SHARP,
      top: block.top ?? SHARP,
      ...(block.bottomInset === undefined ? {} : { bottomInset: block.bottomInset }),
      ...(block.topInset === undefined ? {} : { topInset: block.topInset }),
    })
    const edges = walk(rim)
    const x = block.x ?? 0
    const z = block.z ?? 0

    this.#wall(rim, edges, rings, x, z, block.look)
    if (!block.openTop) this.#cap(rim, edges, rings[rings.length - 1]!, x, z, block.look, 1)
    if (!block.openBottom) this.#cap(rim, edges, rings[0]!, x, z, block.look, -1)
  }

  geometry(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.#position), 3))
    geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(this.#normal), 3))
    geometry.setAttribute('shade', new THREE.BufferAttribute(new Float32Array(this.#shade), 3))
    geometry.setAttribute('glow', new THREE.BufferAttribute(new Float32Array(this.#glow), 3))
    geometry.setAttribute('rough', new THREE.BufferAttribute(new Float32Array(this.#rough), 1))
    geometry.setAttribute('metal', new THREE.BufferAttribute(new Float32Array(this.#metal), 1))
    geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(this.#index), 1))
    geometry.computeBoundingBox()
    return geometry
  }

  get triangles(): number {
    return this.#index.length / 3
  }

  /**
   * The wall of the extrusion, band by band. A ring marked smooth carries the
   * average of the two bands meeting there and both share its vertices, so a
   * fillet reads round; a ring that is not creases.
   */
  #wall(rim: readonly Rim[], edges: readonly number[], rings: readonly Ring[], x: number, z: number, look: Look): void {
    const bands = rings.length - 1
    const slopes: Slope[] = []
    for (let at = 0; at < bands; at++) slopes.push(slopeOf(rings[at]!, rings[at + 1]!))

    let shared: number[] | undefined
    for (let at = 0; at < bands; at++) {
      const under = at > 0 && rings[at]!.smooth ? blend(slopes[at - 1]!, slopes[at]!) : slopes[at]!
      const over = at + 1 < bands && rings[at + 1]!.smooth ? blend(slopes[at]!, slopes[at + 1]!) : slopes[at]!
      const lower = shared ?? this.#ring(rim, rings[at]!, x, z, under, look)
      const upper = this.#ring(rim, rings[at + 1]!, x, z, over, look)
      for (const edge of edges) {
        const next = (edge + 1) % rim.length
        this.#quad(lower[edge]!, lower[next]!, upper[next]!, upper[edge]!)
      }
      shared = rings[at + 1]!.smooth ? upper : undefined
    }
  }

  /** One ring of vertices: the rim pulled in by the ring's inset, at the ring's height. */
  #ring(rim: readonly Rim[], ring: Ring, x: number, z: number, slope: Slope, look: Look): number[] {
    return rim.map((edge) =>
      this.#vertex(
        x + edge.x - edge.nx * ring.inset,
        ring.y,
        z + edge.z - edge.nz * ring.inset,
        edge.nx * slope.horizontal,
        slope.vertical,
        edge.nz * slope.horizontal,
        look,
      ),
    )
  }

  /** A flat lid on the ring, wound to be seen from `way`. */
  #cap(
    rim: readonly Rim[],
    edges: readonly number[],
    ring: Ring,
    x: number,
    z: number,
    look: Look,
    way: number,
  ): void {
    const centre = this.#vertex(x, ring.y, z, 0, way, 0, look)
    const fan = this.#ring(rim, ring, x, z, { horizontal: 0, vertical: way }, look)
    for (const edge of edges) {
      const next = (edge + 1) % rim.length
      if (way > 0) this.#triangle(centre, fan[edge]!, fan[next]!)
      else this.#triangle(centre, fan[next]!, fan[edge]!)
    }
  }

  #vertex(x: number, y: number, z: number, nx: number, ny: number, nz: number, look: Look): number {
    const at = this.#position.length / 3
    point.set(x, y, z)
    direction.set(nx, ny, nz)
    if (this.#frame) {
      point.applyMatrix4(this.#frame)
      direction.transformDirection(this.#frame)
    }
    direction.normalize()

    this.#position.push(point.x, point.y, point.z)
    this.#normal.push(direction.x, direction.y, direction.z)
    const painted = shade(look)
    this.#shade.push(painted.shade[0], painted.shade[1], painted.shade[2])
    this.#glow.push(painted.glow[0], painted.glow[1], painted.glow[2])
    this.#rough.push(painted.roughness)
    this.#metal.push(painted.metalness)
    return at
  }

  #quad(a: number, b: number, c: number, d: number): void {
    this.#triangle(a, b, c)
    this.#triangle(a, c, d)
  }

  #triangle(a: number, b: number, c: number): void {
    this.#index.push(a, b, c)
  }
}

/**
 * Which rim points start a real edge. A square corner is one point held twice,
 * once per normal, and the step between the two covers no ground: winding it
 * would only cost two triangles of nothing.
 */
function walk(rim: readonly Rim[]): number[] {
  const edges: number[] = []
  for (let at = 0; at < rim.length; at++) {
    const next = rim[(at + 1) % rim.length]!
    const here = rim[at]!
    if (Math.abs(here.x - next.x) > 1e-9 || Math.abs(here.z - next.z) > 1e-9) edges.push(at)
  }
  return edges
}

function slopeOf(lower: Ring, upper: Ring): Slope {
  const out = lower.inset - upper.inset
  const up = upper.y - lower.y
  const length = Math.hypot(out, up)
  if (length < 1e-9) return { horizontal: 1, vertical: 0 }
  return { horizontal: up / length, vertical: -out / length }
}

function blend(under: Slope, over: Slope): Slope {
  const horizontal = under.horizontal + over.horizontal
  const vertical = under.vertical + over.vertical
  const length = Math.hypot(horizontal, vertical)
  if (length < 1e-9) return under
  return { horizontal: horizontal / length, vertical: vertical / length }
}
