import { METRICS, PROP_CELL, PROP_SPECS, footprintOf, type Interior, type World } from '@gb/world'
import * as THREE from 'three'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  BAY_SPECS,
  BAY_TASTE,
  FURNISH_STYLES,
  FurnishDressing,
  SOLID_MATERIAL,
  WALL,
  WALL_CONTACTS,
  furnishKit,
  tasteOf,
  type PlacedBay,
} from '../src/index.ts'
import { ROOM_SIZE, dressingIn, meshesOf, plates, surfacedDressing, town } from './support.ts'

let world: World
let interiors: Interior[]

beforeAll(async () => {
  world = await town()
  interiors = [...world.interiors()]
})

/** The hole `@gb/scene` cuts for a doorway, written here rather than read off the box. */
const OPENING = METRICS.building.doorWidth / 2 + 0.1

/** Two rectangles that share an edge are not on top of each other. A millimetre in, they are. */
const TOUCHING = 0.001

/** Which axis a bay's run measures along, in the interior's own coordinates. */
function along(bay: PlacedBay): 'x' | 'y' {
  return bay.side === 'north' || bay.side === 'south' ? 'x' : 'y'
}

/** The line a door on this bay's wall would stand on. */
function wallLine(bay: PlacedBay): number {
  const half = METRICS.building.wallThickness / 2
  return bay.side === 'north' || bay.side === 'west' ? bay.face - half : bay.face + half
}

/** The box round a piece of furniture in interior metres: it may stand turned. */
function boxOf(piece: Interior['furniture'][number]): { x: number; y: number } {
  const { width, depth } = footprintOf(piece.prop)
  const turn = (-piece.rot * Math.PI) / 180
  const across = Math.abs(Math.cos(turn))
  const down = Math.abs(Math.sin(turn))
  return {
    x: (width / 2) * across + (depth / 2) * down,
    y: (width / 2) * down + (depth / 2) * across,
  }
}

function positionsOf(mesh: THREE.Mesh): Float32Array {
  return mesh.geometry.getAttribute('position').array as Float32Array
}

describe('a wall is a run of bays', () => {
  it('is one indexed mesh on the one shared material, however many bays it has', () => {
    const materials = new Set<THREE.Material>()
    let most = 0
    for (const interior of interiors) {
      const room = dressingIn('corpo').room(interior)
      const meshes = meshesOf(room.decor)

      expect(meshes, interior.id).toHaveLength(1)
      expect((meshes[0]!.material as THREE.Material).name, interior.id).toBe(SOLID_MATERIAL)
      expect(meshes[0]!.geometry.getIndex(), interior.id).toBeTruthy()
      materials.add(meshes[0]!.material as THREE.Material)
      most = Math.max(most, room.bays.length)
    }
    // one material for every wall in town, the same one the furniture draws with
    expect(materials.size).toBe(1)
    // the point of the count: a town's busiest wall run is still that one mesh
    expect(most).toBeGreaterThan(30)
  })

  it('claims whole 10 cm cells, never a fraction of one', () => {
    for (const interior of interiors) {
      for (const bay of dressingIn('home').room(interior).bays) {
        expect(Math.round(bay.from / PROP_CELL) * PROP_CELL, `${interior.id} ${bay.side}`).toBeCloseTo(bay.from, 9)
        expect(bay.to - bay.from, `${interior.id} ${bay.side}`).toBeCloseTo(bay.cells * PROP_CELL, 9)
      }
    }
  })

  it('never puts a bay in a doorway', () => {
    for (const interior of interiors) {
      for (const style of FURNISH_STYLES) {
        for (const bay of dressingIn(style).room(interior).bays) {
          if (bay.kind === 'plain') continue
          const axis = along(bay)
          const across = axis === 'x' ? 'y' : 'x'
          for (const door of interior.doors) {
            if (Math.abs(door.pos[across] - wallLine(bay)) > 1e-4) continue
            const overlap =
              Math.min(bay.to, door.pos[axis] + OPENING) - Math.max(bay.from, door.pos[axis] - OPENING)
            expect(overlap, `${interior.id} ${bay.kind} on ${bay.side} against ${door.id}`).toBeLessThanOrEqual(0)
          }
        }
      }
    }
  })

  it('never stands off the wall into a piece of furniture', () => {
    for (const interior of interiors) {
      for (const style of FURNISH_STYLES) {
        const room = dressingIn(style).room(interior)
        for (const bay of room.bays) {
          const spec = BAY_SPECS[bay.kind]
          if (spec.behindFurniture) continue
          const axis = along(bay)
          const across = axis === 'x' ? 'y' : 'x'
          const inward = bay.side === 'north' || bay.side === 'west' ? 1 : -1

          for (const piece of interior.furniture) {
            // a piece in the next room is behind a solid wall, not in front of this one
            if (piece.roomId !== bay.roomId) continue
            const half = boxOf(piece)
            const overlap =
              Math.min(bay.to, piece.pos[axis] + half[axis]) - Math.max(bay.from, piece.pos[axis] - half[axis])
            if (overlap <= TOUCHING) continue
            const near = inward * (piece.pos[across] - inward * half[across] - bay.face)
            if (near >= spec.depth + 0.02) continue

            const top = (piece.lift ?? 0) + (PROP_SPECS[piece.prop].height ?? PROP_SPECS[piece.prop].contact?.height ?? 0)
            expect(top, `${interior.id} ${bay.kind} over ${piece.prop}`).toBeLessThanOrEqual(spec.low + 1e-9)
          }
        }
      }
    }
  })

  it('stays inside the room it lines', () => {
    for (const interior of interiors) {
      const room = dressingIn('corpo').room(interior)
      const bounds = new THREE.Box3().setFromObject(room.decor)

      expect(bounds.min.x, interior.id).toBeGreaterThanOrEqual(0)
      expect(bounds.min.z, interior.id).toBeGreaterThanOrEqual(0)
      expect(bounds.max.x, interior.id).toBeLessThanOrEqual(interior.size.w)
      expect(bounds.max.z, interior.id).toBeLessThanOrEqual(interior.size.h)
      expect(bounds.min.y, interior.id).toBeGreaterThanOrEqual(0)
      expect(bounds.max.y, interior.id).toBeLessThanOrEqual(WALL.rail.top + 1e-6)
    }
  })
})

