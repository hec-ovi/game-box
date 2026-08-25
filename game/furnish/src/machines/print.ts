import { Rng } from '@gb/kit'
import { PROP_SPECS, type Interior, type MachineProgram } from '@gb/world'
import * as THREE from 'three'
import type { Solid } from '../build/solid.ts'
import { PANELS, glassFrame, glassOf, isMachine } from './panel.ts'
import { PROGRAMS } from './programs/index.ts'
import { watchedBy } from './schematic.ts'

/**
 * What every screen in a room is showing, printed on its glass.
 *
 * A machine prop is one shared buffer with lit, idle glass. Its program is
 * this interior's own: it is drawn here, into the room's own geometry, in the
 * glass's frame at the piece's position, lift and turn, so a room of terminals
 * costs one buffer for the machines and a few dozen triangles a screen for
 * what is on them. Nothing is a texture and nothing is a file.
 */
export interface Printed {
  readonly machineId: string
  readonly propId: string
  readonly program: MachineProgram
}

const UP = new THREE.Vector3(0, 1, 0)
const ONE = new THREE.Vector3(1, 1, 1)

export function printScreens(solid: Solid, interior: Interior, seed: string): Printed[] {
  const printed: Printed[] = []
  const watched = watchedBy(interior)
  const root = new Rng(seed).fork('furnish').fork('screens').fork(interior.id)

  for (const piece of interior.furniture) {
    if (!piece.machine || !isMachine(piece.prop)) continue
    const top = PROP_SPECS[piece.prop].height ?? 0
    const glass = glassOf(PANELS[piece.prop], top)
    const frame = placeOf(piece).multiply(glassFrame(piece.prop, top))
    const program = piece.machine.program

    solid.in(frame, () =>
      PROGRAMS[program]({
        solid,
        width: glass.width,
        height: glass.height,
        program,
        rng: root.fork(piece.machine!.id),
        watched: program === 'camera-feed' ? watched : undefined,
      }),
    )
    printed.push({ machineId: piece.machine.id, propId: piece.id, program })
  }
  return printed
}

/** Where a piece stands in the interior, the way `@gb/scene` places it: at its position and lift, turned by its compass heading. */
function placeOf(piece: Interior['furniture'][number]): THREE.Matrix4 {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(piece.pos.x, piece.lift ?? 0, piece.pos.y),
    new THREE.Quaternion().setFromAxisAngle(UP, (-piece.rot * Math.PI) / 180),
    ONE,
  )
}
