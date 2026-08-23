import type { FurnitureProp } from '@gb/world'
import type * as THREE from 'three'
import { PROP_SPECS } from '../catalog/specs.ts'
import type { SurfaceLibrary } from '../surfaces/library.ts'
import { buildCatalog, keyOf, type Built } from './build.ts'
import { solidMaterial } from '../style/material.ts'
import type { FurnishStyle } from '../style/palette.ts'

/**
 * The furniture, built once from a seed.
 *
 * Every piece of it already stands on y = 0, faces north and fills the cells
 * the planner claims, so placing one is a `new Mesh` over shared geometry. The
 * whole catalog, both languages, draws on one material.
 */
export class FurnishLibrary {
  readonly #props: ReadonlyMap<string, Built>
  readonly #material: THREE.Material
  /** Interior floor, walls and ceiling, when the pack carries their textures. */
  readonly surfaces: SurfaceLibrary | undefined

  constructor(seed: string, surfaces?: SurfaceLibrary) {
    this.#props = buildCatalog(seed)
    this.#material = solidMaterial()
    this.surfaces = surfaces
  }

  /** One prop's geometry in one language. Shared: two chairs are one buffer. */
  geometry(prop: FurnitureProp, style: FurnishStyle): THREE.BufferGeometry {
    const built = this.#props.get(keyOf(style, prop))
    if (!built) throw new Error(`furnish: no builder for ${style}/${prop}`)
    return built.geometry
  }

  /** The one material everything here draws with. */
  get material(): THREE.Material {
    return this.#material
  }

  /**
   * How high off the floor the surface is that a body sits, lies or works on,
   * measured off the geometry that was built rather than declared. It comes out
   * equal to the contract height because the geometry was drawn to it, and the
   * tests fail if it ever does not.
   */
  contact(prop: FurnitureProp): number | undefined {
    return this.#props.get(keyOf('corpo', prop))?.contact
  }

  /** The second working surface, for a piece worked from both sides. */
  staffContact(prop: FurnitureProp): number | undefined {
    return PROP_SPECS[prop].staffContact
  }

  /** Triangles in one prop, both languages counted separately. */
  triangles(prop: FurnitureProp, style: FurnishStyle): number {
    return this.#props.get(keyOf(style, prop))?.triangles ?? 0
  }

  dispose(): void {
    for (const built of this.#props.values()) built.geometry.dispose()
    this.#material.dispose()
    this.surfaces?.dispose()
  }
}
