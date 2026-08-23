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
export const ROOM_ATTRIBUTES = { offset: 'roomOffset', size: 'roomSize', look: 'roomLook' } as const

/**
 * Writes a room onto every vertex of one pane.
 *
 * The pane carries where it sits inside its own room rather than where the room
 * is, so the numbers stay true wherever the building ends up. A vertex position
 * moves when the city batches its buildings into shared buffers; the distance
 * from a pane to the middle of its own window wall does not.
 */
export function bakeRoom(pane: THREE.BufferGeometry, room: Room): void {
  const position = pane.getAttribute('position')
  const offset = new Float32Array(position.count * 3)
  for (let at = 0; at < position.count; at++) {
    offset[at * 3] = position.getX(at) - room.centre[0]
    offset[at * 3 + 1] = position.getY(at) - room.centre[1]
    offset[at * 3 + 2] = position.getZ(at) - room.centre[2]
  }
  pane.setAttribute(ROOM_ATTRIBUTES.offset, new THREE.BufferAttribute(offset, 3))
  pane.setAttribute(ROOM_ATTRIBUTES.size, filled(position.count, room.size))
  pane.setAttribute(ROOM_ATTRIBUTES.look, filled(position.count, [room.key, room.look[0], room.look[1]]))
}

function filled(count: number, value: readonly number[]): THREE.BufferAttribute {
  const array = new Float32Array(count * value.length)
  for (let at = 0; at < array.length; at++) array[at] = value[at % value.length]!
  return new THREE.BufferAttribute(array, value.length)
}
