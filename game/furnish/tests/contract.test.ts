import { Greybox } from '@gb/scene'
import { FURNITURE_PROPS, type AnchorKind, type CellKind, type FurnitureProp, type Item, type Npc, type Plot } from '@gb/world'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import {
  FurnishDressing,
  FurnishIncomplete,
  FurnishLibrary,
  loadFurnish,
  placeholderFurnish,
  PROP_ART,
  SURFACE_PARTS,
} from '../src/index.ts'
import { boundsOf, meshesOf, sizeOf, town } from './support.ts'

const dressing = new FurnishDressing(placeholderFurnish())

/** A dressing that writes down what it was asked, so a fall-through is visible. */
class Behind extends Greybox {
  readonly asked: string[] = []

  override prop(prop: FurnitureProp): THREE.Object3D {
    this.asked.push(`prop:${prop}`)
    return super.prop(prop)
  }

  override surface(part: 'floor' | 'wall' | 'ceiling'): THREE.Material {
    this.asked.push(`surface:${part}`)
    return super.surface(part)
  }

  override building(plot: Plot, size: { width: number; depth: number; height: number }): THREE.Object3D {
    this.asked.push(`building:${plot.id}`)
    return super.building(plot, size)
  }

  override character(npc: Npc, doing: AnchorKind): THREE.Object3D {
    this.asked.push(`character:${npc.id}`)
    return super.character(npc, doing)
  }

  override pickup(item: Item): THREE.Object3D {
    this.asked.push(`pickup:${item.id}`)
    return super.pickup(item)
  }

  override ground(kind: CellKind): THREE.Material {
    this.asked.push(`ground:${kind}`)
    return super.ground(kind)
  }
}

describe('prop', () => {
  it('has art for every piece of furniture the generator can place', () => {
    const behind = new Behind()
    const furnished = new FurnishDressing(placeholderFurnish(), behind)

    for (const prop of FURNITURE_PROPS) {
      expect(meshesOf(furnished.prop(prop)).length, prop).toBeGreaterThan(0)
    }
    expect(behind.asked).toEqual([])
  })

  it('stands on the floor with its origin at the centre of its base', () => {
    for (const prop of FURNITURE_PROPS) {
      const bounds = boundsOf(dressing.prop(prop))

      expect(bounds.min.y, `${prop} sits on the floor`).toBeCloseTo(0, 3)
      const centre = bounds.getCenter(new THREE.Vector3())
      expect(Math.abs(centre.x), `${prop} centred across`).toBeLessThan(0.005)
      expect(Math.abs(centre.z), `${prop} centred front to back`).toBeLessThan(0.005)
    }
  })

  it('fills the floor the room planner keeps clear for it, and no more', () => {
    for (const prop of FURNITURE_PROPS) {
      const art = PROP_ART[prop]
      const size = sizeOf(dressing.prop(prop))

      expect(size.x, `${prop} across`).toBeCloseTo(art.w, 2)
      expect(size.z, `${prop} deep`).toBeCloseTo(art.d, 2)
      if (art.h !== undefined) expect(size.y, `${prop} tall`).toBeCloseTo(art.h, 2)
    }
  })

  it('is the same art every time, not a fresh load', () => {
    const first = dressing.prop('chair') as THREE.Mesh
    const second = dressing.prop('chair') as THREE.Mesh

    expect(second).not.toBe(first)
    expect(second.geometry).toBe(first.geometry)
    expect(second.material).toBe(first.material)
  })

  it('hands a prop it has no art for to the dressing behind', () => {
    const behind = new Behind()
    const empty = new FurnishDressing(new FurnishLibrary(new Map(), new Map()), behind)

    expect(meshesOf(empty.prop('bed')).length).toBeGreaterThan(0)
    expect(behind.asked).toEqual(['prop:bed'])
  })
})

describe('surface', () => {
  it('hands floor, walls and ceiling to the dressing behind when the pack has no surfaces in it', () => {
    const behind = new Behind()
    const furnished = new FurnishDressing(placeholderFurnish(), behind)

    for (const part of SURFACE_PARTS) expect(furnished.surface(part)).toBeInstanceOf(THREE.Material)
    expect(behind.asked).toEqual(['surface:floor', 'surface:wall', 'surface:ceiling'])
  })
})

describe('the rest of the dressing', () => {
  it('goes straight through: this box answers for the inside of a building and nothing else', async () => {
    const world = await town()
    const plot = world.plots()[0]!
    const npc = world.npcs()[0]!
    const item = world.items()[0]!
    const behind = new Behind()
    const furnished = new FurnishDressing(placeholderFurnish(), behind)

    furnished.building(plot, { width: 6, depth: 6, height: 4 })
    furnished.character(npc, 'stand')
    furnished.pickup(item)
    furnished.ground('street')

    expect(behind.asked).toEqual([`building:${plot.id}`, `character:${npc.id}`, `pickup:${item.id}`, 'ground:street'])
  })
})

describe('loadFurnish', () => {
  it('refuses a pack that is not the kit, so the city falls back to the layer behind', () => {
    const empty = new THREE.Group()

    expect(() => loadFurnish(empty)).toThrow(FurnishIncomplete)
    try {
      loadFurnish(empty)
    } catch (cause) {
      expect((cause as FurnishIncomplete).code).toBe('furnish-incomplete')
      expect((cause as FurnishIncomplete).missing).toContain('kitchenBar')
    }
  })
})
