import { METRICS, type Interior, type World } from '@gb/world'
import * as THREE from 'three'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  COVE_SPAN,
  FIXTURE,
  FURNISH_STYLES,
  PALETTES,
  WALL,
  type PlacedBay,
} from '../src/index.ts'
import { dressingIn, interiorsAcrossTowns, town } from './support.ts'

/**
 * What a room is lit by.
 *
 * Everything lit in here is emissive geometry, which draws itself and lights
 * nothing, so a room also publishes a light emitter standing in each of those
 * things. These hold the two halves together: a fixture is where the thing that
 * burns is drawn, and it throws what that thing is.
 */

let world: World
let interiors: Interior[]

beforeAll(async () => {
  world = await town()
  interiors = [...world.interiors()]
})

function roomOf(interior: Interior) {
  return dressingIn('corpo').room(interior, world.charter(interior.kind))
}

/** Which way the room is from the face of a wall, written out here rather than read off the box. */
function intoTheRoom(bay: PlacedBay, at: readonly [number, number, number]): number {
  const across = bay.side === 'north' || bay.side === 'south'
  const off = (across ? at[2] : at[0]) - bay.face
  return bay.side === 'north' || bay.side === 'west' ? off : -off
}

function middleOf(bay: PlacedBay): number {
  return (bay.from + bay.to) / 2
}

function alongOf(bay: PlacedBay, at: readonly [number, number, number]): number {
  return bay.side === 'north' || bay.side === 'south' ? at[0] : at[2]
}

describe('what a room is lit by', () => {
  it('stands a fixture in every lit bay and in nothing else', () => {
    for (const interior of interiors) {
      const room = roomOf(interior)
      const lit = room.bays.filter((bay) => bay.kind === 'strip' || bay.kind === 'niche' || bay.kind === 'window' || bay.kind === 'booth')
      const fittings = room.lights.filter((one) => one.kind !== 'cove' && one.kind !== 'screen' && one.kind !== 'dance')

      expect(fittings).toHaveLength(lit.length)
      for (const bay of lit) {
        // into this room, not into the one on the other side of the same wall
        const at = fittings.filter((one) => {
          const off = intoTheRoom(bay, one.position)
          return one.kind === bay.kind && Math.abs(alongOf(bay, one.position) - middleOf(bay)) < 1e-6 && off > 0 && off < 0.4
        })
        expect(at, `${bay.kind} on the ${bay.side} of ${bay.roomId}`).toHaveLength(1)
        // in the room, not in the wall, and inside the height the bay is drawn between
        expect(intoTheRoom(bay, at[0]!.position)).toBeGreaterThan(0)
        expect(at[0]!.position[1]).toBeGreaterThan(0)
        expect(at[0]!.position[1]).toBeLessThan(WALL.head)
      }
    }
  })

  it('runs a line of cove over the walls, each light standing for its own stretch of channel', () => {
    for (const interior of interiors) {
      const coves = roomOf(interior).lights.filter((one) => one.kind === 'cove')
      expect(coves.length, interior.id).toBeGreaterThan(interior.rooms.length)

      for (const cove of coves) {
        // just under the rail, which is where the channel is drawn
        expect(cove.position[1]).toBeGreaterThan(WALL.rail.under - 0.1)
        expect(cove.position[1]).toBeLessThan(WALL.head)
        // and it carries the candela of the stretch it stands for, never more
        expect(cove.intensity).toBeGreaterThan(0)
        expect(cove.intensity).toBeLessThanOrEqual(FIXTURE.cove * COVE_SPAN + 1e-9)
      }
    }
  })

  it('keeps every fixture inside the room it lights', () => {
    const half = METRICS.building.wallThickness / 2
    for (const interior of interiors) {
      for (const fixture of roomOf(interior).lights) {
        expect(fixture.position[0], interior.id).toBeGreaterThan(-half)
        expect(fixture.position[0], interior.id).toBeLessThan(interior.size.w + half)
        expect(fixture.position[2], interior.id).toBeGreaterThan(-half)
        expect(fixture.position[2], interior.id).toBeLessThan(interior.size.h + half)
        expect(fixture.position[1], interior.id).toBeGreaterThan(0)
        expect(fixture.position[1], interior.id).toBeLessThan(METRICS.building.groundFloorHeight)
        // and it falls off: a reach it is worth drawing to, never the whole town
        expect(fixture.radius).toBeGreaterThan(1)
        expect(fixture.radius).toBeLessThanOrEqual(12)
      }
    }
  })

  it('throws a lighter colour than the lens it is drawn in, so a room is not one hue', () => {
    for (const style of FURNISH_STYLES) {
      const room = dressingIn(style).room(interiors[0]!, world.charter(interiors[0]!.kind))
      const cove = room.lights.find((one) => one.kind === 'cove')!
      const lens = new THREE.Color().setHex(PALETTES[style].glow.glow!, THREE.SRGBColorSpace)
      const thrown = new THREE.Color().setHex(cove.colour, THREE.SRGBColorSpace)

      // a lens is authored saturated so it reads as a line of light; what it
      // throws is the whole room's light, and at that saturation a home comes
      // out a red cave
      expect(spread(thrown), style).toBeLessThan(spread(lens))
      expect(Math.min(thrown.r, thrown.g, thrown.b), style).toBeGreaterThan(0.25)
    }
  })

  it('lights every room of every interior of a town, so nothing built here is dark', async () => {
    const all = await interiorsAcrossTowns()
    expect(all.length).toBeGreaterThan(20)
    for (const interior of all) {
      const lights = dressingIn('corpo').room(interior).lights
      expect(lights.length, interior.id).toBeGreaterThan(0)
      for (const room of interior.rooms) {
        const inside = lights.filter(
          (one) =>
            one.position[0] > room.rect.x - 0.3 &&
            one.position[0] < room.rect.x + room.rect.w + 0.3 &&
            one.position[2] > room.rect.y - 0.3 &&
            one.position[2] < room.rect.y + room.rect.h + 0.3,
        )
        expect(inside.length, `${interior.id}/${room.id}`).toBeGreaterThan(0)
      }
    }
  }, 120_000)

  it('draws the same fixtures for the same interior every time', () => {
    const once = roomOf(interiors[0]!).lights
    const twice = roomOf(interiors[0]!).lights
    expect(twice).toEqual(once)
  })
})

/** How far a colour is from grey: 0 is white, 1 is a single channel. */
function spread(colour: THREE.Color): number {
  const peak = Math.max(colour.r, colour.g, colour.b)
  return peak > 0 ? 1 - Math.min(colour.r, colour.g, colour.b) / peak : 0
}
