import { footprintOf, type Interior } from '@gb/world'

/**
 * The room a camera watches, as a camera feed draws it: the room's rectangle,
 * every piece of furniture standing in it as a box, and where the camera is.
 * Arithmetic on the world document and nothing else, so a feed can be checked
 * without building anything.
 */
export interface Schematic {
  readonly roomId: string
  readonly rect: { readonly x: number; readonly y: number; readonly w: number; readonly h: number }
  readonly pieces: readonly { x: number; y: number; width: number; depth: number; rot: number }[]
  readonly camera: { readonly x: number; readonly y: number }
}

/** What the camera in this interior sees, or nothing when the interior hangs no camera. */
export function watchedBy(interior: Interior): Schematic | undefined {
  const camera = interior.furniture.find((piece) => piece.watches)
  const room = camera && interior.rooms.find((room) => room.id === camera.watches)
  if (!camera || !room) return undefined

  return {
    roomId: room.id,
    rect: room.rect,
    pieces: interior.furniture
      .filter((piece) => piece.roomId === room.id && piece.id !== camera.id)
      .map((piece) => ({ x: piece.pos.x, y: piece.pos.y, ...footprintOf(piece.prop), rot: piece.rot })),
    camera: { x: camera.pos.x, y: camera.pos.y },
  }
}
