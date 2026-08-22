import type { Rng } from '@gb/kit'
import type { Anchor, AnchorKind, BuildingKind, Furniture, FurnitureProp, Room } from '@gb/world'

export interface Furnishing {
  readonly furniture: Furniture[]
  readonly anchors: Anchor[]
}

type Mint = (kind: string) => string

const WALL_MARGIN = 0.6

/**
 * Fills a room with the furniture its kind implies, and drops an anchor
 * wherever an NPC could stand and do something: behind the bar, on a stool, at
 * a desk, in a bed. Placing an NPC on an anchor is all it takes for them to
 * look like they belong there.
 */
export function furnish(building: BuildingKind, room: Room, mint: Mint, rng: Rng): Furnishing {
  const out: Furnishing = { furniture: [], anchors: [] }
  const put = (prop: FurnitureProp, x: number, y: number, rot: number): string => {
    const id = mint('prop')
    out.furniture.push({ id, prop, roomId: room.id, pos: { x, y }, rot })
    return id
  }
  const anchor = (kind: AnchorKind, x: number, y: number, rot: number, propId?: string): void => {
    out.anchors.push({ id: mint('anchor'), kind, roomId: room.id, pos: { x, y }, rot, ...(propId ? { propId } : {}) })
  }

  const { x, y, w, h } = room.rect
  const left = x + WALL_MARGIN
  const right = x + w - WALL_MARGIN
  const top = y + WALL_MARGIN
  const bottom = y + h - WALL_MARGIN
  const midX = x + w / 2
  const midY = y + h / 2

  const serviceCounter = (prop: FurnitureProp) => {
    const length = Math.min(w - WALL_MARGIN * 2, 6)
    const startX = midX - length / 2
    const counterY = top + 0.6
    const ids: string[] = []
    for (let i = 0; i < Math.max(2, Math.round(length / 1.5)); i++) {
      ids.push(put(prop, startX + i * 1.5, counterY, 180))
    }
    anchor('serve', midX, counterY - 0.9, 180, ids[0])
    for (let i = 0; i < Math.floor(length / 1.2); i++) {
      const stoolX = startX + 0.6 + i * 1.2
      const stool = put('bar-stool', stoolX, counterY + 1.0, 0)
      anchor('sit-drink', stoolX, counterY + 1.0, 0, stool)
    }
  }

  const tables = (seatKind: AnchorKind) => {
    for (let tx = left + 1.5; tx < right - 1; tx += 2.5) {
      for (let ty = midY; ty < bottom - 1; ty += 2.5) {
        const table = put('table', tx, ty, 0)
        for (const side of [-1, 1]) {
          const chair = put('chair', tx + side * 0.8, ty, side > 0 ? 270 : 90)
          anchor(seatKind, tx + side * 0.8, ty, side > 0 ? 270 : 90, chair)
        }
      }
    }
  }

  switch (room.kind) {
    case 'main':
      if (building === 'bar' || building === 'cafe' || building === 'restaurant') {
        serviceCounter('bar-counter')
        tables('sit-drink')
        if (building === 'bar' && rng.chance(0.5)) put('jukebox', right - 0.5, bottom - 0.5, 315)
      } else if (building === 'shop' || building === 'market') {
        serviceCounter('counter')
        put('register', midX + 0.8, top + 0.6, 180)
        for (let sx = left; sx < right - 1; sx += 1.6) {
          const shelf = put('display-case', sx, bottom - 0.5, 0)
          anchor('browse', sx, bottom - 1.4, 0, shelf)
        }
      } else if (building === 'office') {
        for (let dx = left + 1; dx < right - 1; dx += 2.4) {
          for (let dy = top + 1; dy < bottom - 1; dy += 2.2) {
            const desk = put('desk', dx, dy, 0)
            const chair = put('office-chair', dx, dy + 0.8, 0)
            anchor('work-desk', dx, dy + 0.8, 0, chair)
            void chair
          }
        }
      } else if (building === 'workshop') {
        for (let dx = left + 1; dx < right - 1; dx += 2.4) {
          const bench = put('counter', dx, top + 0.8, 180)
          anchor('work-desk', dx, top + 1.7, 180, bench)
        }
        put('crate-stack', right - 0.8, bottom - 0.8, 0)
      } else if (building === 'clinic') {
        for (let bx = left + 1; bx < right - 1; bx += 2.2) {
          const bed = put('bed', bx, midY, 0)
          anchor('sleep', bx, midY, 0, bed)
        }
      } else if (building === 'chapel') {
        for (let by = top + 1.5; by < bottom - 1; by += 1.2) {
          const pew = put('chair', midX, by, 0)
          anchor('sit', midX, by, 0, pew)
        }
      } else {
        const sofa = put('sofa', midX, top + 0.8, 180)
        anchor('sit', midX, top + 1.4, 180, sofa)
        put('table', midX, top + 2.2, 0)
        put('tv', midX, bottom - 0.4, 0)
        put('rug', midX, midY, 0)
      }
      break

    case 'bedroom': {
      const bed = put('bed', left + 1.2, top + 1.2, 0)
      anchor('sleep', left + 1.2, top + 1.2, 0, bed)
      put('wardrobe', right - 0.5, top + 1, 270)
      put('lamp', left + 0.4, top + 0.4, 0)
      break
    }

    case 'kitchen': {
      put('stove', left + 0.6, top + 0.6, 180)
      const sink = put('sink', left + 1.8, top + 0.6, 180)
      put('fridge', right - 0.6, top + 0.6, 180)
      anchor('cook', left + 1.2, top + 1.5, 180, sink)
      break
    }

    case 'office': {
      const desk = put('desk', midX, top + 1, 180)
      const chair = put('office-chair', midX, top + 1.9, 180)
      anchor('work-desk', midX, top + 1.9, 180, chair)
      put('cabinet', right - 0.5, bottom - 0.5, 270)
      void desk
      break
    }

    case 'hall': {
      for (let sx = left + 1; sx < right - 1; sx += 1.2) {
        const seat = put('chair', sx, bottom - 0.8, 180)
        anchor('sit', sx, bottom - 0.8, 180, seat)
      }
      const desk = put('counter', midX, top + 0.6, 180)
      anchor('serve', midX, top + 1.5, 180, desk)
      put('plant', right - 0.5, top + 0.5, 0)
      break
    }

    case 'storage':
    case 'backroom':
    case 'cellar': {
      for (let sx = left; sx < right - 1; sx += 1.4) {
        put('shelf', sx, top + 0.5, 180)
        put('crate-stack', sx, bottom - 0.6, 0)
      }
      anchor('stand', midX, midY, 0)
      break
    }

    case 'bathroom':
      put('sink', left + 0.6, top + 0.6, 180)
      break
  }

  return out
}
