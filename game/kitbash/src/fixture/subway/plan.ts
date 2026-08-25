import type { Plot } from '@gb/world'
import { doorstepOf, type Face } from '../../compose/faces.ts'
import { TRANSIT } from '../../sign/palette.ts'
import { SIGN, type Sign } from '../../sign/sign.ts'
import { across, lettersOf } from '../../sign/text.ts'
import type { Standing } from '../fixture.ts'
import { standing } from '../shape.ts'
import { SUBWAY, wellOf } from './design.ts'
import { signCentre } from './model.ts'

/** Where a station's subway entrance stands: on the doorstep cell, its mouth opening onto the street. */
export interface SubwayEntrance extends Standing {
  readonly cellSize: number
}

/**
 * The entrance stands on the plot's own doorstep, which is the cell the world
 * marks as where fast travel boards, turned the way the front wall looks so
 * the stairs are walked into from the street and the sign reads from it.
 */
export function planSubway(plot: Plot, front: Face, cellSize: number): SubwayEntrance {
  const [x, z] = doorstepOf(plot, cellSize)
  return { position: [x, 0, z], rotationY: front.rotationY, cellSize }
}

/**
 * The lit panel over the back wall, spelling the word the charter gave the
 * place, in the one colour every station in the town wears: a station is
 * wayfinding, so it is the same sign everywhere.
 */
export function subwaySign(entrance: SubwayEntrance, word: string, front: Face): Sign {
  const { width, length } = wellOf(entrance.cellSize)
  const wide = width + 2 * SUBWAY.well.wall - 2 * SUBWAY.sign.housing
  const tall = SUBWAY.sign.height
  const face = -(length + SUBWAY.well.wall) / 2 + SUBWAY.sign.depth / 2 + SIGN.layer
  return {
    kind: 'subway',
    wall: front.id,
    mount: 'flat',
    origin: standing(entrance.position, entrance.rotationY, [0, signCentre(), face]),
    right: front.right,
    width: wide,
    height: tall,
    ink: TRANSIT.ink,
    panel: 0x0b0e16,
    glow: [TRANSIT.glow, 0],
    glyphs: across(lettersOf(word), wide, tall),
  }
}
