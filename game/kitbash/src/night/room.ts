import * as THREE from 'three'

/**
 * The room one window looks into. It is never geometry: the pane carries these
 * numbers per vertex and the glass material raymarches the box behind them, so
 * a furnished interior with a floor, a back wall and depth costs no triangles
 * and no extra draw.
 *
 * Neighbouring windows on the same storey share one room, which is why a run of
 * panes lights up together and shows the same furniture from two angles.
 */
export interface Room {
  /** Centre of the room's window wall, in the building's own frame. */
  readonly centre: readonly [number, number, number]
  /** How wide the room is across the wall, and how tall, in metres. */
  readonly size: readonly [number, number]
  /**
   * When the lights come on: the room is lit while the city's lit share is
   * above this. Low keys stay lit all night, high ones only in the evening.
   */
  readonly key: number
  /** Two numbers that pick the paint, the floor, the furniture and the bulb. */
  readonly look: readonly [number, number]
}

/** The attributes a pane carries, and what the glass material reads them as. */
export const ROOM_ATTRIBUTES = { centre: 'roomCentre', size: 'roomSize', look: 'roomLook' } as const

/** Writes a room onto every vertex of one pane. */
export function bakeRoom(pane: THREE.BufferGeometry, room: Room): void {
  const count = pane.getAttribute('position').count
  pane.setAttribute(ROOM_ATTRIBUTES.centre, filled(count, room.centre))
  pane.setAttribute(ROOM_ATTRIBUTES.size, filled(count, room.size))
  pane.setAttribute(ROOM_ATTRIBUTES.look, filled(count, [room.key, room.look[0], room.look[1]]))
}

function filled(count: number, value: readonly number[]): THREE.BufferAttribute {
  const array = new Float32Array(count * value.length)
  for (let at = 0; at < array.length; at++) array[at] = value[at % value.length]!
  return new THREE.BufferAttribute(array, value.length)
}
