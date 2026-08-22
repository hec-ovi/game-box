import type { Rng } from '@gb/kit'
import type { BuildingKind, RoomKind } from '@gb/world'

export interface RoomBox {
  readonly kind: RoomKind
  readonly name: string
  readonly rect: { x: number; y: number; w: number; h: number }
}

/** What rooms a kind of building has, in the order they are cut from the shell. */
const RECIPES: Record<BuildingKind, ReadonlyArray<{ kind: RoomKind; name: string; share: number }>> = {
  bar: [
    { kind: 'main', name: 'Taproom', share: 3 },
    { kind: 'storage', name: 'Cellar', share: 1 },
  ],
  cafe: [
    { kind: 'main', name: 'Cafe floor', share: 3 },
    { kind: 'kitchen', name: 'Kitchen', share: 1 },
  ],
  restaurant: [
    { kind: 'main', name: 'Dining room', share: 3 },
    { kind: 'kitchen', name: 'Kitchen', share: 2 },
  ],
  shop: [
    { kind: 'main', name: 'Shop floor', share: 3 },
    { kind: 'backroom', name: 'Back room', share: 1 },
  ],
  market: [{ kind: 'main', name: 'Market hall', share: 1 }],
  house: [
    { kind: 'main', name: 'Living room', share: 2 },
    { kind: 'bedroom', name: 'Bedroom', share: 1 },
    { kind: 'kitchen', name: 'Kitchen', share: 1 },
  ],
  apartment: [
    { kind: 'main', name: 'Living room', share: 2 },
    { kind: 'bedroom', name: 'Bedroom', share: 1 },
  ],
  office: [
    { kind: 'main', name: 'Open office', share: 3 },
    { kind: 'office', name: 'Manager office', share: 1 },
  ],
  workshop: [
    { kind: 'main', name: 'Workshop floor', share: 3 },
    { kind: 'storage', name: 'Parts store', share: 1 },
  ],
  warehouse: [{ kind: 'storage', name: 'Warehouse floor', share: 1 }],
  clinic: [
    { kind: 'hall', name: 'Waiting room', share: 1 },
    { kind: 'main', name: 'Treatment room', share: 2 },
  ],
  hotel: [
    { kind: 'hall', name: 'Lobby', share: 2 },
    { kind: 'bedroom', name: 'Guest room', share: 1 },
  ],
  station: [{ kind: 'hall', name: 'Concourse', share: 1 }],
  chapel: [{ kind: 'main', name: 'Nave', share: 1 }],
}

/**
 * Cuts the shell into rooms by splitting along its longer side, in the shares
 * the recipe asks for. Small buildings collapse to a single room rather than
 * producing cupboards nobody can walk into.
 */
export function cutRooms(kind: BuildingKind, size: { w: number; h: number }, _rng: Rng): RoomBox[] {
  const recipe = RECIPES[kind]
  const usable = recipe.filter((_, index) => index === 0 || roomFits(size, recipe.length))
  const total = usable.reduce((sum, room) => sum + room.share, 0)

  const horizontal = size.w >= size.h
  const boxes: RoomBox[] = []
  let offset = 0
  usable.forEach((room, index) => {
    const isLast = index === usable.length - 1
    const span = isLast
      ? (horizontal ? size.w : size.h) - offset
      : ((horizontal ? size.w : size.h) * room.share) / total
    boxes.push({
      kind: room.kind,
      name: room.name,
      rect: horizontal ? { x: offset, y: 0, w: span, h: size.h } : { x: 0, y: offset, w: size.w, h: span },
    })
    offset += span
  })
  return boxes
}

/** A room is only worth cutting if every part stays walkable. */
function roomFits(size: { w: number; h: number }, rooms: number): boolean {
  const longer = Math.max(size.w, size.h)
  return longer / rooms >= 3
}