describe('what a wall reaches for', () => {
  it('is the finish\'s row tilted by the room\'s use, and a room with no use is the row itself', () => {
    expect(tasteOf('industrial', undefined)).toEqual(BAY_TASTE.industrial)
    // a store racks its walls and hangs no pictures; a kitchen the same way
    expect(tasteOf('industrial', 'store').shelf).toBeGreaterThan(BAY_TASTE.industrial.shelf)
    expect(tasteOf('industrial', 'store').frame).toBe(0)
    expect(tasteOf('domestic', 'kitchen').frame).toBe(0)
    // a kind the use says nothing about keeps its finish's weight
    expect(tasteOf('domestic', 'kitchen').window).toBe(BAY_TASTE.domestic.window)
  })
})

describe('a shelf you can put something on', () => {
  it('is one height, and the highest one keeps its pitch of air under the head of the field', () => {
    // the ledges are pitched off `worktopHeight` and the field of bays ends at
    // `WALL.head`, so the two metres are not free of each other: raise the
    // worktop far enough and the top ledge, or the bottle standing on it,
    // pushes through the head into the lit channel washing down the wall
    const air = WALL.shelf.pitch - WALL.shelf.ledge
    expect(Math.max(...WALL_CONTACTS) + air, 'the top ledge under the head of the field').toBeLessThanOrEqual(WALL.head)
    // a sill and a ledge that land on the same number are one height, not two
    expect(new Set(WALL_CONTACTS).size, 'distinct heights').toBe(WALL_CONTACTS.length)
  })

  it('draws every one of its surfaces on the number, to the micron', () => {
    let found = 0
    for (const interior of interiors) {
      for (const style of FURNISH_STYLES) {
        const room = dressingIn(style).room(interior)
        if (!room.contacts.length) continue
        const level = new Set(plates(room.decor).map((plate) => plate.y))

        for (const height of room.contacts) {
          expect(WALL_CONTACTS, `${interior.id} ${style}`).toContain(height)
          expect(level.has(Math.round(height * 1e5) / 1e5), `${style} ${interior.id} at ${height}`).toBe(true)
          found++
        }
      }
    }
    expect(found).toBeGreaterThan(0)
  })
})

describe('the same seed is the same room', () => {
  it('builds the same wall twice, vertex for vertex', () => {
    const interior = interiors[0]!
    const one = new FurnishDressing(furnishKit('repeat')).room(interior)
    const two = new FurnishDressing(furnishKit('repeat')).room(interior)

    expect(two.bays.map((bay) => bay.kind)).toEqual(one.bays.map((bay) => bay.kind))
    expect([...positionsOf(two.decor)]).toEqual([...positionsOf(one.decor)])
  })

  it('builds a different wall from a different seed', () => {
    const interior = interiors[0]!
    const one = new FurnishDressing(furnishKit('one')).room(interior)
    const two = new FurnishDressing(furnishKit('two')).room(interior)

    expect(two.bays.map((bay) => bay.kind)).not.toEqual(one.bays.map((bay) => bay.kind))
  })

  it('gives two buildings in one town two different rooms', () => {
    const dressing = surfacedDressing('corpo')
    const floors = new Set(interiors.map((interior) => dressing.room(interior).dressing.surface('floor', ROOM_SIZE)))
    const kinds = new Set(interiors.map((interior) => dressing.room(interior).bays.map((bay) => bay.kind).join()))

    expect(floors.size, 'floors in one town').toBeGreaterThan(1)
    expect(kinds.size, 'walls in one town').toBe(interiors.length)
  })

  it('costs the same handful of materials however many buildings there are', () => {
    const dressing = surfacedDressing('home')
    const materials = new Set<THREE.Material>()
    for (const interior of interiors) {
      const room = dressing.room(interior)
      for (const part of ['floor', 'wall', 'ceiling'] as const) materials.add(room.dressing.surface(part, ROOM_SIZE))
    }
    // four floors, three walls and one ceiling is the whole pool for a
    // language, and a town dresses its homes in one and its trade in the other
    expect(materials.size).toBeLessThanOrEqual(8 * FURNISH_STYLES.length)
  })
})
