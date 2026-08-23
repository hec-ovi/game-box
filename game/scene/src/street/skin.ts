import type { World } from '@gb/world'
import * as THREE from 'three'
import { PAVED_KINDS, surfaceGeometry } from '../ground.ts'
import { canyonProbe } from './canyon.ts'
import { StreetField } from './field.ts'
import { streetMaterial, unit, type StreetSkinMaterial } from './material.ts'
import { surfaceNoise } from './noise.ts'
import { SURFACE } from './sizes.ts'

/**
 * The road and the pavement, weathered and wet, in one mesh over the ground the
 * dressing laid.
 *
 * It is one draw for the whole city however big the city is, because it is the
 * same merged quads the ground is already made of, lifted a centimetre clear of
 * the paint and given a surface of their own. Nothing is redrawn and nothing is
 * reflected by re-rendering the scene: the shine is the environment the app
 * already lights everything with, answered at the roughness the weather says.
 */
export class StreetSkin {
  readonly mesh: THREE.Mesh
  readonly #skin: StreetSkinMaterial
  #wetness = 0
  #night = 1

  private constructor(mesh: THREE.Mesh, skin: StreetSkinMaterial) {
    this.mesh = mesh
    this.#skin = skin
  }

  /** Nothing to skin in a city with no paved cells in it. */
  static over(world: World, seed: string): StreetSkin | undefined {
    const parts = PAVED_KINDS.map((kind) => surfaceGeometry(world, kind)).filter((one) => one !== undefined)
    if (!parts.length) return undefined

    const skin = streetMaterial(new StreetField(world, PAVED_KINDS), surfaceNoise(seed), canyonProbe(seed))
    const mesh = new THREE.Mesh(lifted(parts, SURFACE.lift), skin.material)
    mesh.name = 'street:skin'
    mesh.receiveShadow = true
    mesh.castShadow = false
    // over the road, over the paint, under everything that stands on it
    mesh.renderOrder = 1
    return new StreetSkin(mesh, skin)
  }

  /** 0 dry, 1 soaked. Whoever owns the weather writes this; it is one uniform. */
  get wetness(): number {
    return this.#wetness
  }

  set wetness(wetness: number) {
    this.#wetness = unit(wetness)
    this.#skin.setWetness(this.#wetness)
  }

  /** 0 broad daylight, 1 after dark. Whoever owns the clock writes this. */
  get night(): number {
    return this.#night
  }

  set night(darkness: number) {
    this.#night = unit(darkness)
    this.#skin.setNight(this.#night)
  }
}

/** The same faces, pushed out along their own normals so they clear what they cover. */
function lifted(parts: readonly THREE.BufferGeometry[], by: number): THREE.BufferGeometry {
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []

  for (const part of parts) {
    const position = part.getAttribute('position')
    const normal = part.getAttribute('normal')
    const uv = part.getAttribute('uv')
    for (let i = 0; i < position.count; i++) {
      positions.push(
        position.getX(i) + normal.getX(i) * by,
        position.getY(i) + normal.getY(i) * by,
        position.getZ(i) + normal.getZ(i) * by,
      )
      normals.push(normal.getX(i), normal.getY(i), normal.getZ(i))
      uvs.push(uv.getX(i), uv.getY(i))
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3))
  geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(normals), 3))
  geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2))
  return geometry
}
