import { PROP_SPECS, type FurnitureProp, type Item, type ItemArchetype } from '@gb/world'
import type * as THREE from 'three'
import { FurnishError } from '../errors.ts'
import { buildItems, itemKey, type BuiltItem } from '../items/build.ts'
import { castIndex } from '../items/cast.ts'
import type { SurfaceLibrary } from '../surfaces/library.ts'
import { buildCatalog, keyOf, type Built } from './build.ts'
import { solidMaterial } from '../style/material.ts'
import type { FurnishStyle } from '../style/palette.ts'

/**
 * The furniture and the things lying on it, built once from a seed.
 *
 * Every piece of it already stands on y = 0, faces north and fills the cells
 * the planner claims, so placing one is a `new Mesh` over shared geometry. The
 * whole catalog, both languages and every cast of every item, draws on one
 * material.
 */
export class FurnishLibrary {
  readonly #props: ReadonlyMap<string, Built>
  readonly #items: ReadonlyMap<string, BuiltItem>
  readonly #material: THREE.Material
  /** Interior floor, walls and ceiling, when the pack carries their textures. */
  readonly surfaces: SurfaceLibrary | undefined
  /** The town's seed: what the furniture, the items, the walls and the surfaces are all drawn from. */
  readonly seed: string

  constructor(seed: string, surfaces?: SurfaceLibrary) {
    this.#props = buildCatalog(seed)
    this.#items = buildItems(seed)
    this.#material = solidMaterial()
    this.surfaces = surfaces
    this.seed = seed
  }

  /**
   * One prop's geometry in one language, tuned to one of the town's screenings.
   * Shared: two chairs are one buffer, and two televisions on the same
   * screening are one buffer as well.
   */
  geometry(prop: FurnitureProp, style: FurnishStyle, slot = 0): THREE.BufferGeometry {
    const { screens } = this.#built(style, prop)
    return screens[slot % screens.length]!
  }

  /** One thing a player can pick up, in the cast its id draws. Shared per cast. */
  item(item: Item): THREE.BufferGeometry {
    return this.itemGeometry(item.archetype, castIndex(this.seed, item.id))
  }

  /** Which cast of its archetype an item is drawn in. */
  castOf(item: Item): number {
    return castIndex(this.seed, item.id)
  }

  /** One archetype in one named cast. */
  itemGeometry(archetype: ItemArchetype, cast: number): THREE.BufferGeometry {
    const built = this.#items.get(itemKey(archetype, cast))
    if (!built) throw new FurnishError('unknown-item', `${archetype} cast ${cast}`)
    return built.geometry
  }

  /** Triangles in one cast of one archetype. */
  itemTriangles(archetype: ItemArchetype, cast: number): number {
    return this.#items.get(itemKey(archetype, cast))?.triangles ?? 0
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

  /** How many screenings a piece can be tuned to: more than one only if it carries a screen. */
  screenings(prop: FurnitureProp, style: FurnishStyle): number {
    return this.#props.get(keyOf(style, prop))?.screens.length ?? 0
  }

  /** The second working surface, for a piece worked from both sides. */
  staffContact(prop: FurnitureProp): number | undefined {
    return PROP_SPECS[prop]?.staffContact
  }

  /**
   * How tall a piece stands, measured off the triangles that were built rather
   * than off what it declares: the top of a chair is its backrest. This is what
   * a wall bay is tested against before it is allowed to stand off the wall in
   * front of one, so a piece nobody built is refused rather than read as flat.
   */
  heightOf(prop: FurnitureProp, style: FurnishStyle): number {
    const geometry = this.#built(style, prop).screens[0]!
    geometry.computeBoundingBox()
    return geometry.boundingBox!.max.y
  }

  /** Triangles in one prop, both languages counted separately. */
  triangles(prop: FurnitureProp, style: FurnishStyle): number {
    return this.#props.get(keyOf(style, prop))?.triangles ?? 0
  }

  #built(style: FurnishStyle, prop: FurnitureProp): Built {
    const built = this.#props.get(keyOf(style, prop))
    if (!built) throw new FurnishError('unknown-prop', `${style}/${prop}`)
    return built
  }

  dispose(): void {
    for (const built of this.#props.values()) for (const geometry of built.screens) geometry.dispose()
    for (const built of this.#items.values()) built.geometry.dispose()
    this.#material.dispose()
    this.surfaces?.dispose()
  }
}
