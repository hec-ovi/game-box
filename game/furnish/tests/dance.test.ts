import { footprintOf, type Interior, type RoomUse, type World } from '@gb/world'
import { describe, expect, it, beforeAll } from 'vitest'
import { DANCE, DANCE_FLOOR, FURNISH_STYLES, WALL, dancesIn } from '../src/index.ts'
import { clubTown, dressingIn, plates } from './support.ts'

/**
 * The dance floor: lit tiles under whoever is dancing, clear of everything
 * standing in the room, and one booth on the wall nearest them with its top at
 * hand height. Measured on the town whose story calls for dancing.
 */

let club: World

beforeAll(async () => {
  club = await clubTown()
})

/** The box round a piece in interior metres, however it is turned. */
function boxOf(piece: Interior['furniture'][number]) {
  const { width, depth } = footprintOf(piece.prop)
  const turn = (piece.rot * Math.PI) / 180
  const x = (width / 2) * Math.abs(Math.cos(turn)) + (depth / 2) * Math.abs(Math.sin(turn))
  const y = (width / 2) * Math.abs(Math.sin(turn)) + (depth / 2) * Math.abs(Math.cos(turn))
  return { x0: piece.pos.x - x, x1: piece.pos.x + x, y0: piece.pos.y - y, y1: piece.pos.y + y }
}

describe('the floor under the dancers', () => {
  it('is lit within reach of every dancer and nowhere else, clear of the furniture and inside the walls', () => {
    let dancing = 0
    for (const interior of club.interiors()) {
      const room = dressingIn('corpo').room(interior)
      const dancers = interior.anchors.filter((anchor) => anchor.kind === 'dance')
      expect(room.tiles.length > 0, interior.id).toBe(dancers.length > 0)
      if (!dancers.length) continue
      dancing++

      for (const tile of room.tiles) {
        const near = dancers.filter((dancer) => dancer.roomId === tile.roomId)
        expect(Math.min(...near.map((dancer) => Math.hypot(dancer.pos.x - tile.x, dancer.pos.y - tile.y))), interior.id).toBeLessThanOrEqual(DANCE.reach)
        const rect = interior.rooms.find((room) => room.id === tile.roomId)!.rect
        expect(tile.x - DANCE.tile / 2, interior.id).toBeGreaterThan(rect.x)
        expect(tile.x + DANCE.tile / 2, interior.id).toBeLessThan(rect.x + rect.w)
        expect(tile.y - DANCE.tile / 2, interior.id).toBeGreaterThan(rect.y)
        expect(tile.y + DANCE.tile / 2, interior.id).toBeLessThan(rect.y + rect.h)
        for (const piece of interior.furniture) {
          if (piece.roomId !== tile.roomId || piece.lift) continue
          const box = boxOf(piece)
          const apart =
            tile.x + DANCE.tile / 2 <= box.x0 || tile.x - DANCE.tile / 2 >= box.x1 || tile.y + DANCE.tile / 2 <= box.y0 || tile.y - DANCE.tile / 2 >= box.y1
          expect(apart, `${interior.id} tile at ${tile.x},${tile.y} under a ${piece.prop}`).toBe(true)
        }
      }
      // every tile is drawn level, on the number, under the height a body steps over;
      // the corners are chamfered a centimetre, which is the tenth of a per cent allowed
      const top = plates(room.decor).find((plate) => Math.abs(plate.y - DANCE.thick) < 1e-5)
      const laid = room.tiles.length * DANCE.tile * DANCE.tile
      expect(top?.area, interior.id).toBeGreaterThan(laid * 0.998)
      expect(top?.area, interior.id).toBeLessThanOrEqual(laid + 1e-6)
    }
    expect(dancing).toBeGreaterThan(1)
  })

  it('lights every clear tile of a room whose use says it is a dance floor', () => {
    const interior = [...club.interiors()].find((interior) => interior.anchors.some((anchor) => anchor.kind === 'dance'))!
    const floor = interior.anchors.find((anchor) => anchor.kind === 'dance')!.roomId
    const stamped: Interior = {
      ...interior,
      rooms: interior.rooms.map((room) => (room.id === floor ? { ...room, use: DANCE_FLOOR as RoomUse } : room)),
      anchors: interior.anchors.filter((anchor) => anchor.kind !== 'dance'),
    }
    expect(dancesIn(stamped, stamped.rooms.find((room) => room.id === floor)!)).toBe(true)
    const whole = dressingIn('corpo').room(stamped)
    const near = dressingIn('corpo').room(interior)
    expect(whole.tiles.length).toBeGreaterThan(near.tiles.length)
    expect(whole.tiles.every((tile) => tile.roomId === floor)).toBe(true)
  })
})

describe('the booth', () => {
  it('stands once in every room that dances, nowhere else, with its top at hand height exactly', () => {
    for (const interior of club.interiors()) {
      for (const style of FURNISH_STYLES) {
        const room = dressingIn(style).room(interior)
        for (const plan of interior.rooms) {
          const booths = room.bays.filter((bay) => bay.kind === 'booth' && bay.roomId === plan.id)
          expect(booths.length, `${interior.id} ${plan.id}`).toBe(dancesIn(interior, plan) ? 1 : 0)
        }
        if (!room.bays.some((bay) => bay.kind === 'booth')) continue
        expect(room.contacts).toContain(WALL.booth.top)
        const top = plates(room.decor).find((plate) => Math.abs(plate.y - WALL.booth.top) < 1e-5)
        expect(top?.area, `${interior.id} ${style}`).toBeGreaterThan(0.1)
      }
    }
  })
})
