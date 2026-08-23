import { Greybox } from '@gb/scene'
import { FURNITURE_PROPS, type AnchorKind, type CellKind, type FurnitureProp, type Item, type Npc, type Plot } from '@gb/world'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { FURNISH_STYLES, FurnishDressing, PROP_SPECS, SOLID_MATERIAL, SURFACE_PARTS, furnishKit } from '../src/index.ts'
import { dressingIn, meshesOf, town, trianglesOf } from './support.ts'

/** A dressing that writes down what it was asked, so a fall-through is visible. */
class Behind extends Greybox {
  readonly asked: string[] = []

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
  it('builds every piece of furniture the generator can place, in both languages', () => {
    for (const style of FURNISH_STYLES) {
      for (const prop of FURNITURE_PROPS) {
        expect(trianglesOf(dressingIn(style).prop(prop)), `${style} ${prop}`).toBeGreaterThan(0)
      }
    }
  })

  it('is one mesh on the one material the whole catalog shares', () => {
    const dressing = dressingIn('corpo')
    const materials = new Set<THREE.Material>()
    for (const prop of FURNITURE_PROPS) {
      const meshes = meshesOf(dressing.prop(prop))
      expect(meshes.length, prop).toBe(1)
      materials.add(meshes[0]!.material as THREE.Material)
    }

    expect(materials.size).toBe(1)
    expect([...materials][0]!.name).toBe(SOLID_MATERIAL)
  })

  it('carries its colour, its emission and its finish on the vertices, which is what lets it batch', () => {
    const mesh = dressingIn('home').prop('lamp') as THREE.Mesh
    for (const attribute of ['position', 'normal', 'shade', 'glow', 'rough', 'metal']) {
      expect(mesh.geometry.getAttribute(attribute), attribute).toBeDefined()
    }
    expect(mesh.geometry.getIndex()).not.toBeNull()
  })

  it('is the same buffer every time: two chairs are two objects over one geometry', () => {
    const dressing = dressingIn('corpo')
    const first = dressing.prop('chair') as THREE.Mesh
    const second = dressing.prop('chair') as THREE.Mesh

    expect(second).not.toBe(first)
    expect(second.geometry).toBe(first.geometry)
    expect(second.material).toBe(first.material)
  })

  it('draws the same prop differently in the two languages over one library', () => {
    const kit = furnishKit('two-tongues')
    const corpo = new FurnishDressing(kit, undefined, 'corpo')
    const home = corpo.as('home')

    expect(home.style).toBe('home')
    expect(corpo.as('corpo')).toBe(corpo)
    expect((home.prop('sofa') as THREE.Mesh).geometry).not.toBe((corpo.prop('sofa') as THREE.Mesh).geometry)
    expect((home.prop('sofa') as THREE.Mesh).material).toBe((corpo.prop('sofa') as THREE.Mesh).material)
  })
})

describe('the published spec', () => {
  it('covers the whole vocabulary and nothing else', () => {
    expect(Object.keys(PROP_SPECS).sort()).toEqual([...FURNITURE_PROPS].sort())
  })

  it('gives every prop a contact or a height, never both', () => {
    for (const [prop, spec] of Object.entries(PROP_SPECS) as [FurnitureProp, (typeof PROP_SPECS)[FurnitureProp]][]) {
      expect(spec.contact !== undefined && spec.height !== undefined, prop).toBe(false)
    }
  })

  it('marks what belongs on a worktop rather than on the floor', () => {
    const onSurface = Object.entries(PROP_SPECS)
      .filter(([, spec]) => spec.onSurface)
      .map(([prop]) => prop)
    expect(onSurface.sort()).toEqual(['coffee-machine', 'register'])
  })
})

describe('surface', () => {
  it('hands floor, walls and ceiling to the dressing behind when there is no pack', () => {
    const behind = new Behind()
    const furnished = new FurnishDressing(furnishKit(), behind)

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
    const furnished = new FurnishDressing(furnishKit(), behind)

    furnished.building(plot, { width: 6, depth: 6, height: 4 })
    furnished.character(npc, 'stand')
    furnished.ground('street')

    expect(behind.asked).toEqual([`building:${plot.id}`, `character:${npc.id}`, 'ground:street'])

    // what is lying on the furniture is the inside of a building too, so it is
    // answered here and never handed on
    expect(trianglesOf(furnished.pickup(item))).toBeGreaterThan(0)
    expect(behind.asked).not.toContain(`pickup:${item.id}`)
  })
})
