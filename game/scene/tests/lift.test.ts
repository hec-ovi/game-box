import { METRICS, type Furniture, type FurnitureProp } from '@gb/world'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { buildInterior, Greybox, type InteriorBuild } from '../src/index.ts'
import { bar } from './bar.ts'

/**
 * What stands on a counter rather than on the floor. A till and a coffee
 * machine belong on a worktop, and furniture that could only say where on the
 * floor it was left them out of the city altogether.
 */

/** Ten microns: what a float32 position buffer holds, not a tolerance. */
const EXACT = 5

/** The height the counter's top is drawn at, and the number a till is lifted by. */
const COUNTER_TOP = METRICS.furniture.serviceCounterHeight

function piece(id: string, prop: FurnitureProp, x: number, y: number, lift?: number): Furniture {
  return { id, prop, roomId: 'room_0001', pos: { x, y }, rot: 0, ...(lift === undefined ? {} : { lift }) }
}

/** One handmade bar with that furniture in it, built for real. */
function room(furniture: Furniture[], dressing = new Greybox()): InteriorBuild {
  const { world, interior } = bar(furniture)
  return buildInterior(world, interior, dressing)
}

/** Every triangle of one built piece, boxed in interior metres. */
function drawn(built: InteriorBuild, propId: string): THREE.Box3 {
  return new THREE.Box3().setFromObject(built.props.get(propId)!)
}

/** A kit whose props all come off one buffer on one material, the way a real one does. */
class SharedKit extends Greybox {
  readonly geometry = new THREE.BoxGeometry(0.4, 0.3, 0.4)
  readonly material = new THREE.MeshStandardMaterial()

  override prop(): THREE.Object3D {
    const mesh = new THREE.Mesh(this.geometry, this.material)
    mesh.position.y = 0.15
    const base = new THREE.Group()
    base.add(mesh)
    return base
  }
}

describe('a piece that stands on another piece', () => {
  it('puts the till on the counter top, not a centimetre over it', () => {
    const built = room([piece('prop_0001', 'counter', 4, 4), piece('prop_0002', 'register', 4, 4, COUNTER_TOP)])

    expect(built.props.get('prop_0002')!.position.y).toBe(COUNTER_TOP)
    // the base of what is drawn, and the surface it is standing on, are one number
    expect(drawn(built, 'prop_0002').min.y).toBeCloseTo(COUNTER_TOP, EXACT)
    expect(drawn(built, 'prop_0001').max.y).toBeCloseTo(COUNTER_TOP, EXACT)
  })

  it('leaves a piece with no lift on the floor, where every city already has it', () => {
    const built = room([piece('prop_0001', 'counter', 4, 4)])

    expect(built.props.get('prop_0001')!.position.y).toBe(0)
    expect(drawn(built, 'prop_0001').min.y).toBeCloseTo(0, EXACT)
  })

  it('measures how tall it is off the floor, so what stops the player is what they see', () => {
    const built = room([piece('prop_0001', 'counter', 4, 4), piece('prop_0002', 'register', 4, 4, COUNTER_TOP)])

    const till = built.blockers.find((blocker) => blocker.propId === 'prop_0002')!
    expect(till, 'the till published no rectangle').toBeDefined()
    expect(till.height).toBeCloseTo(drawn(built, 'prop_0002').max.y, EXACT)
    expect(till.height).toBeGreaterThan(COUNTER_TOP)
  })

  it('lifts by moving the object, so the piece costs no draw of its own', () => {
    const kit = new SharedKit()
    const built = room([piece('prop_0001', 'counter', 4, 4), piece('prop_0002', 'register', 4, 4, COUNTER_TOP)], kit)

    const meshes = [...built.props.values()].flatMap((object) => object.children as THREE.Mesh[])
    expect(meshes).toHaveLength(2)
    expect(new Set(meshes.map((mesh) => mesh.geometry)).size, 'the lift made a second buffer').toBe(1)
    expect(new Set(meshes.map((mesh) => mesh.material)).size, 'the lift made a second material').toBe(1)
    // and the shared buffer is the one the kit built: the lift is on the transform
    kit.geometry.computeBoundingBox()
    expect(kit.geometry.boundingBox!.min.y).toBeCloseTo(-0.15, EXACT)
  })
})
