import { ITEM_ARCHETYPES, type Item, type ItemArchetype } from '@gb/world'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { ITEM_CASTS, ITEM_SPECS, SOLID_MATERIAL, furnishKit } from '../src/index.ts'
import { boundsOf, contactOf, dressingIn, meshesOf, sizeOf, trianglesOf } from './support.ts'

/**
 * What the player picks up.
 *
 * Fetching a thing and carrying it somewhere is the loop the whole quest layer
 * is built on, so the promises here are: every archetype the world can write
 * has its own shape, that shape is the real object's size, it stands on its own
 * base so it lands on a counter rather than in it, and the whole vocabulary
 * costs a fixed number of buffers on the one shared material however many items
 * a city holds.
 */

function thing(archetype: ItemArchetype, id = 'item_0001'): Item {
  return { id, name: `a ${archetype}`, description: `a ${archetype}`, archetype, value: 1, bulk: 'pocket' }
}

/** Ten microns: what a float32 position buffer holds, not a tolerance. */
const MICRONS = 1e-5

describe('a thing you pick up', () => {
  it('covers the whole vocabulary and gives each archetype its own shape', () => {
    const dressing = dressingIn('corpo')
    const seen = new Map<string, ItemArchetype>()

    for (const archetype of ITEM_ARCHETYPES) {
      const object = dressing.pickup(thing(archetype))
      expect(trianglesOf(object), archetype).toBeGreaterThan(0)

      // no two archetypes come out the same size, which is what "every carried
      // thing is the same beige cube" looked like
      const size = sizeOf(object)
      const shape = [size.x, size.y, size.z].map((metres) => Math.round(metres * 1000)).join('x')
      expect(seen.get(shape), `${archetype} is the same box as ${seen.get(shape)}`).toBeUndefined()
      seen.set(shape, archetype)
    }
    expect(seen.size).toBe(ITEM_ARCHETYPES.length)
  })

  it('is drawn at the size the vocabulary publishes, and never over it', () => {
    const kit = furnishKit()
    for (const archetype of ITEM_ARCHETYPES) {
      const spec = ITEM_SPECS[archetype]
      for (let cast = 0; cast < ITEM_CASTS; cast++) {
        const bounds = new THREE.Box3().setFromBufferAttribute(
          kit.itemGeometry(archetype, cast).getAttribute('position') as THREE.BufferAttribute,
        )
        const where = `${archetype} cast ${cast}`
        expect(bounds.max.x - bounds.min.x, where).toBeLessThanOrEqual(spec.width + MICRONS)
        expect(bounds.max.z - bounds.min.z, where).toBeLessThanOrEqual(spec.depth + MICRONS)
        expect(bounds.max.y - bounds.min.y, where).toBeLessThanOrEqual(spec.height + MICRONS)
      }
    }
  })

  it('stands on the centre of its own base, so putting it down cannot sink it', () => {
    const kit = furnishKit()
    for (const archetype of ITEM_ARCHETYPES) {
      for (let cast = 0; cast < ITEM_CASTS; cast++) {
        const bounds = new THREE.Box3().setFromBufferAttribute(
          kit.itemGeometry(archetype, cast).getAttribute('position') as THREE.BufferAttribute,
        )
        const where = `${archetype} cast ${cast}`
        expect(bounds.min.y, where).toBeCloseTo(0, 5)
        expect((bounds.min.x + bounds.max.x) / 2, where).toBeCloseTo(0, 3)
        expect((bounds.min.z + bounds.max.z) / 2, where).toBeCloseTo(0, 3)
      }
    }
  })

  it('sits exactly on the counter it is put on, not in it and not over it', () => {
    const dressing = dressingIn('corpo')
    const top = contactOf(dressing.prop('counter'), 'work')

    for (const archetype of ITEM_ARCHETYPES) {
      const object = dressing.pickup(thing(archetype))
      object.position.y = top
      expect(boundsOf(object).min.y, archetype).toBeCloseTo(top, 5)
    }
  })

  it('draws a cheap one and a worn one differently without being two models', () => {
    const dressing = dressingIn('corpo')
    const kit = furnishKit()
    const casts = new Set<number>()
    for (let at = 1; at <= 40; at++) casts.add(kit.castOf(thing('ledger', `item_${String(at).padStart(4, '0')}`)))
    expect(casts.size).toBe(ITEM_CASTS)

    const shapes = new Set(
      [...casts].map((cast) => kit.itemGeometry('ledger', cast).getAttribute('shade').array.join()),
    )
    expect(shapes.size).toBe(ITEM_CASTS)

    // and the same item is the same thing every time it is looked at
    const twice = [dressing.pickup(thing('ledger', 'item_0007')), dressing.pickup(thing('ledger', 'item_0007'))]
    expect((twice[1] as THREE.Mesh).geometry).toBe((twice[0] as THREE.Mesh).geometry)
  })

  it('is one indexed mesh on the material the furniture already draws with', () => {
    const dressing = dressingIn('home')
    const materials = new Set<THREE.Material>()
    for (const archetype of ITEM_ARCHETYPES) {
      const meshes = meshesOf(dressing.pickup(thing(archetype)))
      expect(meshes.length, archetype).toBe(1)
      expect(meshes[0]!.geometry.getIndex(), archetype).not.toBeNull()
      materials.add(meshes[0]!.material as THREE.Material)
    }
    materials.add((dressing.prop('table') as THREE.Mesh).material as THREE.Material)

    expect(materials.size).toBe(1)
    expect([...materials][0]!.name).toBe(SOLID_MATERIAL)
  })

  it('costs a fixed number of buffers however many items a city has', () => {
    const kit = furnishKit()
    const buffers = new Set<THREE.BufferGeometry>()
    for (let at = 1; at <= 500; at++) {
      const archetype = ITEM_ARCHETYPES[at % ITEM_ARCHETYPES.length]!
      buffers.add(kit.item(thing(archetype, `item_${String(at).padStart(4, '0')}`)))
    }
    expect(buffers.size).toBeLessThanOrEqual(ITEM_ARCHETYPES.length * ITEM_CASTS)
  })

  it('goes into one batch, so five hundred of them are one draw', () => {
    const kit = furnishKit()
    const geometries = ITEM_ARCHETYPES.flatMap((archetype) =>
      Array.from({ length: ITEM_CASTS }, (_, cast) => kit.itemGeometry(archetype, cast)),
    )
    const vertices = geometries.reduce((total, geometry) => total + geometry.getAttribute('position').count, 0)
    const indices = geometries.reduce((total, geometry) => total + geometry.getIndex()!.count, 0)

    // BatchedMesh refuses a geometry whose attributes do not match the first
    // one it took, so this passing is the proof that they all agree
    const batch = new THREE.BatchedMesh(600, vertices, indices, kit.material)
    const ids = geometries.map((geometry) => batch.addGeometry(geometry))
    for (let at = 0; at < 500; at++) batch.addInstance(ids[at % ids.length]!)

    const scene = new THREE.Scene()
    scene.add(batch)
    expect(meshesOf(scene).length).toBe(1)
    expect(batch.instanceCount).toBe(500)
  })

  it('builds the same catalog twice, vertex for vertex, and a different one from another seed', () => {
    const positions = (seed: string) => {
      const kit = furnishKit(seed)
      return ITEM_ARCHETYPES.flatMap((archetype) =>
        Array.from({ length: ITEM_CASTS }, (_, cast) =>
          Array.from(kit.itemGeometry(archetype, cast).getAttribute('position').array as Float32Array),
        ),
      )
    }

    expect(positions('a-town')).toEqual(positions('a-town'))
    expect(positions('another-town')).not.toEqual(positions('a-town'))
  })
})
