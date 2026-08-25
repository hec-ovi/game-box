import { DOORLAMP, SIGN, type LightEmitter as KitLight, type Sign } from '@gb/kitbash'
import * as THREE from 'three'
import { axesOf, type StreetFace } from './face.ts'

/**
 * Seats the signage `@gb/kitbash` wrote for a plot on the building the pack
 * actually drew.
 *
 * The kit writes a sign against the plot's own arithmetic: a door snapped to
 * its 2 m module, its own door's width and head, and a wall plane on the plot
 * boundary. A pack model centres its entrance on the front, at its own width
 * and head, and stands its fascia band, its screen plates and its parapet tube
 * a few centimetres off that plane. Hung as written, a door lamp lands beside
 * the drawn door and a nameplate lands in the same plane as the board it is
 * written on, which is a stipple of z-fighting rather than a sign.
 *
 * So each fixture is carried onto the surface it belongs to: the pair of door
 * lamps onto the drawn door, and everything laid flat onto the face the model
 * really has under it. Nothing else moves. The kit claims a patch of wall per
 * sign and leaves air round it, so a lamp seated on a wider door and a plate
 * slid onto its band both stay inside what was claimed.
 *
 * The mesh is one welded buffer for the whole building's signage, which is what
 * makes the town's signs one draw, so a vertex is carried by the sign whose
 * patch it stands in. `signsFor` is what `building` hangs and `lightsFor`
 * answers one per sign in the same order, so the meshes and the emitters take
 * the same seats.
 */
export class Fixtures {
  readonly #seats: readonly Seat[]

  private constructor(seats: readonly Seat[]) {
    this.#seats = seats
  }

  /** Where each of a plot's signs belongs on this face, in the order `signsFor` lists them. */
  static on(face: StreetFace, signs: readonly Sign[]): Fixtures {
    // the pair is read off its own middle rather than the plot's, so which side
    // each lamp stands on survives the move onto a door somewhere else
    const isLamp = (sign: Sign) => sign.kind === 'doorlamp' && laidOn(sign, face)
    const lamps = signs.filter(isLamp)
    const middle = lamps.length ? lamps.reduce((sum, lamp) => sum + along(lamp), 0) / lamps.length : 0
    return new Fixtures(signs.map((sign) => seatOf(sign, face, isLamp(sign) ? middle : undefined)))
  }

  /**
   * Which of the plot's signs a point in the building's frame belongs to, in
   * the order `signsFor` lists them, or nothing where it stands in none. The
   * kit claims a patch of wall per sign and leaves air round it, so a point is
   * in at most one.
   */
  holder(point: readonly [number, number, number]): number | undefined {
    const found = this.#seats.findIndex((seat) => holds(seat, point))
    return found < 0 ? undefined : found
  }

  /**
   * Carries every vertex of a building's signage onto the face its own sign
   * belongs on. The mesh may still carry the transform that brought it out of
   * the kit's building, so a vertex is read in the building's frame and written
   * back in its own.
   */
  seat(mesh: THREE.Mesh): void {
    mesh.updateMatrix()
    const inverse = mesh.matrix.clone().invert()
    const position = mesh.geometry.getAttribute('position')
    const read = new THREE.Vector3()
    for (let vertex = 0; vertex < position.count; vertex++) {
      read.fromBufferAttribute(position as THREE.BufferAttribute, vertex).applyMatrix4(mesh.matrix)
      const point: Point = [read.x, read.y, read.z]
      const at = this.holder(point)
      const seat = at === undefined ? undefined : this.#seats[at]
      if (!seat || !moved(seat)) continue
      carry(seat, point)
      read.set(point[0], point[1], point[2]).applyMatrix4(inverse)
      position.setXYZ(vertex, read.x, read.y, read.z)
    }
    position.needsUpdate = true
    mesh.geometry.computeBoundingBox()
    mesh.geometry.computeBoundingSphere()
  }

  /** The same seats under the lights those signs throw, so a lamp and its light stay together. */
  lit(emitters: readonly KitLight[]): KitLight[] {
    return emitters.map((emitter, index) => {
      const seat = this.#seats[index]
      if (!seat || !moved(seat)) return emitter
      const point: Point = [...emitter.position]
      carry(seat, point)
      return { ...emitter, position: point }
    })
  }
}

type Point = [number, number, number]

/** One sign's patch of wall, and the move that carries it onto the drawn face. */
interface Seat {
  readonly across: 'x' | 'z'
  readonly out: 'x' | 'z'
  readonly outward: 1 | -1
  /** The patch this sign's own vertices stand in, in the wall's own axes. */
  readonly holds: { readonly across: [number, number]; readonly up: [number, number]; readonly out: [number, number] }
  /** Metres along the wall, out of it, and up it. */
  readonly shift: readonly [number, number, number]
  /** A door lamp is stretched to the drawn door's head about its own foot; everything else keeps its size. */
  readonly stretch: { readonly from: number; readonly by: number } | undefined
}

/**
 * How much air a fixture may be slid through to sit inside the band it is
 * written on. A sign claims its patch of wall with room round it, so a slide
 * this small can never carry one through another.
 */
const SLIDE = 0.08

