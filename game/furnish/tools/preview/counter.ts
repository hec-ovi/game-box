import { ITEM_ARCHETYPES, type Item, type ItemArchetype } from '@gb/world'
import * as THREE from 'three'
import { ITEM_SPECS, type FurnishDressing, type FurnishLibrary } from '../../src/index.ts'

/**
 * One of every kind of thing a player can pick up, standing on a run of the
 * counter this box builds.
 *
 * Two rows, the taller half at the back so nothing hides behind anything, each
 * item on its own footprint plus a hand's gap and clear of the middle line, so
 * no two of them touch. The camera stands on the north side, which is the side
 * a prop's front looks at.
 */

const COUNTERS = 4
const COUNTER_WIDTH = 1.5
/** The counter's drawn top: what an item is put down on. */
export const COUNTER_TOP = 1.0
/** Air between one thing and the next. */
const GAP = 0.055

export interface Bench {
  readonly root: THREE.Group
  readonly items: { archetype: ItemArchetype; object: THREE.Object3D }[]
  /** How wide the longer of the two rows came out, so a camera can frame it. */
  readonly span: number
}

export function buildCounter(
  kit: FurnishLibrary,
  dressing: FurnishDressing,
  options: { cast: number; batched: boolean; some: readonly ItemArchetype[] },
): Bench {
  const root = new THREE.Group()
  for (let at = 0; at < COUNTERS; at++) {
    const counter = dressing.prop('counter')
    counter.position.x = (at - (COUNTERS - 1) / 2) * COUNTER_WIDTH
    root.add(counter)
  }

  const byHeight = [...ITEM_ARCHETYPES].sort((a, b) => ITEM_SPECS[b].height - ITEM_SPECS[a].height)
  const rows = options.some.length
    ? [options.some, []]
    : [byHeight.slice(0, Math.ceil(byHeight.length / 2)), byHeight.slice(Math.ceil(byHeight.length / 2))]

  const items: { archetype: ItemArchetype; object: THREE.Object3D }[] = []
  let span = 0
  rows.forEach((row, index) => {
    const run = row.reduce((total, archetype) => total + ITEM_SPECS[archetype].width + GAP, -GAP)
    span = Math.max(span, run)
    let x = -run / 2
    for (const archetype of row) {
      const spec = ITEM_SPECS[archetype]
      const object = dressing.pickup(idFor(kit, archetype, options.cast))
      const z = options.some.length ? 0 : (index === 0 ? 1 : -1) * (GAP / 2 + spec.depth / 2)
      object.position.set(x + spec.width / 2, COUNTER_TOP, z)
      object.updateMatrixWorld()
      x += spec.width + GAP
      items.push({ archetype, object })
    }
  })

  if (options.batched) root.add(batch(kit, items))
  else for (const { object } of items) root.add(object)

  return { root, items, span }
}

/** Every item in one `BatchedMesh`, which is what the draw count is read off. */
function batch(kit: FurnishLibrary, items: { object: THREE.Object3D }[]): THREE.BatchedMesh {
  const geometries = items.map(({ object }) => (object as THREE.Mesh).geometry)
  const vertices = geometries.reduce((total, geometry) => total + geometry.getAttribute('position').count, 0)
  const indices = geometries.reduce((total, geometry) => total + geometry.getIndex()!.count, 0)
  const mesh = new THREE.BatchedMesh(items.length, vertices, indices, kit.material)
  mesh.castShadow = true
  for (const [at, { object }] of items.entries()) {
    const id = mesh.addGeometry(geometries[at]!)
    mesh.setMatrixAt(mesh.addInstance(id), object.matrix.compose(object.position, object.quaternion, object.scale))
  }
  return mesh
}

/** An item whose id lands on the cast being shown. */
function idFor(kit: FurnishLibrary, archetype: ItemArchetype, cast: number): Item {
  let id = 'item_0001'
  for (let at = 1; at < 400; at++) {
    const candidate = `item_${String(at).padStart(4, '0')}`
    if (kit.castOf({ archetype, id: candidate } as Item) === cast) {
      id = candidate
      break
    }
  }
  return { id, name: archetype, description: archetype, archetype, value: 1, bulk: 'pocket' }
}
