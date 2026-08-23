import { ITEM_ARCHETYPES, type ItemArchetype } from '@gb/world'
import type * as THREE from 'three'
import { Solid } from '../build/solid.ts'
import { itemCast, ITEM_CASTS } from './cast.ts'
import { ITEM_BUILDERS } from './index.ts'
import { ITEM_SPECS } from './specs.ts'

/** One archetype in one cast, ready to draw. */
export interface BuiltItem {
  readonly geometry: THREE.BufferGeometry
  readonly triangles: number
}

/** How an archetype and a cast are keyed together. */
export function itemKey(archetype: ItemArchetype, cast: number): string {
  return `${archetype}#${cast}`
}

/**
 * Every archetype in every cast, built once from one seed.
 *
 * The whole thing is `ITEM_ARCHETYPES.length` by `ITEM_CASTS` buffers and that
 * number never moves: a town with one envelope in it and a city with four
 * thousand pay the same. An item is a `new Mesh` over one of these on the
 * material the furniture already draws with.
 */
export function buildItems(seed: string): Map<string, BuiltItem> {
  const catalog = new Map<string, BuiltItem>()
  for (const archetype of ITEM_ARCHETYPES) {
    for (let cast = 0; cast < ITEM_CASTS; cast++) {
      catalog.set(itemKey(archetype, cast), buildItem(seed, archetype, cast))
    }
  }
  return catalog
}

function buildItem(seed: string, archetype: ItemArchetype, cast: number): BuiltItem {
  const spec = ITEM_SPECS[archetype]
  const solid = new Solid()
  ITEM_BUILDERS[archetype]({
    solid,
    cast: itemCast(seed, archetype, cast),
    width: spec.width,
    depth: spec.depth,
    height: spec.height,
  })

  const geometry = solid.geometry()
  geometry.name = itemKey(archetype, cast)
  return { geometry, triangles: solid.triangles }
}
