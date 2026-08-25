import type { Interior } from '@gb/world'

/**
 * Which rooms dance.
 *
 * The room use `@gb/world` is asked for in HANDOVERS row 228. Until it lands,
 * a room dances because somebody in it does: `@gb/forge` stands `dance`
 * anchors on a taproom's open floor wherever the town's story calls for it, so
 * the anchors are the fact the dressing reads.
 */
export const DANCE_FLOOR = 'dance-floor'

type Room = Interior['rooms'][number]
export type Anchor = Interior['anchors'][number]

/** The dancers stationed in one room. */
export function dancersIn(interior: Interior, room: Room): Anchor[] {
  return interior.anchors.filter((anchor) => anchor.roomId === room.id && anchor.kind === 'dance')
}

/** Whether a room is a dance floor: by its use, or by the people dancing in it. */
export function dancesIn(interior: Interior, room: Room): boolean {
  return (room.use as string) === DANCE_FLOOR || dancersIn(interior, room).length > 0
}
