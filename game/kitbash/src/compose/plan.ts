import { Rng } from '@gb/kit'
import type { Plot } from '@gb/world'
import { isGlazed, MODULE, type PieceId } from '../catalog/pieces.ts'
import { RECIPES, type Course } from '../catalog/recipes.ts'
import type { Room } from '../night/room.ts'
import { planSigns } from '../sign/plan.ts'
import type { Sign } from '../sign/sign.ts'
import { bandsOf, type Band } from './bands.ts'
import { doorModule, entranceFace, facesOf, type Face } from './faces.ts'
import { roomsAcross } from './rooms.ts'

/** One kit piece, placed in the building's own frame: origin at the centre of its base. */
export interface Placement {
  readonly piece: PieceId
  readonly position: readonly [number, number, number]
  readonly rotationY: number
  readonly scale: readonly [number, number, number]
  /** The room its glass looks into, when it has glass in it. */
  readonly room?: Room
}

export interface BuildingSize {
  readonly width: number
  readonly depth: number
  readonly height: number
}

export interface BuildingPlan {
  readonly placements: readonly Placement[]
  /** Middle of the doorway on the wall plane, and the way it looks out. */
  readonly door: { readonly position: readonly [number, number, number]; readonly rotationY: number }
  /** Every lit sign hung on it, in the building's own frame. */
  readonly signs: readonly Sign[]
}

/**
 * Turns a plot into the pieces that build it: walls module by module on every
 * face, the door on the face the entrance says, a flat deck on top, the room
 * every glazed module looks into, and the signs hung on its walls.
 *
 * Every draw comes from the plot's own seed, forked per feature, so the same
 * plot is the same building every time and adding a feature here cannot move
 * the windows an existing city already has.
 */
export function planBuilding(plot: Plot, size: BuildingSize, cellSize: number): BuildingPlan {
  const recipe = RECIPES[plot.kind]
  const rng = new Rng(`${plot.id}:${plot.kind}:${plot.style}`)
  const rhythm = rng.fork('rhythm')
  const interiors = rng.fork('rooms')
  const signage = rng.fork('signs')
  const faces = facesOf(size.width, size.depth, MODULE.width)
  const bands = bandsOf(plot.storeys, size.height)
  const front = faces[entranceFace(plot)]
  const doorIndex = doorModule(plot, front, cellSize)
  const [doorX, doorZ] = front.centreOf(doorIndex)
  const placements: Placement[] = []

  for (const face of Object.values(faces)) {
    const phase = rhythm.int(0, 3)
    const doorAt = face.id === front.id ? doorIndex : -1
    for (const [storey, band] of bands.entries()) {
      const street = storey === 0
      const course = !street ? recipe.upper : face.id === front.id ? recipe.street : recipe.flank
      const crowning = recipe.crown !== undefined && !street && storey === bands.length - 1
      const rooms = roomsAcross(face, band, interiors)
      for (let module = 0; module < face.modules; module++) {
        const piece = module === doorAt && street
          ? recipe.door
          : pieceFor(course, face, module, phase, street, crowning ? recipe.crown : undefined)
        placements.push(...wall(face, band, module, piece, rooms[module]!, street ? recipe.fascia : undefined))
      }
    }
  }
  placements.push(...deck(size))
  const signs = planSigns(plot, size.height, Object.values(faces), front, doorIndex, bands, signage)
  return { placements, door: { position: [doorX, 0, doorZ], rotationY: front.rotationY }, signs }
}

/**
 * A window unless the rhythm says wall here. Upper storeys keep their corner
 * modules solid, so the building has a pier where two walls meet; street level
 * does not, because a corner shop glazes right round the corner.
 */
function pieceFor(course: Course, face: Face, module: number, phase: number, street: boolean, crown: PieceId | undefined): PieceId {
  const pier = !street && face.modules >= 3 && (module === 0 || module === face.modules - 1)
  const open = !pier && (module + phase) % course.rhythm === 0
  return open ? course.window : (crown ?? course.plain)
}

/**
 * One module of one band: the 3 m piece, and above it on the ground floor the
 * metre-tall band that closes the storey. The same band goes on every ground
 * module of every face, including over the door, so it reads as one course
 * round the building rather than a run of patches.
 */
function wall(face: Face, band: Band, module: number, piece: PieceId, room: Room, fascia: PieceId | undefined): Placement[] {
  const [x, z] = face.centreOf(module)
  const across = face.moduleWidth / MODULE.width
  const closer = fascia ? band.height - MODULE.height : 0
  const wallHeight = closer > 0 ? MODULE.height : band.height
  const out: Placement[] = [{
    piece,
    position: [x, band.base, z],
    rotationY: face.rotationY,
    scale: [across, wallHeight / MODULE.height, 1],
    ...(isGlazed(piece) ? { room } : {}),
  }]
  if (fascia && closer > 0) {
    out.push({
      piece: fascia,
      position: [x, band.base + MODULE.height, z],
      rotationY: face.rotationY,
      scale: [across, closer / MODULE.band, 1],
    })
  }
  return out
}

/** The flat roof, tiled across the footprint and sunk 0.2 m so the walls stand round it as a parapet. */
function deck(size: BuildingSize): Placement[] {
  const across = Math.max(1, Math.round(size.width / MODULE.width))
  const along = Math.max(1, Math.round(size.depth / MODULE.width))
  const [stepX, stepZ] = [size.width / across, size.depth / along]
  const out: Placement[] = []
  for (let ix = 0; ix < across; ix++) {
    for (let iz = 0; iz < along; iz++) {
      out.push({
        piece: 'Roof_2x2',
        position: [-size.width / 2 + (ix + 0.5) * stepX, size.height, -size.depth / 2 + (iz + 0.5) * stepZ],
        rotationY: 0,
        scale: [stepX / MODULE.width, 1, stepZ / MODULE.width],
      })
    }
  }
  return out
}
