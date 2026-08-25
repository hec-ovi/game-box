/**
 * One room's walls, as one buffer.
 *
 * Every bay of every wall of every room in an interior is drawn into the one
 * `Solid` the room hands over, so a whole building's worth of panelling,
 * recesses, shelves, grilles, strips and windows shares one indexed mesh on
 * the one shared material with everything else the room prints: one draw,
 * whatever the count. Adding bay kinds or making the rhythm finer costs
 * triangles, never draws.
 *
 * The bay itself is drawn in a frame of its own (across, up, out of the wall)
 * and put on the wall by a matrix, so nothing in `draw.ts` knows which way a
 * wall faces.
 */
import { Rng } from '@gb/kit'
import type { Interior } from '@gb/world'
import * as THREE from 'three'
import type { Solid } from '../build/solid.ts'
import type { RoomDress } from '../dress.ts'
import { variantOf } from '../style/variant.ts'
import { BAY_SPECS, type BayKind } from './bays.ts'
import { BAY_DRAWS, drawRail, type BayFrame } from './draw.ts'
import { planInterior } from './plan.ts'
import type { Side, TopOf, WallRun } from './runs.ts'

/** Which prop kind the wall variation is drawn for: the wall is a kind like any other. */
const WALL_KIND = 'wall'

/** One bay as it stands in the room, in interior metres. */
export interface PlacedBay {
  readonly kind: BayKind
  readonly roomId: string
  readonly side: Side
  /** Where the face of the wall is: z for a north or south wall, x for the others. */
  readonly face: number
  /** The stretch of the wall it claims, along the wall's own axis. */
  readonly from: number
  readonly to: number
  /** How many 10 cm cells that is. */
  readonly cells: number
  /** Metres it stands off the face of the wall. */
  readonly depth: number
}

export interface BuiltWalls {
  readonly bays: readonly PlacedBay[]
  /** Every height in this room a body can put something down on, exactly. */
  readonly contacts: readonly number[]
}

const UP = new THREE.Vector3(0, 1, 0)
const ONE = new THREE.Vector3(1, 1, 1)

/** Which way a bay's own +z (out of the wall) points, as a turn about +Y. */
const YAW: Record<Side, number> = {
  north: 0,
  south: Math.PI,
  west: Math.PI / 2,
  east: -Math.PI / 2,
}

export function buildWalls(solid: Solid, interior: Interior, dress: RoomDress, seed: string, topOf: TopOf): BuiltWalls {
  const variant = variantOf(dress.style, WALL_KIND, seed)
  const decor = new Rng(seed).fork('furnish').fork('wall-decor').fork(dress.style).fork(interior.id)
  const bays: PlacedBay[] = []
  const contacts = new Set<number>()
  const standsOn = (height: number): void => void contacts.add(height)

  for (const planned of planInterior(interior, dress, seed, topOf)) {
    const { run } = planned

    for (const [at, band] of planned.bands.entries()) {
      const frame: BayFrame = {
        half: (band.to - band.from) / 2,
        variant,
        rng: decor.fork(`rail/${run.roomId}/${run.side}/${at}`),
        standsOn,
      }
      solid.in(placeAt(run, (band.from + band.to) / 2), () => drawRail(solid, frame))
    }

    for (const bay of planned.bays) {
      bays.push({
        kind: bay.kind,
        roomId: run.roomId,
        side: run.side,
        face: run.face,
        from: bay.from,
        to: bay.to,
        cells: bay.cells,
        depth: BAY_SPECS[bay.kind].depth,
      })
      const draw = BAY_DRAWS[bay.kind]
      if (!draw) continue

      const frame: BayFrame = {
        half: (bay.to - bay.from) / 2,
        variant,
        rng: decor.fork(bay.label),
        standsOn,
      }
      solid.in(placeAt(run, (bay.from + bay.to) / 2), () => draw(solid, frame))
    }
  }

  return { bays, contacts: [...contacts].sort((one, two) => one - two) }
}

/** A bay's own frame, standing on the wall at `along` metres down the run. */
function placeAt(run: WallRun, along: number): THREE.Matrix4 {
  const across = run.side === 'north' || run.side === 'south'
  const position = across ? new THREE.Vector3(along, 0, run.face) : new THREE.Vector3(run.face, 0, along)
  return new THREE.Matrix4().compose(
    position,
    new THREE.Quaternion().setFromAxisAngle(UP, YAW[run.side]),
    ONE,
  )
}
