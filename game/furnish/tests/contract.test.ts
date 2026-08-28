import { Greybox, type BuildingSize, type Dressing, type SurfacePart } from '@gb/scene'
import {
  FURNITURE_PROPS,
  METRICS,
  type CellKind,
  type FurnitureProp,
  type Item,
  type ItemArchetype,
  type Plot,
  type ResolvedCharter,
} from '@gb/world'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import {
  FURNISH_STYLES,
  FurnishDressing,
  FurnishError,
  SOLID_MATERIAL,
  SURFACE_PARTS,
  furnishKit,
} from '../src/index.ts'
import { ROOM_SIZE, dressingIn, meshesOf, town, trianglesOf } from './support.ts'

/** A dressing that writes down what it was asked, so a fall-through is visible. */
class Behind extends Greybox {
  readonly asked: string[] = []

  override surface(part: SurfacePart): THREE.Material {
    this.asked.push(`surface:${part}`)
    return super.surface(part)
  }

  override building(plot: Plot, size: BuildingSize, charter: ResolvedCharter): THREE.Object3D {
    this.asked.push(`building:${plot.id}`)
    return super.building(plot, size, charter)
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

/** A dressing with a far look of its own, so a call that reached it is visible in what came back. */
class Whole extends Greybox {
  override shell(plot: Plot, size: BuildingSize, charter: ResolvedCharter): THREE.Object3D {
    const object = super.shell(plot, size, charter)
    object.name = `far:${plot.id}`
    return object
  }
}

/** The seam at its thinnest: a dressing that answers only what every dressing must. */
function bare(): Dressing {
  const grey = new Greybox()
  return {
    building: (plot, size, charter) => grey.building(plot, size, charter),
    prop: (prop) => grey.prop(prop),
    character: (npc, doing) => grey.character(npc, doing),
    pickup: (item) => grey.pickup(item),
    ground: (kind) => grey.ground(kind),
    surface: (part) => grey.surface(part),
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

describe('the height a piece is lifted to', () => {
  it('is published, and it is the drawn top of the counter, so a till lands on it exactly', () => {
    const dressing = dressingIn('corpo')
    expect(dressing.contactHeight('counter')).toBe(METRICS.furniture.serviceCounterHeight)
    expect(dressing.contactHeight('bar-counter')).toBe(METRICS.furniture.barCounterHeight)
    // a piece nobody stands anything on has no such height
    expect(dressing.contactHeight('wardrobe')).toBeUndefined()
  })
})

describe('what it refuses', () => {
  it('names a prop or a thing it has no shape for, rather than drawing it flat', () => {
    const kit = furnishKit()
    const throne = 'throne' as FurnitureProp
    const sword = 'sword' as ItemArchetype

    expect(() => kit.heightOf(throne, 'corpo')).toThrow(FurnishError)
    expect(() => kit.heightOf(throne, 'corpo')).toThrow(/unknown-prop/)
    expect(() => kit.geometry(throne, 'home')).toThrow(/unknown-prop/)
    expect(() => kit.itemGeometry(sword, 0)).toThrow(/unknown-item/)
    // a second surface is a fact about the table, so an unknown name simply has none
    expect(kit.staffContact(throne)).toBeUndefined()
    kit.dispose()
  })
})

describe('surface', () => {
  it('hands floor, walls and ceiling to the dressing behind when there is no pack', () => {
    const behind = new Behind()
    const furnished = new FurnishDressing(furnishKit(), behind)

    for (const part of SURFACE_PARTS) expect(furnished.surface(part, ROOM_SIZE)).toBeInstanceOf(THREE.Material)
    expect(behind.asked).toEqual(['surface:floor', 'surface:wall', 'surface:ceiling'])
  })
})

describe('the rest of the dressing', () => {
  it('goes straight through: this box answers for the inside of a building and nothing else', () => {
    const world = town()
    const plot = world.plots()[0]!
    const item: Item = { id: 'item_0001', name: 'a cup', description: 'a cup', archetype: 'cup', value: 1, bulk: 'pocket' }
    const behind = new Behind()
    const furnished = new FurnishDressing(furnishKit(), behind)

    furnished.building(plot, { width: 6, depth: 6, height: 4 }, world.charter(plot.kind)!)
    furnished.ground('street')

    expect(behind.asked).toEqual([`building:${plot.id}`, 'ground:street'])

    // what is lying on the furniture is the inside of a building too, so it is
    // answered here and never handed on
    expect(trianglesOf(furnished.pickup(item))).toBeGreaterThan(0)
    expect(behind.asked).not.toContain(`pickup:${item.id}`)
  })

  it('carries the far look, the light, the paint and the rubbish the dressing behind publishes', () => {
    const world = town()
    const plot = world.plots()[0]!
    const charter = world.charter(plot.kind)!
    const size = { width: 6, depth: 6, height: 4 }
    const behind = new Whole()
    const furnished = new FurnishDressing(furnishKit(), behind)

    // @gb/scene reads these by asking whether the dressing has one, so being there is half the test
    for (const part of ['shell', 'lights', 'marking', 'clutter'] as const) expect(part in furnished, part).toBe(true)
    expect(furnished.shell!(plot, size, charter).name).toBe(`far:${plot.id}`)
    expect(furnished.lights!(plot, size, charter)).toEqual(behind.lights(plot, size))

    // and a dressing behind with none of them leaves the question answerable
    const plain = new FurnishDressing(furnishKit(), bare())
    for (const part of ['shell', 'lights', 'marking', 'clutter'] as const) expect(part in plain, part).toBe(false)
  })
})
