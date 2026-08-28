import type { Anchor, Furniture } from '@gb/world'
import { describe, expect, it } from 'vitest'
import { buildInterior, Greybox, VISITOR_CELL } from '../src/index.ts'
import { bar } from './bar.ts'
import { town } from './town.ts'

/**
 * Where a companion may stand in a room: on the floor, clear of the furniture
 * and the doors, not on anybody's own spot, and not behind the bar.
 */

/** A bar counter across the back of the room, with the bartender behind it and a patron on a stool in front. */
function counterBar(): ReturnType<typeof bar> {
  const furniture: Furniture[] = [
    { id: 'prop_0001', prop: 'bar-counter', roomId: 'room_0001', pos: { x: 4, y: 6 }, rot: 0 },
    { id: 'prop_0002', prop: 'bar-stool', roomId: 'room_0001', pos: { x: 4, y: 5.2 }, rot: 0 },
  ]
  const anchors: Anchor[] = [
    { id: 'anchor_0001', kind: 'serve', roomId: 'room_0001', pos: { x: 4, y: 7 }, rot: 180, propId: 'prop_0001' },
    { id: 'anchor_0002', kind: 'sit-drink', roomId: 'room_0001', pos: { x: 4, y: 5.2 }, rot: 0, propId: 'prop_0002' },
  ]
  return bar(furniture, anchors)
}

describe('where a visitor may stand', () => {
  it('keeps off the furniture, the doorway, the people and the aisle behind the bar', () => {
    const { world, interior } = counterBar()
    const built = buildInterior(world, interior, new Greybox())
    const cells = built.visitorCells

    expect(cells.length).toBeGreaterThan(0)
    for (const cell of cells) {
      expect(cell.roomId).toBe('room_0001')
      // on the floor, a whole cell in from the walls
      expect(cell.x).toBeGreaterThanOrEqual(VISITOR_CELL / 2)
      expect(cell.x).toBeLessThanOrEqual(interior.size.w - VISITOR_CELL / 2)
      expect(cell.z).toBeGreaterThanOrEqual(VISITOR_CELL / 2)
      expect(cell.z).toBeLessThanOrEqual(interior.size.h - VISITOR_CELL / 2)
      // clear of what a body cannot walk through
      for (const blocker of built.blockers) expect(blocker.contains(cell.x, cell.z, 0.35), `${cell.x},${cell.z} in ${blocker.prop}`).toBe(false)
      // not in the doorway at (4, 0)
      expect(Math.hypot(cell.x - 4, cell.z)).toBeGreaterThanOrEqual(1.5)
      // not on the bartender or the patron
      for (const anchor of interior.anchors) expect(Math.hypot(cell.x - anchor.pos.x, cell.z - anchor.pos.y)).toBeGreaterThanOrEqual(0.7)
      // and nowhere along the back of the counter, which runs across the room at z = 6: the strip past it is the bartender's
      const counter = built.blockers.find((one) => one.prop === 'bar-counter')!
      if (Math.abs(cell.x - counter.x) <= counter.halfWidth + 0.5) expect(cell.z, `${cell.x},${cell.z} is behind the bar`).toBeLessThan(6)
    }
    // the front of the room is open floor and is offered
    expect(cells.some((cell) => cell.z < 4)).toBe(true)
  })

  it('offers the cell nearest the street door first, and the same cells every time', () => {
    const { world, interior } = counterBar()
    const once = buildInterior(world, interior, new Greybox()).visitorCells
    const twice = buildInterior(world, interior, new Greybox()).visitorCells
    const door = interior.doors[0]!

    expect(twice).toEqual(once)
    const distances = once.map((cell) => Math.hypot(cell.x - door.pos.x, cell.z - door.pos.y))
    expect(distances).toEqual([...distances].sort((a, b) => a - b))
  })

  it('finds standing room in every room of a whole town', () => {
    const world = town()
    for (const interior of world.interiors()) {
      const built = buildInterior(world, interior, new Greybox())
      expect(built.visitorCells.length, interior.id).toBeGreaterThan(0)
      for (const cell of built.visitorCells) {
        expect(interior.rooms.some((room) => room.id === cell.roomId)).toBe(true)
        for (const blocker of built.blockers) expect(blocker.contains(cell.x, cell.z, 0.35), `${interior.id} ${cell.x},${cell.z} in ${blocker.prop}`).toBe(false)
      }
    }
  })
})
