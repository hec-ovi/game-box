import { METRICS, type Furniture, type FurnitureProp } from '@gb/world'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { buildInterior, Greybox, type InteriorBuild, type PropFootprint } from '../src/index.ts'
import { bar } from './bar.ts'
import { town } from './town.ts'

/** What the app asks: can the player stand here, being as wide as they are? */
function solidAt(built: InteriorBuild, x: number, z: number, margin = 0): boolean {
  return built.blockers.some((footprint) => footprint.contains(x, z, margin))
}

function piece(id: string, prop: Furniture['prop'], x: number, y: number, rot = 0): Furniture {
  return { id, prop, roomId: 'room_1', pos: { x, y }, rot }
}

/** One handmade bar with that furniture in it, built for real. */
function room(...furniture: Furniture[]): InteriorBuild {
  const { world, interior } = bar(furniture)
  return buildInterior(world, interior, new Greybox())
}

/** A kit whose models stand half a metre to the right of the point they are placed at. */
const OFF_CENTRE = 0.5
class Lopsided extends Greybox {
  override prop(prop: FurnitureProp): THREE.Object3D {
    const object = super.prop(prop)
    for (const part of object.children) part.position.x += OFF_CENTRE
    return object
  }
}

/** A point that far off the middle of a rectangle, along the rectangle's own width. */
function across(footprint: PropFootprint, distance: number): { x: number; z: number } {
  return { x: footprint.x + distance * Math.cos(footprint.rot), z: footprint.z - distance * Math.sin(footprint.rot) }
}

/** How much of the floor a player can stand on, sampled every half metre. */
function clearFraction(built: InteriorBuild, size: { w: number; h: number }): number {
  let clear = 0
  let total = 0
  for (let x = 0.5; x < size.w; x += 0.5) {
    for (let z = 0.5; z < size.h; z += 0.5) {
      total += 1
      if (!solidAt(built, x, z)) clear += 1
    }
  }
  return clear / total
}

describe('what the player walks into', () => {
  it('stops them at a piece of furniture and lets them cross the open floor', async () => {
    const world = await town()
    const interior = world.interiors().find((i) => i.furniture.length > 0)!
    const built = buildInterior(world, interior, new Greybox())
    const footprint = built.blockers[0]!
    expect(footprint, 'a furnished room with nothing in it that stops anyone').toBeDefined()
    const piece = interior.furniture.find((f) => f.id === footprint.propId)!

    // the piece is solid where it is drawn, in the coordinates the entrance is in
    expect(solidAt(built, piece.pos.x, piece.pos.y)).toBe(true)
    const beyond = across(footprint, footprint.halfWidth + 0.2)
    expect(footprint.contains(beyond.x, beyond.z)).toBe(false)
    expect(footprint.contains(beyond.x, beyond.z, METRICS.player.radius)).toBe(true)

    // the way in is clear, and so is most of the room
    expect(solidAt(built, built.entrance.x, built.entrance.z, METRICS.player.radius)).toBe(false)
    const stride = built.entrance.clone().addScaledVector(built.inward, 0.8)
    expect(solidAt(built, stride.x, stride.z, METRICS.player.radius)).toBe(false)
    expect(clearFraction(built, interior.size)).toBeGreaterThan(0.5)
  })

  it('measures every rectangle off the object that was drawn', async () => {
    const world = await town()
    const interior = world.interiors().find((i) => i.furniture.length > 4)!
    const built = buildInterior(world, interior, new Greybox())
    expect(built.blockers.length).toBeGreaterThan(0)

    for (const footprint of built.blockers) {
      const drawn = new THREE.Box3().setFromObject(built.props.get(footprint.propId)!)
      const size = drawn.getSize(new THREE.Vector3())
      const centre = drawn.getCenter(new THREE.Vector3())
      const cos = Math.abs(Math.cos(footprint.rot))
      const sin = Math.abs(Math.sin(footprint.rot))

      // squared up to the world, the rectangle is exactly the box the prop is drawn in
      expect(footprint.halfWidth * cos + footprint.halfDepth * sin).toBeCloseTo(size.x / 2, 5)
      expect(footprint.halfWidth * sin + footprint.halfDepth * cos).toBeCloseTo(size.z / 2, 5)
      expect(footprint.x).toBeCloseTo(centre.x, 5)
      expect(footprint.z).toBeCloseTo(centre.z, 5)
      expect(footprint.height).toBeCloseTo(drawn.max.y, 5)
    }
  })

  it('lets them walk over a rug and not through the counter beside it', () => {
    const built = room(piece('prop_1', 'rug', 2, 4), piece('prop_2', 'counter', 6, 4))

    expect(built.blockers.map((b) => b.propId)).toEqual(['prop_2'])
    expect(solidAt(built, 2, 4)).toBe(false)
    expect(solidAt(built, 6, 4)).toBe(true)
    // and the rug is still drawn, it just does not stop anyone
    expect(built.props.get('prop_1')).toBeDefined()
  })

  it('turns the rectangle with the furniture', () => {
    const straight = room(piece('prop_1', 'bar-counter', 4, 4, 0))
    const turned = room(piece('prop_1', 'bar-counter', 4, 4, 90))

    // a counter is 1.4 m across the front and 0.6 m through: stood facing east, its long side runs north to south
    expect(solidAt(straight, 4.6, 4)).toBe(true)
    expect(solidAt(straight, 4, 4.6)).toBe(false)
    expect(solidAt(turned, 4.6, 4)).toBe(false)
    expect(solidAt(turned, 4, 4.6)).toBe(true)

    // and off the compass points, where an east for west mirror would show: facing north-east,
    // the long side runs north-west to south-east
    const diagonal = room(piece('prop_1', 'bar-counter', 4, 4, 45))
    const step = 0.4 * Math.SQRT1_2
    expect(solidAt(diagonal, 4 + step, 4 + step)).toBe(true)
    expect(solidAt(diagonal, 4 + step, 4 - step)).toBe(false)
  })

  it('puts the rectangle where the model stands, not where its origin is', () => {
    const stool = piece('prop_1', 'bar-stool', 4, 4, 90)
    const { world, interior } = bar([stool])
    const footprint = buildInterior(world, interior, new Lopsided()).blockers[0]!

    // the model is off to its own right, and the prop faces east, so that is half a metre south
    expect(footprint.x).toBeCloseTo(stool.pos.x, 5)
    expect(footprint.z).toBeCloseTo(stool.pos.y + OFF_CENTRE, 5)
  })

  it('never parks a wardrobe in the doorway', () => {
    // the bar's street door is at (4, 0)
    expect(room(piece('prop_1', 'wardrobe', 4, 0)).blockers).toEqual([])
    // the same wardrobe further in is solid, so it is the doorway that spares it and not the prop
    expect(solidAt(room(piece('prop_1', 'wardrobe', 4, 4)), 4, 4)).toBe(true)
  })
})
