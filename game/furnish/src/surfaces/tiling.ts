import * as THREE from 'three'
import { replaceDefaultUV } from 'three/tsl'
import type { NodeMaterial } from 'three/webgpu'
import { planeMetres } from './pattern.ts'

/**
 * How big a texture is on an interior surface: one tile of the image every
 * `metres` metres of real floor, wall or ceiling.
 *
 * The image is laid out by where the surface is in the world rather than by the
 * mesh's own UVs, per axis. That is what keeps the stones the same size in a
 * small room and a large one, keeps a 6 m by 3 m wall from stretching the
 * pattern 2:1, and leaves no seam where one wall meets the next.
 *
 * The rule is written twice: `apply` hangs it on a material for the renderer to
 * run, and `uv` is the same arithmetic in TypeScript, which is how a test can
 * measure what a wall was given. Change one and change the other.
 */
export class MetreTiling {
  /** Metres of surface one tile of the image covers. */
  readonly metres: number

  constructor(metres: number) {
    this.metres = metres
  }

  /** Tiles per metre: the density itself, the same on both axes of any surface. */
  get perMetre(): number {
    return 1 / this.metres
  }

  /**
   * Where a point on a surface lands on the image, in tiles. The plane comes
   * from the face: a floor or a ceiling takes x and z, a wall takes height and
   * whichever horizontal axis it runs along.
   */
  uv(point: THREE.Vector3, normal: THREE.Vector3): THREE.Vector2 {
    const face = new THREE.Vector3(Math.abs(normal.x), Math.abs(normal.y), Math.abs(normal.z))
    const planar = face.y > Math.max(face.x, face.z)
      ? new THREE.Vector2(point.x, point.z)
      : face.x > face.z
        ? new THREE.Vector2(point.z, point.y)
        : new THREE.Vector2(point.x, point.y)
    return planar.multiplyScalar(this.perMetre)
  }

  /**
   * Puts the rule on a material and remembers it. Every texture the material
   * samples reads these coordinates instead of the mesh's UVs, which is a
   * context the node renderer honours; a shader patch would not survive the
   * WebGPU pipeline the game draws with.
   */
  apply<T extends NodeMaterial>(material: T): T {
    material.contextNode = replaceDefaultUV(this.#node())
    TILINGS.set(material, this)
    return material
  }

  /** The same arithmetic as `uv`, for the GPU. */
  #node() {
    return planeMetres().mul(this.perMetre)
  }
}

const TILINGS = new WeakMap<THREE.Material, MetreTiling>()

/** How a material tiles, or nothing if it was not built to tile in metres. */
export function tilingOf(material: THREE.Material): MetreTiling | undefined {
  return TILINGS.get(material)
}
