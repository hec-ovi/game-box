import * as THREE from 'three'
import { cellUv } from './atlas.ts'
import { BLANK } from './glyphs.ts'
import { SIGN_ATTRIBUTES } from './material.ts'
import { SIGN, type Sign, type Written } from './sign.ts'

/**
 * A building's signs as one indexed mesh on the one sign material, which is
 * exactly what `@gb/scene`'s batch takes: every sign in the city lands in one
 * buffer and costs one draw, however many buildings are standing.
 *
 * A sign is quads and nothing else. The panel is a quad on the empty cell, each
 * letter is a quad on its own cell, and a letter quad paints the panel colour
 * where the letter is not, so the two are the same opaque surface with no
 * blending and nothing to sort.
 */
export function buildSigns(signs: readonly Sign[], material: THREE.Material, name: string): THREE.Mesh | undefined {
  const quads = signs.reduce((total, sign) => total + 1 + sign.glyphs.length, 0)
  if (quads === 0) return undefined

  const build = new Quads(quads)
  for (const sign of signs) {
    build.add(sign, { cell: BLANK, u: 0, v: 0, width: sign.width, height: sign.height }, 0)
    for (const glyph of sign.glyphs) build.add(sign, glyph, SIGN.layer)
  }

  const mesh = new THREE.Mesh(build.geometry(), material)
  mesh.name = `${name}:${SIGN.material}`
  mesh.castShadow = false
  mesh.receiveShadow = true
  return mesh
}

/** How many triangles a plan's worth of signs comes to, without building them. */
export function signTriangles(signs: readonly Sign[]): number {
  return signs.reduce((total, sign) => total + 2 * (1 + sign.glyphs.length), 0)
}

/** A run of quads being filled in, one buffer per attribute. */
class Quads {
  readonly #position: Float32Array
  readonly #normal: Float32Array
  readonly #uv: Float32Array
  readonly #ink: Float32Array
  readonly #panel: Float32Array
  readonly #glow: Float32Array
  readonly #index: Uint32Array
  #at = 0

  constructor(quads: number) {
    this.#position = new Float32Array(quads * 12)
    this.#normal = new Float32Array(quads * 12)
    this.#uv = new Float32Array(quads * 8)
    this.#ink = new Float32Array(quads * 12)
    this.#panel = new Float32Array(quads * 12)
    this.#glow = new Float32Array(quads * 8)
    this.#index = new Uint32Array(quads * 6)
  }

  add(sign: Sign, written: Written, layer: number): void {
    const [rx, rz] = sign.right
    // the panel looks along its own width turned a quarter up
    const [nx, nz] = [-rz, rx]
    const cx = sign.origin[0] + rx * written.u + nx * layer
    const cy = sign.origin[1] + written.v
    const cz = sign.origin[2] + rz * written.u + nz * layer
    const [halfW, halfH] = [written.width / 2, written.height / 2]
    const [u0, v0, u1, v1] = cellUv(written.cell)

    const ink = colour(sign.ink)
    const panel = colour(sign.panel)
    const first = this.#at * 4
    const corners: ReadonlyArray<readonly [number, number]> = [[-1, -1], [1, -1], [1, 1], [-1, 1]]
    corners.forEach(([sideways, upright], corner) => {
      const vertex = first + corner
      this.#position.set([cx + rx * halfW * sideways, cy + halfH * upright, cz + rz * halfW * sideways], vertex * 3)
      this.#normal.set([nx, 0, nz], vertex * 3)
      this.#uv.set([sideways < 0 ? u0 : u1, upright < 0 ? v0 : v1], vertex * 2)
      this.#ink.set(ink, vertex * 3)
      this.#panel.set(panel, vertex * 3)
      this.#glow.set(sign.glow, vertex * 2)
    })
    this.#index.set([first, first + 1, first + 2, first, first + 2, first + 3], this.#at * 6)
    this.#at++
  }

  geometry(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(this.#position, 3))
    geometry.setAttribute('normal', new THREE.BufferAttribute(this.#normal, 3))
    geometry.setAttribute('uv', new THREE.BufferAttribute(this.#uv, 2))
    geometry.setAttribute(SIGN_ATTRIBUTES.ink, new THREE.BufferAttribute(this.#ink, 3))
    geometry.setAttribute(SIGN_ATTRIBUTES.panel, new THREE.BufferAttribute(this.#panel, 3))
    geometry.setAttribute(SIGN_ATTRIBUTES.glow, new THREE.BufferAttribute(this.#glow, 2))
    geometry.setIndex(new THREE.BufferAttribute(this.#index, 1))
    geometry.computeBoundingSphere()
    return geometry
  }
}

const scratch = new THREE.Color()

/** A colour as three numbers in the renderer's working space. */
function colour(hex: number): [number, number, number] {
  scratch.setHex(hex)
  return [scratch.r, scratch.g, scratch.b]
}
