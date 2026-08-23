import type { FurnitureProp } from '@gb/world'
import * as THREE from 'three'
import type { SurfaceLibrary } from '../surfaces/library.ts'
import type { Built, Part } from './build.ts'

/**
 * The furniture, loaded once. Every piece of it is already the right size, the
 * right way round and standing on y = 0, so placing one is a new `Mesh` over
 * geometry and a material the whole town shares.
 */
export class FurnishLibrary {
  readonly #props: ReadonlyMap<FurnitureProp, Built>
  readonly #materials: ReadonlyMap<string, THREE.Material>
  /** Interior floor, walls and ceiling, when the pack carries their textures. */
  readonly surfaces: SurfaceLibrary | undefined

  constructor(
    props: ReadonlyMap<FurnitureProp, Built>,
    materials: ReadonlyMap<string, THREE.Material>,
    surfaces?: SurfaceLibrary,
  ) {
    this.#props = props
    this.#materials = materials
    this.surfaces = surfaces
  }

  /** One prop's geometry, one entry per material on it. Nothing for a prop the library has no art for. */
  parts(prop: FurnitureProp): readonly Part[] | undefined {
    return this.#props.get(prop)?.parts
  }

  /**
   * How high off the floor the surface of this prop is that a body sits, lies
   * or works on, measured off the geometry that was built. Nothing for a prop
   * nobody uses, and never the top of the bounding box: the top of a chair is
   * its backrest.
   */
  contact(prop: FurnitureProp): number | undefined {
    return this.#props.get(prop)?.contact
  }

  material(name: string): THREE.Material {
    const found = this.#materials.get(name)
    if (found) return found
    throw new Error(`furnish: no material named ${name}`)
  }

  /** Frees every buffer, material and texture the library holds. */
  dispose(): void {
    for (const built of this.#props.values()) for (const part of built.parts) part.geometry.dispose()
    for (const material of this.#materials.values()) material.dispose()
    this.surfaces?.dispose()
  }
}
