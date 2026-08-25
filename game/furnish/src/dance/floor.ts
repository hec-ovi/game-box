import { Rng } from '@gb/kit'
import { METRICS, footprintOf, type Interior } from '@gb/world'
import type { Solid } from '../build/solid.ts'
import { everyCorner } from '../build/outline.ts'
import { LIT_TILES } from '../style/lit.ts'
import { dancersIn, dancesIn } from './room.ts'

/**
 * The lit floor under the dancers.
 *
 * A grid of tiles on the room's own floor, each shining in one of four
 * colours, laid where the dancing is: every tile whose middle is within reach
 * of a `dance` anchor, clear of the furniture and of every doorway, inside the
 * walls. A room whose use says it is a dance floor and has nobody dancing yet
 * lights every clear tile it has.
 *
 * A tile is 2 cm tall, the same as a rug: under the height a body steps over,
 * so it is walked on rather than into, and nothing here is a blocker.
 */
export interface LitTile {
  readonly roomId: string
  /** The middle of the tile, in interior metres. */
  readonly x: number
  readonly y: number
}

/** The tile lattice, its tile, and how far off a dancer a tile still lights. */
export const DANCE = { pitch: 0.5, tile: 0.46, thick: 0.02, reach: 1.3 } as const

const HALF_WALL = METRICS.building.wallThickness / 2
/** Air between a tile and a wall, and between a tile and a piece of furniture. */
const CLEAR = 0.06
/** The floor a doorway needs: half the hole `@gb/scene` cuts, and the depth a body steps in. */
const DOORWAY = { half: METRICS.building.doorWidth / 2 + 0.1, deep: 0.8 }

interface Box {
  readonly x0: number
  readonly x1: number
  readonly y0: number
  readonly y1: number
}

export function layDanceFloor(solid: Solid, interior: Interior, seed: string): LitTile[] {
  const tiles: LitTile[] = []
  const rng = new Rng(seed).fork('furnish').fork('dance').fork(interior.id)

  for (const room of interior.rooms) {
    if (!dancesIn(interior, room)) continue
    const dancers = dancersIn(interior, room)
    const taken = [...furnitureIn(interior, room.id), ...doorwaysOf(interior, room.rect)]
    const inset = HALF_WALL + CLEAR
    const half = DANCE.tile / 2
    const first = { x: room.rect.x + inset + DANCE.pitch / 2, y: room.rect.y + inset + DANCE.pitch / 2 }
    const last = { x: room.rect.x + room.rect.w - inset - half, y: room.rect.y + room.rect.h - inset - half }

    for (let y = first.y; y <= last.y; y += DANCE.pitch) {
      for (let x = first.x; x <= last.x; x += DANCE.pitch) {
        const tile = { x0: x - half, x1: x + half, y0: y - half, y1: y + half }
        if (taken.some((box) => overlaps(box, tile))) continue
        if (dancers.length && !dancers.some((dancer) => Math.hypot(dancer.pos.x - x, dancer.pos.y - y) <= DANCE.reach)) continue
        tiles.push({ roomId: room.id, x, y })
        solid.block({
          x,
          z: y,
          width: DANCE.tile,
          depth: DANCE.tile,
          y0: 0,
          y1: DANCE.thick,
          corner: everyCorner(0.01),
          arc: 1,
          look: LIT_TILES[rng.fork(`${room.id}/${tiles.length}`).int(0, LIT_TILES.length)]!,
        })
      }
    }
  }
  return tiles
}

/** The box round every piece in the room, however it is turned, with air round it. */
function furnitureIn(interior: Interior, roomId: string): Box[] {
  return interior.furniture
    .filter((piece) => piece.roomId === roomId && !piece.lift)
    .map((piece) => {
      const { width, depth } = footprintOf(piece.prop)
      const turn = (piece.rot * Math.PI) / 180
      const halfX = (width / 2) * Math.abs(Math.cos(turn)) + (depth / 2) * Math.abs(Math.sin(turn)) + CLEAR
      const halfY = (width / 2) * Math.abs(Math.sin(turn)) + (depth / 2) * Math.abs(Math.cos(turn)) + CLEAR
      return { x0: piece.pos.x - halfX, x1: piece.pos.x + halfX, y0: piece.pos.y - halfY, y1: piece.pos.y + halfY }
    })
}

/** The floor inside every door on the room's edges. */
function doorwaysOf(interior: Interior, rect: Interior['rooms'][number]['rect']): Box[] {
  const boxes: Box[] = []
  for (const door of interior.doors) {
    const { x, y } = door.pos
    const onX = Math.abs(y - rect.y) < 1e-4 || Math.abs(y - rect.y - rect.h) < 1e-4
    const onY = Math.abs(x - rect.x) < 1e-4 || Math.abs(x - rect.x - rect.w) < 1e-4
    if (onX && x > rect.x && x < rect.x + rect.w) {
      boxes.push({ x0: x - DOORWAY.half, x1: x + DOORWAY.half, y0: y - DOORWAY.deep, y1: y + DOORWAY.deep })
    } else if (onY && y > rect.y && y < rect.y + rect.h) {
      boxes.push({ x0: x - DOORWAY.deep, x1: x + DOORWAY.deep, y0: y - DOORWAY.half, y1: y + DOORWAY.half })
    }
  }
  return boxes
}

function overlaps(one: Box, two: Box): boolean {
  return one.x0 < two.x1 && one.x1 > two.x0 && one.y0 < two.y1 && one.y1 > two.y0
}