function seatOf(sign: Sign, face: StreetFace, pairAt: number | undefined): Seat {
  const { across, out, outward } = axesOf(sign.wall)
  const hung = sign.mount === 'hung'
  const a = along(sign)
  // the patch of wall the sign takes: a hung box claims its bracket, and its
  // width runs out over the street rather than along the wall
  const wide = (hung ? SIGN.foot : sign.width) / 2
  const patch = {
    across: [a - wide, a + wide] as [number, number],
    up: [sign.origin[1] - sign.height / 2, sign.origin[1] + sign.height / 2] as [number, number],
  }
  // where its nearest surface stands, which for a hung box is the inner edge of its panel
  const stood = offWall(sign) - (hung ? sign.width / 2 : 0) - face.plane
  const rest = {
    across,
    out,
    outward,
    holds: {
      across: [patch.across[0] - EDGE, patch.across[1] + EDGE] as [number, number],
      up: [patch.up[0] - EDGE, patch.up[1] + EDGE] as [number, number],
      out: [face.plane + stood - SIGN.stand - EDGE, face.plane + stood + (hung ? sign.width : 0) + SIGN.layer + EDGE] as [number, number],
    },
  }
  if (!laidOn(sign, face)) return { ...rest, shift: [0, 0, 0], stretch: undefined }
  return pairAt === undefined ? { ...rest, ...laid(sign, face, patch) } : { ...rest, ...lamp(sign, face, a, pairAt) }
}

/** A vertex may stand this far outside its own sign's patch: a letter is lifted off its panel and a bracket runs back to the wall. */
const EDGE = 0.02

/**
 * Whether this sign lies on the wall the entrance is on, which is what can be
 * carried onto the face the pack drew.
 *
 * A blade on a flank is the kit's own wall and its own arithmetic. A sign
 * standing further off than a panel does is not on the wall at all: the lit box
 * over a subway entrance stands out on the doorstep in front of it, and moving
 * it back would put it through the stairs.
 */
export function laidOn(sign: Sign, face: StreetFace): boolean {
  if (sign.wall !== face.wall) return false
  return Math.abs(offWall(sign) - (sign.mount === 'hung' ? sign.width / 2 : 0) - face.plane - SIGN.stand) <= EDGE
}

/**
 * A plate laid on the wall: pushed out onto whatever the model really has under
 * it, and slid inside the band it is written on where the two do not line up.
 * A hung box moves out with its bracket and is never slid, because it is read
 * along the street rather than off the wall it hangs from.
 */
function laid(sign: Sign, face: StreetFace, patch: { across: [number, number]; up: [number, number] }): Pick<Seat, 'shift' | 'stretch'> {
  const lift = sign.mount === 'hung' ? 0 : onBand(face, patch.across, patch.up)
  return { shift: [0, face.reliefUnder(patch.across, [patch.up[0] + lift, patch.up[1] + lift]), lift], stretch: undefined }
}

/** How far a plate has to be slid to sit inside the band it is written on, or nothing when it is not on one. */
function onBand(face: StreetFace, across: readonly [number, number], up: readonly [number, number]): number {
  const band = face.band
  if (!band) return 0
  const middle = band.position[axesOf(face.wall).across === 'x' ? 0 : 2]
  const [low, high] = [band.position[1] - band.height / 2, band.position[1] + band.height / 2]
  if (across[0] < middle - band.width / 2 || across[1] > middle + band.width / 2) return 0
  if (Math.min(up[1], high) - Math.max(up[0], low) < (up[1] - up[0]) / 2) return 0
  if (up[1] > high) return -Math.min(up[1] - high, SLIDE)
  if (up[0] < low) return Math.min(low - up[0], SLIDE)
  return 0
}

/**
 * A door lamp: the pair straddles the drawn door at `DOORLAMP.beside` outside
 * its frame and runs from its own foot to the drawn door's head.
 */
function lamp(sign: Sign, face: StreetFace, a: number, pairAt: number): Pick<Seat, 'shift' | 'stretch'> {
  const door = face.door
  if (!door) return { shift: [0, 0, 0], stretch: undefined }
  const side = a < pairAt ? -1 : 1
  const middle = door.position[axesOf(face.wall).across === 'x' ? 0 : 2]
  const to = middle + side * (door.width / 2 + DOORLAMP.beside + DOORLAMP.width / 2)
  const foot = sign.origin[1] - sign.height / 2
  const head = door.position[1] + door.height / 2 + DOORLAMP.overhead
  const relief = face.reliefUnder([to - DOORLAMP.width / 2, to + DOORLAMP.width / 2], [foot, head])
  return { shift: [to - a, relief, 0], stretch: { from: foot, by: (head - foot) / sign.height } }
}

/** Where a sign sits along its wall, in the building's own frame. */
function along(sign: Sign): number {
  return sign.origin[axesOf(sign.wall).across === 'x' ? 0 : 2]
}

/** How far a sign stands off its wall, along that wall's outward normal. */
function offWall(sign: Sign): number {
  const { out, outward } = axesOf(sign.wall)
  return sign.origin[out === 'x' ? 0 : 2] * outward
}

function moved(seat: Seat): boolean {
  return seat.stretch !== undefined || seat.shift.some((metres) => metres !== 0)
}

function holds(seat: Seat, point: readonly [number, number, number]): boolean {
  const a = point[seat.across === 'x' ? 0 : 2]
  const w = point[seat.out === 'x' ? 0 : 2] * seat.outward
  return a >= seat.holds.across[0] && a <= seat.holds.across[1] && point[1] >= seat.holds.up[0] && point[1] <= seat.holds.up[1] && w >= seat.holds.out[0] && w <= seat.holds.out[1]
}

function carry(seat: Seat, point: Point): void {
  const acrossAt = seat.across === 'x' ? 0 : 2
  const outAt = seat.out === 'x' ? 0 : 2
  point[acrossAt] += seat.shift[0]
  point[outAt] += seat.shift[1] * seat.outward
  point[1] = (seat.stretch ? seat.stretch.from + (point[1] - seat.stretch.from) * seat.stretch.by : point[1]) + seat.shift[2]
}
